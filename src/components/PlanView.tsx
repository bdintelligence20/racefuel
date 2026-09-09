import { useState } from 'react';
import { Watch, RotateCcw, Map as MapIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getActiveDurationHours } from '../services/route/timeFormat';
import { ExportModal } from './export/ExportModal';
import { TrailBackdrop } from './TrailBackdrop';

/** Elapsed minutes → "h:mm". */
function fmtElapsed(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * The loaded-route surface, answer-first and single-column (the gut-training
 * shape): the plan's carbs/hr and the fuel-stop spine lead; the map and the
 * product browser are one tap away rather than filling the screen. A quiet
 * ridgeline backdrop (TrailBackdrop) sits behind the whole surface so it never
 * opens on a blank white screen — the content floats over it. Reuses the real
 * generation (autoGeneratePlan), export (ExportModal) and route data.
 */
export function PlanView({ onShowMap }: { onShowMap: () => void }) {
  const { routeData, autoGeneratePlan, resetRoute, lastGeneratedPlan } = useApp();
  const [exportOpen, setExportOpen] = useState(false);

  const stops = [...routeData.nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm);
  const hasPlan = stops.length > 0;
  const totalCarbs = stops.reduce((s, p) => s + p.product.carbs, 0);
  const totalSodium = stops.reduce((s, p) => s + p.product.sodium, 0);
  const hours = getActiveDurationHours(routeData, 3.25);
  const totalMin = hours * 60;
  const carbsPerHour = hours > 0 ? Math.round(totalCarbs / hours) : 0;
  const targetMin = lastGeneratedPlan?.carbTarget?.min ?? 60;
  const targetMax = lastGeneratedPlan?.carbTarget?.max ?? 90;
  const inRange = carbsPerHour >= targetMin && carbsPerHour <= targetMax;
  const totalKm = routeData.distanceKm || 1;

  const label = 'text-[9px] font-display font-semibold uppercase tracking-wider text-text-muted';

  return (
    <div className="relative flex-1 min-h-0 bg-background">
      {/* Atmosphere — anchored to the pane, content scrolls over it */}
      <TrailBackdrop className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="absolute inset-0 overflow-y-auto">
        <div className="relative max-w-2xl mx-auto w-full px-5 py-6">
          {/* Header — route name, stats, escape hatches */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-black text-text-primary leading-tight tracking-tight truncate">
                {routeData.name || 'Your route'}
              </h1>
              <div className="text-xs text-text-muted font-display mt-1 tabular-nums">
                {routeData.distanceKm.toFixed(1)} km · {routeData.elevationGain} m · {routeData.estimatedTime}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={onShowMap} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-surface/70 backdrop-blur-sm text-text-secondary hover:border-accent/40 hover:text-text-primary text-xs font-display font-semibold transition-colors">
                <MapIcon className="w-4 h-4" /> Map
              </button>
              <button onClick={resetRoute} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-surface/70 backdrop-blur-sm text-text-secondary hover:text-text-primary text-xs font-display font-semibold transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> New
              </button>
            </div>
          </div>

          {hasPlan ? (
            <>
              {/* Answer band */}
              <div className="flex items-stretch mt-6 pb-5 border-b border-[var(--color-border)]">
                <div className="pr-6 mr-6 border-r border-[var(--color-border)]">
                  <div className={label}>Carbs / hour</div>
                  <div className="text-5xl font-display font-black text-accent leading-none mt-1.5 tabular-nums">
                    {carbsPerHour}<span className="text-lg text-text-muted ml-1">g/hr</span>
                  </div>
                  <div className={`text-[10px] font-display font-semibold uppercase tracking-wider mt-2 ${inRange ? 'text-accent' : 'text-warm'}`}>
                    {inRange ? `Within ${targetMin}–${targetMax} g/hr` : `Target ${targetMin}–${targetMax} g/hr`}
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div>
                    <div className="text-2xl font-display font-black text-accent-muted tabular-nums">{totalCarbs}</div>
                    <div className={`${label} mt-1`}>total carbs · g</div>
                  </div>
                  <div>
                    <div className="text-2xl font-display font-black text-accent-muted tabular-nums">{(totalSodium / 1000).toFixed(1)}</div>
                    <div className={`${label} mt-1`}>sodium · g</div>
                  </div>
                  <div>
                    <div className="text-2xl font-display font-black text-accent-muted tabular-nums">{stops.length}</div>
                    <div className={`${label} mt-1`}>fuel stops</div>
                  </div>
                </div>
              </div>

              {/* The spine — when to take what */}
              <div className="relative mt-5">
                <div className="absolute left-[46px] top-3 bottom-3 w-px bg-[var(--color-border)]" />
                {stops.map((p) => {
                  const elapsed = totalMin > 0 ? (p.distanceKm / totalKm) * totalMin : 0;
                  return (
                    <div key={p.id} className="grid grid-cols-[52px_1fr_auto] gap-3 items-start py-3 border-t border-[var(--color-border)] first:border-t-0">
                      <div className="text-right">
                        <div className="text-base font-display font-black text-accent-muted tabular-nums leading-none">{p.distanceKm.toFixed(0)}</div>
                        <div className={`${label} mt-1`}>km</div>
                      </div>
                      <div className="relative pl-5">
                        <span className="absolute left-0 top-1 w-3 h-3 rounded-full bg-accent border-2 border-surface shadow-[0_0_0_1px_var(--color-border)]" />
                        <div className="text-sm font-display font-bold text-text-primary leading-tight">{p.product.brand} {p.product.name}</div>
                        <div className="text-[11px] text-text-muted capitalize">{p.product.category}</div>
                        <div className="text-[9px] font-display font-semibold uppercase tracking-wider text-accent mt-1">{fmtElapsed(elapsed)} elapsed</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-display font-black text-accent-muted tabular-nums leading-none">{p.product.carbs}</div>
                        <div className={`${label} mt-1`}>carbs g</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* One primary action */}
              <div className="flex gap-2 mt-6">
                <button onClick={() => setExportOpen(true)} className="flex-[2] min-h-[54px] flex items-center justify-center gap-2 rounded-xl bg-accent text-white font-display font-bold text-sm hover:bg-accent-light active:scale-[0.99] transition-all shadow-sm">
                  <Watch className="w-4 h-4" /> Export to watch
                </button>
                <button onClick={autoGeneratePlan} className="flex-1 min-h-[54px] flex items-center justify-center rounded-xl border border-accent bg-surface/70 backdrop-blur-sm text-accent font-display font-bold text-sm hover:bg-accent/[0.06] active:scale-[0.99] transition-all">
                  Regenerate
                </button>
              </div>
            </>
          ) : (
            /* Route loaded, no plan yet — the hero over the ridgeline */
            <div className="flex flex-col items-center text-center min-h-[62vh] justify-center px-2">
              <div className={`${label} text-accent/80`}>Route aware nutrition</div>
              <h2 className="text-[2.1rem] leading-[1.1] font-display font-black text-text-primary tracking-tight mt-3 max-w-md">
                Don't hit the wall.<br />
                <span className="text-accent">Fuel the whole thing.</span>
              </h2>
              <p className="text-sm text-text-secondary mt-3 max-w-sm leading-relaxed">
                We'll place fuel stops along {routeData.name ? routeData.name : 'your route'} and tell you exactly what to take, and when.
              </p>
              <button onClick={autoGeneratePlan} className="mt-7 min-h-[56px] px-9 flex items-center justify-center rounded-xl bg-accent text-white font-display font-bold text-sm hover:bg-accent-light active:scale-[0.99] transition-all shadow-md">
                Build my plan
              </button>
              <button onClick={onShowMap} className="mt-3 text-text-muted hover:text-text-primary text-xs font-display font-semibold py-2 transition-colors">
                Or place stops on the map
              </button>
            </div>
          )}
        </div>
      </div>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
