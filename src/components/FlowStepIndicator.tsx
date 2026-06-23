import { Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * The primary-flow step indicator the brief asks for: a persistent
 * "where am I, what's next" cue across Route → Details → Plan → Export → Buy.
 *
 * It's derived purely from app state — there's no wizard router underneath, the
 * app is still one canvas — so it reads progress rather than driving it:
 *  - done   : a step the state proves is complete (route loaded, plan placed…)
 *  - active : the first not-yet-done step — the thing to do next
 *  - upcoming: still ahead
 *
 * Export and Buy are terminal actions we can't observe completion of from
 * state, so once a plan exists "Export" becomes the active next step and Buy
 * sits just beyond it. That's enough to keep the user moving without pretending
 * to know they've synced a watch.
 */
const STEPS = ['Route', 'Details', 'Plan', 'Export', 'Buy'] as const;
type StepName = (typeof STEPS)[number];

function useCurrentStep(): { activeIndex: number; doneThrough: number } {
  const { routeData, autoGenStatus, pendingPlan, lastGeneratedPlan } = useApp();
  const hasRoute = routeData.loaded;
  const hasPlan = routeData.nutritionPoints.length > 0 && !!lastGeneratedPlan;
  const generating = autoGenStatus !== null || pendingPlan !== null;

  // doneThrough = index of the last completed step (-1 = none done yet).
  let doneThrough = -1;
  if (hasRoute) doneThrough = 0;          // Route done
  if (hasRoute && (hasPlan || generating)) doneThrough = 1; // Details done
  if (hasPlan) doneThrough = 2;           // Plan done

  // active = first not-done step.
  const activeIndex = Math.min(STEPS.length - 1, doneThrough + 1);
  return { activeIndex, doneThrough };
}

export function FlowStepIndicator({ className = '' }: { className?: string }) {
  const { activeIndex, doneThrough } = useCurrentStep();

  return (
    <nav
      aria-label="Plan progress"
      className={`w-full bg-surface/95 backdrop-blur border-b border-[var(--color-border)] px-3 py-1.5 ${className}`}
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        {/* Dots only — labels would truncate at phone widths, so the current
            step's name lives in the single line on the right instead. */}
        <ol className="flex items-center gap-1.5">
          {STEPS.map((step: StepName, i) => {
            const isDone = i <= doneThrough;
            const isActive = i === activeIndex;
            return (
              <li key={step} className="flex items-center" aria-current={isActive ? 'step' : undefined}>
                <span
                  title={step}
                  className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-display font-bold transition-colors ${
                    isDone
                      ? 'bg-accent text-white'
                      : isActive
                        ? 'bg-warm text-white ring-2 ring-warm/30'
                        : 'bg-surfaceHighlight text-text-muted border border-[var(--color-border)]'
                  }`}
                >
                  {isDone ? <Check className="w-3 h-3" /> : i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className={`h-px w-3 transition-colors ${i < doneThrough ? 'bg-accent/50' : 'bg-[var(--color-border)]'}`}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
        <div className="text-right leading-tight flex-shrink-0">
          <div className="text-[9px] font-display uppercase tracking-wider text-text-muted">
            Step {activeIndex + 1} of {STEPS.length}
          </div>
          <div className="text-[12px] font-display font-bold text-text-primary">{STEPS[activeIndex]}</div>
        </div>
      </div>
    </nav>
  );
}
