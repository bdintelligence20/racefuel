import { useEffect, useRef, useState } from 'react';
import { Check, X, RotateCcw } from 'lucide-react';

interface EstimatedTimeEditorProps {
  /** Current effective value in "H:MM" or "H:MM:SS" format. */
  value: string;
  /** Whether the current value is user-set (vs auto-estimated). Controls the "Reset to auto" button. */
  isUserSet: boolean;
  onSave: (hms: string) => void;
  /** Called when the user clears their override and reverts to the auto-estimated value. */
  onClear: () => void;
  onClose: () => void;
}

function splitHM(value: string): { h: number; m: number } {
  const parts = value.split(':').map((p) => parseInt(p, 10) || 0);
  return { h: parts[0] ?? 0, m: parts[1] ?? 0 };
}

export function EstimatedTimeEditor({ value, isUserSet, onSave, onClear, onClose }: EstimatedTimeEditorProps) {
  const initial = splitHM(value);
  const [hours, setHours] = useState<string>(String(initial.h));
  const [minutes, setMinutes] = useState<string>(String(initial.m).padStart(2, '0'));
  const rootRef = useRef<HTMLDivElement>(null);

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

  const handleSave = () => {
    const h = Math.max(0, Math.min(99, parseInt(hours, 10) || 0));
    const m = Math.max(0, Math.min(59, parseInt(minutes, 10) || 0));
    if (h === 0 && m === 0) return;
    onSave(`${h}:${String(m).padStart(2, '0')}:00`);
    onClose();
  };

  return (
    <div
      ref={rootRef}
      className="absolute top-full left-0 mt-2 z-30 w-[240px] bg-surface border border-[var(--color-border)] rounded-xl shadow-xl p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-display text-text-muted uppercase tracking-wider font-semibold">
          Expected time
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <div className="text-[9px] font-display text-text-muted uppercase tracking-wider mb-1">Hours</div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="w-full h-10 px-2 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] text-text-primary text-lg font-display font-bold text-center focus:outline-none focus:border-warm focus:ring-1 focus:ring-warm/20"
            autoFocus
          />
        </label>
        <span className="text-xl font-display font-bold text-text-muted pb-2">:</span>
        <label className="flex-1">
          <div className="text-[9px] font-display text-text-muted uppercase tracking-wider mb-1">Minutes</div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full h-10 px-2 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] text-text-primary text-lg font-display font-bold text-center focus:outline-none focus:border-warm focus:ring-1 focus:ring-warm/20"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        {isUserSet && (
          <button
            onClick={() => {
              onClear();
              onClose();
            }}
            className="flex items-center gap-1 px-2 py-2 rounded-lg text-[11px] font-display font-medium text-text-muted hover:text-text-primary hover:bg-surfaceHighlight transition-colors"
            title="Reset to auto-estimated time"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Auto
          </button>
        )}
        <button
          onClick={handleSave}
          className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-warm text-white text-xs font-display font-bold uppercase tracking-wider hover:bg-warm-light active:scale-[0.98] transition-all"
        >
          <Check className="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </div>
  );
}
