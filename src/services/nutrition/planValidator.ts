import { NutritionPoint } from '../../context/AppContext';
import { CarbTarget } from './carbCalculator';
import { HydrationTarget } from './hydrationCalculator';
import { CaffeineRecommendation } from './caffeineStrategy';

export type WarningSeverity = 'info' | 'warning' | 'critical';

export interface PlanWarning {
  id: string;
  severity: WarningSeverity;
  message: string;
  detail: string;
  distanceKm?: number;  // Location on route where issue occurs
  metric?: string;       // Which metric is affected
}

export interface ValidationResult {
  warnings: PlanWarning[];
  score: number;        // 0-100 plan quality score
  carbsPerHour: number;
  totalCarbs: number;
  totalSodium: number;
  totalCaffeine: number;
  totalCalories: number;
  totalCost: number;
}

export function validatePlan(
  nutritionPoints: NutritionPoint[],
  distanceKm: number,
  durationHours: number,
  carbTarget?: CarbTarget,
  hydrationTarget?: HydrationTarget,
  caffeineStrategy?: CaffeineRecommendation,
  bodyWeightKg?: number
): ValidationResult {
  const warnings: PlanWarning[] = [];
  let score = 100;

  const sorted = [...nutritionPoints].sort((a, b) => a.distanceKm - b.distanceKm);

  // Calculate totals
  const totalCarbs = sorted.reduce((sum, p) => sum + p.product.carbs, 0);
  const totalSodium = sorted.reduce((sum, p) => sum + p.product.sodium, 0);
  const totalCaffeine = sorted.reduce((sum, p) => sum + p.product.caffeine, 0);
  const totalCalories = sorted.reduce((sum, p) => sum + p.product.calories, 0);
  const totalCost = sorted.reduce((sum, p) => sum + (p.product.priceZAR || 0), 0);
  const carbsPerHour = durationHours > 0 ? Math.round(totalCarbs / durationHours) : 0;

  // === Check for no nutrition points ===
  if (sorted.length === 0 && durationHours > 1) {
    warnings.push({
      id: 'no-nutrition',
      severity: 'critical',
      message: 'No nutrition planned',
      detail: `A ${durationHours.toFixed(1)}hr effort requires fueling. Add nutrition points to your plan.`,
      metric: 'carbs',
    });
    score -= 50;
  }

  // === Check gaps between nutrition points ===
  if (sorted.length > 0) {
    const avgSpeed = distanceKm / durationHours;

    // Check gap from start
    if (sorted[0].distanceKm > 20) {
      const gapMinutes = (sorted[0].distanceKm / avgSpeed) * 60;
      warnings.push({
        id: 'late-start',
        severity: 'warning',
        message: 'Late first nutrition',
        detail: `First nutrition at ${sorted[0].distanceKm.toFixed(1)}km (~${Math.round(gapMinutes)}min). Consider starting earlier for better energy availability.`,
        distanceKm: sorted[0].distanceKm,
        metric: 'timing',
      });
      score -= 10;
    }

    // Check gaps between points
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].distanceKm - sorted[i - 1].distanceKm;
      const gapMinutes = (gap / avgSpeed) * 60;

      if (gapMinutes > 45) {
        warnings.push({
          id: `gap-${i}`,
          severity: 'critical',
          message: 'Large nutrition gap',
          detail: `${Math.round(gapMinutes)}min gap between ${sorted[i - 1].distanceKm.toFixed(1)}km and ${sorted[i].distanceKm.toFixed(1)}km. Risk of bonking.`,
          distanceKm: sorted[i - 1].distanceKm + gap / 2,
          metric: 'timing',
        });
        score -= 15;
      } else if (gapMinutes > 30) {
        warnings.push({
          id: `gap-${i}`,
          severity: 'warning',
          message: 'Nutrition gap',
          detail: `${Math.round(gapMinutes)}min between points at ${sorted[i - 1].distanceKm.toFixed(1)}km and ${sorted[i].distanceKm.toFixed(1)}km.`,
          distanceKm: sorted[i - 1].distanceKm + gap / 2,
          metric: 'timing',
        });
        score -= 5;
      }
    }

    // Check clustering (too close together)
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].distanceKm - sorted[i - 1].distanceKm;
      const gapMinutes = (gap / avgSpeed) * 60;

      if (gapMinutes < 10) {
        warnings.push({
          id: `cluster-${i}`,
          severity: 'warning',
          message: 'Products too close',
          detail: `Only ${Math.round(gapMinutes)}min between points. Allow at least 12-15min for gut processing.`,
          distanceKm: sorted[i].distanceKm,
          metric: 'timing',
        });
        score -= 5;
      }
    }

    // Check gap to finish
    const lastPoint = sorted[sorted.length - 1];
    const distToFinish = distanceKm - lastPoint.distanceKm;
    const timeToFinish = (distToFinish / avgSpeed) * 60;
    if (timeToFinish > 45 && durationHours > 2) {
      warnings.push({
        id: 'early-stop',
        severity: 'info',
        message: 'No late-race nutrition',
        detail: `Last nutrition at ${lastPoint.distanceKm.toFixed(1)}km, ${Math.round(timeToFinish)}min from finish. Consider adding fuel for the final push.`,
        distanceKm: lastPoint.distanceKm,
        metric: 'timing',
      });
      score -= 5;
    }
  }

  // === Spec guardrails from the target objects ===
  if (carbTarget && carbTarget.gutCapped && carbTarget.tierMaxBeforeGutCap > carbTarget.max) {
    warnings.push({
      id: 'gut-capped',
      severity: 'info',
      message: 'Carb target capped by gut tolerance',
      detail: `Tier would allow up to ${carbTarget.tierMaxBeforeGutCap}g/h, but your gut-trained ceiling caps the plan at ${carbTarget.max}g/h. Raise gradually with training.`,
      metric: 'carbs',
    });
  }

  if (hydrationTarget?.ultraCapApplied) {
    warnings.push({
      id: 'fluid-ultra-cap',
      severity: 'warning',
      message: 'Fluid capped at 800 ml/h',
      detail: 'Long-event hyponatremia guardrail (Hew-Butler 2015). Anything above 800 ml/h on a >4h effort needs matched sodium intake.',
      metric: 'fluid',
    });
    score -= 5;
  }

  if (hydrationTarget?.hyponatremiaRisk) {
    warnings.push({
      id: 'hyponatremia-risk',
      severity: 'critical',
      message: 'Hyponatremia risk',
      detail: 'Fluid-to-sodium ratio exceeds 1.5 L per gram. Reduce fluid intake, raise sodium, or both — especially in the back half of the event.',
      metric: 'sodium',
    });
    score -= 20;
  }

  // === Carb target validation ===
  if (carbTarget && durationHours > 1) {
    if (carbsPerHour < carbTarget.min) {
      warnings.push({
        id: 'carbs-low',
        severity: 'critical',
        message: 'Carbs below minimum',
        detail: `${carbsPerHour}g/hr is below the recommended minimum of ${carbTarget.min}g/hr for this effort. Risk of energy depletion.`,
        metric: 'carbs',
      });
      score -= 20;
    } else if (carbsPerHour < carbTarget.target) {
      warnings.push({
        id: 'carbs-below-target',
        severity: 'warning',
        message: 'Carbs below target',
        detail: `${carbsPerHour}g/hr vs target of ${carbTarget.target}g/hr. Consider adding more carbohydrate sources.`,
        metric: 'carbs',
      });
      score -= 10;
    } else if (carbsPerHour > carbTarget.max) {
      warnings.push({
        id: 'carbs-high',
        severity: 'warning',
        message: 'Carbs above maximum',
        detail: `${carbsPerHour}g/hr exceeds the ${carbTarget.max}g/hr maximum. Risk of GI distress unless gut is trained for this intake.`,
        metric: 'carbs',
      });
      score -= 10;
    }
  }

  // === Sodium validation ===
  if (hydrationTarget && durationHours > 1) {
    const sodiumPerHour = durationHours > 0 ? totalSodium / durationHours : 0;
    if (sodiumPerHour < hydrationTarget.sodiumMgPerHour * 0.5) {
      warnings.push({
        id: 'sodium-low',
        severity: 'warning',
        message: 'Low sodium intake',
        detail: `${Math.round(sodiumPerHour)}mg/hr sodium vs recommended ${hydrationTarget.sodiumMgPerHour}mg/hr. Consider adding electrolyte products.`,
        metric: 'sodium',
      });
      score -= 10;
    }
  }

  // === Caffeine validation ===
  if (bodyWeightKg && totalCaffeine > 0) {
    const caffeinePerKg = totalCaffeine / bodyWeightKg;
    if (caffeinePerKg > 6) {
      warnings.push({
        id: 'caffeine-high',
        severity: 'critical',
        message: 'Excessive caffeine',
        detail: `${Math.round(caffeinePerKg * 10) / 10}mg/kg caffeine exceeds safe performance dose of 6mg/kg. Risk of GI issues, anxiety, elevated HR.`,
        metric: 'caffeine',
      });
      score -= 15;
    } else if (caffeinePerKg > 4) {
      warnings.push({
        id: 'caffeine-moderate',
        severity: 'info',
        message: 'High caffeine intake',
        detail: `${Math.round(caffeinePerKg * 10) / 10}mg/kg caffeine. This is above moderate dose. Ensure you have trained with this amount.`,
        metric: 'caffeine',
      });
    }

    // Check for early caffeine
    const cafPoints = sorted.filter(p => p.product.caffeine > 0);
    if (cafPoints.length > 0 && caffeineStrategy && caffeineStrategy.timing !== 'none') {
      const firstCaf = cafPoints[0];
      if (firstCaf.distanceKm < caffeineStrategy.firstDoseKm * 0.7) {
        warnings.push({
          id: 'caffeine-early',
          severity: 'info',
          message: 'Early caffeine',
          detail: `Caffeine at ${firstCaf.distanceKm.toFixed(1)}km is earlier than optimal. Save caffeine for the final 40-50% for maximum benefit.`,
          distanceKm: firstCaf.distanceKm,
          metric: 'caffeine',
        });
        score -= 5;
      }
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    warnings,
    score,
    carbsPerHour,
    totalCarbs,
    totalSodium,
    totalCaffeine,
    totalCalories,
    totalCost,
  };
}
