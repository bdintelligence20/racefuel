import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind classes for the desktop popover wrapper — each chip editor
   *  has its own width / padding / z-index etc. and passes them in here. */
  desktopClassName: string;
}

/** Shared wrapper for the CONFIG chip editors (Time / Date / Effort / Sport).
 *
 *  Mobile: renders a fixed bottom-sheet via `createPortal` to `document.body`
 *  with a tappable backdrop. The portal sidesteps ancestor transforms /
 *  overflow:hidden / containing-block traps inside the map area that were
 *  clipping the sheet on iOS Safari.
 *
 *  Desktop: renders inline as an absolute popover positioned below the chip
 *  — identical behaviour to before this wrapper existed. */
export function ChipEditor({ onClose, children, desktopClassName }: Props) {
  const [isLg, setIsLg] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLg(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);

  // Tap-outside-to-close + Escape. Each editor used to manage its own
  // listener; centralising it here means both branches share identical
  // behaviour.
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (isLg) {
    return (
      <div ref={rootRef} className={desktopClassName}>
        {children}
      </div>
    );
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[80] bg-[#3D2152]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={rootRef}
        className="fixed left-0 right-0 bottom-0 z-[81] max-h-[85dvh] flex flex-col bg-surface border-t border-[var(--color-border)] shadow-2xl rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {/* Sticky header — drag handle + X close. Stays pinned while the
            content below scrolls so the close affordance is always reachable. */}
        <div className="relative flex-shrink-0 pt-2 pb-1">
          <div
            aria-hidden
            className="mx-auto h-1 w-10 rounded-full bg-[var(--color-border)]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-1 right-1 w-9 h-9 flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-surfaceHighlight transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-2">{children}</div>
      </div>
    </>,
    document.body
  );
}
