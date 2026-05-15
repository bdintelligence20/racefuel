import './firebase';
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

/**
 * Blog posts on Firestore.
 *
 *   posts/{postId}
 *     slug:           string  (unique, kebab-case)
 *     title:          string
 *     excerpt:        string|null
 *     body:           string   // Markdown — rendered by the SPA's tiny renderer
 *     coverImageUrl:  string|null
 *     author:         string
 *     tags:           string[]
 *     readingMinutes: number|null
 *     seoTitle:       string|null
 *     seoDescription: string|null
 *     published:      boolean
 *     publishedAt:    Timestamp   // when this becomes visible
 *     createdAt:      Timestamp
 *     updatedAt:      Timestamp
 *     createdBy:      string  (admin email)
 *     updatedBy:      string  (admin email)
 *
 * The SPA reads `posts` directly via Firestore SDK — rules permit reads only
 * when `published == true` and `publishedAt <= now`. Admin writes go through
 * these callables (admin SDK bypasses rules).
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

function normaliseSlug(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) return null;
  return slug;
}

function tsToMillis(v: unknown): number | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'object' && v !== null && 'toMillis' in v) {
    try { return (v as { toMillis(): number }).toMillis(); } catch { return null; }
  }
  if (typeof v === 'number') return v;
  return null;
}

interface PostRowOut {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  author: string;
  tags: string[];
  readingMinutes: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  published: boolean;
  publishedAt: number | null;
  createdAt: number | null;
  updatedAt: number | null;
  createdBy: string | null;
  updatedBy: string | null;
}

function rowToOut(id: string, d: Record<string, unknown>): PostRowOut {
  return {
    id,
    slug: String(d.slug ?? ''),
    title: String(d.title ?? ''),
    excerpt: (d.excerpt as string | null) ?? null,
    body: String(d.body ?? ''),
    coverImageUrl: (d.coverImageUrl as string | null) ?? null,
    author: String(d.author ?? 'Fuel Cue'),
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    readingMinutes: (d.readingMinutes as number | null) ?? null,
    seoTitle: (d.seoTitle as string | null) ?? null,
    seoDescription: (d.seoDescription as string | null) ?? null,
    published: Boolean(d.published),
    publishedAt: tsToMillis(d.publishedAt),
    createdAt: tsToMillis(d.createdAt),
    updatedAt: tsToMillis(d.updatedAt),
    createdBy: (d.createdBy as string | null) ?? null,
    updatedBy: (d.updatedBy as string | null) ?? null,
  };
}

/* ----------------------------- callables ----------------------------- */

export const adminListPosts = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const snap = await getFirestore()
    .collection('posts')
    .orderBy('updatedAt', 'desc')
    .limit(500)
    .get();
  const rows = snap.docs.map((d) => rowToOut(d.id, d.data() as Record<string, unknown>));
  return { rows };
});

export const adminGetPost = onCall({ region: REGION }, async (request) => {
  await assertAdmin(request);
  const args = (request.data ?? {}) as { id?: string };
  if (!args.id) throw new HttpsError('invalid-argument', 'id required.');
  const ref = getFirestore().collection('posts').doc(args.id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Post not found.');
  return rowToOut(snap.id, snap.data() as Record<string, unknown>);
});

export const adminUpsertPost = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as {
    id?: string | null;
    slug?: string;
    title?: string;
    excerpt?: string | null;
    body?: string;
    coverImageUrl?: string | null;
    author?: string;
    tags?: string[];
    readingMinutes?: number | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    published?: boolean;
    publishedAt?: number | null;
  };

  const slug = normaliseSlug(args.slug);
  if (!slug) throw new HttpsError('invalid-argument', 'Invalid slug — use kebab-case (a-z, 0-9, -).');
  if (!args.title?.trim()) throw new HttpsError('invalid-argument', 'Title required.');
  if (!args.body?.trim()) throw new HttpsError('invalid-argument', 'Body required.');

  const fs = getFirestore();

  // Slug uniqueness — Firestore lets us hit the index directly.
  const dupSnap = await fs.collection('posts').where('slug', '==', slug).limit(2).get();
  for (const d of dupSnap.docs) {
    if (d.id !== args.id) {
      throw new HttpsError('already-exists', `Another post already uses the slug "${slug}".`);
    }
  }

  const publishedAtMs = args.publishedAt ?? Date.now();
  const patch: Record<string, unknown> = {
    slug,
    title: args.title.trim().slice(0, 200),
    excerpt: args.excerpt?.trim() ? args.excerpt.trim().slice(0, 400) : null,
    body: args.body,
    coverImageUrl: args.coverImageUrl?.trim() ? args.coverImageUrl.trim() : null,
    author: args.author?.trim() || 'Fuel Cue',
    tags: Array.isArray(args.tags) ? args.tags.filter((t) => typeof t === 'string').slice(0, 12) : [],
    readingMinutes: typeof args.readingMinutes === 'number' && args.readingMinutes > 0 ? Math.round(args.readingMinutes) : null,
    seoTitle: args.seoTitle?.trim() ? args.seoTitle.trim().slice(0, 80) : null,
    seoDescription: args.seoDescription?.trim() ? args.seoDescription.trim().slice(0, 240) : null,
    published: args.published === true,
    publishedAt: Timestamp.fromMillis(publishedAtMs),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: ctx.email,
  };

  if (args.id) {
    const ref = fs.collection('posts').doc(args.id);
    const existing = await ref.get();
    if (!existing.exists) throw new HttpsError('not-found', 'Post not found.');
    await ref.update(patch);
    logger.info('Post updated', { id: args.id, slug, by: ctx.email });
    return { ok: true, id: args.id, slug };
  } else {
    const ref = fs.collection('posts').doc();
    await ref.set({
      ...patch,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: ctx.email,
    });
    logger.info('Post created', { id: ref.id, slug, by: ctx.email });
    return { ok: true, id: ref.id, slug };
  }
});

export const adminDeletePost = onCall({ region: REGION }, async (request) => {
  const ctx = await assertAdmin(request);
  const args = (request.data ?? {}) as { id?: string };
  if (!args.id) throw new HttpsError('invalid-argument', 'id required.');
  await getFirestore().collection('posts').doc(args.id).delete();
  logger.info('Post deleted', { id: args.id, by: ctx.email });
  return { ok: true };
});
