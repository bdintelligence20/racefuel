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
  elevationGainM?: number;
  gpsPath?: GpsPoint[];
  routeAnalysis?: RouteAnalysis;
  profile: UserProfile;
  isCompetition: boolean;
  temperatureCelsius: number;
  humidity: number;
  preferredProductIds?: string[];
  preferredCategories?: Array<'gel' | 'drink' | 'bar' | 'chew'>;
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
 * Intensity proxy. Without power meters we estimate intensity from expected pace vs
 * a rough reference. Elevation gain bumps it up. This is deliberately conservative
 * — most users dragging in a GPX are training-paced, not racing.
 */
function inferIntensity(distanceKm: number, durationHours: number, elevationGainM: number, sport: 'running' | 'cycling'): number {
  if (durationHours <= 0) return 0.7;
  const speed = distanceKm / durationHours;
  const refSpeed = sport === 'cycling' ? 28 : 11; // km/h reference at moderate
  const speedIntensity = Math.max(0.5, Math.min(1.0, speed / refSpeed * 0.75));
  const elevPerKm = distanceKm > 0 ? elevationGainM / distanceKm : 0;
  const elevBoost = sport === 'running' ? elevPerKm * 0.005 : elevPerKm * 0.003;
  return Math.max(0.5, Math.min(1.0, speedIntensity + elevBoost));
}

/**
 * Phase-aware fuel-gap in minutes (Jeukendrup, Burke — frequent small doses beat
 * large ones as gut motility slows late in the effort).
 */
function gapMinutesForPhase(phase: number, durationHours: number): number {
  if (phase < 0.33) return durationHours > 2 ? 28 : 25;
  if (phase < 0.66) return durationHours > 2 ? 24 : 22;
  return durationHours > 2 ? 20 : 18;
}

/**
 * First-fuel offset in minutes. For <60min efforts we never place; for 60–90min a
 * single dose around halfway; >90min at ~30–35min to stretch glycogen. Heat pulls
 * this earlier because GI stress shows up sooner when core temp is rising.
 */
function firstFuelMinutes(durationHours: number, temperatureCelsius: number): number {
  const hot = temperatureCelsius >= 25;
  if (durationHours < 1.5) return Math.round(durationHours * 60 * (hot ? 0.42 : 0.5));
  return hot ? 28 : 35;
}

function pickFromSorted<T>(sorted: T[], topN = 3): T {
  if (sorted.length === 0) throw new Error('Cannot pick from empty list');
  return sorted[Math.floor(Math.random() * Math.min(topN, sorted.length))];
}

/**
 * Fuel-candidacy filter. Two reasons a product is rejected here:
 *   1) multi-serve packaging that can't be consumed mid-route (tubs, boxes, bulk);
 *   2) recovery/post-race formulations (high protein, often named "Recover"/"Recovery"),
 *      which don't belong in on-course fueling even when single-serve.
 *
 * Also exported so the sidebar's product list stays in sync.
 */
export function isSingleServe(p: ProductProps): boolean {
  const name = `${p.brand} ${p.name}`.toLowerCase();
  const multiServePatterns = [
    /\btub\b/,
    /\btin\b/,
    /\bjar\b/,
    /\bbulk\b/,
    /\bmultipack\b/,
    /\bmulti-?pack\b/,
    /\bpack of \d+/,
    /\bbox of \d+/,
    /\b\d+\s*(tabs?|tablets?|serv(ing|e)s?|sachets?|gels?|bars?|chews?)\b(?!\s*per)/,
    /\b([3-9]\d{2}|[1-9]\d{3})\s*g\b/,
    /\b[1-9](\.[0-9]+)?\s*kg\b/,
  ];
  if (multiServePatterns.some((re) => re.test(name))) return false;
  if (p.carbs > 70) return false;
  return true;
}

/**
 * A fuel candidate must provide meaningful carbs. Recovery formulas and products
 * we have no nutrition data for get excluded — otherwise the placement loop runs
 * without tripping the carb-target break and overfills short routes.
 */
function isFuelCandidate(p: ProductProps): boolean {
  if (!isSingleServe(p)) return false;
  if (p.carbs <= 0) return false;
  const name = `${p.brand} ${p.name}`.toLowerCase();
  if (/recover(y)?/.test(name)) return false;
  // Pure salt / protein / creatine supplements are filtered by the carbs check above.
  return true;
}

function byCarbProximity(items: ProductProps[], targetCarbs: number): ProductProps[] {
  return [...items].sort(
    (a, b) => Math.abs(a.carbs - targetCarbs) - Math.abs(b.carbs - targetCarbs),
  );
}

function selectProduct(
  distanceKm: number,
  totalDistanceKm: number,
  caffeineStrat: CaffeineRecommendation,
  currentCaffeineMg: number,
  segment: RouteSegment | undefined,
  preferredProducts: ProductProps[] | undefined,
  preferSolidNow: boolean,
  targetCarbsPerPoint: number,
  maxCarbsPerPoint: number,
  preferredCategories?: Array<'gel' | 'drink' | 'bar' | 'chew'>,
): ProductProps | null {
  const rawPool = preferredProducts && preferredProducts.length > 0 ? preferredProducts : products;
  const fuelPool = rawPool.filter(isFuelCandidate);
  if (fuelPool.length === 0) return null;

  const budgeted = fuelPool.filter((p) => p.carbs <= maxCarbsPerPoint);
  const basePool = budgeted.length > 0 ? budgeted : fuelPool;

  const preferredSet = preferredCategories && preferredCategories.length > 0 ? new Set(preferredCategories) : null;
  const preferredPool = preferredSet ? basePool.filter((p) => preferredSet.has(p.category)) : basePool;
  const pool = preferredPool.length > 0 ? preferredPool : basePool;

  const gels = pool.filter((p) => p.category === 'gel');
  const drinks = pool.filter((p) => p.category === 'drink');
  const bars = pool.filter((p) => p.category === 'bar');
  const chews = pool.filter((p) => p.category === 'chew');

  if (shouldUseCaffeineProduct(distanceKm, totalDistanceKm, caffeineStrat, currentCaffeineMg)) {
    const cafProducts = pool.filter((p) => p.caffeine > 0);
    if (cafProducts.length > 0) return pickFromSorted(byCarbProximity(cafProducts, targetCarbsPerPoint), 2);
  }

  if (preferSolidNow) {
    const solids = [...bars, ...chews];
    if (solids.length > 0 && (!segment || segment.type !== 'climb')) {
      return pickFromSorted(byCarbProximity(solids, targetCarbsPerPoint), 3);
    }
    if (gels.length > 0) return pickFromSorted(byCarbProximity(gels, targetCarbsPerPoint), 3);
  } else {
    if (drinks.length > 0 && segment?.type !== 'climb') {
      return pickFromSorted(byCarbProximity(drinks, targetCarbsPerPoint), 3);
    }
    if (gels.length > 0) {
      return pickFromSorted(byCarbProximity(gels, targetCarbsPerPoint), 3);
    }
  }

  return pickFromSorted(byCarbProximity(pool, targetCarbsPerPoint), Math.min(5, pool.length));
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
    preferredCategories,
    budget,
  } = input;

  const sport = profile.sport ?? 'running';
  const gutTolerance = profile.gutTolerance ?? 'trained';
  const intensityPercent = inferIntensity(distanceKm, durationHours, input.elevationGainM ?? 0, sport);

  const carbTarget = calculateCarbTarget({
    durationHours,
    intensityPercent,
    gutTolerance,
    isCompetition,
    bodyWeightKg: profile.weight,
  });

  const hydrationTarget = calculateHydration({
    bodyWeightKg: profile.weight,
    durationHours,
    temperatureCelsius,
    humidity,
    intensityPercent,
    sweatRate: profile.sweatRate,
    sport,
    sweatSodiumBucket: profile.sweatSodiumBucket ?? 'unknown',
    heatAcclimatised: profile.heatAcclimatised ?? false,
    earlySeasonHeat: profile.earlySeasonHeat ?? false,
  });

  const caffeineStrategy = calculateCaffeineStrategy({
    bodyWeightKg: profile.weight,
    durationHours,
    distanceKm,
    isRegularConsumer: true,
    targetMgPerKg: isCompetition ? 4 : 3,
  });

  const emptyMetrics = { totalCarbs: 0, carbsPerHour: 0, totalSodium: 0, totalCaffeine: 0, totalCalories: 0, totalCost: 0 };

  // Short efforts fall into the <30min / 30–75min tiers — no on-course fueling needed.
  if (carbTarget.target === 0 || durationHours < 1) {
    return { nutritionPoints: [], carbTarget, hydrationTarget, caffeineStrategy, metrics: emptyMetrics };
  }

  const preferredProducts = preferredProductIds
    ? products.filter((p) => preferredProductIds.includes(p.id))
    : undefined;

  const avgSpeed = distanceKm / durationHours;
  const segments = routeAnalysis?.segments || [];

  const firstMin = firstFuelMinutes(durationHours, temperatureCelsius);
  const firstKm = Math.max(2, (avgSpeed * firstMin) / 60);

  const targetTotalCarbs = Math.round(carbTarget.target * durationHours);
  const maxTotalCarbs = Math.round(carbTarget.max * durationHours);

  // Estimate points needed to hit the target, so we can split the target evenly.
  const avgGapMin =
    (gapMinutesForPhase(0.2, durationHours) +
      gapMinutesForPhase(0.5, durationHours) +
      gapMinutesForPhase(0.8, durationHours)) / 3;
  const endBufferKm = Math.max(1, Math.min(3, avgSpeed * 0.15));
  const usableKm = Math.max(0, distanceKm - endBufferKm - firstKm);
  const estimatedPoints = Math.max(1, Math.round((usableKm / avgSpeed) * 60 / avgGapMin) + 1);

  if (usableKm <= 0 || maxTotalCarbs < 15) {
    return { nutritionPoints: [], carbTarget, hydrationTarget, caffeineStrategy, metrics: emptyMetrics };
  }

  const initialTargetPerPoint = Math.max(10, Math.round(targetTotalCarbs / estimatedPoints));
  const budgetScaledFloor = Math.min(15, Math.max(8, Math.round(maxTotalCarbs * 0.5)));
  // Cap per-point dose at 60% of event max or the largest single-dose a gut-trained athlete
  // would tolerate in one hit (~60g). We cap the PER-POINT dose, not the total, so a long
  // event can still place many moderate doses.
  const absoluteMaxPerPoint = Math.max(
    budgetScaledFloor,
    Math.min(Math.round(maxTotalCarbs * 0.6), 60),
  );

  const points: NutritionPoint[] = [];
  let totalCarbs = 0;
  let totalSodium = 0;
  let totalCaffeine = 0;
  let totalCalories = 0;
  let totalCost = 0;
  let preferSolid = false;
  let cursorKm = firstKm;

  let safety = 0;
  while (cursorKm < distanceKm - endBufferKm && safety++ < 200) {
    if (totalCarbs >= maxTotalCarbs) break;
    // Stop once we've met the target — no need to overshoot and risk the gut-tolerance
    // ceiling. Small overshoot absorbed by rounding is fine.
    if (totalCarbs >= targetTotalCarbs) break;

    let placeKm = cursorKm;
    const lookaheadKm = (avgSpeed * 8) / 60;
    const upcomingClimb = segments.find(
      (s) => s.type === 'climb' && s.startKm > cursorKm && s.startKm - cursorKm <= lookaheadKm,
    );
    if (upcomingClimb) {
      const preClimbKm = upcomingClimb.startKm - (avgSpeed * 5) / 60;
      if (preClimbKm > cursorKm) placeKm = preClimbKm;
    }
    const currentSeg = segmentAt(segments, placeKm);
    if (currentSeg?.type === 'descent' && currentSeg.endKm - placeKm > 1.5) {
      placeKm = Math.min(distanceKm - endBufferKm, currentSeg.endKm);
    }

    if (points.length > 0) {
      const lastKm = points[points.length - 1].distanceKm;
      const gapMin = ((placeKm - lastKm) / avgSpeed) * 60;
      if (gapMin < 12) {
        cursorKm = lastKm + (avgSpeed * 15) / 60;
        continue;
      }
    }

    // Recompute the per-point target each iteration. If earlier placements undershot
    // (e.g. we grabbed a 23g gel on a climb when we wanted 35g), the remaining points
    // aim higher to catch up. Prevents the "45g/h on a 75g/h target" under-delivery.
    const remainingKm = Math.max(0.1, distanceKm - endBufferKm - placeKm);
    const remainingHours = remainingKm / avgSpeed;
    const nextGapMin = gapMinutesForPhase(placeKm / distanceKm, durationHours);
    const expectedRemainingPoints = Math.max(1, Math.round((remainingHours * 60) / nextGapMin));
    const remainingCarbsToTarget = Math.max(0, targetTotalCarbs - totalCarbs);
    const dynamicTargetPerPoint = Math.max(
      20,
      Math.min(absoluteMaxPerPoint, Math.round(remainingCarbsToTarget / expectedRemainingPoints)),
    );
    // Fall back to the initial target if remaining work is negligible — prevents tiny divisors
    // from blowing the per-point target up to absurd heights on the last placement.
    const perPointTarget = remainingCarbsToTarget > 15 ? dynamicTargetPerPoint : initialTargetPerPoint;

    const segForPlacement = segmentAt(segments, placeKm);
    const remainingCarbBudget = Math.max(0, maxTotalCarbs - totalCarbs);
    const dynamicCap = Math.min(absoluteMaxPerPoint, remainingCarbBudget + 5);
    const product = selectProduct(
      placeKm,
      distanceKm,
      caffeineStrategy,
      totalCaffeine,
      segForPlacement,
      preferredProducts,
      preferSolid,
      perPointTarget,
      dynamicCap,
      preferredCategories,
    );
    if (!product) break; // no usable fuel in catalog

    let chosen: ProductProps = product;
    if (budget && totalCost + (product.priceZAR || 0) > budget) {
      const affordable = products
        .filter((p) => isFuelCandidate(p) && (p.priceZAR || 0) <= budget - totalCost && p.carbs <= dynamicCap);
      if (affordable.length === 0) break;
      chosen = byCarbProximity(affordable, perPointTarget)[0];
    }

    points.push({
      id: nanoid(),
      distanceKm: Math.round(placeKm * 10) / 10,
      product: chosen,
    });
    totalCarbs += chosen.carbs;
    totalSodium += chosen.sodium;
    totalCaffeine += chosen.caffeine;
    totalCalories += chosen.calories;
    totalCost += chosen.priceZAR || 0;

    preferSolid = !preferSolid;

    // Adaptive gap: if we're tracking below the target rate we shorten the next step
    // (down to a 15-minute absorption floor) so we can fit more placements and close the
    // carbs-per-hour gap. Above pace, keep the phase-aware gap as-is — no need to crowd.
    let gapMin = gapMinutesForPhase(placeKm / distanceKm, durationHours);
    const hoursSoFar = Math.max(0.01, (placeKm - firstKm) / avgSpeed + firstMin / 60);
    const currentRate = totalCarbs / hoursSoFar;
    if (currentRate < carbTarget.target * 0.9) {
      gapMin = Math.max(15, Math.round(gapMin * 0.8));
    }
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
