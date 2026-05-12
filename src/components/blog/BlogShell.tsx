import { ArrowLeft } from 'lucide-react';

/**
 * Shared header + footer chrome for /blog pages. Mirrors the LegalPage shell
 * so the blog inherits the same public-page typography and link styling.
 */
export function BlogShell({
  back,
  children,
}: {
  /** Optional back link target. Defaults to "/" (home). */
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const backLink = back ?? { href: '/', label: 'Home' };
  return (
    <div className="min-h-screen bg-background text-text-primary font-sans">
      <header className="border-b border-[var(--color-border)] bg-surface sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <a
            href={backLink.href}
            className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary text-[12px] font-display"
          >
            <ArrowLeft className="w-4 h-4" /> {backLink.label}
          </a>
          <img src="/logo.png" alt="fuelcue" className="h-7 w-auto ml-2" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">{children}</main>
    </div>
  );
}
