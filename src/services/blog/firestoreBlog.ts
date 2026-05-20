import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { firestore } from '../firebase/config';

/**
 * Public, client-side reads of the `posts` collection.
 *
 * Rules permit reads only where `published == true` and `publishedAt <= now`,
 * so every query here must constrain on those fields. The admin UI uses
 * adminListPosts / adminGetPost callables instead — those return drafts too.
 */

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  author: string;
  tags: string[];
  readingMinutes: number | null;
  publishedAt: number | null;
  updatedAt: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
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

function rowToPost(id: string, d: Record<string, unknown>): BlogPost {
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
    publishedAt: tsToMillis(d.publishedAt),
    updatedAt: tsToMillis(d.updatedAt),
    seoTitle: (d.seoTitle as string | null) ?? null,
    seoDescription: (d.seoDescription as string | null) ?? null,
  };
}

export async function listPosts(opts: { pageSize?: number } = {}): Promise<BlogPost[]> {
  const q = query(
    collection(firestore, 'posts'),
    where('published', '==', true),
    where('publishedAt', '<=', Timestamp.now()),
    orderBy('publishedAt', 'desc'),
    limit(opts.pageSize ?? 30),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => rowToPost(d.id, d.data()));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  // The `posts` read rule is `published == true && publishedAt <= request.time`.
  // Firestore rules are not filters: a query is rejected with permission-denied
  // unless its constraints *prove* every result satisfies the rule. So this
  // query MUST carry both the `published == true` and `publishedAt <=` filters —
  // omitting the latter (as an earlier version did) makes every blog-post page
  // fail with "Missing or insufficient permissions". Mirrors listPosts().
  const q = query(
    collection(firestore, 'posts'),
    where('slug', '==', slug),
    where('published', '==', true),
    where('publishedAt', '<=', Timestamp.now()),
    orderBy('publishedAt', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  return rowToPost(first.id, first.data());
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  const snap = await getDoc(doc(firestore, 'posts', id));
  if (!snap.exists()) return null;
  return rowToPost(snap.id, snap.data() as Record<string, unknown>);
}
