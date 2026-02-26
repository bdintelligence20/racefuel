import { nanoid } from 'nanoid';
import { NutritionPoint, UserProfile, GpsPoint } from '../../context/AppContext';
import { ProductProps } from '../../components/NutritionCard';
import { products } from '../../data/products';
import { RouteAnalysis, RouteSegment } from '../route/routeAnalyzer';
import { calculateCarbTarget, CarbTarget } from './carbCalculator';
import { calculateHydration, HydrationTarget } from './hydrationCalculator';
import { calculateCaffeineStrategy, CaffeineRecommendation, shouldUseCaffeineProduct } from './caffeineStrategy';

export interface PlanGeneratorInput {
  distanceKm: number;
  durationHours: number;
  gpsPath?: GpsPoint[];
  routeAnalysis?: RouteAnalysis;
  profile: UserProfile;
  isCompetition: boolean;
  temperatureCelsius: number;
  humidity: number;
  preferredProductIds?: string[];
  budget?: number | null;
}

export interface GeneratedPlan {
  nutritionPoints: NutritionPoint[];
  carbTarget: CarbTarget;
  hydrationTarget: HydrationTarget;
  caffeineStrategy: CaffeineRecommendation;
  metrics: {
    totalCarbs: number;
    carbsPerHour: number;
    totalSodium: number;
    totalCaffeine: number;
    totalCalories: number;
    totalCost: number;
  };
}

/**
 * Get appropriate products for a position on the route
 */
function selectProduct(
  distanceKm: number,
  totalDistanceKm: number,
  durationHours: number,
  caffeineStrat: CaffeineRecommendation,
  currentCaffeineMg: number,
  segment?: RouteSegment,
  preferredProducts?: ProductProps[]
): ProductProps {
  const progress = distanceKm / totalDistanceKm;
  const catalog = preferredProducts && preferredProducts.length > 0 ? preferredProducts : products;

  const gels = catalog.filter(p => p.category === 'gel');
  const drinks = catalog.filter(p => p.category === 'drink');
  const bars = catalog.filter(p => p.category === 'bar');
  const chews = catalog.filter(p => p.category === 'chew');

  // Should we use caffeine here?
  const useCaffeine = shouldUseCaffeineProduct(
    distanceKm, totalDistanceKm, caffeineStrat, currentCaffeineMg
  );

  if (useCaffeine) {
    const cafProducts = catalog.filter(p => p.caffeine > 0);
    if (cafProducts.length > 0) {
      return cafProducts[Math.floor(Math.random() * cafProducts.length)];
    }
  }

  // First 40%: prefer bars/chews (solid food, easier at lower relative intensity)
  if (progress < 0.4 && durationHours > 2) {
    const solids = [...bars, ...chews];
    if (solids.length > 0 && (!segment || segment.type !== 'climb')) {
      return solids[Math.floor(Math.random() * solids.length)];
    }
  }

  // On climbs: prefer gels (quick, easy to consume)
  if (segment?.type === 'climb') {
    if (gels.length > 0) {
      return gels[Math.floor(Math.random() * gels.length)];
    }
  }

  // On descents/flats: prefer drinks (easier to drink)
  if (segment?.type === 'descent' || segment?.type === 'flat') {
    if (drinks.length > 0 && Math.random() > 0.5) {
      return drinks[Math.floor(Math.random() * drinks.length)];
    }
  }

  // Default: alternate between gels and drinks
  const isEven = Math.floor(distanceKm / 10) % 2 === 0;
  if (isEven && gels.length > 0) {
    // Pick a random gel, prefer higher-carb for longer efforts
    const sorted = [...gels].sort((a, b) => b.carbs - a.carbs);
    return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
  }

  if (drinks.length > 0) {
    const sorted = [...drinks].sort((a, b) => b.carbs - a.carbs);
    return sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
  }

  // Fallback
  return catalog[Math.floor(Math.random() * catalog.length)];
}

function getSegmentAtDistance(segments: RouteSegment[], km: number): RouteSegment | undefined {
  return segments.find(s => km >= s.startKm && km <= s.endKm);
}

export function generatePlan(input: PlanGeneratorInput): GeneratedPlan {
  const {
    distanceKm,
    durationHours,
    routeAnalysis,
    profile,
    isCompetition,
    temperatureCelsius,
    humidity,
    preferredProductIds,
    budget,
  } = input;

  // Calculate targets
  const carbTarget = calculateCarbTarget({
    durationHours,
    intensityPercent: 0.75, // Default to tempo effort
    gutTolerance: 'trained',
    isCompetition,
    bodyWeightKg: profile.weight,
  });

  const hydrationTarget = calculateHydration({
    bodyWeightKg: profile.weight,
    durationHours,
    temperatureCelsius,
    humidity,
    intensityPercent: 0.75,
    sweatRate: profile.sweatRate,
  });

  const caffeineStrategy = calculateCaffeineStrategy({
    bodyWeightKg: profile.weight,
    durationHours,
    distanceKm,
    isRegularConsumer: true,
    targetMgPerKg: isCompetition ? 4 : 3,
  });

  // Build preferred products list
  const preferredProducts = preferredProductIds
    ? products.filter(p => preferredProductIds.includes(p.id))
    : undefined;

  // Determine placement intervals
  const avgSpeed = distanceKm / durationHours;
  // Place nutrition every 15-20 minutes
  const intervalMinutes = durationHours > 3 ? 15 : 20;
  const intervalKm = (avgSpeed * intervalMinutes) / 60;

  // Start fueling at ~15-20min in
  const firstPointKm = Math.max(5, intervalKm * 0.8);

  // Generate nutrition points
  const points: NutritionPoint[] = [];
  let totalCarbs = 0;
  let totalSodium = 0;
  let totalCaffeine = 0;
  let totalCalories = 0;
  let totalCost = 0;

  const segments = routeAnalysis?.segments || [];

  // Place points along the route
  for (let km = firstPointKm; km < distanceKm - 3; km += intervalKm) {
    const segment = getSegmentAtDistance(segments, km);

    // If approaching a climb, place nutrition 5min before
    if (segment?.type === 'climb' && km === segment.startKm) {
      const preClimbKm = Math.max(firstPointKm, km - (avgSpeed * 5) / 60);
      if (points.length > 0 && preClimbKm - points[points.length - 1].distanceKm < intervalKm * 0.5) {
        continue; // Too close to previous point
      }
      km = preClimbKm;
    }

    // Check minimum spacing
    if (points.length > 0) {
      const lastKm = points[points.length - 1].distanceKm;
      const gapMinutes = ((km - lastKm) / avgSpeed) * 60;
      if (gapMinutes < 12) continue;
    }

    const product = selectProduct(
      km, distanceKm, durationHours, caffeineStrategy,
      totalCaffeine, segment, preferredProducts
    );

    // Budget check
    if (budget && totalCost + (product.priceZAR || 0) > budget) {
      // Try to find a cheaper alternative
      const cheaper = products
        .filter(p => (p.priceZAR || 0) <= budget - totalCost)
        .sort((a, b) => b.carbs - a.carbs);
      if (cheaper.length === 0) break; // Over budget
      // Use cheapest high-carb option
      const cheapProduct = cheaper[0];
      points.push({
        id: nanoid(),
        distanceKm: Math.round(km * 10) / 10,
        product: cheapProduct,
      });
      totalCarbs += cheapProduct.carbs;
      totalSodium += cheapProduct.sodium;
      totalCaffeine += cheapProduct.caffeine;
      totalCalories += cheapProduct.calories;
      totalCost += cheapProduct.priceZAR || 0;
      continue;
    }

    points.push({
      id: nanoid(),
      distanceKm: Math.round(km * 10) / 10,
      product,
    });

    totalCarbs += product.carbs;
    totalSodium += product.sodium;
    totalCaffeine += product.caffeine;
    totalCalories += product.calories;
    totalCost += product.priceZAR || 0;
  }

  // Check if we're meeting carb targets, if under, add more points
  const carbsPerHour = durationHours > 0 ? totalCarbs / durationHours : 0;
  if (carbsPerHour < carbTarget.target * 0.8 && points.length > 0) {
    // Find biggest gaps and add points
    const sorted = [...points].sort((a, b) => a.distanceKm - b.distanceKm);
    const gaps: { midKm: number; gapKm: number }[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].distanceKm - sorted[i - 1].distanceKm;
      if (gap > intervalKm * 1.3) {
        gaps.push({
          midKm: sorted[i - 1].distanceKm + gap / 2,
          gapKm: gap,
        });
      }
    }

    gaps.sort((a, b) => b.gapKm - a.gapKm);

    for (const gap of gaps.slice(0, 3)) {
      const segment = getSegmentAtDistance(segments, gap.midKm);
      const product = selectProduct(
        gap.midKm, distanceKm, durationHours, caffeineStrategy,
        totalCaffeine, segment, preferredProducts
      );

      points.push({
        id: nanoid(),
        distanceKm: Math.round(gap.midKm * 10) / 10,
        product,
      });
      totalCarbs += product.carbs;
      totalSodium += product.sodium;
      totalCaffeine += product.caffeine;
      totalCalories += product.calories;
      totalCost += product.priceZAR || 0;
    }
  }

  // Sort by distance
  points.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    nutritionPoints: points,
    carbTarget,
    hydrationTarget,
    caffeineStrategy,
    metrics: {
      totalCarbs,
      carbsPerHour: durationHours > 0 ? Math.round(totalCarbs / durationHours) : 0,
      totalSodium,
      totalCaffeine,
      totalCalories,
      totalCost: Math.round(totalCost * 100) / 100,
    },
  };
}
