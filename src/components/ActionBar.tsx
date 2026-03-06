import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, Undo2, Redo2, Shield } from 'lucide-react';
import { ExportModal } from './export/ExportModal';
import { PlanWarnings } from './PlanWarnings';

export function ActionBar() {
  const { routeData, planValidation, canUndo, canRedo, undo, redo } = useApp();
  const [exportOpen, setExportOpen] = useState(false);

  if (!routeData.loaded) return null;

  const totalCost = routeData.nutritionPoints.reduce((sum, point) => {
    return sum + (point.product.priceZAR || 0);
  }, 0);

  const totalCarbs = routeData.nutritionPoints.reduce((sum, point) => {
    return sum + point.product.carbs;
  }, 0);

  const timeParts = (routeData.estimatedTime || '3:00:00').split(':').map(Number);
  const hours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600 || 3.25;
  const carbsPerHour = hours > 0 ? Math.round(totalCarbs / hours) : 0;

  return (
    <>
      <div className="fixed bottom-0 left-0 lg:left-72 right-0 lg:right-80 bg-surface/95 backdrop-blur-md border-t border-white/[0.06] p-3 lg:p-4 z-40 flex flex-col gap-2 lg:gap-3 animate-slide-up">
        {/* Warnings */}
        {planValidation && planValidation.warnings.length > 0 && (
          <PlanWarnings warnings={planValidation.warnings} compact />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                Distance
              </div>
              <div className="text-xl font-mono font-bold text-white">
                {routeData.distanceKm.toFixed(1)}km
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                Points
              </div>
              <div className="text-xl font-mono font-bold text-accent">
                {routeData.nutritionPoints.length}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                Carbs/hr
              </div>
              <div className={`text-xl font-mono font-bold ${
                carbsPerHour >= 60 && carbsPerHour <= 90 ? 'text-accent-light' :
                carbsPerHour > 90 ? 'text-red-400' : 'text-warm'
              }`}>
                {carbsPerHour}g
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                Total Carbs
              </div>
              <div className="text-xl font-mono font-bold text-warm">
                {totalCarbs}g
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                Est. Cost
              </div>
              <div className="text-xl font-mono font-bold text-accent-light">
                R{totalCost.toFixed(2)}
              </div>
            </div>
            {planValidation && (
              <div>
                <div className="text-[10px] text-text-secondary uppercase tracking-wider">
                  Plan Score
                </div>
                <div className={`text-xl font-mono font-bold flex items-center gap-1 ${
                  planValidation.score >= 80 ? 'text-accent-light' :
                  planValidation.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  <Shield className="w-4 h-4" />
                  {planValidation.score}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button
              onClick={undo}
              disabled={!canUndo}
              className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.06] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.06] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            {/* Export */}
            <button
              onClick={() => setExportOpen(true)}
              disabled={routeData.nutritionPoints.length === 0}
              className="px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-black font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export Plan
            </button>
          </div>
        </div>
      </div>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
}
