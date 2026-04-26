import { useEffect, useRef } from 'react';

type Sport = 'run' | 'cycle' | 'hike';
type Surface = 'road' | 'trail' | 'mountain';

interface Props {
  sport: Sport | undefined;
  surface: Surface | undefined;
  onSaveSport: (sport: Sport | undefined) => void;
  onSaveSurface: (surface: Surface | undefined) => void;
  onClose: () => void;
}

const SPORTS: Array<{ value: Sport; label: string }> = [
  { value: 'run', label: 'Run' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'hike', label: 'Hike' },
];

const SURFACES: Array<{ value: Surface; label: string }> = [
  { value: 'road', label: 'Road' },
  { value: 'trail', label: 'Trail' },
  { value: 'mountain', label: 'Mountain' },
];

/** Popover for the per-route sport + surface override. The estimator re-runs
 *  inside AppContext when either changes, so the chip's "Time" sibling
 *  updates immediately. */
export function RouteSportEditor({ sport, surface, onSaveSport, onSaveSurface, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-40 bg-surface border border-[var(--color-border)] rounded-xl shadow-xl p-3 w-60 max-w-[calc(100vw-1.5rem)]"
    >
      <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider mb-2">
        Route sport &amp; surface
      </div>

      <div className="text-[9px] text-text-muted font-display uppercase tracking-wider mb-1">Sport</div>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {SPORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onSaveSport(s.value)}
            className={`py-1.5 rounded-md text-xs font-display font-semibold transition-colors ${
              sport === s.value
                ? 'bg-warm text-white'
                : 'bg-surfaceHighlight text-text-secondary hover:bg-warm/[0.08]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="text-[9px] text-text-muted font-display uppercase tracking-wider mb-1">Surface</div>
      <div className="grid grid-cols-3 gap-1">
        {SURFACES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onSaveSurface(s.value)}
            className={`py-1.5 rounded-md text-xs font-display font-semibold transition-colors ${
              (surface ?? 'road') === s.value
                ? 'bg-accent text-white'
                : 'bg-surfaceHighlight text-text-secondary hover:bg-accent/[0.08]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            onSaveSport(undefined);
            onSaveSurface(undefined);
          }}
          className="flex-1 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary border border-[var(--color-border)] hover:bg-surfaceHighlight transition-colors"
        >
          Auto
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-1.5 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider bg-warm text-white hover:bg-warm-light transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
