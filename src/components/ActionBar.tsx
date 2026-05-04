import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Download, Undo2, Redo2, Info, Share2, Zap, Trash2 } from 'lucide-react';
import { ExportModal } from './export/ExportModal';
import { FlyoverExportModal } from './export/FlyoverExportModal';
import { ScorePopover } from './ScorePopover';
import { calculatePlanCost } from '../services/nutrition/costCalculator';
import { getActiveDurationHours } from '../services/route/timeFormat';

export function ActionBar() {
  const { routeData, planValidation, canUndo, canRedo, undo, redo, autoGeneratePlan, resetRoute } = useApp();
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);

  const cost = useMemo(() => calculatePlanCost(routeData.nutritionPoints), [routeData.nutritionPoints]);

  if (!routeData.loaded) return null;

  // Footer shows per-serving "cost of this run" — matches the athlete's
  // mental model of what they actually used. When buying full packs costs
  // noticeably more (e.g. a 1kg drink tub for one scoop), show the "to buy"
  // sub so the headline number isn't accused of being the full-tub price.
  const runCost = cost.runCostZAR;
  const totalToBuy = cost.totalCostZAR;
  const hasPackInflation = totalToBuy > runCost + 1;

  const totalCarbs = routeData.nutritionPoints.reduce((sum, point) => {
    return sum + point.product.carbs;
  }, 0);

  const hours = getActiveDurationHours(routeData, 3);
  const carbsPerHour = hours > 0 ? Math.round(totalCarbs / hours) : 0;

  return (
    <>
      <div className="bg-surface border-t border-[var(--color-border)] px-4 py-3 lg:px-5 lg:py-3 flex flex-col gap-2 safe-bottom">
        {/* Warning pills used to live here, but they duplicated the content of
            the Score popover and ate scarce mobile vertical real estate. The
            Score (i) popover is now the single home for plan warnings. */}

        {/* Stats row. Each stat has a hint explaining what it means. */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: routeData.distanceKm.toFixed(1) + 'km', value: routeData.nutritionPoints.length + ' pts', color: 'text-text-primary', hint: 'Route distance · number of fuel points placed' },
            { label: 'Carbs/hr', value: carbsPerHour + 'g', color: carbsPerHour >= 60 && carbsPerHour <= 90 ? 'text-accent' : carbsPerHour > 90 ? 'text-terrain-rust' : 'text-warm', hint: 'Grams of carbohydrate per hour. Evidence target: 60–90 g/h for efforts over 2 hours.' },
            { label: 'Total', value: totalCarbs + 'g', color: 'text-warm', hint: 'Total grams of carbs across all placements.' },
            {
              label: 'Run cost',
              value: 'R' + runCost.toFixed(0),
              color: 'text-accent',
              hint: hasPackInflation
                ? `Cost of the servings used on this run. To buy in full packs: R${totalToBuy.toFixed(0)}.`
                : 'Per-serving equivalent of what the plan consumes.',
              subValue: hasPackInflation ? `+R${(totalToBuy - runCost).toFixed(0)} buy` : undefined,
            },
          ].map((stat) => (
            <div key={stat.label} className="flex-shrink-0" title={stat.hint}>
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display">{stat.label}</div>
              <div className={`text-sm font-display font-bold ${stat.color}`}>{stat.value}</div>
              {'subValue' in stat && stat.subValue && (
                <div className="text-[9px] text-text-muted font-display tabular-nums">{stat.subValue}</div>
              )}
            </div>
          ))}

          {planValidation && (
            <div className="flex-shrink-0 relative">
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display flex items-center gap-1">
                Score
                <button
                  type="button"
                  onClick={() => setScoreOpen((v) => !v)}
                  aria-label="Show score breakdown"
                  className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setScoreOpen((v) => !v)}
                className={`text-sm font-display font-bold ${planValidation.score >= 80 ? 'text-accent' : planValidation.score >= 50 ? 'text-warm' : 'text-terrain-rust'} cursor-pointer`}
              >
                {planValidation.score}
              </button>
              {scoreOpen && <ScorePopover validation={planValidation} onClose={() => setScoreOpen(false)} />}
            </div>
          )}
        </div>

        {/* Actions row. On narrow phones every button is icon-only so all
            six fit in one row; on sm+ we add visible labels. Clear and Auto
            were previously map overlays that got buried under the strip /
            elevation panel — surfacing them here keeps every primary action
            reachable from a single thumb-friendly bar. */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/[0.08] active:scale-95 transition-all"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/[0.08] active:scale-95 transition-all"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            onClick={resetRoute}
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-surfaceHighlight border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 text-red-400/80 hover:text-red-400 active:scale-95 transition-all"
            title="Clear route"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          <button
            onClick={autoGeneratePlan}
            title="Auto-generate a science-backed nutrition plan for this route"
            className="lg:hidden h-9 sm:h-10 px-2.5 sm:px-3 rounded-xl bg-warm hover:bg-warm-light text-white font-display font-bold uppercase text-[11px] sm:text-xs tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-[0_0_12px_rgba(245,160,32,0.25)]"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">Auto</span>
          </button>

          <button
            onClick={() => setShareOpen(true)}
            disabled={routeData.nutritionPoints.length === 0}
            title="Make a shareable cinematic flyover video of your route + fuel points"
            className="h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl bg-surfaceHighlight border border-warm/30 hover:border-warm hover:bg-warm/[0.08] text-warm font-display font-bold uppercase text-[11px] sm:text-xs tracking-wider flex items-center gap-1.5 sm:gap-2 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <button
            onClick={() => setExportOpen(true)}
            disabled={routeData.nutritionPoints.length === 0}
            className="h-9 sm:h-10 px-2.5 sm:px-5 rounded-xl bg-accent hover:bg-accent-light text-white font-display font-bold uppercase text-[11px] sm:text-xs tracking-wider flex items-center gap-1.5 sm:gap-2 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
      <FlyoverExportModal isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}
