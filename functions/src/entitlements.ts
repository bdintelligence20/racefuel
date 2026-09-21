/**
 * Entitlements — server-authoritative feature access.
 *
 * Generalises the admin-allowlist pattern (SEED_ADMINS + an email-keyed
 * Firestore collection + a callable check) into a per-user access resolver.
 * Eligibility is admin-controlled and lives OFF the user doc (owner-write
 * rules would otherwise let a user self-grant): a `betaAccess/{email}`
 * collection, mirroring `admins/{email}`.
 *
 * The gut-training beta is gated by BOTH per-user eligibility AND a global
 * runtime kill switch (`config/features.gutTrainingV2Enabled`), so it can be
 * pulled for everyone at once without a redeploy.
 *
 * FAIL CLOSED. `getMyAccess` returns no access whenever the caller is
 * unauthenticated, has no email, or any Firestore read throws. The client
 * treats loading/timeout/App-Check-reject the same way (see useEntitlements).
 */
import './firebase';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { SEED_ADMINS, isAdmin, assertAdmin } from './admin';

const REGION = 'us-central1';
const FEATURES_DOC = 'config/features';
const BETA_COLLECTION = 'betaAccess';

function tsToMillis(v: unknown): number | null {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return null;
}

/** Global kill switch for the gut-training beta. Absent or `true` = enabled;
 *  only an explicit `false` turns it off. The per-user allowlist still gates
 *  access regardless, so a missing config doc never WIDENS access. */
async function gutTrainingKillSwitchOn(): Promise<boolean> {
  const snap = await getFirestore().doc(FEATURES_DOC).get();
  const data = snap.data() as { gutTrainingV2Enabled?: boolean } | undefined;
  return data?.gutTrainingV2Enabled !== false;
}

async function betaAccessHas(email: string): Promise<boolean> {
  const snap = await getFirestore().collection(BETA_COLLECTION).doc(email).get();
  return snap.exists;
}

/* ----------------------------- getMyAccess ---------------------------- */

export const getMyAccess = onCall({ region: REGION }, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) return { isAdmin: false, betaGutTraining: false };
  const email = (auth.token?.email as string | undefined)?.toLowerCase();
  if (!email) return { isAdmin: false, betaGutTraining: false };
  try {
    const admin = await isAdmin(email);
    // Seed admins and betaAccess members are eligible; eligibility is ANDed
    // with the global kill switch — off means false for EVERYONE, admins too.
    const eligible = admin || (await betaAccessHas(email));
    const killOn = await gutTrainingKillSwitchOn();
    return { isAdmin: admin, betaGutTraining: eligible && killOn, email };
  } catch (err) {
    logger.warn('getMyAccess failed (fail-closed)', { err: String(err) });
    return { isAdmin: false, betaGutTraining: false };
  }
});

/* ----------------------- beta allowlist management -------------------- */

export const adminListBeta = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const db = getFirestore();
  const [allowSnap, featuresSnap, optInSnap] = await Promise.all([
    db.collection(BETA_COLLECTION).get(),
    db.doc(FEATURES_DOC).get(),
    // Per-user opt-in / dismissal records live under users/{uid}/betaOptIns.
    db.collectionGroup('betaOptIns').get(),
  ]);

  const features = featuresSnap.data() as { gutTrainingV2Enabled?: boolean } | undefined;

  const optIns = optInSnap.docs.map((d) => {
    const data = d.data() as {
      email?: string;
      gutTraining?: { optedIn?: boolean; optedInAt?: string; dismissedAt?: string; dismissCount?: number };
    };
    const gt = data.gutTraining ?? {};
    return {
      uid: d.ref.parent.parent?.id ?? null,
      email: (data.email ?? '').toLowerCase() || null,
      optedIn: gt.optedIn ?? false,
      optedInAt: gt.optedInAt ?? null,
      dismissedAt: gt.dismissedAt ?? null,
      dismissCount: gt.dismissCount ?? 0,
    };
  });

  return {
    gutTrainingV2Enabled: features?.gutTrainingV2Enabled !== false,
    seedAdmins: Array.from(SEED_ADMINS),
    allow: allowSnap.docs.map((d) => ({
      email: d.id,
      addedAt: tsToMillis((d.data() as { addedAt?: Timestamp }).addedAt),
      addedBy: (d.data() as { addedBy?: string }).addedBy ?? null,
    })),
    optIns,
  };
});

export const adminAddBeta = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as { email?: string };
  const email = args.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Valid email required.');
  }
  await getFirestore().collection(BETA_COLLECTION).doc(email).set({
    addedAt: Timestamp.now(),
    addedBy: ctx.email,
  }, { merge: true });
  logger.info('beta access added', { email, by: ctx.email });
  return { ok: true };
});

export const adminRemoveBeta = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as { email?: string };
  const email = args.email?.trim().toLowerCase();
  if (!email) throw new HttpsError('invalid-argument', 'email required.');
  await getFirestore().collection(BETA_COLLECTION).doc(email).delete();
  logger.info('beta access removed', { email, by: ctx.email });
  return { ok: true };
});

/* --------------------------- kill switch ------------------------------ */

export const adminSetGutTrainingV2Enabled = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as { enabled?: boolean };
  if (typeof args.enabled !== 'boolean') {
    throw new HttpsError('invalid-argument', 'enabled (boolean) required.');
  }
  await getFirestore().doc(FEATURES_DOC).set({
    gutTrainingV2Enabled: args.enabled,
    updatedAt: Timestamp.now(),
    updatedBy: ctx.email,
  }, { merge: true });
  logger.info('gut-training kill switch set', { enabled: args.enabled, by: ctx.email });
  return { ok: true, enabled: args.enabled };
});
