import { useEffect, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { BetaBannerState } from '../hooks/useGutBetaBanner';

/**
 * The prominent full-width opt-in banner. Rendered only when `state.visible`
 * (the caller — TopBanners — swaps it in for the site-feedback banner, so only
 * one global banner owns the top slot / --banner-h at a time).
 *
 * Palette: plum accents on cream, used sparingly — the surround stays cream,
 * plum carries the icon, the headline, and the primary action. All colours via
 * brand tokens, no hardcoded hexes.
 */
export function GutTrainingBetaBanner({ state }: { state: BetaBannerState }) {
  const ref = useRef<HTMLDivElement>(null);

  // Publish the measured height as --banner-h so the rest of the shell offsets
  // beneath it (same contract the site-feedback banner uses).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--banner-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--banner-h');
    };
  }, []);

  return (
    <>
      <div
        ref={ref}
        role="region"
        aria-label="Gut-training beta invitation"
        className="fixed top-0 left-0 right-0 z-[60] bg-surface border-b border-[var(--color-border)] shadow-[0_2px_10px_-6px_var(--color-accent)] safe-top"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex items-center gap-3">
          <div className="hidden sm:flex w-8 h-8 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-display font-bold text-text-primary leading-tight truncate">
              Train your gut for race day
            </div>
            <div className="text-[11.5px] font-sans text-text-secondary leading-tight truncate">
              You've got early access to the gut-training beta.
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={state.join}
              disabled={state.pending}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-accent text-white text-[11.5px] font-display font-bold hover:bg-accent-light transition-colors disabled:opacity-50"
            >
              {state.pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Join the beta
            </button>
            <button
              onClick={state.dismiss}
              disabled={state.pending}
              className="px-2.5 sm:px-3 py-2 rounded-lg text-[11.5px] font-display font-semibold text-text-secondary hover:text-text-primary hover:bg-accent/[0.06] transition-colors disabled:opacity-50"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
      {/* Spacer so naturally-flowing screens aren't covered by the fixed bar. */}
      <div aria-hidden="true" style={{ height: 'var(--banner-h, 0px)' }} />
    </>
  );
}
