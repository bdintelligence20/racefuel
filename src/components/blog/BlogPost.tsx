import { useEffect, useState } from 'react';
import { getArticleBySlug, strapiAssetUrl, type Article } from '../../services/strapi';
import { BlogShell } from './BlogShell';
import { formatPublishedAt } from './blogUtils';
import { RichText } from './RichText';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'ok'; article: Article };

export function BlogPost({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    getArticleBySlug(slug, ctrl.signal)
      .then((article) => {
        if (!article) setState({ status: 'not-found' });
        else setState({ status: 'ok', article });
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to load article.';
        setState({ status: 'error', message });
      });
    return () => ctrl.abort();
  }, [slug]);

  // Bump <title> for sharing previews while the SPA is rendered. Strapi-side
  // SEO meta will need SSR/prerender, which is out of scope for v1.
  useEffect(() => {
    if (state.status === 'ok') {
      const original = document.title;
      document.title = `${state.article.title} — fuelcue blog`;
      return () => {
        document.title = original;
      };
    }
  }, [state]);

  return (
    <BlogShell back={{ href: '/blog', label: 'All articles' }}>
      {state.status === 'loading' && <LoadingArticle />}
      {state.status === 'error' && (
        <Panel
          eyebrow="Couldn't load article"
          body={<p className="text-[14px] text-text-secondary leading-relaxed">{state.message}</p>}
        />
      )}
      {state.status === 'not-found' && (
        <Panel
          eyebrow="Not found"
          body={
            <p className="text-[14px] text-text-secondary leading-relaxed">
              No article matches this URL. <a className="text-warm hover:underline" href="/blog">Browse all articles.</a>
            </p>
          }
        />
      )}
      {state.status === 'ok' && <ArticleBody article={state.article} />}
    </BlogShell>
  );
}

function ArticleBody({ article }: { article: Article }) {
  const cover = strapiAssetUrl(article.coverImage);
  return (
    <article>
      <div className="text-[12px] font-display uppercase tracking-wider text-text-muted mb-2">
        {formatPublishedAt(article.publishedAt)}
        {article.author ? <span> · {article.author}</span> : null}
      </div>
      <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-text-primary mb-6">
        {article.title}
      </h1>
      {cover && (
        <img
          src={cover}
          alt={article.coverImage?.alternativeText ?? ''}
          className="rounded-xl mb-8 w-full h-auto"
        />
      )}
      {article.excerpt && (
        <div className="rounded-xl bg-surfaceHighlight border border-[var(--color-border)] p-5 mb-8 text-[14px] leading-relaxed text-text-primary">
          {article.excerpt}
        </div>
      )}
      <div className="text-[14px] leading-relaxed text-text-secondary">
        <RichText body={article.body} />
      </div>
    </article>
  );
}

function LoadingArticle() {
  return (
    <div className="space-y-4">
      <div className="h-3 w-32 bg-surfaceHighlight rounded animate-pulse" />
      <div className="h-8 w-3/4 bg-surfaceHighlight rounded animate-pulse" />
      <div className="h-48 w-full bg-surfaceHighlight rounded-xl animate-pulse" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-surfaceHighlight rounded animate-pulse" />
        <div className="h-3 w-5/6 bg-surfaceHighlight rounded animate-pulse" />
        <div className="h-3 w-4/6 bg-surfaceHighlight rounded animate-pulse" />
      </div>
    </div>
  );
}

function Panel({ eyebrow, body }: { eyebrow: string; body: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-surfaceHighlight p-5">
      <div className="text-[10px] font-display font-bold text-warm uppercase tracking-wider mb-2">
        {eyebrow}
      </div>
      {body}
    </div>
  );
}
