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
          className="inline-flex items-center gap-1.5 text-[12px] font-display font-bold uppercase tracking-wider text-[#A0929E] hover:text-[#3D2152] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to fuelcue
        </button>
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="w-7 h-7 text-[#F5A020]" />
          <h1 className="text-4xl font-display font-black text-[#3D2152] tracking-tight">The Fuel Log</h1>
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
                className="group block w-full text-left bg-white border border-[#3D2152]/10 rounded-2xl overflow-hidden shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)] hover:shadow-[0_6px_16px_-8px_rgba(61,33,82,0.18)] hover:border-[#F5A020]/40 transition-all"
              >
                {p.coverImageUrl && (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-[#FFF9F0]">
                    <img
                      src={p.coverImageUrl}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-[10px] font-display font-bold uppercase tracking-[0.18em] text-[#A0929E] mb-2">
                    <span>{formatDate(p.publishedAt)}</span>
                    {p.readingMinutes && (
                      <>
                        <span>·</span>
                        <span>{p.readingMinutes} min read</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-[19px] font-display font-bold text-[#3D2152] mb-2 leading-snug group-hover:text-[#F5A020] transition-colors">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-[13px] text-[#6B5A7A] leading-relaxed line-clamp-3">{p.excerpt}</p>
                  )}
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider text-[#F5A020]">
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
    <div className="min-h-screen bg-[#FFF9F0] font-sans">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">{children}</div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#3D2152]/10 rounded-2xl px-6 py-10 text-center">
      <Newspaper className="w-10 h-10 text-[#A0929E] mx-auto mb-3" />
      <p className="text-[13px] text-[#6B5A7A] max-w-md mx-auto">{children}</p>
    </div>
  );
}
