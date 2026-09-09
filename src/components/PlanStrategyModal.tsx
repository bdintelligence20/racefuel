import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, RefreshCw } from 'lucide-react';
import { GeneratedPlan } from '../services/nutrition/planGenerator';
import { calculatePlanCost } from '../services/nutrition/costCalculator';

export interface PlanStrategyContext {
  durationHours: number;
  temperatureCelsius: number;
  humidity: number;
  /** True when temp/humidity came from a forecast (user picked a date).
   *  Drives whether the weather line references conditions. */
  weatherFromForecast: boolean;
  intensityBucket: 'easy' | 'moderate' | 'hard';
  rationale?: string;
}

interface Props {
  plan: GeneratedPlan | null;
  context: PlanStrategyContext | null;
  onApply: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}

function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

export function PlanStrategyModal({ plan, context, onApply, onRegenerate, onClose }: Props) {
  const open = plan !== null && context !== null;
  useModalBehavior(open, onClose);
  if (!open || !plan || !context) return null;

  const { carbTarget, hydrationTarget, caffeineStrategy } = plan;
  const carbsPerHour = carbTarget.target;
  const carbInRange = carbsPerHour >= carbTarget.min && carbsPerHour <= carbTarget.max;
  // The engine can collapse the band to a single value (e.g. gut-capped at
  // 90), which would render as an odd "within 90–90". Say "at target" then.
  const carbStatus =
    carbTarget.min === carbTarget.max
      ? 'At target'
      : carbInRange
      ? `Within ${carbTarget.min}–${carbTarget.max} g/h`
      : `Target ${carbTarget.min}–${carbTarget.max} g/h`;

  // Derive everything from the placements themselves rather than the
  // pre-computed metrics object. plan.metrics is built once at generation time
  // and can drift from plan.nutritionPoints if those ever get edited. Summing
  // here means the headline and the sub-lines can never disagree.
  const planCarbs = plan.nutritionPoints.reduce((s, p) => s + p.product.carbs, 0);
  const planCaffeineTotal = plan.nutritionPoints.reduce((s, p) => s + p.product.caffeine, 0);
  const sodiumPerHour = hydrationTarget.sodiumMgPerHour;
  const fluidPerHour = hydrationTarget.fluidMlPerHour;
  const caffeineTotal = caffeineStrategy.totalCaffeineMg;
  const points = plan.nutritionPoints.length;

  const caffeineLine =
    caffeineStrategy.timing === 'none'
      ? 'No caffeine — the effort is short enough that a mouth rinse, or nothing, is fine.'
      : caffeineStrategy.timing === 'late-only'
      ? `A single caffeine dose near the 40% mark.`
      : `Caffeine spread across the final 45% of the effort.`;

  // Combine the carb-target rationale (tier + intensity band) with the agent's
  // strategic narrative (terrain, dual-transporter logic). Showing both keeps
  // "why this g/h?" separate from "why these placements?".
  const agentRationale = (plan as GeneratedPlan & { rationale?: string; source?: string }).rationale;
  const rationale =
    agentRationale && agentRationale.length > 0
      ? `${carbTarget.rationale}\n\n${agentRationale}`
      : carbTarget.rationale;

  const eyebrow = 'text-[10px] font-display font-semibold text-text-muted uppercase tracking-[0.14em]';
  const cost = calculatePlanCost(plan.nutritionPoints);
  const hasPackInflation = cost.totalCostZAR > cost.runCostZAR + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* A clean white card — no horizon, no table. Hierarchy and whitespace
          carry it: one big answer, an airy ledger, then quiet reasoning. */}
      <div className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-hidden ring-1 ring-[var(--color-border)]">
        <div className="max-h-[90dvh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between px-7 pt-7">
            <div>
              <div className={eyebrow}>FuelCue strategy</div>
              <h2 className="text-xl font-display font-black text-text-primary tracking-tight mt-1">Your plan at a glance</h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 w-9 h-9 rounded-full hover:bg-accent/[0.06] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* The answer — the one number everything else supports */}
          <div className="px-7 pt-6">
            <div className="flex items-end gap-2.5">
              <span className="text-[4.25rem] leading-[0.85] font-display font-black text-accent tabular-nums">{carbsPerHour}</span>
              <span className="text-xl font-display font-bold text-text-muted pb-1.5">g/h carbs</span>
            </div>
            <div className="mt-3">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-display font-bold uppercase tracking-wider ${carbInRange ? 'bg-accent/[0.08] text-accent' : 'bg-warm/[0.1] text-warm'}`}>
                {carbStatus}
              </span>
            </div>
            <p className="mt-4 text-sm text-text-secondary leading-relaxed">
              Based on <strong className="text-text-primary font-semibold">{formatHours(context.durationHours)}</strong> at{' '}
              <strong className="text-text-primary font-semibold">{context.intensityBucket}</strong> intensity
              {context.weatherFromForecast ? (
                <>
                  {' '}in <strong className="text-text-primary font-semibold">{context.temperatureCelsius}°C</strong> /{' '}
                  <strong className="text-text-primary font-semibold">{context.humidity}%</strong> humidity
                </>
              ) : null}
              , here's what to take each hour to finish strong.
            </p>
          </div>

          {/* Supporting numbers — an airy ledger, not a grid of cards */}
          <div className="px-7 mt-6">
            <LedgerRow label="Sodium" value={String(sodiumPerHour)} unit="mg/h" note={`${(plan.nutritionPoints.reduce((s, p) => s + p.product.sodium, 0) / 1000).toFixed(1)} g over the route`} first />
            <LedgerRow label="Fluid" value={String(fluidPerHour)} unit="ml/h" note={`~${Math.round(hydrationTarget.sweatRateLPerHour * 100) / 100} L/h sweat · ${Math.round(hydrationTarget.replacementFraction * 100)}% replaced`} />
            <LedgerRow
              label="Caffeine"
              value={caffeineStrategy.timing === 'none' ? '—' : String(caffeineTotal)}
              unit={caffeineStrategy.timing === 'none' ? '' : 'mg'}
              note={caffeineStrategy.timing === 'none' ? 'Not needed for this effort' : `${planCaffeineTotal} mg placed in the plan`}
            />
          </div>

          {/* Why this plan — prose, no box */}
          {rationale && (
            <div className="px-7 mt-6 pt-6 border-t border-[var(--color-border)]">
              <div className={`${eyebrow} mb-2`}>Why this plan</div>
              <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">{rationale}</p>
            </div>
          )}

          {/* Quiet footnotes */}
          <div className="px-7 mt-5 pb-7 space-y-1 text-[11px] text-text-muted leading-relaxed">
            <p>{caffeineLine}</p>
            <p>
              {points} fuel point{points === 1 ? '' : 's'} · {planCarbs}g carbs · <span className="text-text-secondary">R{cost.runCostZAR.toFixed(0)} this run</span>
              {hasPackInflation && <span className="text-text-muted"> (R{cost.totalCostZAR.toFixed(0)} to buy full packs)</span>}
            </p>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 px-7 py-5 bg-surface/90 backdrop-blur-sm border-t border-[var(--color-border)] flex gap-2.5">
            <button
              onClick={onRegenerate}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-text-secondary text-xs font-display font-bold uppercase tracking-wider hover:bg-accent/[0.06] hover:text-text-primary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <button
              onClick={onApply}
              className="flex-1 py-3 rounded-xl bg-accent text-white text-xs font-display font-bold uppercase tracking-wider hover:bg-accent-light transition-colors shadow-sm"
            >
              View plan on map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One line of the supporting ledger: name + optional note on the left, the
 *  number right-aligned. A hairline separates rows (none above the first). */
function LedgerRow({
  label,
  value,
  unit,
  note,
  first,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  first?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3.5 ${first ? '' : 'border-t border-[var(--color-border)]'}`}>
      <div className="min-w-0">
        <div className="text-[13px] font-display font-semibold text-text-primary">{label}</div>
        <div className="text-[11px] text-text-muted leading-tight mt-0.5">{note}</div>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="text-2xl font-display font-black text-accent tabular-nums">{value}</span>
        {unit && <span className="text-xs text-text-muted ml-1 font-semibold">{unit}</span>}
      </div>
    </div>
  );
}
