import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { listArticles, strapiAssetUrl, type Article } from '../../services/strapi';
import { BlogShell } from './BlogShell';
import { formatPublishedAt } from './blogUtils';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; articles: Article[] };

export function BlogIndex() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const ctrl = new AbortController();
    listArticles(ctrl.signal)
      .then((articles) => setState({ status: 'ok', articles }))
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to load articles.';
        setState({ status: 'error', message });
      });
    return () => ctrl.abort();
  }, []);

  return (
    <BlogShell>
      <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-text-primary mb-2">
        Blog
      </h1>
      <p className="text-[13px] font-display text-text-muted mb-10">
        Race-day nutrition, training fuel, and what we're learning building fuelcue.
      </p>

      {state.status === 'loading' && <LoadingList />}
      {state.status === 'error' && <ErrorPanel message={state.message} />}
      {state.status === 'ok' && state.articles.length === 0 && <EmptyPanel />}
      {state.status === 'ok' && state.articles.length > 0 && (
        <ul className="space-y-8">
          {state.articles.map((article) => (
            <li key={article.id}>
              <ArticleCard article={article} />
            </li>
          ))}
        </ul>
      )}
    </BlogShell>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const cover = strapiAssetUrl(article.coverImage);
  return (
    <a
      href={`/blog/${article.slug}`}
      className="group block rounded-xl border border-[var(--color-border)] bg-surface overflow-hidden hover:border-warm/60 transition-colors"
    >
      {cover && (
        <img
          src={cover}
          alt={article.coverImage?.alternativeText ?? ''}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
      )}
      <div className="p-5">
        <div className="text-[10px] font-display font-bold text-warm uppercase tracking-wider mb-2">
          {formatPublishedAt(article.publishedAt)}
          {article.author ? <span className="text-text-muted"> · {article.author}</span> : null}
        </div>
        <h2 className="text-[20px] font-display font-bold text-text-primary mb-2 group-hover:text-warm transition-colors">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="text-[14px] text-text-secondary leading-relaxed mb-3 line-clamp-3">
            {article.excerpt}
          </p>
        )}
        <span className="inline-flex items-center gap-1.5 text-[12px] font-display font-bold text-warm">
          Read article
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </a>
  );
}

function LoadingList() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--color-border)] bg-surface overflow-hidden"
        >
          <div className="h-48 bg-surfaceHighlight animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="h-3 w-24 bg-surfaceHighlight rounded animate-pulse" />
            <div className="h-5 w-2/3 bg-surfaceHighlight rounded animate-pulse" />
            <div className="h-3 w-full bg-surfaceHighlight rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-surfaceHighlight p-5">
      <div className="text-[10px] font-display font-bold text-warm uppercase tracking-wider mb-2">
        Couldn't load articles
      </div>
      <p className="text-[14px] text-text-secondary leading-relaxed">{message}</p>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-surfaceHighlight p-5">
      <div className="text-[10px] font-display font-bold text-warm uppercase tracking-wider mb-2">
        Nothing here yet
      </div>
      <p className="text-[14px] text-text-secondary leading-relaxed">
        Articles will appear here as soon as the first post is published in Strapi.
      </p>
    </div>
  );
}
