/**
 * Shape of the Article content type as defined in Strapi. See
 * docs/strapi/blog-content-model.md for the matching collection-type schema
 * the CMS must expose for these pages to render.
 *
 * Targets Strapi v5, which returns content fields flattened on the root of
 * each entity (no `attributes` envelope).
 */
export interface StrapiImageFormat {
  url: string;
  width: number;
  height: number;
}

export interface StrapiImage {
  url: string;
  alternativeText?: string | null;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: StrapiImageFormat;
    small?: StrapiImageFormat;
    medium?: StrapiImageFormat;
    large?: StrapiImageFormat;
  };
}

export interface Article {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  /** Rich-text body. Strapi returns either plain markdown (Text/Rich-text v1)
   *  or a structured Blocks array. We accept both here and let the renderer
   *  decide; see src/components/blog/RichText.tsx. */
  body: string | unknown[];
  publishedAt: string;
  author?: string | null;
  coverImage?: StrapiImage | null;
}

export interface StrapiListResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiSingleResponse<T> {
  data: T | null;
  meta: Record<string, unknown>;
}
