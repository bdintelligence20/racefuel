import { useModalBehavior } from '../hooks/useModalBehavior';
import { Zap, Droplets, Coffee, X, Thermometer, Gauge, Clock, RefreshCw } from 'lucide-react';
import { GeneratedPlan } from '../services/nutrition/planGenerator';

export interface PlanStrategyContext {
  durationHours: number;
  temperatureCelsius: number;
  humidity: number;
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
  const carbsTotal = Math.round(carbsPerHour * context.durationHours);
  const sodiumPerHour = hydrationTarget.sodiumMgPerHour;
  const fluidPerHour = hydrationTarget.fluidMlPerHour;
  const caffeineTotal = caffeineStrategy.totalCaffeineMg;

  const caffeineLine =
    caffeineStrategy.timing === 'none'
      ? 'No caffeine — effort is short enough that mouth rinse or none is fine.'
      : caffeineStrategy.timing === 'late-only'
      ? `~${caffeineTotal}mg caffeine — a single dose near the 40% mark.`
      : `~${caffeineTotal}mg caffeine distributed across the final 45%.`;

  const agentRationale = (plan as GeneratedPlan & { rationale?: string; source?: string }).rationale;
  const rationale = agentRationale && agentRationale.length > 0 ? agentRationale : carbTarget.rationale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div>
            <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">FuelCue Strategy</div>
            <h2 className="text-lg font-display font-bold text-text-primary">Your plan at a glance</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full hover:bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lede */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Based on <strong className="text-text-primary">{formatHours(context.durationHours)}</strong> at{' '}
            <strong className="text-text-primary">{context.intensityBucket}</strong> intensity,{' '}
            <strong className="text-text-primary">{context.temperatureCelsius}°C</strong> /{' '}
            <strong className="text-text-primary">{context.humidity}%</strong> humidity, we suggest{' '}
            <strong className="text-warm">{carbsPerHour} g/h carbs</strong>{' '}
            and <strong className="text-accent">{sodiumPerHour} mg/h sodium</strong>.
          </p>

          {/* Context pills */}
          <div className="flex flex-wrap gap-1.5">
            <Pill icon={Clock}>{formatHours(context.durationHours)}</Pill>
            <Pill icon={Gauge}>{context.intensityBucket}</Pill>
            <Pill icon={Thermometer}>{context.temperatureCelsius}°C / {context.humidity}%</Pill>
          </div>

          {/* Target grid */}
          <div className="grid grid-cols-2 gap-2">
            <TargetCard
              icon={Zap}
              label="Carbs"
              value={`${carbsPerHour} g/h`}
              sub={`~${carbsTotal}g total`}
              accent="warm"
            />
            <TargetCard
              icon={Droplets}
              label="Sodium"
              value={`${sodiumPerHour} mg/h`}
              sub={`~${Math.round(hydrationTarget.sweatRateLPerHour * 100) / 100} L/h sweat`}
              accent="accent"
            />
            <TargetCard
              icon={Droplets}
              label="Fluid"
              value={`${fluidPerHour} ml/h`}
              sub={`${Math.round(hydrationTarget.replacementFraction * 100)}% replacement`}
              accent="accent"
            />
            <TargetCard
              icon={Coffee}
              label="Caffeine"
              value={caffeineStrategy.timing === 'none' ? 'None' : `${caffeineTotal} mg`}
              sub={caffeineStrategy.timing}
              accent="warm"
            />
          </div>

          {/* Rationale */}
          {rationale && (
            <div className="bg-surfaceHighlight rounded-lg p-3 border border-[var(--color-border)]">
              <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider mb-1">Why this plan</div>
              <p className="text-xs text-text-secondary leading-relaxed">{rationale}</p>
            </div>
          )}

          {/* Caffeine guidance line */}
          <p className="text-[11px] text-text-muted italic">{caffeineLine}</p>

          {/* Placement count teaser */}
          <div className="text-[11px] text-text-muted">
            {plan.nutritionPoints.length} fuel point{plan.nutritionPoints.length === 1 ? '' : 's'} placed · {plan.metrics.totalCarbs}g total carbs · R{plan.metrics.totalCost.toFixed(0)}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[var(--color-border)] bg-surfaceHighlight flex gap-2">
          <button
            onClick={onRegenerate}
            className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-lg bg-surface border border-[var(--color-border)] text-text-primary text-xs font-display font-bold uppercase tracking-wider hover:bg-accent/[0.08] transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Regenerate
          </button>
          <button
            onClick={onApply}
            className="flex-1 py-3 rounded-lg bg-warm text-white text-xs font-display font-bold uppercase tracking-wider hover:bg-warm-light transition-colors shadow-[0_0_15px_rgba(245,160,32,0.25)]"
          >
            View plan on map
          </button>
        </div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surfaceHighlight border border-[var(--color-border)] text-[10px] font-display font-semibold text-text-secondary">
      <Icon className="w-3 h-3" />
      {children}
    </span>
  );
}

function TargetCard({ icon: Icon, label, value, sub, accent }: { icon: React.ElementType; label: string; value: string; sub: string; accent: 'warm' | 'accent' }) {
  const accentClass = accent === 'warm' ? 'text-warm' : 'text-accent';
  return (
    <div className="p-3 rounded-lg bg-surfaceHighlight border border-[var(--color-border)]">
      <div className="flex items-center gap-1.5 text-text-muted mb-1">
        <Icon className="w-3 h-3" />
        <span className="text-[9px] font-display font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-display font-black tabular-nums ${accentClass}`}>{value}</div>
      <div className="text-[10px] font-display text-text-muted leading-tight">{sub}</div>
    </div>
  );
}
