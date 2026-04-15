import { useState, useEffect } from 'react';
import { getAllPlans, getAllFeedback, SavedPlan } from '../persistence/db';
import { RouteData, NutritionPoint } from '../context/AppContext';

export interface NutritionStats {
  totalRuns: number;
  totalKm: number;
  totalCarbs: number;
  totalSodium: number;
  totalCaffeine: number;
  totalCost: number;
  avgCarbsPerHour: number;
  avgFeel: number | null;
  bonkRate: number | null;
  gutIssueRate: number | null;
  favoriteProducts: { name: string; brand: string; count: number }[];
}

function parsePlanNutrition(plan: SavedPlan): { points: NutritionPoint[]; distanceKm: number; hours: number } {
  try {
    const route = JSON.parse(plan.routeDataJson) as RouteData;
    const timeParts = (route.estimatedTime || '3:00:00').split(':').map(Number);
    const hours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
    return { points: route.nutritionPoints || [], distanceKm: route.distanceKm, hours };
  } catch {
    return { points: [], distanceKm: 0, hours: 0 };
  }
}

export function useNutritionStats(recentCount = 10) {
  const [stats, setStats] = useState<NutritionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function compute() {
      const [allPlans, allFeedback] = await Promise.all([getAllPlans(), getAllFeedback()]);

      // Filter out autosave plans and take recent ones
      const plans = allPlans
        .filter((p) => !p.name.startsWith('Auto-save:'))
        .slice(0, recentCount);

      if (plans.length === 0) {
        setStats(null);
        setLoading(false);
        return;
      }

      let totalKm = 0;
      let totalCarbs = 0;
      let totalSodium = 0;
      let totalCaffeine = 0;
      let totalCost = 0;
      let totalHours = 0;
      const productCounts: Record<string, { name: string; brand: string; count: number }> = {};

      for (const plan of plans) {
        const { points, distanceKm, hours } = parsePlanNutrition(plan);
        totalKm += distanceKm;
        totalHours += hours;

        for (const p of points) {
          totalCarbs += p.product.carbs;
          totalSodium += p.product.sodium;
          totalCaffeine += p.product.caffeine;
          totalCost += p.product.priceZAR || 0;

          const key = p.product.id;
          if (!productCounts[key]) {
            productCounts[key] = { name: p.product.name, brand: p.product.brand, count: 0 };
          }
          productCounts[key].count++;
        }
      }

      // Feedback stats
      const recentFeedback = allFeedback.slice(0, recentCount);
      let avgFeel: number | null = null;
      let bonkRate: number | null = null;
      let gutIssueRate: number | null = null;

      if (recentFeedback.length > 0) {
        avgFeel = recentFeedback.reduce((s, f) => s + f.overallFeel, 0) / recentFeedback.length;
        avgFeel = Math.round(avgFeel * 10) / 10;
        bonkRate = recentFeedback.filter((f) => f.bonkLevel > 0).length / recentFeedback.length;
        bonkRate = Math.round(bonkRate * 100);
        gutIssueRate = recentFeedback.filter((f) => f.gutIssues !== 'none').length / recentFeedback.length;
        gutIssueRate = Math.round(gutIssueRate * 100);
      }

      const favoriteProducts = Object.values(productCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalRuns: plans.length,
        totalKm: Math.round(totalKm),
        totalCarbs: Math.round(totalCarbs),
        totalSodium: Math.round(totalSodium),
        totalCaffeine: Math.round(totalCaffeine),
        totalCost: Math.round(totalCost),
        avgCarbsPerHour: totalHours > 0 ? Math.round(totalCarbs / totalHours) : 0,
        avgFeel,
        bonkRate,
        gutIssueRate,
        favoriteProducts,
      });
      setLoading(false);
    }

    compute();
  }, [recentCount]);

  return { stats, loading };
}
