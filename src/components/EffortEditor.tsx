import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number | undefined;
  onSave: (effort: number | undefined) => void;
  onClose: () => void;
}

/** Popover slider that maps a perceived-effort 1–10 onto the planner's
 *  intensity input. Saving "auto" clears the override so the planner goes
 *  back to inferring intensity from pace + elevation. */
export function EffortEditor({ value, onSave, onClose }: Props) {
  const [effort, setEffort] = useState<number>(value ?? 6);
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

  const label = effort <= 3 ? 'Easy' : effort <= 6 ? 'Moderate' : effort <= 8 ? 'Hard' : 'Max';
  const description =
    effort <= 3
      ? 'Conversational pace. Glycogen handles most of it; fuel light.'
      : effort <= 6
      ? 'Steady training effort. Spec-tier fueling.'
      : effort <= 8
      ? 'Race pace. Higher carb target; caffeine on.'
      : 'All-out. Upper gut-tolerance territory.';

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-40 bg-surface border border-[var(--color-border)] rounded-xl shadow-xl p-4 w-64 max-w-[calc(100vw-1.5rem)]"
    >
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">Perceived Effort</div>
          <div className="text-lg font-display font-bold text-text-primary">
            {effort}/10 · <span className="text-warm">{label}</span>
          </div>
        </div>
        {value != null && (
          <button
            type="button"
            onClick={() => onSave(undefined)}
            className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surfaceHighlight transition-colors"
          >
            Auto
          </button>
        )}
      </div>

      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={effort}
        onChange={(e) => setEffort(parseInt(e.target.value, 10))}
        className="w-full accent-warm"
        aria-label="Perceived effort 1 to 10"
      />
      <div className="flex justify-between text-[9px] text-text-muted font-display mt-0.5">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>

      <p className="text-[11px] text-text-secondary mt-2 leading-snug">{description}</p>

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] text-text-primary text-xs font-display font-bold uppercase tracking-wider hover:bg-accent/[0.08] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(effort)}
          className="flex-1 py-2 rounded-lg bg-warm text-white text-xs font-display font-bold uppercase tracking-wider hover:bg-warm-light transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
