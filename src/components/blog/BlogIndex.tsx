import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, ArrowRight, Newspaper } from 'lucide-react';
import { listPosts, type BlogPost } from '../../services/blog/firestoreBlog';

function formatDate(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function navigateBlog(slug?: string) {
  const to = slug ? `/blog/${slug}` : '/blog';
  if (window.location.pathname !== to) {
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listPosts({ pageSize: 30 });
        if (!cancelled) setPosts(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load posts.');
          setPosts([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <BlogShell>
      <div className="mb-8">
        <button
          onClick={() => {
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
          className="min-h-11 inline-flex items-center gap-1.5 text-[12px] font-mono font-bold uppercase tracking-wider text-[#6B7772] hover:text-[#264C42] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to fuelcue
        </button>
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="w-7 h-7 text-[#2F5D50]" />
          <h1 className="text-4xl font-display font-semibold text-[#1B2320] tracking-tight">The <span className="text-[#5F2B57]">Fuel Log</span></h1>
        </div>
        <p className="text-[14px] text-[#6B5A7A] max-w-xl">
          Race nutrition, training intel, and product deep-dives from the Fuel Cue team.
        </p>
      </div>

      {posts === null ? (
        <div className="flex items-center gap-2 text-[#A0929E] text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading posts…
        </div>
      ) : error ? (
        <Placeholder>{error}</Placeholder>
      ) : posts.length === 0 ? (
        <Placeholder>No posts yet — check back soon.</Placeholder>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {posts.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => navigateBlog(p.slug)}
                className="group block w-full text-left bg-white border border-[#EAE5DA] rounded-lg overflow-hidden hover:border-[#2F5D50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D50] transition-colors"
              >
                {p.coverImageUrl && (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-[#EEF4F1]">
                    <img
                      src={p.coverImageUrl}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#6B7772] mb-2">
                    <span>{formatDate(p.publishedAt)}</span>
                    {p.readingMinutes && (
                      <>
                        <span>·</span>
                        <span>{p.readingMinutes} min read</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-[19px] font-sans font-bold text-[#1B2320] mb-2 leading-snug group-hover:text-[#264C42] transition-colors">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-[15px] text-[#6B7772] leading-relaxed line-clamp-3">{p.excerpt}</p>
                  )}
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-[#2F5D50]">
                    Read post <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BlogShell>
  );
}

export function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">{children}</div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#EAE5DA] rounded-lg px-6 py-10 text-center">
      <Newspaper className="w-10 h-10 text-[#6B7772] mx-auto mb-3" />
      <p className="text-[15px] text-[#6B7772] max-w-md mx-auto">{children}</p>
    </div>
  );
}
