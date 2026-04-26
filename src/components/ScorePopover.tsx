import { useEffect, useRef } from 'react';
import { Info, AlertTriangle, AlertOctagon } from 'lucide-react';
import { ValidationResult } from '../services/nutrition/planValidator';

interface Props {
  validation: ValidationResult;
  onClose: () => void;
}

/** Popover that breaks the plan score down warning-by-warning. Replaces the
 *  warning-pill stack that used to live above the ActionBar — same content,
 *  one home, less screen real estate. */
export function ScorePopover({ validation, onClose }: Props) {
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

  const scoreColor =
    validation.score >= 80 ? 'text-accent' : validation.score >= 50 ? 'text-warm' : 'text-terrain-rust';

  // Only deductions get a row (info-severity warnings can have points: 0).
  const deductions = validation.warnings.filter((w) => w.points > 0);
  const flags = validation.warnings.filter((w) => w.points === 0);

  return (
    <div
      ref={ref}
      className="absolute bottom-full right-0 mb-2 z-40 bg-surface border border-[var(--color-border)] rounded-xl shadow-xl p-4 w-72 max-w-[calc(100vw-1.5rem)]"
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">Plan Score</div>
        <div className={`text-lg font-display font-black tabular-nums ${scoreColor}`}>{validation.score}<span className="text-text-muted text-xs"> / 100</span></div>
      </div>

      <p className="text-[11px] text-text-secondary leading-snug mb-3">
        Starts at 100. Each warning below subtracts points. 80+ is on target, 50–79 has issues, &lt;50 needs work.
      </p>

      {deductions.length === 0 && flags.length === 0 && (
        <div className="text-xs text-text-secondary py-2">No warnings — plan is on target.</div>
      )}

      {deductions.length > 0 && (
        <div className="space-y-2">
          {deductions.map((w) => {
            const Icon = w.severity === 'critical' ? AlertOctagon : AlertTriangle;
            const iconColor = w.severity === 'critical' ? 'text-terrain-rust' : 'text-warm';
            return (
              <div key={w.id} className="flex items-start gap-2 text-[11px]">
                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display font-semibold text-text-primary">{w.message}</span>
                    <span className="font-display font-bold text-terrain-rust tabular-nums whitespace-nowrap">−{w.points}</span>
                  </div>
                  <div className="text-text-muted leading-snug mt-0.5">{w.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {flags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-2">
          {flags.map((w) => (
            <div key={w.id} className="flex items-start gap-2 text-[11px]">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-text-muted" />
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-text-secondary">{w.message}</div>
                <div className="text-text-muted leading-snug mt-0.5">{w.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
