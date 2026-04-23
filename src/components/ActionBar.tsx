import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Download, Undo2, Redo2 } from 'lucide-react';
import { ExportModal } from './export/ExportModal';
import { PlanWarnings } from './PlanWarnings';
import { calculatePlanCost } from '../services/nutrition/costCalculator';

export function ActionBar() {
  const { routeData, planValidation, canUndo, canRedo, undo, redo } = useApp();
  const [exportOpen, setExportOpen] = useState(false);

  const cost = useMemo(() => calculatePlanCost(routeData.nutritionPoints), [routeData.nutritionPoints]);

  if (!routeData.loaded) return null;

  // Footer shows per-serving "cost of this run" — matches the athlete's
  // mental model of what they actually used. Full-pack total lives in the
  // kit modal and plan summary.
  const runCost = cost.runCostZAR;

  const totalCarbs = routeData.nutritionPoints.reduce((sum, point) => {
    return sum + point.product.carbs;
  }, 0);

  const timeParts = (routeData.estimatedTime || '3:00:00').split(':').map(Number);
  const hours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600 || 3.25;
  const carbsPerHour = hours > 0 ? Math.round(totalCarbs / hours) : 0;

  return (
    <>
      <div className="bg-surface border-t border-[var(--color-border)] px-4 py-3 lg:px-5 lg:py-3 flex flex-col gap-2 safe-bottom">
        {/* Warnings */}
        {planValidation && planValidation.warnings.length > 0 && (
          <PlanWarnings warnings={planValidation.warnings} compact />
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {[
            { label: routeData.distanceKm.toFixed(1) + 'km', value: routeData.nutritionPoints.length + ' pts', color: 'text-text-primary' },
            { label: 'Carbs/hr', value: carbsPerHour + 'g', color: carbsPerHour >= 60 && carbsPerHour <= 90 ? 'text-accent' : carbsPerHour > 90 ? 'text-terrain-rust' : 'text-warm' },
            { label: 'Total', value: totalCarbs + 'g', color: 'text-warm' },
            { label: 'Run cost', value: 'R' + runCost.toFixed(0), color: 'text-accent' },
            ...(planValidation ? [{ label: 'Score', value: String(planValidation.score), color: planValidation.score >= 80 ? 'text-accent' : planValidation.score >= 50 ? 'text-warm' : 'text-terrain-rust' }] : []),
          ].map((stat) => (
            <div key={stat.label} className="flex-shrink-0">
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display">{stat.label}</div>
              <div className={`text-sm font-display font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/[0.08] active:scale-95 transition-all"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-primary disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent/[0.08] active:scale-95 transition-all"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setExportOpen(true)}
            disabled={routeData.nutritionPoints.length === 0}
            className="h-10 px-5 rounded-xl bg-accent hover:bg-accent-light text-white font-display font-bold uppercase text-xs tracking-wider flex items-center gap-2 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}
