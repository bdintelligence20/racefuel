import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, Thermometer, Gauge, Clock, RefreshCw, CalendarPlus } from 'lucide-react';
import { GeneratedPlan } from '../services/nutrition/planGenerator';
import { calculatePlanCost } from '../services/nutrition/costCalculator';
import { TrailBackdrop } from './TrailBackdrop';

export interface PlanStrategyContext {
  durationHours: number;
  temperatureCelsius: number;
  humidity: number;
  /** True when temp/humidity came from a forecast (user picked a date).
   *  Drives whether the weather pill and lede sentence reference conditions. */
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
      ? 'at target'
      : carbInRange
      ? `within ${carbTarget.min}–${carbTarget.max}`
      : `target ${carbTarget.min}–${carbTarget.max}`;
  // Derive everything below from the placements themselves rather than the
  // pre-computed metrics object. plan.metrics is built once at generation time
  // and can drift from plan.nutritionPoints if those ever get edited (or if the
  // metrics calc has a rounding bug). Summing here means the headline, the
  // sub-line, and the footer can never disagree.
  const planCarbs = plan.nutritionPoints.reduce((s, p) => s + p.product.carbs, 0);
  const planSodium = plan.nutritionPoints.reduce((s, p) => s + p.product.sodium, 0);
  const planCaffeineTotal = plan.nutritionPoints.reduce((s, p) => s + p.product.caffeine, 0);
  const planCarbsPerHour = context.durationHours > 0 ? Math.round(planCarbs / context.durationHours) : 0;
  const planSodiumPerHour = context.durationHours > 0 ? Math.round(planSodium / context.durationHours) : 0;
  const sodiumPerHour = hydrationTarget.sodiumMgPerHour;
  const fluidPerHour = hydrationTarget.fluidMlPerHour;
  const caffeineTotal = caffeineStrategy.totalCaffeineMg;

  const caffeineLine =
    caffeineStrategy.timing === 'none'
      ? 'No caffeine — effort is short enough that mouth rinse or none is fine.'
      : caffeineStrategy.timing === 'late-only'
      ? `~${caffeineTotal}mg caffeine — a single dose near the 40% mark.`
      : `~${caffeineTotal}mg caffeine distributed across the final 45%.`;

  // Combine the carb-target rationale (tier + intensity band) with the
  // agent's strategic narrative (terrain awareness, dual-transporter
  // logic). Showing both addresses the "why this g/h?" question
  // separately from "why these placements?" — feedback BS#4 ("carbs/hr
  // seems inconsistent — is this based on route difficulty?") needs the
  // tier/intensity line specifically, which the agent rationale doesn't
  // mention.
  const agentRationale = (plan as GeneratedPlan & { rationale?: string; source?: string }).rationale;
  const rationale =
    agentRationale && agentRationale.length > 0
      ? `${carbTarget.rationale}\n\n${agentRationale}`
      : carbTarget.rationale;

  const eyebrow = 'text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider';
  const cost = calculatePlanCost(plan.nutritionPoints);
  const hasPackInflation = cost.totalCostZAR > cost.runCostZAR + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-hidden">
        {/* The same horizon as the plan surface, kept to a whisper so the dense
            figures below stay crisp. */}
        <TrailBackdrop className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />

        <div className="relative max-h-[90dvh] overflow-y-auto">
          {/* Header — no fill, a hairline does the separating */}
          <div className="flex items-start justify-between px-5 pt-5">
            <div>
              <div className={eyebrow}>FuelCue strategy</div>
              <h2 className="text-xl font-display font-black text-text-primary tracking-tight mt-0.5">Your plan at a glance</h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="-mr-1 w-9 h-9 rounded-full hover:bg-accent/[0.06] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Lede — the answer, in prose */}
          <p className="px-5 mt-3 text-sm text-text-secondary leading-relaxed">
            Based on <strong className="text-text-primary">{formatHours(context.durationHours)}</strong> at{' '}
            <strong className="text-text-primary">{context.intensityBucket}</strong> intensity
            {context.weatherFromForecast ? (
              <>
                ,{' '}
                <strong className="text-text-primary">{context.temperatureCelsius}°C</strong> /{' '}
                <strong className="text-text-primary">{context.humidity}%</strong> humidity
              </>
            ) : null}
            , we suggest{' '}
            <strong className="text-accent">{carbsPerHour} g/h carbs</strong>{' '}
            and <strong className="text-accent">{sodiumPerHour} mg/h sodium</strong>.
          </p>

          {/* Context pills — borderless, subtle */}
          <div className="px-5 mt-3 flex flex-wrap gap-1.5">
            <Pill icon={Clock}>{formatHours(context.durationHours)}</Pill>
            <Pill icon={Gauge}>{context.intensityBucket}</Pill>
            {context.weatherFromForecast ? (
              <Pill icon={Thermometer}>{context.temperatureCelsius}°C / {context.humidity}%</Pill>
            ) : (
              <Pill icon={CalendarPlus}>add a date for weather-aware sodium</Pill>
            )}
          </div>

          {/* Targets — one ruled table, not four floating cards. Each cell shows
              the TARGET as the headline and what the plan delivers beneath, so
              the numbers can't drift apart. */}
          <div className="mx-5 mt-4 grid grid-cols-2 border-t border-l border-[var(--color-border)] rounded-lg overflow-hidden bg-surface">
            <Metric
              label="Carbs"
              value={String(carbsPerHour)}
              unit="g/h"
              sub={`Plan ${planCarbsPerHour} g/h · ${planCarbs}g`}
              status={carbStatus}
              inRange={carbInRange}
            />
            <Metric
              label="Sodium"
              value={String(sodiumPerHour)}
              unit="mg/h"
              sub={`Plan ${planSodiumPerHour} mg/h · ${planSodium}mg`}
            />
            <Metric
              label="Fluid"
              value={String(fluidPerHour)}
              unit="ml/h"
              sub={`~${Math.round(hydrationTarget.sweatRateLPerHour * 100) / 100} L/h sweat · ${Math.round(hydrationTarget.replacementFraction * 100)}% replace`}
            />
            <Metric
              label="Caffeine"
              value={caffeineStrategy.timing === 'none' ? '—' : String(caffeineTotal)}
              unit={caffeineStrategy.timing === 'none' ? '' : 'mg'}
              sub={caffeineStrategy.timing === 'none' ? 'short effort' : `Plan ${planCaffeineTotal} mg`}
            />
          </div>

          {/* Why this plan — a ruled section, no box */}
          {rationale && (
            <div className="mx-5 mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className={`${eyebrow} mb-1.5`}>Why this plan</div>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{rationale}</p>
            </div>
          )}

          {/* Caffeine guidance — upright, never italic (§6) */}
          <p className="px-5 mt-3 text-[11px] text-text-muted leading-relaxed">{caffeineLine}</p>

          {/* Placement + cost — show both figures so tub-price inflation doesn't
              confuse the athlete. */}
          <div className="px-5 mt-3 pb-5 text-[11px] text-text-muted space-y-0.5">
            <div>
              {plan.nutritionPoints.length} fuel point{plan.nutritionPoints.length === 1 ? '' : 's'} placed · {planCarbs}g total carbs
            </div>
            <div>
              <span className="text-text-secondary">Cost of this run:</span> R{cost.runCostZAR.toFixed(0)}
              {hasPackInflation && (
                <>
                  {' '}·{' '}
                  <span className="text-text-secondary">Total to buy:</span> R{cost.totalCostZAR.toFixed(0)}
                  <span className="text-text-muted/70"> (full packs)</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 px-5 py-4 border-t border-[var(--color-border)] bg-surface/85 backdrop-blur-sm flex gap-2">
            <button
              onClick={onRegenerate}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-surface text-text-primary text-xs font-display font-bold uppercase tracking-wider hover:bg-accent/[0.06] transition-colors"
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

function Pill({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/[0.06] text-[10px] font-display font-semibold text-text-secondary">
      <Icon className="w-3 h-3 text-text-muted" />
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  unit,
  sub,
  status,
  inRange,
}: {
  label: string;
  value: string;
  unit: string;
  sub: string;
  status?: string;
  inRange?: boolean;
}) {
  return (
    <div className="p-3.5 border-r border-b border-[var(--color-border)]">
      <div className="text-[9px] font-display font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-2xl font-display font-black text-accent tabular-nums leading-none mt-1.5">
        {value}
        {unit && <span className="text-sm text-text-muted ml-1 font-bold">{unit}</span>}
      </div>
      <div className="text-[10px] font-display text-text-muted leading-tight mt-1.5">{sub}</div>
      {status && (
        <div className={`text-[9px] font-display font-semibold uppercase tracking-wider mt-1 ${inRange ? 'text-accent' : 'text-warm'}`}>
          {status}
        </div>
      )}
    </div>
  );
}
