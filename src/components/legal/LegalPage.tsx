import { ArrowLeft } from 'lucide-react';

/**
 * Shared layout for legal pages. Renders a centered scrollable column with
 * a header, last-updated date, and section tree. Pages stay public (no
 * auth gate) so they can be linked from the OAuth consent screen, Stitch
 * checkout, and email footers.
 *
 * NOT a substitute for legal review — copy is reasonable boilerplate for a
 * South-African direct-to-consumer endurance-nutrition product but each
 * section should be checked by your lawyer before relying on it.
 */
export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

interface LegalPageProps {
  title: string;
  /** Display string, e.g. "7 May 2026". */
  lastUpdated: string;
  /** Plain-language summary that appears above the long-form sections. */
  intro: React.ReactNode;
  sections: LegalSection[];
}

export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary font-sans">
      <header className="border-b border-[var(--color-border)] bg-surface sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary text-[12px] font-display"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </a>
          <img src="/logo.png" alt="fuelcue" className="h-7 w-auto ml-2" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-text-primary mb-2">
          {title}
        </h1>
        <p className="text-[12px] font-display uppercase tracking-wider text-text-muted mb-6">
          Last updated: {lastUpdated}
        </p>

        <div className="rounded-xl bg-surfaceHighlight border border-[var(--color-border)] p-5 mb-10">
          <div className="text-[10px] font-display font-bold text-warm uppercase tracking-wider mb-2">
            In plain language
          </div>
          <div className="text-[14px] leading-relaxed text-text-primary">{intro}</div>
        </div>

        <article className="space-y-8 text-[14px] leading-relaxed text-text-secondary">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-[15px] font-display font-bold uppercase tracking-wider text-text-primary mb-2">
                {i + 1}. {s.heading}
              </h2>
              <div className="space-y-3">{s.body}</div>
            </section>
          ))}
        </article>

        <footer className="mt-12 pt-6 border-t border-[var(--color-border)] text-[12px] text-text-muted font-display">
          <p>
            Questions? Email{' '}
            <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">
              hello@fuelcue.com
            </a>
            .
          </p>
          <p className="mt-2">
            <a className="hover:text-text-primary" href="/privacy">Privacy</a>
            <span className="mx-2 text-text-muted/50">·</span>
            <a className="hover:text-text-primary" href="/terms">Terms</a>
            <span className="mx-2 text-text-muted/50">·</span>
            <a className="hover:text-text-primary" href="/cookies">Cookies</a>
            <span className="mx-2 text-text-muted/50">·</span>
            <a className="hover:text-text-primary" href="/shipping-returns">Shipping &amp; Returns</a>
          </p>
        </footer>
      </main>
    </div>
  );
}

/** Helper for rendering a paragraph inside a legal section. */
export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

/** Bullet list for legal sections — keeps spacing consistent. */
export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-outside pl-5 space-y-1.5 text-text-secondary">{children}</ul>;
}
