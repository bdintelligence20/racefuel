import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { getPostBySlug, type BlogPost as BlogPostData } from '../../services/blog/firestoreBlog';
import { Markdown } from '../../services/blog/markdown';
import { BlogShell } from './BlogIndex';

function formatDate(ms: number | null): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function navigateBlogIndex() {
  if (window.location.pathname !== '/blog') {
    window.history.pushState({}, '', '/blog');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export function BlogPost({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPostData | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPost(undefined);
    (async () => {
      try {
        const p = await getPostBySlug(slug);
        if (!cancelled) setPost(p);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load post.');
          setPost(null);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Drive the browser tab title from the post — small win but it's a blog,
  // people share these links and the OG/title matters in the preview.
  useEffect(() => {
    if (post && post !== undefined) {
      document.title = `${post.title} — Fuel Cue`;
      return () => {
        document.title = 'Fuel Cue';
      };
    }
  }, [post]);

  return (
    <BlogShell>
      <button
        onClick={navigateBlogIndex}
        className="min-h-11 inline-flex items-center gap-1.5 text-[12px] font-mono font-bold uppercase tracking-wider text-[#6B7772] hover:text-[#264C42] transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All posts
      </button>

      {post === undefined && (
        <div className="flex items-center gap-2 text-[#A0929E] text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}

      {post === null && (
        <div className="bg-white border border-[#EAE5DA] rounded-lg px-6 py-10 text-center">
          <AlertCircle className="w-10 h-10 text-[#B23A2C] mx-auto mb-3" />
          <h1 className="text-[18px] font-sans font-bold text-[#1B2320] mb-2">Post not found</h1>
          <p className="text-[15px] text-[#6B7772] max-w-md mx-auto">
            {error ?? `We couldn't find a post with slug "${slug}".`}
          </p>
        </div>
      )}

      {post && (
        <article className="bg-white border border-[#EAE5DA] rounded-lg overflow-hidden">
          {post.coverImageUrl && (
            <div className="aspect-[16/8] w-full overflow-hidden bg-[#EEF4F1]">
              <img
                src={post.coverImageUrl}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="px-6 sm:px-10 py-8 sm:py-10">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#6B7772] mb-3">
              <span>{formatDate(post.publishedAt)}</span>
              {post.readingMinutes && (
                <>
                  <span>·</span>
                  <span>{post.readingMinutes} min read</span>
                </>
              )}
              {post.author && (
                <>
                  <span>·</span>
                  <span>By {post.author}</span>
                </>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-semibold text-[#1B2320] tracking-tight leading-tight mb-4">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="text-[16px] text-[#6B7772] leading-relaxed mb-6 border-l-4 border-[#2F5D50] pl-4">
                {post.excerpt}
              </p>
            )}
            <div className="prose-fuelcue max-w-none">
              <Markdown source={post.body} />
            </div>

            {post.tags && post.tags.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#EAE5DA] flex flex-wrap gap-1.5">
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#EEF4F1] text-[#264C42] border border-[#BCD5CB]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>
      )}
    </BlogShell>
  );
}
