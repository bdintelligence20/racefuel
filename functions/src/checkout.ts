import './firebase';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Webhook } from 'svix';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import {
  createPaymentInitiation,
  registerWebhook,
  type StitchConfig,
} from './stitch-client';
import {
  createOrder,
  type ShopifyConfig,
  type CreateOrderInput,
} from './shopify-client';

/**
 * End-to-end checkout flow.
 *
 *   SPA              createCheckout fn        Stitch        stitchWebhook fn       Shopify
 *    │── POST cart ──▶  ① write 'pending'
 *    │                  ② Stitch oauth
 *    │                  ③ create payment ──▶
 *    │                                      ◀── { id, url }
 *    │ ◀─ url + id ─────
 *    ├── browser to url ─────────────────▶ user pays
 *    │                                       │ (svix signed POST)
 *    │                                       └─────▶ ④ verify signature
 *    │                                              ⑤ flip 'pending' → 'paid'
 *    │                                              ⑥ create Shopify order ──▶ ✓
 *    │                                              ⑦ flip → 'placed'
 *    │ ◀── redirect to /payment-callback (status query param)
 *    │ ◀── poll /orders/:id from Firestore for the final 'placed' state
 */

// Stitch
const STITCH_CLIENT_ID = defineSecret('STITCH_CLIENT_ID_TEST');
const STITCH_CLIENT_SECRET = defineSecret('STITCH_CLIENT_SECRET_TEST');
const STITCH_WEBHOOK_SECRET = defineSecret('STITCH_WEBHOOK_SECRET');

// Shopify
const SHOPIFY_ADMIN_TOKEN = defineSecret('SHOPIFY_ADMIN_TOKEN');
const SHOPIFY_STORE_URL = defineSecret('SHOPIFY_STORE_URL');

const PROJECT_ID = 'promogroup';
const SELF_BASE_URL = 'https://us-central1-promogroup.cloudfunctions.net';
const SPA_PAYMENT_CALLBACK = 'https://fuelcue.com/payment-callback';

const ALLOWED_ORIGINS = new Set([
  'https://fuelcue.com',
  'https://www.fuelcue.com',
  'https://racefuel-dtlkpe56ha-uc.a.run.app',
  'http://localhost:5173',
]);

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
    country: string; // 'South Africa' for now
    zip: string;
  };
  lineItems: Array<{
    variantId: number;
    quantity: number;
    title: string; // for our records — Shopify is source of truth
    unitPrice: number; // in ZAR major units
  }>;
}

/* ------------------------ helpers ------------------------ */

function corsHeaders(origin: string | undefined): Record<string, string> {
  const o = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://fuelcue.com';
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

function sanitizeRef(s: string, max: number): string {
  // Stitch's references must be alnum+spaces — strip everything else.
  return s.replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, max) || 'fuelcue';
}

/* ------------------------ createCheckout ------------------------ */

export const createCheckout = onRequest(
  {
    region: 'us-central1',
    secrets: [STITCH_CLIENT_ID, STITCH_CLIENT_SECRET],
    cors: false, // handled manually so we control origin allowlist
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
    const total = totalZar(payload.lineItems);

    // 1. Persist a 'pending' order before talking to Stitch — if Stitch fails,
    //    we still have a record and can retry / debug.
    await orderRef.set({
      status: 'pending',
      customer: payload.customer,
      shippingAddress: payload.shippingAddress,
      lineItems: payload.lineItems,
      amount: { currency: 'ZAR', total },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Create Stitch payment initiation.
    const cfg: StitchConfig = {
      clientId: STITCH_CLIENT_ID.value(),
      clientSecret: STITCH_CLIENT_SECRET.value(),
    };

    let paymentRequestId: string;
    let paymentUrl: string;
    try {
      const created = await createPaymentInitiation(cfg, {
        amountZar: total,
        payerReference: sanitizeRef(payload.customer.firstName, 12),
        beneficiaryReference: sanitizeRef(`fuelcue ${orderId.slice(0, 6)}`, 20),
        externalReference: orderId,
        payer: {
          fullName: `${payload.customer.firstName} ${payload.customer.lastName}`.trim(),
          email: payload.customer.email,
          mobileNumber: payload.customer.phone,
        },
      });
      paymentRequestId = created.id;
      paymentUrl = created.url;
    } catch (err) {
      logger.error('Stitch payment initiation failed', { orderId, err });
      await orderRef.update({
        status: 'failed',
        failureReason: 'stitch-init-failed',
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(502).json({ error: 'payment-init-failed' });
      return;
    }

    // 3. Append our callback redirect_uri to the Stitch hosted URL.
    const redirectUri = `${SPA_PAYMENT_CALLBACK}?orderId=${orderId}`;
    const fullUrl = `${paymentUrl}?redirect_uri=${encodeURIComponent(redirectUri)}`;

    await orderRef.update({
      stitch: {
        paymentRequestId,
        paymentUrl,
        redirectUri,
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({
      orderId,
      paymentUrl: fullUrl,
    });
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
  return errs;
}

/* ------------------------ stitchWebhook ------------------------ */

interface StitchWebhookPayload {
  data?: {
    client?: {
      paymentInitiationRequests?: {
        node?: {
          __typename: string;
          id: string;
          externalReference?: string;
          state?: { __typename: string; date?: string };
        };
      };
    };
  };
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

    // svix verification needs the raw, unmodified body. Cloud Functions Gen 2
    // exposes it via req.rawBody (a Buffer). req.body is already JSON-parsed.
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      logger.error('Webhook missing rawBody — cannot verify signature');
      res.status(400).send('no-raw-body');
      return;
    }

    let parsed: StitchWebhookPayload;
    try {
      const wh = new Webhook(STITCH_WEBHOOK_SECRET.value());
      parsed = wh.verify(rawBody.toString('utf8'), {
        'svix-id': String(req.get('svix-id') ?? ''),
        'svix-timestamp': String(req.get('svix-timestamp') ?? ''),
        'svix-signature': String(req.get('svix-signature') ?? ''),
      }) as StitchWebhookPayload;
    } catch (err) {
      logger.warn('Webhook signature verification failed', { err });
      res.status(401).send('bad-signature');
      return;
    }

    const node = parsed.data?.client?.paymentInitiationRequests?.node;
    if (!node) {
      logger.warn('Webhook payload missing payment node');
      res.status(200).send('ignored-no-node');
      return;
    }

    const orderId = node.externalReference;
    const stateType = node.state?.__typename;

    logger.info('Stitch webhook received', {
      paymentRequestId: node.id,
      orderId,
      stateType,
    });

    if (!orderId) {
      res.status(200).send('ignored-no-external-ref');
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

    // Map Stitch's state to ours.
    if (stateType === 'PaymentInitiationRequestCancelled') {
      await orderRef.update({
        status: 'cancelled',
        stitch: {
          ...snap.data()?.stitch,
          state: 'cancelled',
          completedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('cancelled');
      return;
    }
    if (stateType === 'PaymentInitiationRequestExpired') {
      await orderRef.update({
        status: 'failed',
        failureReason: 'expired',
        stitch: {
          ...snap.data()?.stitch,
          state: 'expired',
          completedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('expired');
      return;
    }
    if (stateType !== 'PaymentInitiationRequestCompleted') {
      logger.info('Webhook for non-terminal state', { stateType });
      res.status(200).send('ignored-not-completed');
      return;
    }

    // Idempotency: if we've already placed the Shopify order, the second
    // webhook delivery (svix retries) shouldn't re-create it.
    const data = snap.data()!;
    if (data.shopify?.orderId) {
      logger.info('Order already placed in Shopify — webhook is duplicate', { orderId });
      res.status(200).send('already-placed');
      return;
    }

    // 1. Mark as paid first so the dashboard reflects it even if Shopify
    //    creation hiccups.
    await orderRef.update({
      status: 'paid',
      stitch: {
        ...data.stitch,
        state: 'completed',
        completedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Create the Shopify order.
    const shopifyCfg: ShopifyConfig = {
      storeUrl: SHOPIFY_STORE_URL.value(),
      accessToken: SHOPIFY_ADMIN_TOKEN.value(),
    };

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
      externalOrderId: orderId,
      note: `fuelcue order ${orderId} — paid via Stitch (${node.id})`,
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
      logger.info('Order placed in Shopify', { orderId, shopifyOrderName: created.name });
      res.status(200).send('placed');
    } catch (err) {
      // Don't fail the webhook — the payment succeeded, the order is recorded
      // as 'paid', and we'll need to retry the Shopify create manually. svix
      // retries would just re-enter the same failure path.
      logger.error('Shopify order creation failed', { orderId, err });
      await orderRef.update({
        status: 'paid-needs-fulfillment',
        shopifyError: String(err).slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.status(200).send('paid-shopify-failed');
    }
  }
);

/* ------------------------ admin: register webhook (one-time) ------------------------ */

/**
 * One-shot helper to register the stitchWebhook URL with Stitch and capture
 * the resulting svix secret. Call by visiting the function URL with
 * `?key=<bearer>` matching the STITCH_WEBHOOK_SECRET secret's current placeholder
 * — once the real secret is captured, this endpoint becomes inert (the bearer
 * no longer matches and it returns 401). Cheap, zero-state setup endpoint.
 */
export const stitchRegisterWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [STITCH_CLIENT_ID, STITCH_CLIENT_SECRET, STITCH_WEBHOOK_SECRET],
  },
  async (req, res) => {
    const expected = STITCH_WEBHOOK_SECRET.value();
    const provided = String(req.query.key ?? '');
    // The bearer is the placeholder string written when we pre-create the
    // secret. Once a real whsec_... lands, this gate flips closed.
    if (provided !== expected) {
      res.status(401).send('unauthorized');
      return;
    }
    const cfg: StitchConfig = {
      clientId: STITCH_CLIENT_ID.value(),
      clientSecret: STITCH_CLIENT_SECRET.value(),
    };
    const webhookUrl = `${SELF_BASE_URL}/stitchWebhook`;
    let sub;
    try {
      sub = await registerWebhook(cfg, webhookUrl);
    } catch (err) {
      logger.error('Webhook registration failed', err);
      res.status(502).send(`registration-failed: ${err}`);
      return;
    }

    // Persist the secret as a new version of STITCH_WEBHOOK_SECRET.
    try {
      await sm.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/STITCH_WEBHOOK_SECRET`,
        payload: { data: Buffer.from(sub.secret, 'utf8') },
      });
    } catch (err) {
      logger.error('Failed to persist webhook secret', err);
      res.status(500).send(`captured but failed to persist: ${err}`);
      return;
    }

    res.json({
      ok: true,
      subscriptionId: sub.id,
      url: sub.url,
      message:
        'Webhook subscription registered and secret stored as STITCH_WEBHOOK_SECRET. ' +
        'Redeploy the stitchWebhook function to pick up the new secret value.',
    });
  }
);
