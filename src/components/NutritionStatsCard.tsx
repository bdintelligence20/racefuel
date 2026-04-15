import { Zap, Droplets, TrendingUp, Heart, AlertTriangle } from 'lucide-react';
import { useNutritionStats } from '../hooks/useNutritionStats';

export function NutritionStatsCard() {
  const { stats, loading } = useNutritionStats();

  if (loading) return null;
  if (!stats) {
    return (
      <div className="p-3 rounded-xl bg-surfaceHighlight border border-[var(--color-border)]">
        <p className="text-[10px] text-text-muted text-center">
          Save plans to see your nutrition stats
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
        Nutrition Profile
      </h2>

      <div className="p-3 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] space-y-3">
        {/* Summary Line */}
        <p className="text-xs text-text-secondary">
          Over <span className="text-text-primary font-semibold">{stats.totalRuns} plans</span>{' '}
          ({stats.totalKm}km) you've consumed:
        </p>

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-warm" />
            <div>
              <div className="text-sm font-display font-bold text-text-primary">{stats.totalCarbs}g</div>
              <div className="text-[9px] text-text-muted">total carbs</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <div>
              <div className="text-sm font-display font-bold text-text-primary">{stats.totalSodium}mg</div>
              <div className="text-[9px] text-text-muted">total sodium</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-accent" />
            <div>
              <div className="text-sm font-display font-bold text-text-primary">{stats.avgCarbsPerHour}g/hr</div>
              <div className="text-[9px] text-text-muted">avg carbs/hr</div>
            </div>
          </div>
          {stats.avgFeel !== null && (
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-pink-400" />
              <div>
                <div className="text-sm font-display font-bold text-text-primary">{stats.avgFeel}/5</div>
                <div className="text-[9px] text-text-muted">avg feel</div>
              </div>
            </div>
          )}
        </div>

        {/* Warnings */}
        {stats.bonkRate !== null && stats.bonkRate > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-warm">
            <AlertTriangle className="w-3 h-3" />
            <span>Bonked in {stats.bonkRate}% of runs</span>
          </div>
        )}

        {/* Favorite Products */}
        {stats.favoriteProducts.length > 0 && (
          <div>
            <div className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Top products</div>
            <div className="space-y-1">
              {stats.favoriteProducts.slice(0, 3).map((p) => (
                <div key={p.name} className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary truncate">{p.brand} {p.name}</span>
                  <span className="text-text-muted font-display ml-2">{p.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
