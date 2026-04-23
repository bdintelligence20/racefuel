import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  /** Current ISO date (YYYY-MM-DD) or undefined. */
  value: string | undefined;
  onSave: (isoDate: string | undefined) => void;
  onClose: () => void;
}

/**
 * Controlled calendar popover — purpose-built to match the Time/Effort chip
 * pattern and sidestep the years of native <input type="date"> cross-browser
 * flakiness. Renders a month grid the user taps through; Today and Clear
 * actions sit below.
 */
export function DateEditor({ value, onSave, onClose }: Props) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const initial = value ? parseIso(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth()); // 0–11
  const [selected, setSelected] = useState<string | undefined>(value);
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

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  // Display Monday-first to match most race-cal conventions.
  const leadingBlanks = (firstDayOfMonth + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const pick = (day: number) => {
    const iso = toIso(viewYear, viewMonth, day);
    if (iso < todayIso) return; // block past dates — weather forecast only goes forward
    setSelected(iso);
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };
  const handleToday = () => {
    setSelected(todayIso);
    setViewYear(new Date().getFullYear());
    setViewMonth(new Date().getMonth());
  };
  const handleClear = () => {
    onSave(undefined);
    onClose();
  };

  const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div
      ref={rootRef}
      className="absolute top-full left-0 mt-1 z-40 bg-surface border border-[var(--color-border)] rounded-xl shadow-xl p-3 w-72"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => stepMonth(-1)}
          className="w-8 h-8 rounded-md hover:bg-surfaceHighlight text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-display font-bold text-text-primary tabular-nums">{monthName}</div>
        <button
          type="button"
          onClick={() => stepMonth(1)}
          className="w-8 h-8 rounded-md hover:bg-surfaceHighlight text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekdayLabels.map((w, i) => (
          <div
            key={`wd-${i}`}
            className="h-6 flex items-center justify-center text-[9px] font-display font-semibold text-text-muted uppercase"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`blank-${idx}`} className="h-8" />;
          const iso = toIso(viewYear, viewMonth, day);
          const isPast = iso < todayIso;
          const isToday = iso === todayIso;
          const isSelected = iso === selected;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => pick(day)}
              disabled={isPast}
              className={`h-8 rounded-md text-xs font-display tabular-nums transition-colors ${
                isSelected
                  ? 'bg-warm text-white font-bold'
                  : isPast
                    ? 'text-text-muted/30 cursor-not-allowed'
                    : isToday
                      ? 'bg-surfaceHighlight text-warm font-bold ring-1 ring-warm/30 hover:bg-warm/10'
                      : 'text-text-primary hover:bg-surfaceHighlight'
              }`}
              aria-label={iso}
              aria-pressed={isSelected}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={handleToday}
          className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surfaceHighlight transition-colors"
        >
          Today
        </button>
        <div className="flex gap-2">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surfaceHighlight transition-colors"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!selected}
            className={`text-[11px] font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors ${
              selected ? 'bg-warm text-white hover:bg-warm-light' : 'bg-surfaceHighlight text-text-muted cursor-not-allowed'
            }`}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function parseIso(iso: string): Date {
  // YYYY-MM-DD — force local timezone so the display date matches what was picked.
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function toIso(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
