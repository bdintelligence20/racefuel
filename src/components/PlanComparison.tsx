import { useMemo } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, Zap, Droplets, Coffee, TrendingUp, CheckCircle2, AlertTriangle, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { useApp, NutritionPoint } from '../context/AppContext';
import { calculateCarbTarget } from '../services/nutrition/carbCalculator';
import { calculateHydration } from '../services/nutrition/hydrationCalculator';
import { calculateCaffeineStrategy } from '../services/nutrition/caffeineStrategy';

interface PlanComparisonProps {
  isOpen: boolean;
  onClose: () => void;
}

type Status = 'on-target' | 'under' | 'over' | 'off-plan';

interface MetricResult {
  label: string;
  icon: React.ElementType;
  current: number;
  unit: string;
  targetLo: number;      // lower bound of "on-target" band
  targetHi: number;      // upper bound
  niceTarget: number;    // display target
  status: Status;
  note?: string;
}

function statusFromValue(current: number, lo: number, hi: number): Status {
  if (current === 0 && (lo > 0 || hi > 0)) return 'off-plan';
  if (current < lo) return 'under';
  if (current > hi) return 'over';
  return 'on-target';
}

const statusStyle: Record<Status, { bg: string; ring: string; text: string; label: string }> = {
  'on-target': { bg: 'bg-accent/10',  ring: 'ring-accent/30',   text: 'text-accent',     label: 'On target' },
  'under':     { bg: 'bg-amber-500/10', ring: 'ring-amber-500/30', text: 'text-amber-600', label: 'Under target' },
  'over':      { bg: 'bg-red-500/10', ring: 'ring-red-500/30',  text: 'text-red-500',    label: 'Above target' },
  'off-plan':  { bg: 'bg-gray-500/10', ring: 'ring-gray-500/30', text: 'text-text-muted', label: 'No plan yet' },
};

function computePoints(points: NutritionPoint[]) {
  return {
    totalCarbs: points.reduce((s, p) => s + p.product.carbs, 0),
    totalSodium: points.reduce((s, p) => s + p.product.sodium, 0),
    totalCaffeine: points.reduce((s, p) => s + p.product.caffeine, 0),
    totalCalories: points.reduce((s, p) => s + p.product.calories, 0),
  };
}

function StatusPill({ status, small = false }: { status: Status; small?: boolean }) {
  const s = statusStyle[status];
  const icon = status === 'on-target' ? CheckCircle2 : status === 'over' || status === 'under' ? AlertTriangle : Info;
  const Icon = icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ring-1 ${s.bg} ${s.ring} ${s.text} ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'} font-display font-bold uppercase tracking-wider whitespace-nowrap`}>
      <Icon className="w-3 h-3" />
      {s.label}
    </span>
  );
}

function MetricCard({ m }: { m: MetricResult }) {
  const s = statusStyle[m.status];
  const Icon = m.icon;
  return (
    <div className="relative p-4 rounded-xl bg-surfaceHighlight border border-[var(--color-border)]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 text-text-muted">
          <Icon className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase tracking-[0.14em] font-display font-semibold">{m.label}</span>
        </div>
        <StatusPill status={m.status} small />
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-display font-black tabular-nums ${s.text}`}>
          {m.current}
        </span>
        <span className="text-sm font-display text-text-muted">{m.unit}</span>
      </div>
      <div className="mt-1 text-[11px] font-display text-text-muted tracking-wide">
        Target <span className="font-semibold text-text-secondary">{m.targetLo}–{m.targetHi}{m.unit}</span>
        {m.niceTarget !== m.targetLo && m.niceTarget !== m.targetHi && (
          <span className="text-text-muted/70"> (aim {m.niceTarget}{m.unit})</span>
        )}
      </div>
      {m.note && <p className="mt-2 text-[11px] text-text-muted leading-snug">{m.note}</p>}
    </div>
  );
}

/** Build an elevation polyline from gpsPath (matches MapCanvas styling in miniature). */
function elevationPath(gpsPath: { elevation?: number }[] | undefined, width: number, height: number): { line: string; area: string; min: number; max: number } {
  if (!gpsPath || gpsPath.length === 0) return { line: '', area: '', min: 0, max: 1 };
  const rawElevs = gpsPath.filter((p) => p.elevation !== undefined).map((p) => p.elevation as number);
  if (rawElevs.length === 0) return { line: '', area: '', min: 0, max: 1 };

  // Light smoothing
  const window = Math.max(2, Math.floor(rawElevs.length / 60));
  const elevs = rawElevs.map((_, i) => {
    const start = Math.max(0, i - window);
    const end = Math.min(rawElevs.length, i + window + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += rawElevs[j];
    return sum / (end - start);
  });

  const min = Math.min(...elevs);
  const max = Math.max(...elevs);
  const range = max - min || 1;

  const samples = Math.min(120, elevs.length);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor((i / (samples - 1)) * (elevs.length - 1));
    const x = (i / (samples - 1)) * width;
    const y = height - ((elevs[idx] - min) / range) * height;
    pts.push({ x, y });
  }

  let line = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) line += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  return { line, area, min, max };
}

export function PlanComparison({ isOpen, onClose }: PlanComparisonProps) {
  const { routeData, userProfile, lastGeneratedPlan } = useApp();

  const hours = useMemo(() => {
    const timeParts = (routeData.estimatedTime || '3:00:00').split(':').map(Number);
    return timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600 || 3.25;
  }, [routeData.estimatedTime]);

  // Build research-based targets directly — don't depend on auto-generate having run
  const targets = useMemo(() => {
    const carb = calculateCarbTarget({
      durationHours: hours,
      intensityPercent: 0.75,
      gutTolerance: userProfile.gutTolerance ?? 'trained',
      isCompetition: false,
      bodyWeightKg: userProfile.weight,
      userOverrideGPerHour: userProfile.carbTargetGPerHour,
    });
    const hydration = calculateHydration({
      bodyWeightKg: userProfile.weight,
      durationHours: hours,
      temperatureCelsius: 22,
      humidity: 50,
      intensityPercent: 0.75,
      sweatRate: userProfile.sweatRate,
      sport: userProfile.sport ?? 'running',
      sweatSodiumBucket: userProfile.sweatSodiumBucket ?? 'unknown',
      heatAcclimatised: userProfile.heatAcclimatised ?? false,
      earlySeasonHeat: userProfile.earlySeasonHeat ?? false,
    });
    const caff = calculateCaffeineStrategy({
      bodyWeightKg: userProfile.weight,
      durationHours: hours,
      distanceKm: routeData.distanceKm,
      isRegularConsumer: true,
      targetMgPerKg: 3,
    });
    return { carb, hydration, caff };
  }, [
    hours,
    userProfile.weight,
    userProfile.sweatRate,
    userProfile.sport,
    userProfile.gutTolerance,
    userProfile.sweatSodiumBucket,
    userProfile.heatAcclimatised,
    userProfile.earlySeasonHeat,
    routeData.distanceKm,
  ]);

  const totals = useMemo(() => computePoints(routeData.nutritionPoints), [routeData.nutritionPoints]);

  const metrics: MetricResult[] = useMemo(() => {
    const carbsPerHour = hours > 0 ? Math.round(totals.totalCarbs / hours) : 0;
    const totalSodiumTargetLo = Math.round(targets.hydration.sodiumMgPerHour * hours * 0.8);
    const totalSodiumTargetHi = Math.round(targets.hydration.sodiumMgPerHour * hours * 1.2);
    const caffTargetLo = Math.round(targets.caff.totalCaffeineMg * 0.7);
    const caffTargetHi = Math.round(targets.caff.totalCaffeineMg * 1.2);

    const carbStatus = statusFromValue(carbsPerHour, targets.carb.min, targets.carb.max);
    const carbNote =
      carbStatus === 'under'
        ? `${targets.carb.target - carbsPerHour}g/h below target — add ${Math.ceil((targets.carb.target - carbsPerHour) * hours / 30)}× ~30g gels/drinks.`
        : carbStatus === 'over'
        ? `${carbsPerHour - targets.carb.max}g/h above ceiling — risks GI distress. Trim or swap to lower-carb products.`
        : targets.carb.rationale;

    const sodiumStatus = statusFromValue(totals.totalSodium, totalSodiumTargetLo, totalSodiumTargetHi);
    const sodiumNote =
      sodiumStatus === 'under'
        ? `~${totalSodiumTargetLo - totals.totalSodium}mg short. Heavy sweaters cramp. Swap a gel for an electrolyte drink.`
        : sodiumStatus === 'over'
        ? `Above ceiling — fine in heat; watch GI tolerance.`
        : 'Matches your projected sweat loss.';

    const caffStatus = targets.caff.timing === 'none'
      ? statusFromValue(totals.totalCaffeine, 0, 50)
      : statusFromValue(totals.totalCaffeine, caffTargetLo, caffTargetHi);
    const caffNote = targets.caff.timing === 'none'
      ? 'Effort is too short to benefit from caffeine.'
      : caffStatus === 'under'
      ? `Consider a caffeinated gel at ~${Math.round(targets.caff.firstDoseKm)}km for the final push.`
      : caffStatus === 'over'
      ? 'High caffeine — jitters and GI risk in the last hour.'
      : targets.caff.rationale;

    const calTarget = Math.round((carbsPerHour * 4) * hours); // rough kcal from carbs
    const calLo = Math.round(calTarget * 0.85);
    const calHi = Math.round(calTarget * 1.3);

    return [
      {
        label: 'Carbs / hour',
        icon: Zap,
        current: carbsPerHour,
        unit: 'g',
        targetLo: targets.carb.min,
        targetHi: targets.carb.max,
        niceTarget: targets.carb.target,
        status: carbStatus,
        note: carbNote,
      },
      {
        label: 'Total carbs',
        icon: Zap,
        current: totals.totalCarbs,
        unit: 'g',
        targetLo: Math.round(targets.carb.min * hours),
        targetHi: Math.round(targets.carb.max * hours),
        niceTarget: Math.round(targets.carb.target * hours),
        status: statusFromValue(totals.totalCarbs, Math.round(targets.carb.min * hours), Math.round(targets.carb.max * hours)),
      },
      {
        label: 'Sodium',
        icon: Droplets,
        current: totals.totalSodium,
        unit: 'mg',
        targetLo: totalSodiumTargetLo,
        targetHi: totalSodiumTargetHi,
        niceTarget: Math.round(targets.hydration.sodiumMgPerHour * hours),
        status: sodiumStatus,
        note: sodiumNote,
      },
      {
        label: 'Caffeine',
        icon: Coffee,
        current: totals.totalCaffeine,
        unit: 'mg',
        targetLo: targets.caff.timing === 'none' ? 0 : caffTargetLo,
        targetHi: targets.caff.timing === 'none' ? 50 : caffTargetHi,
        niceTarget: targets.caff.totalCaffeineMg,
        status: caffStatus,
        note: caffNote,
      },
      {
        label: 'Calories',
        icon: TrendingUp,
        current: totals.totalCalories,
        unit: 'kcal',
        targetLo: calLo,
        targetHi: calHi,
        niceTarget: calTarget,
        status: statusFromValue(totals.totalCalories, calLo, calHi),
      },
    ];
  }, [totals, hours, targets]);

  const overallStatus: Status = useMemo(() => {
    const statuses = metrics.map((m) => m.status);
    if (statuses.some((s) => s === 'over')) return 'over';
    if (statuses.filter((s) => s === 'under').length >= 2) return 'under';
    if (statuses.every((s) => s === 'on-target')) return 'on-target';
    if (statuses.every((s) => s === 'off-plan')) return 'off-plan';
    return 'under';
  }, [metrics]);

  const actions = useMemo(() => {
    const list: { kind: 'add' | 'remove' | 'info'; text: string }[] = [];
    for (const m of metrics) {
      if (m.status === 'under' && m.note) list.push({ kind: 'add', text: `${m.label}: ${m.note}` });
      else if (m.status === 'over' && m.note) list.push({ kind: 'remove', text: `${m.label}: ${m.note}` });
    }
    // Spacing insight
    const sorted = [...routeData.nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm);
    if (sorted.length >= 3) {
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i].distanceKm - sorted[i - 1].distanceKm);
      const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const cv = Math.sqrt(gaps.map((g) => (g - avg) ** 2).reduce((s, g) => s + g, 0) / gaps.length) / avg;
      if (cv > 0.5) {
        list.push({ kind: 'info', text: 'Spacing is uneven — some fuel points cluster. Consider redistributing for steadier intake.' });
      }
    }
    // Late-race coverage
    if (sorted.length > 0) {
      const lastKm = sorted[sorted.length - 1].distanceKm;
      const coverage = lastKm / routeData.distanceKm;
      if (coverage < 0.75 && hours >= 1.5) {
        list.push({ kind: 'add', text: `Last fuel is at ${lastKm.toFixed(1)}km — consider one more around km ${Math.round(routeData.distanceKm * 0.85)} to cover the final stretch.` });
      }
    }
    return list.slice(0, 4);
  }, [metrics, routeData.nutritionPoints, routeData.distanceKm, hours]);
  useModalBehavior(isOpen, onClose);


  if (!isOpen) return null;

  // Timeline geometry
  const timelineW = 760;
  const timelineH = 140;
  const elev = elevationPath(routeData.gpsPath, timelineW, timelineH);
  const maxKm = routeData.distanceKm || 100;

  const colorMap: Record<string, string> = {
    orange: '#F5A020', blue: '#3D2152', white: '#6B5A7A',
    green: '#E8671A', red: '#C94A1A', yellow: '#F5B830',
  };
  const userSorted = [...routeData.nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm);
  const recSorted = lastGeneratedPlan
    ? [...lastGeneratedPlan.nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95dvh] sm:max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:fade-in sm:zoom-in-95 duration-200">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="text-base sm:text-lg font-display font-black text-text-primary tracking-tight">Plan comparison</h2>
              <StatusPill status={overallStatus} />
            </div>
            <p className="text-[11px] text-text-muted font-display uppercase tracking-[0.15em] truncate">
              {routeData.name} &middot; {routeData.distanceKm.toFixed(1)}km &middot; {routeData.estimatedTime}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-accent/[0.08] active:bg-accent/[0.12] transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5 sm:space-y-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Metric cards — stacked on all screens */}
          <div className="space-y-3">
            {metrics.map((m) => (
              <MetricCard key={m.label} m={m} />
            ))}
          </div>

          {/* Fueling timeline over elevation profile */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-display font-black uppercase tracking-[0.18em] text-text-primary">
                Fueling timeline
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-display text-text-muted">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warm" />Your plan</span>
                {recSorted.length > 0 && (
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full ring-1 ring-accent/60 bg-accent/30" />Recommended</span>
                )}
              </div>
            </div>

            <div className="relative rounded-xl bg-surfaceHighlight border border-[var(--color-border)] overflow-hidden">
              <svg viewBox={`0 0 ${timelineW} ${timelineH}`} className="w-full h-36" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#F5A020" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3D2152" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                {elev.line ? (
                  <>
                    <path d={elev.area} fill="url(#elevFill)" />
                    <path d={elev.line} fill="none" stroke="#E8671A" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </>
                ) : (
                  <rect x={0} y={timelineH - 4} width={timelineW} height={4} fill="#F5A020" opacity={0.3} />
                )}
                {/* Gridlines */}
                {[0.25, 0.5, 0.75].map((p) => (
                  <line key={p} x1={timelineW * p} y1={0} x2={timelineW * p} y2={timelineH} stroke="#3D2152" strokeOpacity={0.06} strokeWidth={1} />
                ))}
              </svg>

              {/* User markers — above the baseline */}
              {userSorted.map((p) => {
                const left = (p.distanceKm / maxKm) * 100;
                return (
                  <div
                    key={`u-${p.id}`}
                    className="absolute top-3 w-3 h-3 rounded-full ring-2 ring-white shadow-md -translate-x-1/2"
                    style={{ left: `${left}%`, background: colorMap[p.product.color] || '#F5A020' }}
                    title={`${p.product.name} · ${p.distanceKm.toFixed(1)}km`}
                  />
                );
              })}
              {/* Recommended markers — small ghosts below */}
              {recSorted.map((p) => {
                const left = (p.distanceKm / maxKm) * 100;
                return (
                  <div
                    key={`r-${p.id}`}
                    className="absolute bottom-3 w-2.5 h-2.5 rounded-full ring-1 ring-accent/60 -translate-x-1/2"
                    style={{ left: `${left}%`, background: 'rgba(232,103,26,0.25)' }}
                    title={`${p.product.name} · ${p.distanceKm.toFixed(1)}km`}
                  />
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] font-display text-text-muted mt-1 px-0.5">
              <span>0km</span>
              <span>{(maxKm * 0.25).toFixed(0)}</span>
              <span>{(maxKm * 0.5).toFixed(0)}</span>
              <span>{(maxKm * 0.75).toFixed(0)}</span>
              <span>{maxKm.toFixed(0)}km</span>
            </div>
          </div>

          {/* Action recommendations */}
          {actions.length > 0 && (
            <div>
              <h3 className="text-[11px] font-display font-black uppercase tracking-[0.18em] text-text-primary mb-3">
                Recommendations
              </h3>
              <div className="space-y-2">
                {actions.map((a, i) => {
                  const Icon = a.kind === 'add' ? ArrowUp : a.kind === 'remove' ? ArrowDown : Info;
                  const accent = a.kind === 'add' ? 'text-amber-600 bg-amber-500/10 ring-amber-500/25'
                              : a.kind === 'remove' ? 'text-red-500 bg-red-500/10 ring-red-500/25'
                              : 'text-accent bg-accent/10 ring-accent/25';
                  return (
                    <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg ring-1 ${accent}`}>
                      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <p className="text-[12px] font-display leading-snug">{a.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {routeData.nutritionPoints.length === 0 && (
            <div className="rounded-xl p-4 bg-surfaceHighlight border border-dashed border-[var(--color-border)] text-center">
              <p className="text-sm text-text-secondary font-display font-semibold">No fuel points yet</p>
              <p className="text-[11px] text-text-muted mt-1">
                Auto-generate a plan or drop products onto the map, then come back for your score.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
