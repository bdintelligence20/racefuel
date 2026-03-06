import { useMemo } from 'react';
import { X, Zap, Droplets, Coffee, TrendingUp, DollarSign } from 'lucide-react';
import { useApp, NutritionPoint } from '../context/AppContext';

interface PlanComparisonProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PlanMetrics {
  label: string;
  totalCarbs: number;
  carbsPerHour: number;
  totalSodium: number;
  totalCaffeine: number;
  totalCalories: number;
  totalCost: number;
  pointCount: number;
  avgGapKm: number;
}

function computeMetrics(points: NutritionPoint[], distanceKm: number, hours: number, label: string): PlanMetrics {
  const totalCarbs = points.reduce((s, p) => s + p.product.carbs, 0);
  const totalSodium = points.reduce((s, p) => s + p.product.sodium, 0);
  const totalCaffeine = points.reduce((s, p) => s + p.product.caffeine, 0);
  const totalCalories = points.reduce((s, p) => s + p.product.calories, 0);
  const totalCost = points.reduce((s, p) => s + (p.product.priceZAR || 0), 0);
  const sorted = [...points].sort((a, b) => a.distanceKm - b.distanceKm);
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += sorted[i].distanceKm - sorted[i - 1].distanceKm;
  }
  const avgGapKm = sorted.length > 1 ? totalGap / (sorted.length - 1) : distanceKm;

  return {
    label,
    totalCarbs,
    carbsPerHour: hours > 0 ? Math.round(totalCarbs / hours) : 0,
    totalSodium,
    totalCaffeine,
    totalCalories,
    totalCost,
    pointCount: points.length,
    avgGapKm,
  };
}

function MetricRow({
  label,
  icon: Icon,
  current,
  recommended,
  unit,
  higherIsBetter = true,
}: {
  label: string;
  icon: React.ElementType;
  current: number;
  recommended: number;
  unit: string;
  higherIsBetter?: boolean;
}) {
  const diff = current - recommended;
  const pctDiff = recommended > 0 ? Math.round((diff / recommended) * 100) : 0;
  const isBetter = higherIsBetter ? diff >= 0 : diff <= 0;

  return (
    <div className="grid grid-cols-4 gap-2 items-center py-2 border-b border-white/[0.04]">
      <div className="flex items-center gap-2 text-text-secondary">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-center">
        <span className="text-sm font-mono font-bold text-white">{current}{unit}</span>
      </div>
      <div className="text-center">
        <span className="text-sm font-mono font-bold text-warm">{recommended}{unit}</span>
      </div>
      <div className="text-center">
        <span className={`text-xs font-mono font-bold ${isBetter ? 'text-accent-light' : 'text-red-400'}`}>
          {diff > 0 ? '+' : ''}{pctDiff}%
        </span>
      </div>
    </div>
  );
}

export function PlanComparison({ isOpen, onClose }: PlanComparisonProps) {
  const { routeData, lastGeneratedPlan } = useApp();

  const hours = useMemo(() => {
    const timeParts = (routeData.estimatedTime || '3:00:00').split(':').map(Number);
    return timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600 || 3.25;
  }, [routeData.estimatedTime]);

  const currentMetrics = useMemo(
    () => computeMetrics(routeData.nutritionPoints, routeData.distanceKm, hours, 'Your Plan'),
    [routeData.nutritionPoints, routeData.distanceKm, hours]
  );

  const recommendedMetrics = useMemo(() => {
    if (!lastGeneratedPlan) return null;
    return computeMetrics(lastGeneratedPlan.nutritionPoints, routeData.distanceKm, hours, 'Recommended');
  }, [lastGeneratedPlan, routeData.distanceKm, hours]);

  if (!isOpen) return null;

  // Timeline visualization
  const maxKm = routeData.distanceKm || 100;
  const currentSorted = [...routeData.nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm);
  const recSorted = lastGeneratedPlan
    ? [...lastGeneratedPlan.nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-white/[0.06] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] bg-surfaceHighlight">
          <div>
            <h2 className="text-lg font-bold text-white">Plan Comparison</h2>
            <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
              {routeData.name} &middot; {routeData.distanceKm.toFixed(1)}km
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Timeline Overlay */}
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Nutrition Timeline
            </h3>
            <div className="space-y-2">
              {/* Current plan timeline */}
              <div>
                <div className="text-[10px] text-text-muted mb-1 uppercase">Your Plan</div>
                <div className="h-6 bg-black/50 border border-white/[0.06] relative rounded-sm overflow-hidden">
                  {currentSorted.map((p) => {
                    const left = (p.distanceKm / maxKm) * 100;
                    const colorMap: Record<string, string> = {
                      orange: '#10b981', blue: '#f59e0b', white: '#ffffff',
                      green: '#34d399', red: '#ef4444', yellow: '#eab308',
                    };
                    return (
                      <div
                        key={p.id}
                        className="absolute top-0 bottom-0 w-1"
                        style={{ left: `${left}%`, backgroundColor: colorMap[p.product.color] || '#10b981' }}
                        title={`${p.product.name} @ ${p.distanceKm.toFixed(1)}km`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Recommended plan timeline */}
              {recSorted.length > 0 && (
                <div>
                  <div className="text-[10px] text-warm mb-1 uppercase">Recommended</div>
                  <div className="h-6 bg-black/50 border border-warm/20 relative rounded-sm overflow-hidden">
                    {recSorted.map((p) => {
                      const left = (p.distanceKm / maxKm) * 100;
                      return (
                        <div
                          key={p.id}
                          className="absolute top-0 bottom-0 w-1 bg-warm"
                          style={{ left: `${left}%` }}
                          title={`${p.product.name} @ ${p.distanceKm.toFixed(1)}km`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Distance axis */}
              <div className="flex justify-between text-[9px] font-mono text-text-muted">
                <span>0km</span>
                <span>{(maxKm * 0.25).toFixed(0)}km</span>
                <span>{(maxKm * 0.5).toFixed(0)}km</span>
                <span>{(maxKm * 0.75).toFixed(0)}km</span>
                <span>{maxKm.toFixed(0)}km</span>
              </div>
            </div>
          </div>

          {/* Metrics Comparison */}
          <div>
            <div className="grid grid-cols-4 gap-2 pb-2 border-b border-white/[0.06]">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Metric</div>
              <div className="text-[10px] text-white uppercase tracking-wider text-center">Your Plan</div>
              <div className="text-[10px] text-warm uppercase tracking-wider text-center">
                {recommendedMetrics ? 'Recommended' : 'Target'}
              </div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider text-center">Diff</div>
            </div>

            <MetricRow
              label="Carbs/hr"
              icon={Zap}
              current={currentMetrics.carbsPerHour}
              recommended={recommendedMetrics?.carbsPerHour ?? 80}
              unit="g"
            />
            <MetricRow
              label="Total Carbs"
              icon={Zap}
              current={currentMetrics.totalCarbs}
              recommended={recommendedMetrics?.totalCarbs ?? Math.round(80 * hours)}
              unit="g"
            />
            <MetricRow
              label="Sodium"
              icon={Droplets}
              current={currentMetrics.totalSodium}
              recommended={recommendedMetrics?.totalSodium ?? Math.round(500 * hours)}
              unit="mg"
            />
            <MetricRow
              label="Caffeine"
              icon={Coffee}
              current={currentMetrics.totalCaffeine}
              recommended={recommendedMetrics?.totalCaffeine ?? 200}
              unit="mg"
            />
            <MetricRow
              label="Calories"
              icon={TrendingUp}
              current={currentMetrics.totalCalories}
              recommended={recommendedMetrics?.totalCalories ?? Math.round(300 * hours)}
              unit=""
            />
            <MetricRow
              label="Cost"
              icon={DollarSign}
              current={Math.round(currentMetrics.totalCost)}
              recommended={recommendedMetrics ? Math.round(recommendedMetrics.totalCost) : 0}
              unit="R"
              higherIsBetter={false}
            />
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 border border-white/[0.06] p-4">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Your Plan</div>
              <div className="text-2xl font-mono font-bold text-white">{currentMetrics.pointCount}</div>
              <div className="text-xs text-text-secondary">nutrition points</div>
              <div className="mt-2 text-xs font-mono text-text-muted">
                Avg gap: {currentMetrics.avgGapKm.toFixed(1)}km
              </div>
            </div>
            <div className="bg-black/30 border border-warm/20 p-4">
              <div className="text-[10px] text-warm uppercase tracking-wider mb-2">Recommended</div>
              <div className="text-2xl font-mono font-bold text-warm">
                {recommendedMetrics?.pointCount ?? '—'}
              </div>
              <div className="text-xs text-text-secondary">nutrition points</div>
              <div className="mt-2 text-xs font-mono text-text-muted">
                Avg gap: {recommendedMetrics ? recommendedMetrics.avgGapKm.toFixed(1) : '—'}km
              </div>
            </div>
          </div>

          {!recommendedMetrics && (
            <div className="bg-surfaceHighlight border border-white/[0.06] p-4 text-center">
              <p className="text-xs text-text-secondary">
                Generate an auto plan first to see a full comparison.
                <br />Showing default targets for now.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
