import type {
  Article,
  StrapiImage,
  StrapiListResponse,
  StrapiSingleResponse,
} from './strapiTypes';

/**
 * Thin fetch wrapper around the Strapi v5 REST API. Reads VITE_STRAPI_URL at
 * call time so missing config surfaces a clear error instead of a confusing
 * fetch failure. Endpoints are public; the optional VITE_STRAPI_TOKEN is sent
 * only if set, for setups that gate the find/findOne routes behind a
 * read-only token.
 */
function strapiBase(): string {
  const url = import.meta.env.VITE_STRAPI_URL;
  if (!url) {
    throw new Error(
      'VITE_STRAPI_URL is not set. Add your Strapi instance URL to .env to enable the blog.'
    );
  }
  return url.replace(/\/$/, '');
}

function authHeaders(): HeadersInit {
  const token = import.meta.env.VITE_STRAPI_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function strapiFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${strapiBase()}/api${path}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Strapi request failed (${res.status}) for ${path}`);
  }
  return res.json() as Promise<T>;
}

/** Asset URLs in Strapi may be relative (self-hosted) or absolute (Strapi
 *  Cloud + S3). Prefix relative URLs with the API host so <img src> works. */
export function strapiAssetUrl(image: StrapiImage | null | undefined): string | null {
  const url = image?.url;
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${strapiBase()}${url}`;
}

export async function listArticles(signal?: AbortSignal): Promise<Article[]> {
  const json = await strapiFetch<StrapiListResponse<Article>>(
    '/articles?populate=coverImage&sort=publishedAt:desc&pagination[pageSize]=50',
    signal,
  );
  return json.data;
}

export async function getArticleBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<Article | null> {
  const params = new URLSearchParams({
    'filters[slug][$eq]': slug,
    populate: 'coverImage',
    'pagination[pageSize]': '1',
  });
  const json = await strapiFetch<StrapiListResponse<Article>>(
    `/articles?${params.toString()}`,
    signal,
  );
  return json.data[0] ?? null;
}

export type { Article, StrapiImage, StrapiListResponse, StrapiSingleResponse };
