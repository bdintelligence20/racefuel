import './firebase';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as crypto from 'crypto';
import {
  createPaymentLink,
  registerWebhook,
  registerRedirectUrl,
  type StitchConfig,
  type PaymentLink,
} from './stitch-client';
import {
  createOrder,
  type ShopifyConfig,
  type CreateOrderInput,
} from './shopify-client';
import {
  tryResolveCoupon,
  recordCouponRedemption,
  type ResolvedDiscount,
} from './coupons';
import { resolveAllowedOrigin } from './cors';

/**
 * End-to-end checkout flow (Stitch Express + Shopify).
 *
 *   SPA            createCheckout fn        Stitch Express        stitchWebhook fn          Shopify
 *    │── POST cart ──▶ ① write 'pending'
 *    │                 ② getToken (cached 15m)
 *    │                 ③ POST /payment-links ──▶
 *    │                                          ◀── { id, link, status:PENDING }
 *    │ ◀─ link + id ────
 *    ├── browser to link ───────────────────▶ user pays
 *    │                                          │ (signed webhook POST)
 *    │                                          └────▶ ④ verify HMAC-SHA256 signature
 *    │                                                  ⑤ flip 'pending' → 'paid'
 *    │                                                  ⑥ create Shopify order ──▶ ✓
 *    │                                                  ⑦ flip → 'placed'
 *    │ ◀── redirect to /payment-callback?orderId=…
 *    │ ◀── subscribe to /orders/:id Firestore doc for the final 'placed' state
 */

// Live Stitch creds — switched from STITCH_CLIENT_ID_TEST after the test
// secret's signing key drifted out of sync with what Stitch was actually
// signing webhooks with (every webhook returned 401 'Bad webhook
// signature', leaving paid orders stuck at 'pending' in Firestore).
const STITCH_CLIENT_ID = defineSecret('STITCH_CLIENT_ID');
const STITCH_CLIENT_SECRET = defineSecret('STITCH_CLIENT_SECRET');
const STITCH_WEBHOOK_SECRET = defineSecret('STITCH_WEBHOOK_SECRET');

const SHOPIFY_ADMIN_TOKEN = defineSecret('SHOPIFY_ADMIN_TOKEN');
const SHOPIFY_STORE_URL = defineSecret('SHOPIFY_STORE_URL');

const PROJECT_ID = 'promogroup';
const SELF_BASE_URL = 'https://us-central1-promogroup.cloudfunctions.net';
const SPA_PAYMENT_CALLBACK = 'https://fuelcue.com/payment-callback';

const sm = new SecretManagerServiceClient();

/* ------------------------ types ------------------------ */

interface CheckoutPayload {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  shippingAddress: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    country: string;
    zip: string;
  };
  lineItems: Array<{
    variantId: number;
    quantity: number;
    title: string;
    unitPrice: number; // ZAR major units
  }>;
  /** Flat shipping rate the SPA computed (R140 under R999, free above).
   *  Source of truth for the rate is the SPA — we just attach it here so
   *  Stitch charges the right total and Shopify shows the right shipping
   *  line on the order. Optional for backward compat with old SPAs. */
  shippingLine?: {
    title: string;
    priceZAR: number;
  };
  /** Optional coupon code the athlete applied in the cart. The server
   *  re-validates against Firestore — never trust the client's discount math. */
  coupon?: { code: string };
}

/* ------------------------ helpers ------------------------ */

function corsHeaders(origin: string | undefined): Record<string, string> {
  const o = resolveAllowedOrigin(origin);
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '3600',
    Vary: 'Origin',
  };
}

function applyCors(req: any, res: any) {
  const origin = req.get('origin');
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.set(k, v);
}

function totalZar(lineItems: CheckoutPayload['lineItems']): number {
  return lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);
}

/** Subtotal + shipping − discount. Stitch must charge this — paying just the
 *  line items total leaves Fuel Lab eating the courier fee, and skipping the
 *  discount means the athlete's coupon never reached the rails. */
function grandTotalZar(p: CheckoutPayload, discount: ResolvedDiscount | null): number {
  const subtotal = totalZar(p.lineItems);
  const shipping = discount?.freeShipping ? 0 : (p.shippingLine?.priceZAR ?? 0);
  const off = discount?.amountOffSubtotalZAR ?? 0;
  return Math.max(0, subtotal - off + shipping);
}

/* ------------------------ createCheckout ------------------------ */

export const createCheckout = onRequest(
  {
    region: 'us-central1',
    secrets: [STITCH_CLIENT_ID, STITCH_CLIENT_SECRET],
    cors: false,
  },
  async (req, res) => {
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method-not-allowed' });
      return;
    }

    const payload = req.body as CheckoutPayload;
    const errs = validateCheckout(payload);
    if (errs.length) {
      res.status(400).json({ error: 'invalid-payload', details: errs });
      return;
    }

    const fs = getFirestore();
    const orderRef = fs.collection('orders').doc();
    const orderId = orderRef.id;
    const subtotal = totalZar(payload.lineItems);

    // Server-side coupon resolution — never trust the SPA's discount math.
    // If the code became invalid between cart and submit (expired, hit usage
    // cap, etc.), we silently drop it; the SPA will see the unsold-out total
    // on the next redirect and can re-prompt.
    const discount = await tryResolveCoupon(payload.coupon?.code, subtotal);

    const baseShipping = payload.shippingLine?.priceZAR ?? 0;
    const shippingZar = discount?.freeShipping ? 0 : baseShipping;
    const total = grandTotalZar(payload, discount);

    await orderRef.set({
      status: 'pending',
      customer: payload.customer,
      shippingAddress: payload.shippingAddress,
      lineItems: payload.lineItems,
      shippingLine: discount?.freeShipping && payload.shippingLine
        ? { ...payload.shippingLine, priceZAR: 0, title: `${payload.shippingLine.title} (coupon)` }
        : (payload.shippingLine ?? null),
      coupon: discount
        ? {
            code: discount.code,
            type: discount.type,
            value: discount.value,
            amountOffSubtotalZAR: discount.amountOffSubtotalZAR,
            freeShipping: discount.freeShipping,
            description: discount.description,
          }
        : null,
      amount: {
        currency: 'ZAR',
        subtotal,
        shipping: shippingZar,
        discount: discount?.amountOffSubtotalZAR ?? 0,
        total,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const cfg: StitchConfig = {
      clientId: STITCH_CLIENT_ID.value(),
      clientSecret: STITCH_CLIENT_SECRET.value(),
    };

    let link: PaymentLink;
    try {
      link = await createPaymentLink(cfg, {
        amountZar: total,
        // merchantReference must be alphanumeric+space+hyphen, ≤50 chars.
        // Firestore doc ids are 20 chars alphanumeric — perfect fit.
        merchantReference: `fuelcue-${orderId}`,
        payerName: `${payload.customer.firstName} ${payload.customer.lastName}`.trim(),
        payerEmailAddress: payload.customer.email,
        payerPhoneNumber: payload.customer.phone,
      });
    } catch (err) {
      logger.error('Stitch Express payment-link create failed', { orderId, err: String(err) });
      await orderRef.update({
        status: 'failed',
        failureReason: 'stitch-init-failed',
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(502).json({ error: 'payment-init-failed' });
      return;
    }

    // Append our redirect URL so Stitch knows where to send the user after they
    // pay. Per Stitch Express docs, redirect URLs must be pre-registered (we do
    // that one-time via stitchRegisterWebhook) — only allowlisted origins are
    // accepted.
    const redirectUri = `${SPA_PAYMENT_CALLBACK}?orderId=${orderId}`;
    const fullUrl = `${link.link}?redirect_uri=${encodeURIComponent(redirectUri)}`;

    await orderRef.update({
      stitch: {
        paymentLinkId: link.id,
        paymentUrl: link.link,
        merchantReference: link.merchantReference,
        redirectUri,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ orderId, paymentUrl: fullUrl });
  }
);

function validateCheckout(p: CheckoutPayload | undefined): string[] {
  const errs: string[] = [];
  if (!p) return ['missing-body'];
  if (!p.customer?.firstName?.trim()) errs.push('customer.firstName');
  if (!p.customer?.lastName?.trim()) errs.push('customer.lastName');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.customer?.email ?? '')) errs.push('customer.email');
  if (!p.shippingAddress?.address1?.trim()) errs.push('shippingAddress.address1');
  if (!p.shippingAddress?.city?.trim()) errs.push('shippingAddress.city');
  if (!p.shippingAddress?.zip?.trim()) errs.push('shippingAddress.zip');
  if (!Array.isArray(p.lineItems) || p.lineItems.length === 0) errs.push('lineItems');
  for (const li of p.lineItems ?? []) {
    if (!li.variantId || !Number.isFinite(li.variantId)) errs.push('lineItems.variantId');
    if (!li.quantity || li.quantity < 1) errs.push('lineItems.quantity');
    if (!Number.isFinite(li.unitPrice) || li.unitPrice < 0) errs.push('lineItems.unitPrice');
  }
  if (p.shippingLine) {
    if (typeof p.shippingLine.title !== 'string' || !p.shippingLine.title.trim()) {
      errs.push('shippingLine.title');
    }
    if (!Number.isFinite(p.shippingLine.priceZAR) || p.shippingLine.priceZAR < 0) {
      errs.push('shippingLine.priceZAR');
    }
  }
  if (p.coupon !== undefined) {
    if (typeof p.coupon !== 'object' || p.coupon === null || typeof p.coupon.code !== 'string') {
      errs.push('coupon.code');
    }
  }
  return errs;
}

/* ------------------------ stitchWebhook ------------------------ */

interface StitchExpressWebhookEvent {
  /** Event type, e.g. "payment_link.paid" or "payment_link.cancelled".
   *  The exact field names are observed empirically; logged on first arrival
   *  so we can tighten this typing once we see real payloads. */
  event?: string;
  type?: string;
  data?: {
    paymentLink?: {
      id: string;
      status: 'PAID' | 'CANCELLED' | 'EXPIRED' | 'PENDING';
      merchantReference?: string;
      amount?: number;
      paidAt?: string;
    };
    payment?: {
      id: string;
      status: string;
      amount?: number;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

function verifyStitchSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  // Stitch Express signs webhooks with HMAC-SHA256 of the raw body using the
  // secret returned at webhook registration time. Header is X-Stitch-Signature.
  // Secret may be plain or base64 — trying both in turn.
  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  if (constantTimeEquals(signature, computed)) return true;
  // Fallback: treat secret as base64
  try {
    const secretBuf = Buffer.from(secret, 'base64');
    const computedB = crypto.createHmac('sha256', secretBuf).update(rawBody, 'utf8').digest('hex');
    if (constantTimeEquals(signature, computedB)) return true;
  } catch { /* not base64 */ }
  return false;
}

function constantTimeEquals(a: string, b: string): boolean {
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export const stitchWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [STITCH_WEBHOOK_SECRET, SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE_URL],
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('method-not-allowed');
      return;
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      logger.error('Webhook missing rawBody');
      res.status(400).send('no-raw-body');
      return;
    }

    const signature = String(req.get('x-stitch-signature') ?? req.get('stitch-signature') ?? '');
    const webhookSecret = STITCH_WEBHOOK_SECRET.value();

    // For dev/setup, allow signature bypass when the placeholder secret is in
    // play — that means the webhook hasn't been registered yet and we want to
    // see what Stitch actually sends so we can tighten verification later.
    const isPlaceholderSecret = webhookSecret.startsWith('placeholder-');
    if (!isPlaceholderSecret) {
      if (!verifyStitchSignature(rawBody.toString('utf8'), signature, webhookSecret)) {
        logger.warn('Bad webhook signature', {
          providedSignature: signature.slice(0, 20),
        });
        res.status(401).send('bad-signature');
        return;
      }
    } else {
      logger.warn('Webhook secret is still placeholder — accepting unsigned webhook for inspection', {
        signature: signature.slice(0, 20),
        bodyPreview: rawBody.toString('utf8').slice(0, 400),
      });
    }

    let parsed: StitchExpressWebhookEvent;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).send('bad-json');
      return;
    }

    logger.info('Stitch webhook received', {
      event: parsed.event ?? parsed.type,
      bodyShape: JSON.stringify(parsed).slice(0, 800),
    });

    // Pull the payment-link node out — handle a couple of shapes since Stitch
    // Express's webhook payload schema isn't fully documented.
    const pl = parsed.data?.paymentLink ?? (parsed as any).paymentLink ?? null;
    if (!pl?.id || !pl?.status) {
      logger.warn('Webhook payload had no paymentLink with id+status — ignoring', {
        body: JSON.stringify(parsed).slice(0, 600),
      });
      res.status(200).send('ignored-no-payment-link');
      return;
    }

    // Recover our internal orderId from the merchantReference.
    // We always send `fuelcue-<orderId>`.
    const merchantRef = pl.merchantReference ?? '';
    const orderId = merchantRef.startsWith('fuelcue-')
      ? merchantRef.slice('fuelcue-'.length)
      : null;

    if (!orderId) {
      logger.warn('Webhook merchantReference missing or unrecognised', { merchantRef });
      res.status(200).send('ignored-bad-ref');
      return;
    }

    const fs = getFirestore();
    const orderRef = fs.collection('orders').doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      logger.warn('Webhook for unknown order', { orderId });
      res.status(200).send('ignored-unknown-order');
      return;
    }

    if (pl.status === 'CANCELLED') {
      await orderRef.update({
        status: 'cancelled',
        stitch: { ...snap.data()?.stitch, state: 'cancelled', completedAt: FieldValue.serverTimestamp() },
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('cancelled');
      return;
    }
    if (pl.status === 'EXPIRED') {
      await orderRef.update({
        status: 'failed',
        failureReason: 'expired',
        stitch: { ...snap.data()?.stitch, state: 'expired', completedAt: FieldValue.serverTimestamp() },
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('expired');
      return;
    }
    if (pl.status !== 'PAID') {
      // PENDING — webhook fired for a non-terminal state, ignore.
      res.status(200).send('ignored-not-paid');
      return;
    }

    // Idempotency: skip Shopify creation if we've already done it.
    const data = snap.data()!;
    if (data.shopify?.orderId) {
      logger.info('Order already placed in Shopify — webhook duplicate', { orderId });
      res.status(200).send('already-placed');
      return;
    }

    await orderRef.update({
      status: 'paid',
      stitch: {
        ...data.stitch,
        state: 'completed',
        completedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    const shopifyCfg: ShopifyConfig = {
      storeUrl: SHOPIFY_STORE_URL.value(),
      accessToken: SHOPIFY_ADMIN_TOKEN.value(),
    };

    const persistedCoupon = data.coupon as
      | {
          code: string;
          type: 'percent' | 'fixed' | 'freeShipping';
          value: number;
          amountOffSubtotalZAR: number;
          freeShipping: boolean;
          description: string | null;
        }
      | null
      | undefined;

    const orderInput: CreateOrderInput = {
      customer: data.customer,
      shippingAddress: {
        firstName: data.customer.firstName,
        lastName: data.customer.lastName,
        ...data.shippingAddress,
        phone: data.customer.phone,
      },
      lineItems: (data.lineItems as CheckoutPayload['lineItems']).map((li) => ({
        variantId: li.variantId,
        quantity: li.quantity,
      })),
      // Forward the shipping line we persisted at checkout-create time so
      // the Shopify receipt + admin show the same R140 / free row Stitch
      // already charged the customer.
      ...(data.shippingLine ? { shippingLine: data.shippingLine } : {}),
      // If a coupon was applied at checkout-create time, mirror it on the
      // Shopify order via applied_discount so the customer-facing receipt
      // shows "Discount: -RX (CODE)" instead of a phantom write-off.
      ...(persistedCoupon && (persistedCoupon.amountOffSubtotalZAR > 0 || persistedCoupon.freeShipping)
        ? {
            appliedDiscount: {
              title: persistedCoupon.description || `Coupon ${persistedCoupon.code}`,
              code: persistedCoupon.code,
              amountZAR:
                persistedCoupon.amountOffSubtotalZAR +
                (persistedCoupon.freeShipping ? (data.shippingLine?.priceZAR ?? 0) : 0),
            },
          }
        : {}),
      externalOrderId: orderId,
      note: `fuelcue order ${orderId} — paid via Stitch Express (${pl.id})${persistedCoupon ? ` — coupon ${persistedCoupon.code}` : ''}`,
    };

    try {
      const created = await createOrder(shopifyCfg, orderInput);
      await orderRef.update({
        status: 'placed',
        shopify: {
          orderId: created.id,
          orderNumber: created.orderNumber,
          name: created.name,
          adminUrl: created.adminUrl,
          totalPrice: created.totalPrice,
          financialStatus: created.financialStatus,
          placedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Atomically bump the coupon's usedCount + record the redemption.
      // Idempotent — replayed webhooks are skipped inside recordCouponRedemption.
      if (persistedCoupon) {
        try {
          const totalOff =
            persistedCoupon.amountOffSubtotalZAR +
            (persistedCoupon.freeShipping ? (data.shippingLine?.priceZAR ?? 0) : 0);
          await recordCouponRedemption(persistedCoupon.code, orderId, data.customer.email, totalOff);
        } catch (couponErr) {
          // Don't fail the webhook over usage-counting — order is placed in
          // Shopify, that's what matters. We log loudly so admin can reconcile.
          logger.error('Coupon redemption record failed (order is placed)', {
            orderId,
            code: persistedCoupon.code,
            err: String(couponErr),
          });
        }
      }
      logger.info('Order placed in Shopify', { orderId, shopifyOrderName: created.name });
      res.status(200).send('placed');
    } catch (err) {
      logger.error('Shopify order creation failed', { orderId, err: String(err) });
      await orderRef.update({
        status: 'paid-needs-fulfillment',
        shopifyError: String(err).slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('paid-shopify-failed');
    }
  }
);

/* ------------------------ admin: register webhook + redirect URL ------------------------ */

/**
 * One-shot setup endpoint: registers our SPA's payment-callback URL as an
 * allowlisted Stitch Express redirect URL, AND registers our stitchWebhook
 * function as the webhook destination, capturing the resulting signing
 * secret as a new version of STITCH_WEBHOOK_SECRET.
 *
 * Gated by the placeholder bearer in STITCH_WEBHOOK_SECRET — once a real
 * whsec lands, this endpoint becomes inert.
 */
export const stitchRegisterWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [STITCH_CLIENT_ID, STITCH_CLIENT_SECRET, STITCH_WEBHOOK_SECRET],
  },
  async (req, res) => {
    const expected = STITCH_WEBHOOK_SECRET.value();
    const provided = String(req.query.key ?? '');
    if (provided !== expected) {
      res.status(401).send('unauthorized');
      return;
    }

    const cfg: StitchConfig = {
      clientId: STITCH_CLIENT_ID.value(),
      clientSecret: STITCH_CLIENT_SECRET.value(),
    };

    const result: Record<string, unknown> = {};

    // 1. Register the SPA payment-callback as an allowlisted redirect URL.
    try {
      const list = await registerRedirectUrl(cfg, SPA_PAYMENT_CALLBACK);
      result.redirectUrls = list;
    } catch (err) {
      logger.error('Redirect URL registration failed', err);
      result.redirectUrlError = String(err);
    }

    // 2. Register the webhook + capture signing secret.
    let secret: string | null = null;
    try {
      const reg = await registerWebhook(cfg, `${SELF_BASE_URL}/stitchWebhook`);
      secret = reg.secret;
      result.webhookSecretFingerprint = secret.slice(0, 12) + '…';
    } catch (err) {
      logger.error('Webhook registration failed', err);
      res.status(502).json({ ...result, error: `webhook-registration-failed: ${err}` });
      return;
    }

    // 3. Persist the secret.
    try {
      await sm.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/STITCH_WEBHOOK_SECRET`,
        payload: { data: Buffer.from(secret, 'utf8') },
      });
      result.persisted = true;
    } catch (err) {
      logger.error('Failed to persist webhook secret', err);
      res.status(500).json({ ...result, error: `persist-failed: ${err}`, secretPreview: secret.slice(0, 12) + '…' });
      return;
    }

    res.json({
      ok: true,
      ...result,
      message:
        'Webhook subscription registered, signing secret stored as new version of ' +
        'STITCH_WEBHOOK_SECRET. Redeploy stitchWebhook to pick up the new value.',
    });
  }
);
