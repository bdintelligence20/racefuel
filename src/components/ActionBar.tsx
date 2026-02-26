import React from 'react';
import { useApp } from '../context/AppContext';
import { Download } from 'lucide-react';

export function ActionBar() {
  const { routeData } = useApp();
  if (!routeData.loaded) return null;

  // Calculate total cost using actual product prices
  const totalCost = routeData.nutritionPoints.reduce((sum, point) => {
    return sum + (point.product.priceZAR || 0);
  }, 0);

  const totalCarbs = routeData.nutritionPoints.reduce((sum, point) => {
    return sum + point.product.carbs;
  }, 0);

  return (
    <div className="fixed bottom-0 left-72 right-80 bg-surface border-t border-white/10 p-4 z-40 flex items-center justify-between animate-slide-up">
      <div className="flex items-center gap-8">
        <div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider">
            Total Distance
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {routeData.distanceKm.toFixed(1)}km
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider">
            Nutrition Points
          </div>
          <div className="text-xl font-mono font-bold text-neon-orange">
            {routeData.nutritionPoints.length}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider">
            Total Carbs
          </div>
          <div className="text-xl font-mono font-bold text-neon-blue">
            {totalCarbs}g
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-secondary uppercase tracking-wider">
            Est. Cost
          </div>
          <div className="text-xl font-mono font-bold text-neon-green">
            R{totalCost.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold uppercase text-sm tracking-wider flex items-center gap-2 transition-colors">
          <Download className="w-4 h-4" />
          Export Plan
        </button>
      </div>
    </div>
  );
}