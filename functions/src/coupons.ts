import './firebase';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

/**
 * Coupon code engine.
 *
 *   coupons/{CODE}  ←  doc id is the uppercased code so lookups by code are O(1).
 *     type:           'percent' | 'fixed' | 'freeShipping'
 *     value:          number      // percent (0-100) or ZAR (fixed). Ignored for freeShipping.
 *     active:         boolean
 *     usageLimit:     number|null // total redemptions across all users
 *     usedCount:      number      // server-incremented in stitchWebhook after Shopify order placed
 *     minSubtotalZAR: number|null
 *     startsAt:       Timestamp|null
 *     expiresAt:      Timestamp|null
 *     description:    string|null
 *     createdAt:      Timestamp
 *     createdBy:      string      // admin email
 *
 *   coupons/{CODE}/redemptions/{orderId}  ←  audit trail, one per successful redemption.
 *     orderId, email, amountZAR (discount applied), redeemedAt
 *
 * Callables:
 *   validateCoupon   — public; the cart calls this to preview a discount before checkout.
 *   adminListCoupons / adminUpsertCoupon / adminDeleteCoupon — admin-gated.
 *
 * Application:
 *   createCheckout takes an optional { coupon: { code } } on the payload, re-validates
 *   server-side, and writes the resolved discount into the order doc. The Stitch payment
 *   amount is the discounted total. The webhook hands a Shopify order with applied_discount
 *   so the customer-facing receipt reflects the same code + amount.
 */

const REGION = 'us-central1';

const SEED_ADMINS: ReadonlySet<string> = new Set([
  'nicholasflemmer@gmail.com',
  'mullin.scott1@gmail.com',
  'spiesbradley@gmail.com',
  'dane@thepromogroup.co.za',
  'jeff@thepromogroup.co.za',
  'clickfirm.utt@gmail.com',
]);

async function isAdmin(email: string): Promise<boolean> {
  if (SEED_ADMINS.has(email)) return true;
  const snap = await getFirestore().collection('admins').doc(email).get();
  return snap.exists;
}

async function assertAdmin(request: CallableRequest<unknown>): Promise<{ uid: string; email: string }> {
  const auth = request.auth;
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  const email = (auth.token?.email as string | undefined)?.toLowerCase();
  if (!email) throw new HttpsError('failed-precondition', 'Account has no email.');
  if (!(await isAdmin(email))) throw new HttpsError('permission-denied', 'Admin access required.');
  return { uid: auth.uid, email };
}

/* ------------------------------ types ------------------------------ */

export type CouponType = 'percent' | 'fixed' | 'freeShipping';

export interface CouponDoc {
  type: CouponType;
  value: number;
  active: boolean;
  usageLimit: number | null;
  usedCount: number;
  minSubtotalZAR: number | null;
  startsAt: Timestamp | null;
  expiresAt: Timestamp | null;
  description: string | null;
  createdAt: Timestamp;
  createdBy: string;
}

export interface ResolvedDiscount {
  code: string;
  type: CouponType;
  value: number;
  /** Discount applied to the line-items subtotal (ZAR, never negative, capped to subtotal). */
  amountOffSubtotalZAR: number;
  /** True when the coupon zeroes the shipping line. */
  freeShipping: boolean;
  description: string | null;
}

/* --------------------------- public engine --------------------------- */

function normaliseCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return null;
  return code;
}

function reasonNotApplicable(
  doc: CouponDoc | null,
  subtotalZar: number,
  now: Date
): string | null {
  if (!doc) return 'unknown-code';
  if (!doc.active) return 'inactive';
  if (doc.startsAt && doc.startsAt.toMillis() > now.getTime()) return 'not-started';
  if (doc.expiresAt && doc.expiresAt.toMillis() < now.getTime()) return 'expired';
  if (doc.usageLimit !== null && doc.usedCount >= doc.usageLimit) return 'usage-limit-reached';
  if (doc.minSubtotalZAR !== null && subtotalZar < doc.minSubtotalZAR) return 'below-minimum-subtotal';
  return null;
}

function computeDiscount(
  doc: CouponDoc,
  subtotalZar: number
): { amountOffSubtotalZAR: number; freeShipping: boolean } {
  if (doc.type === 'percent') {
    const pct = Math.max(0, Math.min(100, doc.value));
    const off = Math.min(subtotalZar, Math.round((subtotalZar * pct) * 100) / 10000);
    return { amountOffSubtotalZAR: round2(off), freeShipping: false };
  }
  if (doc.type === 'fixed') {
    const off = Math.min(subtotalZar, Math.max(0, doc.value));
    return { amountOffSubtotalZAR: round2(off), freeShipping: false };
  }
  // freeShipping — no subtotal discount, just zero the shipping line at checkout time.
  return { amountOffSubtotalZAR: 0, freeShipping: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Read coupon doc + decide if it currently applies to the given subtotal.
 * Throws an HttpsError when called from a callable (caller catches if it wants soft handling).
 * For internal use from createCheckout, use `tryResolveCoupon` instead.
 */
export async function resolveCoupon(
  rawCode: string,
  subtotalZar: number
): Promise<ResolvedDiscount> {
  const code = normaliseCode(rawCode);
  if (!code) throw new HttpsError('invalid-argument', 'Invalid code format.');
  const snap = await getFirestore().collection('coupons').doc(code).get();
  const doc = snap.exists ? (snap.data() as CouponDoc) : null;
  const why = reasonNotApplicable(doc, subtotalZar, new Date());
  if (why || !doc) throw new HttpsError('failed-precondition', why ?? 'unknown-code');

  const { amountOffSubtotalZAR, freeShipping } = computeDiscount(doc, subtotalZar);
  return {
    code,
    type: doc.type,
    value: doc.value,
    amountOffSubtotalZAR,
    freeShipping,
    description: doc.description,
  };
}

/** Soft variant — returns null instead of throwing, used by createCheckout. */
export async function tryResolveCoupon(
  rawCode: string | null | undefined,
  subtotalZar: number
): Promise<ResolvedDiscount | null> {
  if (!rawCode) return null;
  try {
    return await resolveCoupon(rawCode, subtotalZar);
  } catch (err) {
    logger.warn('Coupon not applicable at checkout', { rawCode, subtotalZar, err: String(err) });
    return null;
  }
}

/**
 * Idempotent: increment usedCount + write a redemption record for this orderId.
 * Called from stitchWebhook after the Shopify order is successfully placed.
 */
export async function recordCouponRedemption(
  code: string,
  orderId: string,
  email: string,
  amountZAR: number
): Promise<void> {
  const fs = getFirestore();
  const couponRef = fs.collection('coupons').doc(code);
  const redemptionRef = couponRef.collection('redemptions').doc(orderId);

  await fs.runTransaction(async (tx) => {
    const r = await tx.get(redemptionRef);
    if (r.exists) return; // already recorded, no-op.
    tx.set(redemptionRef, {
      orderId,
      email,
      amountZAR,
      redeemedAt: FieldValue.serverTimestamp(),
    });
    tx.update(couponRef, {
      usedCount: FieldValue.increment(1),
    });
  });
}

/* ------------------------------ callables ------------------------------ */

export const validateCoupon = onCall({ region: REGION }, async (request) => {
  const args = (request.data ?? {}) as { code?: string; subtotalZar?: number };
  const code = normaliseCode(args.code);
  const subtotalZar = typeof args.subtotalZar === 'number' ? args.subtotalZar : 0;
  if (!code) throw new HttpsError('invalid-argument', 'Invalid code format.');
  if (!Number.isFinite(subtotalZar) || subtotalZar < 0) {
    throw new HttpsError('invalid-argument', 'subtotalZar must be a non-negative number.');
  }
  const snap = await getFirestore().collection('coupons').doc(code).get();
  const doc = snap.exists ? (snap.data() as CouponDoc) : null;
  const why = reasonNotApplicable(doc, subtotalZar, new Date());
  if (why || !doc) {
    return { ok: false as const, reason: why ?? 'unknown-code', code };
  }
  const { amountOffSubtotalZAR, freeShipping } = computeDiscount(doc, subtotalZar);
  return {
    ok: true as const,
    discount: {
      code,
      type: doc.type,
      value: doc.value,
      amountOffSubtotalZAR,
      freeShipping,
      description: doc.description,
    } as ResolvedDiscount,
  };
});

export const adminListCoupons = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as { activeOnly?: boolean };
  const snap = await getFirestore()
    .collection('coupons')
    .orderBy('createdAt', 'desc')
    .limit(500)
    .get();
  let rows = snap.docs.map((d) => {
    const data = d.data() as CouponDoc;
    return {
      code: d.id,
      type: data.type,
      value: data.value,
      active: data.active,
      usageLimit: data.usageLimit,
      usedCount: data.usedCount,
      minSubtotalZAR: data.minSubtotalZAR,
      startsAt: data.startsAt?.toMillis() ?? null,
      expiresAt: data.expiresAt?.toMillis() ?? null,
      description: data.description,
      createdAt: data.createdAt?.toMillis() ?? null,
      createdBy: data.createdBy,
    };
  });
  if (args.activeOnly) rows = rows.filter((r) => r.active);
  return { rows };
});

export const adminUpsertCoupon = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as {
    code?: string;
    type?: CouponType;
    value?: number;
    active?: boolean;
    usageLimit?: number | null;
    minSubtotalZAR?: number | null;
    startsAt?: number | null;
    expiresAt?: number | null;
    description?: string | null;
  };
  const code = normaliseCode(args.code);
  if (!code) throw new HttpsError('invalid-argument', 'Invalid code format. Use 2-32 chars A-Z 0-9 _ -.');
  if (!args.type || !['percent', 'fixed', 'freeShipping'].includes(args.type)) {
    throw new HttpsError('invalid-argument', 'type must be percent | fixed | freeShipping.');
  }
  const value = args.type === 'freeShipping' ? 0 : Number(args.value);
  if (args.type !== 'freeShipping') {
    if (!Number.isFinite(value) || value <= 0) {
      throw new HttpsError('invalid-argument', 'value must be a positive number.');
    }
    if (args.type === 'percent' && value > 100) {
      throw new HttpsError('invalid-argument', 'percent value must be 0-100.');
    }
  }
  if (args.expiresAt != null && args.startsAt != null && args.expiresAt < args.startsAt) {
    throw new HttpsError('invalid-argument', 'expiresAt must be after startsAt.');
  }

  const fs = getFirestore();
  const ref = fs.collection('coupons').doc(code);
  const existing = await ref.get();

  const patch: Partial<CouponDoc> = {
    type: args.type,
    value,
    active: args.active !== false,
    usageLimit: args.usageLimit ?? null,
    minSubtotalZAR: args.minSubtotalZAR ?? null,
    startsAt: args.startsAt ? Timestamp.fromMillis(args.startsAt) : null,
    expiresAt: args.expiresAt ? Timestamp.fromMillis(args.expiresAt) : null,
    description: args.description?.trim() ? args.description.trim() : null,
  };

  if (existing.exists) {
    await ref.update(patch as Record<string, unknown>);
  } else {
    const doc: CouponDoc = {
      ...(patch as Required<Omit<CouponDoc, 'usedCount' | 'createdAt' | 'createdBy'>>),
      usedCount: 0,
      createdAt: Timestamp.now(),
      createdBy: ctx.email,
    };
    await ref.set(doc);
  }
  logger.info('Coupon upserted', { code, type: args.type, by: ctx.email });
  return { ok: true, code };
});

export const adminDeleteCoupon = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as { code?: string };
  const code = normaliseCode(args.code);
  if (!code) throw new HttpsError('invalid-argument', 'Invalid code format.');
  // Hard delete — redemptions subcollection is left behind for audit. Firestore
  // handles orphaned subcollections fine; they're invisible via the SDK.
  await getFirestore().collection('coupons').doc(code).delete();
  logger.info('Coupon deleted', { code, by: ctx.email });
  return { ok: true };
});
