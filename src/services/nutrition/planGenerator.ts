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
 * Phase-aware fuel-gap in minutes.
 *
 * Research basis:
 * - Early phase: glycogen stores are full, gut tolerance is peak. Wider gaps are fine.
 * - Mid phase: glycogen depletion accelerates; tighter spacing sustains carb availability.
 * - Late phase: the bonk zone. Research (Jeukendrup, Burke) shows frequent small doses
 *   outperform large ones as gut motility slows under stress. Pull gaps tighter to prevent
 *   hypoglycaemia-driven performance drops.
 */
function gapMinutesForPhase(phase: number, durationHours: number): number {
  if (phase < 0.33) return durationHours > 2 ? 28 : 25;
  if (phase < 0.66) return durationHours > 2 ? 24 : 22;
  return durationHours > 2 ? 20 : 18;
}

/**
 * Pick the time of the first fuel point, in minutes into the effort.
 *
 * Research basis:
 * - <60 min: no fuel needed — glycogen covers it (handled upstream, not here).
 * - 60-90 min: single fuel around halfway is often sufficient.
 * - >90 min: first fuel at 30-40 min in to stretch glycogen without emptying the tank.
 * - Hot conditions shift this earlier (sweat loss starts earlier GI stress).
 */
function firstFuelMinutes(durationHours: number, temperatureCelsius: number): number {
  const hot = temperatureCelsius >= 25;
  if (durationHours < 1.5) return Math.round(durationHours * 60 * (hot ? 0.42 : 0.5));
  if (durationHours < 2.5) return hot ? 28 : 35;
  return hot ? 28 : 35;
}

function pickFromSorted<T>(sorted: T[], topN = 3): T {
  if (sorted.length === 0) throw new Error('Cannot pick from empty list');
  return sorted[Math.floor(Math.random() * Math.min(topN, sorted.length))];
}

/**
 * Choose the next product.
 *
 * Research basis (dual-transporter absorption, Jeukendrup 2010+):
 * - Glucose uptake saturates at ~60 g/h via SGLT1.
 * - Adding fructose (GLUT5) enables up to 90 g/h.
 * - Alternating liquid (often fructose-containing) with solid (glucose-heavy) approximates
 *   the 2:1 glucose:fructose ratio in real use.
 */
function selectProduct(
  distanceKm: number,
  totalDistanceKm: number,
  caffeineStrat: CaffeineRecommendation,
  currentCaffeineMg: number,
  segment: RouteSegment | undefined,
  preferredProducts: ProductProps[] | undefined,
  preferSolidNow: boolean
): ProductProps {
  const catalog = preferredProducts && preferredProducts.length > 0 ? preferredProducts : products;
  const gels = catalog.filter((p) => p.category === 'gel');
  const drinks = catalog.filter((p) => p.category === 'drink');
  const bars = catalog.filter((p) => p.category === 'bar');
  const chews = catalog.filter((p) => p.category === 'chew');

  // Caffeine timing — strategic, not filler
  if (shouldUseCaffeineProduct(distanceKm, totalDistanceKm, caffeineStrat, currentCaffeineMg)) {
    const cafProducts = catalog.filter((p) => p.caffeine > 0).sort((a, b) => b.carbs - a.carbs);
    if (cafProducts.length > 0) return pickFromSorted(cafProducts, 2);
  }

  // Dual-transporter alternation: solid (glucose) ↔ liquid (often fructose blend)
  if (preferSolidNow) {
    const solids = [...bars, ...chews].sort((a, b) => b.carbs - a.carbs);
    if (solids.length > 0 && (!segment || segment.type !== 'climb')) {
      return pickFromSorted(solids, 3);
    }
    // On climbs, solids are hard to chew — fall back to gels
    if (gels.length > 0) return pickFromSorted([...gels].sort((a, b) => b.carbs - a.carbs), 3);
  } else {
    if (drinks.length > 0 && segment?.type !== 'climb') {
      const sorted = [...drinks].sort((a, b) => b.carbs - a.carbs);
      return pickFromSorted(sorted, 3);
    }
    // Liquid not ideal on a climb — pivot to a gel (quick, no chewing, high-carb)
    if (gels.length > 0) {
      const sorted = [...gels].sort((a, b) => b.carbs - a.carbs);
      return pickFromSorted(sorted, 3);
    }
  }

  // Last resort: whatever we have, prefer higher-carb for long efforts
  const fallback = [...catalog].sort((a, b) => b.carbs - a.carbs);
  return pickFromSorted(fallback, Math.min(5, fallback.length));
}

function segmentAt(segments: RouteSegment[], km: number): RouteSegment | undefined {
  return segments.find((s) => km >= s.startKm && km <= s.endKm);
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

  const carbTarget = calculateCarbTarget({
    durationHours,
    intensityPercent: 0.75,
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

  // Short efforts → no mid-run fueling (glycogen sufficient). Caller already guards this
  // but we double-check here so this function is safe standalone.
  if (durationHours < 1) {
    return {
      nutritionPoints: [],
      carbTarget,
      hydrationTarget,
      caffeineStrategy,
      metrics: {
        totalCarbs: 0,
        carbsPerHour: 0,
        totalSodium: 0,
        totalCaffeine: 0,
        totalCalories: 0,
        totalCost: 0,
      },
    };
  }

  const preferredProducts = preferredProductIds
    ? products.filter((p) => preferredProductIds.includes(p.id))
    : undefined;

  const avgSpeed = distanceKm / durationHours; // km/h
  const segments = routeAnalysis?.segments || [];

  // Phase 1: when does the first fuel go?
  const firstMin = firstFuelMinutes(durationHours, temperatureCelsius);
  const firstKm = Math.max(2, (avgSpeed * firstMin) / 60);

  const points: NutritionPoint[] = [];
  let totalCarbs = 0;
  let totalSodium = 0;
  let totalCaffeine = 0;
  let totalCalories = 0;
  let totalCost = 0;
  let preferSolid = false; // dual-transporter alternation; alternate every point

  let cursorKm = firstKm;

  // Stop placing roughly 2 km before the finish — last fuel won't be digested in time
  const endBufferKm = Math.max(1, Math.min(3, avgSpeed * 0.15));

  let safety = 0;
  while (cursorKm < distanceKm - endBufferKm && safety++ < 200) {
    const phase = cursorKm / distanceKm;
    let placeKm = cursorKm;

    // TERRAIN SMARTS:
    // 1) If a climb starts in the next ~8 min, place the fuel ~5 min BEFORE the climb
    //    so it's absorbed when you need it.
    const lookaheadKm = (avgSpeed * 8) / 60;
    const upcomingClimb = segments.find(
      (s) => s.type === 'climb' && s.startKm > cursorKm && s.startKm - cursorKm <= lookaheadKm
    );
    if (upcomingClimb) {
      const preClimbKm = upcomingClimb.startKm - (avgSpeed * 5) / 60;
      if (preClimbKm > cursorKm) placeKm = preClimbKm;
    }

    // 2) If we'd be fueling mid-descent, push to end-of-descent — stomach tolerates food
    //    poorly while pounding downhill.
    const currentSeg = segmentAt(segments, placeKm);
    if (currentSeg?.type === 'descent' && currentSeg.endKm - placeKm > 1.5) {
      placeKm = Math.min(distanceKm - endBufferKm, currentSeg.endKm);
    }

    // Minimum-gap protection (avoid stacking when terrain pulled two placements together)
    if (points.length > 0) {
      const lastKm = points[points.length - 1].distanceKm;
      const gapMin = ((placeKm - lastKm) / avgSpeed) * 60;
      if (gapMin < 12) {
        cursorKm = lastKm + (avgSpeed * 15) / 60;
        continue;
      }
    }

    const segForPlacement = segmentAt(segments, placeKm);
    const product = selectProduct(
      placeKm,
      distanceKm,
      caffeineStrategy,
      totalCaffeine,
      segForPlacement,
      preferredProducts,
      preferSolid
    );

    // Budget check — swap to cheapest high-carb alternative if needed
    if (budget && totalCost + (product.priceZAR || 0) > budget) {
      const cheaper = products
        .filter((p) => (p.priceZAR || 0) <= budget - totalCost)
        .sort((a, b) => b.carbs - a.carbs);
      if (cheaper.length === 0) break; // can't afford any more
      const cheapProduct = cheaper[0];
      points.push({
        id: nanoid(),
        distanceKm: Math.round(placeKm * 10) / 10,
        product: cheapProduct,
      });
      totalCarbs += cheapProduct.carbs;
      totalSodium += cheapProduct.sodium;
      totalCaffeine += cheapProduct.caffeine;
      totalCalories += cheapProduct.calories;
      totalCost += cheapProduct.priceZAR || 0;
    } else {
      points.push({
        id: nanoid(),
        distanceKm: Math.round(placeKm * 10) / 10,
        product,
      });
      totalCarbs += product.carbs;
      totalSodium += product.sodium;
      totalCaffeine += product.caffeine;
      totalCalories += product.calories;
      totalCost += product.priceZAR || 0;
    }

    preferSolid = !preferSolid; // alternate for dual-transporter next time

    // Advance by phase-aware gap
    const gapMin = gapMinutesForPhase(phase, durationHours);
    cursorKm = placeKm + (avgSpeed * gapMin) / 60;
  }

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
