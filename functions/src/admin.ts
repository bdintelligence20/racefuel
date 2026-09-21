import './firebase';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { logger } from 'firebase-functions';

// Always-admin fallback so the dashboard is reachable on first deploy
// without a manual seed step. Anyone added via `adminAddAdmin` joins the
// allowlist alongside this baseline. Seed admins can't be removed from the
// Settings tab — change this list and redeploy if that's needed.
export const SEED_ADMINS: ReadonlySet<string> = new Set([
  'nicholasflemmer@gmail.com',
  'mullin.scott1@gmail.com',
  'spiesbradley@gmail.com',
  'dane@thepromogroup.co.za',
  'jeff@thepromogroup.co.za',
  'clickfirm.utt@gmail.com',
]);

const REGION = 'us-central1';

interface ContextEmail {
  uid: string;
  email: string;
}

function requireEmail(request: CallableRequest<unknown>): ContextEmail {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const email = (auth.token?.email as string | undefined)?.toLowerCase();
  if (!email) {
    throw new HttpsError('failed-precondition', 'Account has no email.');
  }
  return { uid: auth.uid, email };
}

export async function isAdmin(email: string): Promise<boolean> {
  if (SEED_ADMINS.has(email)) return true;
  const snap = await getFirestore().collection('admins').doc(email).get();
  return snap.exists;
}

export async function assertAdmin(request: CallableRequest<unknown>): Promise<ContextEmail> {
  const ctx = requireEmail(request);
  if (!(await isAdmin(ctx.email))) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
  return ctx;
}

/* ----------------------------- helpers ----------------------------- */

function tsToMillis(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'object' && v !== null && 'toMillis' in v) {
    try { return (v as { toMillis(): number }).toMillis(); } catch { return null; }
  }
  if (typeof v === 'number') return v;
  return null;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function emptyDayBuckets(rangeDays: number): Record<string, number> {
  const out: Record<string, number> = {};
  const now = Date.now();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    out[d.toISOString().slice(0, 10)] = 0;
  }
  return out;
}

async function chunkedAll<I, O>(items: I[], size: number, fn: (chunk: I[]) => Promise<O[]>): Promise<O[]> {
  const out: O[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await fn(items.slice(i, i + size))));
  }
  return out;
}

/** Resolve a Firestore query, returning a fallback if it fails (e.g. an
 *  index is still being built). Logs the error so we know about it. */
async function safeQuery<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.warn(`safeQuery ${name} failed (fallback used)`, { err: String(err) });
    return fallback;
  }
}

function emptyCount(): FirebaseFirestore.AggregateQuerySnapshot<{ count: FirebaseFirestore.AggregateField<number> }> {
  return { data: () => ({ count: 0 }) } as unknown as FirebaseFirestore.AggregateQuerySnapshot<{ count: FirebaseFirestore.AggregateField<number> }>;
}
function emptySnap(): FirebaseFirestore.QuerySnapshot {
  return { docs: [], size: 0, empty: true } as unknown as FirebaseFirestore.QuerySnapshot;
}
function emptyDoc(): FirebaseFirestore.DocumentSnapshot {
  return { exists: false, data: () => undefined } as unknown as FirebaseFirestore.DocumentSnapshot;
}

/* --------------------------- adminCheck ---------------------------- */

export const adminCheck = onCall({ region: REGION }, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) return { isAdmin: false };
  const email = (auth.token?.email as string | undefined)?.toLowerCase();
  if (!email) return { isAdmin: false };
  return { isAdmin: await isAdmin(email), email };
});

/* -------------------------- adminMetrics --------------------------- */

interface MetricsArgs { rangeDays?: number }

export const adminMetrics = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as MetricsArgs;
  const rangeDays = Math.max(1, Math.min(365, args.rangeDays ?? 30));
  const sinceMs = Date.now() - rangeDays * 86400000;
  const sinceTs = Timestamp.fromMillis(sinceMs);
  const db = getFirestore();

  const [
    authUsers,
    ordersSnap,
    plansSnap,
    feedbackSnap,
    customProductsSnap,
    ratingsSnap,
    earlyAccessSnap,
    siteFeedbackSnap,
    plansRecentSnap,
    feedbackRecentSnap,
    ordersRecentSnap,
  ] = await Promise.all([
    safeQuery('list-auth-users', () => listAllAuthUsers(), [] as UserRecord[]),
    safeQuery('count(orders)', () => db.collection('orders').count().get(), emptyCount()),
    safeQuery('count(plans)', () => db.collectionGroup('plans').count().get(), emptyCount()),
    safeQuery('count(feedback)', () => db.collectionGroup('feedback').count().get(), emptyCount()),
    safeQuery('count(customProducts)', () => db.collectionGroup('customProducts').count().get(), emptyCount()),
    safeQuery('count(ratings)', () => db.collectionGroup('ratings').count().get(), emptyCount()),
    safeQuery('count(earlyAccess)', () => db.collection('earlyAccessRequests').count().get(), emptyCount()),
    safeQuery('count(siteFeedback)', () => db.collection('siteFeedback').count().get(), emptyCount()),
    safeQuery('plans-recent', () => db.collectionGroup('plans').where('createdAt', '>=', sinceTs).get(), emptySnap()),
    safeQuery('feedback-recent', () => db.collectionGroup('feedback').where('createdAt', '>=', sinceTs).get(), emptySnap()),
    safeQuery('orders-recent', () => db.collection('orders').where('createdAt', '>=', sinceTs).get(), emptySnap()),
  ]);

  let revenueZAR = 0;
  let paidOrders = 0;
  const revenueByDay = emptyDayBuckets(rangeDays);
  const ordersByDay = emptyDayBuckets(rangeDays);
  for (const doc of ordersRecentSnap.docs) {
    const d = doc.data() as {
      status?: string;
      amount?: { total?: number };
      createdAt?: Timestamp;
    };
    const created = tsToMillis(d.createdAt);
    if (created == null) continue;
    const k = dayKey(created);
    if (k in ordersByDay) ordersByDay[k] += 1;
    if (d.status === 'paid' || d.status === 'placed' || d.status === 'paid-needs-fulfillment') {
      const amount = Number(d.amount?.total ?? 0);
      revenueZAR += amount;
      paidOrders += 1;
      if (k in revenueByDay) revenueByDay[k] += amount;
    }
  }

  const plansByDay = emptyDayBuckets(rangeDays);
  for (const doc of plansRecentSnap.docs) {
    const created = tsToMillis((doc.data() as { createdAt?: Timestamp }).createdAt);
    if (created == null) continue;
    const k = dayKey(created);
    if (k in plansByDay) plansByDay[k] += 1;
  }

  const feedbackByDay = emptyDayBuckets(rangeDays);
  for (const doc of feedbackRecentSnap.docs) {
    const created = tsToMillis((doc.data() as { createdAt?: Timestamp }).createdAt);
    if (created == null) continue;
    const k = dayKey(created);
    if (k in feedbackByDay) feedbackByDay[k] += 1;
  }

  const signupsByDay = emptyDayBuckets(rangeDays);
  for (const u of authUsers) {
    if (!u.metadata.creationTime) continue;
    const created = new Date(u.metadata.creationTime).getTime();
    if (created < sinceMs) continue;
    const k = dayKey(created);
    if (k in signupsByDay) signupsByDay[k] += 1;
  }

  return {
    rangeDays,
    totals: {
      usersCount: authUsers.length,
      ordersCount: ordersSnap.data().count,
      plansCount: plansSnap.data().count,
      feedbackCount: feedbackSnap.data().count,
      customProductsCount: customProductsSnap.data().count,
      ratingsCount: ratingsSnap.data().count,
      earlyAccessCount: earlyAccessSnap.data().count,
      siteFeedbackCount: siteFeedbackSnap.data().count,
      revenueZAR,
      paidOrders,
    },
    series: {
      signupsByDay: bucketsToSeries(signupsByDay),
      revenueByDay: bucketsToSeries(revenueByDay),
      plansByDay: bucketsToSeries(plansByDay),
      feedbackByDay: bucketsToSeries(feedbackByDay),
      ordersByDay: bucketsToSeries(ordersByDay),
    },
  };
});

function bucketsToSeries(b: Record<string, number>): Array<{ date: string; value: number }> {
  return Object.entries(b)
    .sort(([a], [c]) => (a < c ? -1 : 1))
    .map(([date, value]) => ({ date, value }));
}

/* ------------------------- adminListUsers -------------------------- */

interface ListUsersArgs {
  cursor?: number | null;
  limit?: number;
  search?: string;
  sortBy?: 'lastLoginAt' | 'createdAt' | 'loginCount';
}

/** Fetch every Firebase Auth user (paginated). Capped to be safe but in
 *  practice the dashboard is operating on hundreds, not millions. */
async function listAllAuthUsers(): Promise<UserRecord[]> {
  const auth = getAuth();
  const all: UserRecord[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const res = await auth.listUsers(1000, pageToken);
    all.push(...res.users);
    pageToken = res.pageToken;
    if (!pageToken) break;
  }
  return all;
}

export const adminListUsers = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as ListUsersArgs;
  const limit = Math.max(1, Math.min(100, args.limit ?? 25));
  const sortBy = args.sortBy ?? 'lastLoginAt';
  const search = args.search?.trim().toLowerCase() ?? '';
  const db = getFirestore();

  // Source of truth: Firebase Auth. Pull every user, then layer on Firestore
  // _meta (loginCount) when present.
  const authUsers = await listAllAuthUsers();

  // Pull all _meta docs once for loginCount enrichment. Tolerates missing
  // index by returning empty.
  const metaSnap = await safeQuery('listUsers-meta', () => db.collectionGroup('_meta').get(), emptySnap());
  const metaByUid = new Map<string, { loginCount?: number }>();
  for (const d of metaSnap.docs) {
    const uid = d.ref.parent.parent?.id;
    if (!uid) continue;
    if (d.id !== 'data') continue; // skip /strava etc.
    metaByUid.set(uid, d.data() as { loginCount?: number });
  }

  const rows = authUsers.map((u) => ({
    uid: u.uid,
    email: (u.email ?? '').toLowerCase(),
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime).getTime() : null,
    lastLoginAt: u.metadata.lastSignInTime ? new Date(u.metadata.lastSignInTime).getTime() : null,
    loginCount: metaByUid.get(u.uid)?.loginCount ?? 0,
    provider: u.providerData[0]?.providerId ?? null,
    disabled: u.disabled,
  }));

  const matched = search
    ? rows.filter((r) => r.email.includes(search) || (r.displayName ?? '').toLowerCase().includes(search))
    : rows;

  // Sort
  matched.sort((a, b) => {
    const av = (a[sortBy] ?? 0) as number;
    const bv = (b[sortBy] ?? 0) as number;
    return bv - av;
  });

  // Cursor = offset (number we slice past)
  const offset = args.cursor ?? 0;
  const page = matched.slice(offset, offset + limit);
  const nextCursor = matched.length > offset + limit ? offset + limit : null;

  // Per-user counts via parallel count() queries. ~4 reads × N users.
  const counts = await Promise.all(
    page.map(async (u) => {
      if (!u.uid) return { plans: 0, feedback: 0, ratings: 0, customProducts: 0, ordersCount: 0, revenueZAR: 0 };
      const userRef = db.collection('users').doc(u.uid);
      const [plans, feedback, ratings, customProducts, ordersForUser] = await Promise.all([
        userRef.collection('plans').count().get(),
        userRef.collection('feedback').count().get(),
        userRef.collection('ratings').count().get(),
        userRef.collection('customProducts').count().get(),
        u.email
          ? db.collection('orders').where('customer.email', '==', u.email).get()
          : Promise.resolve(null),
      ]);
      let ordersCount = 0;
      let revenueZAR = 0;
      if (ordersForUser) {
        ordersCount = ordersForUser.size;
        for (const od of ordersForUser.docs) {
          const data = od.data() as { status?: string; amount?: { total?: number } };
          if (['paid', 'placed', 'paid-needs-fulfillment'].includes(data.status ?? '')) {
            revenueZAR += Number(data.amount?.total ?? 0);
          }
        }
      }
      return {
        plans: plans.data().count,
        feedback: feedback.data().count,
        ratings: ratings.data().count,
        customProducts: customProducts.data().count,
        ordersCount,
        revenueZAR,
      };
    })
  );

  return {
    users: page.map((u, i) => ({ ...u, ...counts[i] })),
    nextCursor,
  };
});

/* -------------------------- adminGetUser --------------------------- */

interface GetUserArgs { uid: string }

export const adminGetUser = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as GetUserArgs;
  if (!args.uid) throw new HttpsError('invalid-argument', 'uid required.');
  const db = getFirestore();
  const userRef = db.collection('users').doc(args.uid);

  // Wrap each read in safeQuery so a single failing subcollection query
  // (e.g. an index that's still building) doesn't take down the whole
  // detail view with INTERNAL.
  const [
    metaSnap,
    profileSnap,
    plansSnap,
    feedbackSnap,
    ratingsSnap,
    customProductsSnap,
    preferencesSnap,
    stravaMetaSnap,
  ] = await Promise.all([
    safeQuery('getUser-meta', () => userRef.collection('_meta').doc('data').get(), emptyDoc()),
    safeQuery('getUser-profile', () => userRef.collection('profile').doc('data').get(), emptyDoc()),
    safeQuery('getUser-plans', () => userRef.collection('plans').orderBy('updatedAt', 'desc').get(), emptySnap()),
    safeQuery('getUser-feedback', () => userRef.collection('feedback').orderBy('createdAt', 'desc').get(), emptySnap()),
    safeQuery('getUser-ratings', () => userRef.collection('ratings').orderBy('createdAt', 'desc').get(), emptySnap()),
    safeQuery('getUser-customProducts', () => userRef.collection('customProducts').orderBy('createdAt', 'desc').get(), emptySnap()),
    safeQuery('getUser-preferences', () => userRef.collection('preferences').doc('data').get(), emptyDoc()),
    safeQuery('getUser-strava', () => userRef.collection('_meta').doc('strava').get(), emptyDoc()),
  ]);

  // Pull Firebase Auth record as a fallback / enrichment source — _meta only
  // exists for users who have signed in since instrumentation went live.
  const authRecord = await safeQuery(
    'getUser-auth',
    () => getAuth().getUser(args.uid),
    null as UserRecord | null
  );

  const baseMeta = metaSnap.exists ? serializeDoc(metaSnap.data()) : {};
  const meta: Record<string, unknown> = {
    email: (baseMeta.email as string | undefined) ?? authRecord?.email ?? null,
    displayName: (baseMeta.displayName as string | undefined) ?? authRecord?.displayName ?? null,
    photoURL: (baseMeta.photoURL as string | undefined) ?? authRecord?.photoURL ?? null,
    createdAt: baseMeta.createdAt ?? (authRecord?.metadata.creationTime ? new Date(authRecord.metadata.creationTime).getTime() : null),
    lastLoginAt: baseMeta.lastLoginAt ?? (authRecord?.metadata.lastSignInTime ? new Date(authRecord.metadata.lastSignInTime).getTime() : null),
    loginCount: baseMeta.loginCount ?? 0,
    lastSignInProvider: baseMeta.lastSignInProvider ?? authRecord?.providerData[0]?.providerId ?? null,
    disabled: authRecord?.disabled ?? false,
  };
  const email = (meta.email as string | null)?.toLowerCase() ?? null;
  // Needs a composite index on (customer.email ASC, createdAt DESC).
  // Wrap in safeQuery so the page still renders (just with no orders) if
  // the index is missing or still building.
  const ordersSnap = email
    ? await safeQuery(
        'getUser-orders',
        () => db.collection('orders').where('customer.email', '==', email).orderBy('createdAt', 'desc').get(),
        emptySnap()
      )
    : null;

  return {
    uid: args.uid,
    meta,
    profile: profileSnap.exists ? serializeDoc(profileSnap.data()) : null,
    preferences: preferencesSnap.exists ? serializeDoc(preferencesSnap.data()) : null,
    strava: stravaMetaSnap.exists ? serializeDoc(stravaMetaSnap.data()) : null,
    plans: plansSnap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) })),
    feedback: feedbackSnap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) })),
    ratings: ratingsSnap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) })),
    customProducts: customProductsSnap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) })),
    orders: ordersSnap?.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) })) ?? [],
  };
});

function serializeDoc(data: FirebaseFirestore.DocumentData | undefined): Record<string, unknown> {
  if (!data) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Timestamp) out[k] = v.toMillis();
    else if (Array.isArray(v)) out[k] = v.map((x) => (x instanceof Timestamp ? x.toMillis() : x));
    else if (v && typeof v === 'object' && !(v instanceof Buffer)) {
      // Firestore nested objects — recurse one level
      const inner: Record<string, unknown> = {};
      for (const [ik, iv] of Object.entries(v as Record<string, unknown>)) {
        inner[ik] = iv instanceof Timestamp ? iv.toMillis() : iv;
      }
      out[k] = inner;
    } else {
      out[k] = v;
    }
  }
  return out;
}

/* ------------------------- adminListOrders ------------------------- */

interface ListOrdersArgs {
  cursor?: number | null;
  limit?: number;
  status?: string;
  search?: string;
}

export const adminListOrders = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as ListOrdersArgs;
  const limit = Math.max(1, Math.min(200, args.limit ?? 50));
  const search = args.search?.trim().toLowerCase() ?? '';
  const db = getFirestore();

  let q: FirebaseFirestore.Query = db.collection('orders').orderBy('createdAt', 'desc');
  if (args.status && args.status !== 'all') {
    q = q.where('status', '==', args.status);
  }
  if (args.cursor != null) {
    q = q.startAfter(Timestamp.fromMillis(args.cursor));
  }
  const fetchLimit = search ? limit * 4 : limit + 1;
  const snap = await q.limit(fetchLimit).get();

  const rows = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
  const matched = search
    ? rows.filter((r) => {
        const row = r as { customer?: { email?: string; firstName?: string; lastName?: string }; shopify?: { name?: string } };
        const hay = [row.customer?.email, row.customer?.firstName, row.customer?.lastName, row.shopify?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(search);
      })
    : rows;

  const page = matched.slice(0, limit);
  const last = page[page.length - 1] as { createdAt?: number } | undefined;
  const nextCursor = matched.length > limit && last?.createdAt != null ? last.createdAt : null;

  return { orders: page, nextCursor };
});

/* ----------------------- adminListEarlyAccess ---------------------- */

interface ListEarlyAccessArgs {
  cursor?: number | null;
  limit?: number;
  search?: string;
}

export const adminListEarlyAccess = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as ListEarlyAccessArgs;
  const limit = Math.max(1, Math.min(500, args.limit ?? 50));
  const search = args.search?.trim().toLowerCase() ?? '';
  const db = getFirestore();

  let q: FirebaseFirestore.Query = db.collection('earlyAccessRequests').orderBy('createdAt', 'desc');
  if (args.cursor != null) q = q.startAfter(Timestamp.fromMillis(args.cursor));
  const fetchLimit = search ? limit * 4 : limit + 1;
  const snap = await q.limit(fetchLimit).get();

  const rows = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
  const matched = search
    ? rows.filter((r) => {
        const hay = [
          (r as { name?: string }).name,
          (r as { email?: string }).email,
          ((r as { sports?: string[] }).sports ?? []).join(' '),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(search);
      })
    : rows;

  // Aggregate sport distribution across the matched set.
  const sportCounts: Record<string, number> = {};
  for (const r of matched) {
    const sports = (r as { sports?: string[] }).sports ?? [];
    for (const s of sports) sportCounts[s] = (sportCounts[s] ?? 0) + 1;
  }

  const page = matched.slice(0, limit);
  const last = page[page.length - 1] as { createdAt?: number } | undefined;
  const nextCursor = matched.length > limit && last?.createdAt != null ? last.createdAt : null;

  return { rows: page, sportCounts, nextCursor, total: matched.length };
});

/* ------------------------ adminListGutTrainingV2 -------------------- */
// Gut Training v2 (beta) opt-in list + progress — this IS the "record of
// who has opted in" the beta requires. Each opted-in athlete has a
// `users/{uid}/gutTrainingV2Program/data` doc (client writes it once setup
// completes — see gutTrainingV2Program in src/services/firebase/firestore.ts);
// a collectionGroup query here reads across every user the same way
// adminListUsers/adminGetUser already read plans/feedback/ratings.

interface ListGutTrainingV2Args {
  cursor?: number | null;
  limit?: number;
  search?: string;
}

export const adminListGutTrainingV2 = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as ListGutTrainingV2Args;
  const limit = Math.max(1, Math.min(500, args.limit ?? 50));
  const search = args.search?.trim().toLowerCase() ?? '';
  const db = getFirestore();

  const progSnap = await safeQuery('gutTrainingV2-programs', () => db.collectionGroup('gutTrainingV2Program').get(), emptySnap());

  const rows = await Promise.all(progSnap.docs.map(async (d) => {
    const uid = d.ref.parent.parent?.id ?? '';
    const data = d.data() as {
      event?: { name?: string; date?: string; durationHours?: number; distanceKm?: number };
      startGPerHour?: number;
      targetGPerHour?: number;
      currentGPerHour?: number;
      weekNumber?: number;
      status?: string;
      optedInAt?: string;
      updatedAt?: Timestamp;
    };
    const sessionsCount = uid
      ? await safeQuery(`gutTrainingV2-sessions-${uid}`, () => db.collection('users').doc(uid).collection('gutTrainingV2Sessions').count().get(), emptyCount())
      : emptyCount();
    return {
      uid,
      event: data.event ?? null,
      startGPerHour: data.startGPerHour ?? null,
      targetGPerHour: data.targetGPerHour ?? null,
      currentGPerHour: data.currentGPerHour ?? null,
      weekNumber: data.weekNumber ?? null,
      status: data.status ?? null,
      optedInAt: data.optedInAt ?? null,
      updatedAt: tsToMillis(data.updatedAt),
      sessionsCount: sessionsCount.data().count,
    };
  }));

  const authUsers = await safeQuery('gutTrainingV2-auth', () => listAllAuthUsers(), [] as UserRecord[]);
  const emailByUid = new Map(authUsers.map((u) => [u.uid, (u.email ?? '').toLowerCase()]));
  const enriched = rows.map((r) => ({ ...r, email: emailByUid.get(r.uid) ?? '' }));

  const matched = search
    ? enriched.filter((r) => [r.email, r.event?.name].filter(Boolean).join(' ').toLowerCase().includes(search))
    : enriched;

  matched.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const offset = args.cursor ?? 0;
  const page = matched.slice(offset, offset + limit);
  const nextCursor = matched.length > offset + limit ? offset + limit : null;

  return { rows: page, nextCursor, total: matched.length };
});

/* ----------------------- adminListSiteFeedback --------------------- */

interface ListSiteFeedbackArgs {
  cursor?: number | null;
  limit?: number;
  search?: string;
}

export const adminListSiteFeedback = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as ListSiteFeedbackArgs;
  const limit = Math.max(1, Math.min(500, args.limit ?? 50));
  const search = args.search?.trim().toLowerCase() ?? '';
  const db = getFirestore();

  let q: FirebaseFirestore.Query = db.collection('siteFeedback').orderBy('createdAt', 'desc');
  if (args.cursor != null) q = q.startAfter(Timestamp.fromMillis(args.cursor));
  const fetchLimit = search ? limit * 4 : limit + 1;
  const snap = await q.limit(fetchLimit).get();

  const rows = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
  const matched = search
    ? rows.filter((r) => {
        const row = r as { message?: string; email?: string; displayName?: string };
        const hay = [row.message, row.email, row.displayName]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(search);
      })
    : rows;

  const page = matched.slice(0, limit);
  const last = page[page.length - 1] as { createdAt?: number } | undefined;
  const nextCursor = matched.length > limit && last?.createdAt != null ? last.createdAt : null;

  return { rows: page, nextCursor, total: matched.length };
});

/* ------------------------- product analytics ----------------------- */

export const adminProductInsights = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const db = getFirestore();

  const [ratingsSnap, customProductsSnap] = await Promise.all([
    db.collectionGroup('ratings').get(),
    db.collectionGroup('customProducts').get(),
  ]);

  interface RatingAgg { count: number; sumRating: number; sumGut: number; sumTaste: number }
  const byProduct = new Map<string, RatingAgg>();
  const ratingHistogram: number[] = [0, 0, 0, 0, 0, 0]; // index 0 unused, 1..5
  for (const d of ratingsSnap.docs) {
    const r = d.data() as { productId?: string; rating?: number; gutComfort?: number; taste?: number };
    if (!r.productId) continue;
    const agg = byProduct.get(r.productId) ?? { count: 0, sumRating: 0, sumGut: 0, sumTaste: 0 };
    agg.count += 1;
    agg.sumRating += Number(r.rating ?? 0);
    agg.sumGut += Number(r.gutComfort ?? 0);
    agg.sumTaste += Number(r.taste ?? 0);
    byProduct.set(r.productId, agg);
    const rounded = Math.round(Number(r.rating ?? 0));
    if (rounded >= 1 && rounded <= 5) ratingHistogram[rounded] += 1;
  }

  const topRated = Array.from(byProduct.entries())
    .map(([productId, agg]) => ({
      productId,
      count: agg.count,
      avgRating: agg.count > 0 ? agg.sumRating / agg.count : 0,
      avgGut: agg.count > 0 ? agg.sumGut / agg.count : 0,
      avgTaste: agg.count > 0 ? agg.sumTaste / agg.count : 0,
    }))
    .sort((a, b) => (b.avgRating - a.avgRating) || (b.count - a.count))
    .slice(0, 25);

  // Custom-product popularity (by brand/name pair).
  const customByLabel = new Map<string, { count: number; brand: string; name: string; category?: string }>();
  for (const d of customProductsSnap.docs) {
    const cp = d.data() as { brand?: string; name?: string; category?: string };
    const label = `${cp.brand ?? ''}::${cp.name ?? ''}`;
    const cur = customByLabel.get(label) ?? { count: 0, brand: cp.brand ?? '', name: cp.name ?? '', category: cp.category };
    cur.count += 1;
    customByLabel.set(label, cur);
  }
  const topCustom = Array.from(customByLabel.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  return {
    ratingsCount: ratingsSnap.size,
    customProductsCount: customProductsSnap.size,
    ratingHistogram: ratingHistogram.slice(1),
    topRated,
    topCustom,
  };
});

/* ------------------------ activity insights ------------------------ */

export const adminActivityInsights = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as { rangeDays?: number };
  const rangeDays = Math.max(1, Math.min(365, args.rangeDays ?? 90));
  const sinceTs = Timestamp.fromMillis(Date.now() - rangeDays * 86400000);
  const db = getFirestore();

  const [feedbackSnap, plansSnap] = await Promise.all([
    db.collectionGroup('feedback').where('createdAt', '>=', sinceTs).get(),
    db.collectionGroup('plans').where('createdAt', '>=', sinceTs).get(),
  ]);

  let feelSum = 0;
  let executionSum = 0;
  let bonkAny = 0;
  let bonkSevere = 0;
  const gutBuckets: Record<string, number> = { none: 0, mild: 0, moderate: 0, severe: 0 };
  let plannedCarbsSum = 0;
  let actualCarbsSum = 0;
  let actualCarbsCount = 0;
  const recent: Array<Record<string, unknown>> = [];

  for (const d of feedbackSnap.docs) {
    const f = d.data() as {
      overallFeel?: number;
      executionQuality?: number;
      bonkLevel?: number;
      gutIssues?: string;
      plannedCarbs?: number;
      actualCarbs?: number;
      routeName?: string;
      notes?: string;
      createdAt?: Timestamp;
    };
    feelSum += Number(f.overallFeel ?? 0);
    executionSum += Number(f.executionQuality ?? 0);
    if ((f.bonkLevel ?? 0) >= 1) bonkAny += 1;
    if ((f.bonkLevel ?? 0) >= 2) bonkSevere += 1;
    const gi = f.gutIssues ?? 'none';
    if (gi in gutBuckets) gutBuckets[gi] += 1;
    plannedCarbsSum += Number(f.plannedCarbs ?? 0);
    if (typeof f.actualCarbs === 'number') {
      actualCarbsSum += f.actualCarbs;
      actualCarbsCount += 1;
    }
    if (recent.length < 25) {
      recent.push({
        id: d.id,
        uid: d.ref.parent.parent?.id ?? '',
        routeName: f.routeName,
        overallFeel: f.overallFeel,
        executionQuality: f.executionQuality,
        bonkLevel: f.bonkLevel,
        gutIssues: f.gutIssues,
        plannedCarbs: f.plannedCarbs,
        actualCarbs: f.actualCarbs,
        notes: f.notes,
        createdAt: tsToMillis(f.createdAt),
      });
    }
  }

  // Top routes by plan count.
  const routeCounts = new Map<string, { count: number; distanceKm: number; sumElevation: number }>();
  for (const d of plansSnap.docs) {
    const p = d.data() as { routeName?: string; distanceKm?: number; elevationGain?: number };
    const name = (p.routeName || '').trim();
    if (!name) continue;
    const cur = routeCounts.get(name) ?? { count: 0, distanceKm: 0, sumElevation: 0 };
    cur.count += 1;
    cur.distanceKm = Math.max(cur.distanceKm, Number(p.distanceKm ?? 0));
    cur.sumElevation += Number(p.elevationGain ?? 0);
    routeCounts.set(name, cur);
  }
  const topRoutes = Array.from(routeCounts.entries())
    .map(([routeName, v]) => ({ routeName, count: v.count, distanceKm: v.distanceKm, avgElevation: v.count > 0 ? v.sumElevation / v.count : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const fbCount = feedbackSnap.size;
  return {
    rangeDays,
    feedbackCount: fbCount,
    plansCount: plansSnap.size,
    avgOverallFeel: fbCount > 0 ? feelSum / fbCount : 0,
    avgExecutionQuality: fbCount > 0 ? executionSum / fbCount : 0,
    bonkRateAny: fbCount > 0 ? bonkAny / fbCount : 0,
    bonkRateSevere: fbCount > 0 ? bonkSevere / fbCount : 0,
    gutBuckets,
    plannedCarbsAvg: fbCount > 0 ? plannedCarbsSum / fbCount : 0,
    actualCarbsAvg: actualCarbsCount > 0 ? actualCarbsSum / actualCarbsCount : 0,
    actualCarbsCount,
    recent,
    topRoutes,
  };
});

/* ----------------------- admin allowlist mgmt ---------------------- */

export const adminListAdmins = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const snap = await getFirestore().collection('admins').get();
  return {
    seedAdmins: Array.from(SEED_ADMINS),
    admins: snap.docs.map((d) => ({
      email: d.id,
      addedAt: tsToMillis((d.data() as { addedAt?: Timestamp }).addedAt),
      addedBy: (d.data() as { addedBy?: string }).addedBy ?? null,
    })),
  };
});

export const adminAddAdmin = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as { email?: string };
  const email = args.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Valid email required.');
  }
  await getFirestore().collection('admins').doc(email).set({
    addedAt: Timestamp.now(),
    addedBy: ctx.email,
  }, { merge: true });
  logger.info('admin added', { email, by: ctx.email });
  return { ok: true };
});

export const adminRemoveAdmin = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as { email?: string };
  const email = args.email?.trim().toLowerCase();
  if (!email) throw new HttpsError('invalid-argument', 'email required.');
  if (SEED_ADMINS.has(email)) {
    throw new HttpsError('failed-precondition', 'Cannot remove a seed admin (edit functions/src/admin.ts and redeploy).');
  }
  await getFirestore().collection('admins').doc(email).delete();
  logger.info('admin removed', { email, by: ctx.email });
  return { ok: true };
});

// Re-export helper so other admin entry points can share it without re-declaring.
export { chunkedAll };
