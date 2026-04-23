import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface AutoGenProgressProps {
  /** Most recent phase reported by the pipeline. */
  phase: string;
  /** Whether the overlay is open. */
  open: boolean;
}

/** Rotating verbs, Claude-Code style. Changes faster than phases so there's
 *  always visible motion even while we're mid-agent-call. */
const VERBS = [
  'Analysing',
  'Cross-referencing',
  'Sanity-checking',
  'Consulting the spec',
  'Matching products',
  'Studying the terrain',
  'Weighing caffeine timing',
  'Balancing carbs',
  'Thinking',
  'Reasoning',
];

function pickVerb(tick: number): string {
  return VERBS[tick % VERBS.length];
}

export function AutoGenProgress({ phase, open }: AutoGenProgressProps) {
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) {
      setTick(0);
      setElapsed(0);
      return;
    }
    const verbTimer = setInterval(() => setTick((t) => t + 1), 900);
    const elapsedTimer = setInterval(() => setElapsed((e) => e + 0.1), 100);
    return () => {
      clearInterval(verbTimer);
      clearInterval(elapsedTimer);
    };
  }, [open]);

  if (!open) return null;

  const verb = pickVerb(tick);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      {/* Subtle backdrop — doesn't block, just dims */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] pointer-events-auto" />

      <div
        className="relative bg-surface border border-[var(--color-border)] rounded-2xl shadow-2xl px-5 py-4 sm:px-6 sm:py-5 w-[calc(100vw-2rem)] max-w-[420px] pointer-events-auto"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-warm/20 blur-md animate-pulse" />
            <div className="relative w-9 h-9 rounded-full bg-warm/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-warm fill-warm animate-pulse" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">
              FuelCue · Auto Generate
            </div>
            <div className="text-sm font-display font-bold text-text-primary truncate">
              <span className="inline-block min-w-[160px]">{verb}</span>
              <AnimatedDots />
            </div>
          </div>
          <div className="text-[11px] font-display tabular-nums text-text-muted">
            {elapsed.toFixed(1)}s
          </div>
        </div>

        {/* Current phase — the real one emitted by the pipeline. */}
        <div className="bg-surfaceHighlight rounded-lg px-3 py-2 border border-[var(--color-border)]">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-display text-text-muted mt-0.5">{'>'}</span>
            <p className="text-xs text-text-secondary leading-snug flex-1">{phase}</p>
          </div>
        </div>

        {/* Indeterminate progress bar */}
        <div className="mt-3 h-0.5 bg-surfaceHighlight rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-warm rounded-full animate-[progress_1.5s_ease-in-out_infinite]" />
        </div>

        <style>{`
          @keyframes progress {
            0%   { transform: translateX(-120%); }
            100% { transform: translateX(420%); }
          }
        `}</style>
      </div>
    </div>
  );
}

/** Three dots that fade in sequence — a hair softer than the verb rotation. */
function AnimatedDots() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x + 1) % 4), 350);
    return () => clearInterval(t);
  }, []);
  return <span className="text-warm">{'.'.repeat(n)}</span>;
}
