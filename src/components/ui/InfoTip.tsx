import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

/**
 * Tap-to-explain term definition. The brief is explicit: information icons must
 * "explain themselves on tap or be removed", and technical terms (carb load,
 * intensity zone, salt tab) must be "defined inline or on tap". A beginner
 * should feel capable, not stupid.
 *
 * Native `title=` tooltips only work on hover, so they're invisible on the
 * phone — which is exactly where the brief says the centre of gravity is. This
 * is a real, tappable popover that works on touch: tap the icon, read a plain-
 * language sentence, tap anywhere to dismiss.
 */
export function InfoTip({ label, text, className = '' }: { label: string; text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <span ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        className="inline-flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
      >
        <Info className="w-3 h-3" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 max-w-[70vw] bg-surface border border-[var(--color-border)] rounded-lg shadow-xl px-2.5 py-2 text-left pointer-events-none"
        >
          <span className="block text-[11px] font-display font-bold text-text-primary mb-0.5">{label}</span>
          <span className="block text-[11px] font-display text-text-secondary leading-snug">{text}</span>
        </span>
      )}
    </span>
  );
}
