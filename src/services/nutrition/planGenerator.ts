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
 * Reject multi-serve / bulk products (tubs, tins, 500g mixes, bottles-of-tablets).
 * You can't eat a 1kg tub mid-run; these are for pre-race prep or home use.
 *
 * Matches common patterns:
 *   - "Tub", "Tin", "Jar", "Pouch" (mix containers)
 *   - "Pack of N", "Box of N", "Multipack", "Bulk"
 *   - Weights ≥ 300g (single serves are typically 30-80g)
 *   - Caps/bottles with many tablets ("60 tabs", "Pack of 20")
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
    /\b([3-9]\d{2}|[1-9]\d{3})\s*g\b/,  // 300g, 450g, 500g, 1000g etc.
    /\b[1-9](\.[0-9]+)?\s*kg\b/,
  ];
  if (multiServePatterns.some((re) => re.test(name))) return false;

  // Carbs > 70g in a single item is almost always a multi-serve mix (most single
  // gels/bars/chews are 20-40g, biggest singles are ~60-65g).
  if (p.carbs > 70) return false;

  return true;
}

/**
 * Sort products by how close their carbs are to a target dose (closest first).
 * Prevents "always pick the 90g mix" behaviour for short runs.
 */
function byCarbProximity(items: ProductProps[], targetCarbs: number): ProductProps[] {
  return [...items].sort(
    (a, b) => Math.abs(a.carbs - targetCarbs) - Math.abs(b.carbs - targetCarbs),
  );
}

/**
 * Choose the next product.
 *
 * Research basis (dual-transporter absorption, Jeukendrup 2010+):
 * - Glucose uptake saturates at ~60 g/h via SGLT1.
 * - Adding fructose (GLUT5) enables up to 90 g/h.
 * - Alternating liquid (often fructose-containing) with solid (glucose-heavy) approximates
 *   the 2:1 glucose:fructose ratio in real use.
 *
 * targetCarbsPerPoint: the dose we're aiming for at THIS placement. The generator
 * computes this from total-carb-target / expected-points so short runs don't get
 * slammed with a 90g mix.
 */
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
): ProductProps {
  const catalogRaw = preferredProducts && preferredProducts.length > 0 ? preferredProducts : products;
  // Only single-serve products are appropriate for on-course fueling.
  const catalog = catalogRaw.filter(isSingleServe);
  const fallbackCatalog = catalog.length > 0 ? catalog : catalogRaw;

  // Filter out products that massively overshoot the per-point budget (e.g. an 80g mix
  // on a 13km run). Keep anything within maxCarbsPerPoint; fall back if empty.
  const budgeted = fallbackCatalog.filter((p) => p.carbs <= maxCarbsPerPoint);
  const basePool = budgeted.length > 0 ? budgeted : fallbackCatalog;

  // Apply the user's category preference as a SOFT bias: filter to preferred
  // categories if that subset is non-empty; otherwise fall through to the full pool
  // (so a climb that needs a gel still gets one even if the user only ticked "chew").
  const preferredSet = preferredCategories && preferredCategories.length > 0 ? new Set(preferredCategories) : null;
  const preferredPool = preferredSet ? basePool.filter((p) => preferredSet.has(p.category)) : basePool;
  const pool = preferredPool.length > 0 ? preferredPool : basePool;

  const gels = pool.filter((p) => p.category === 'gel');
  const drinks = pool.filter((p) => p.category === 'drink');
  const bars = pool.filter((p) => p.category === 'bar');
  const chews = pool.filter((p) => p.category === 'chew');

  // Caffeine timing — strategic, not filler. Still respect the per-point budget.
  if (shouldUseCaffeineProduct(distanceKm, totalDistanceKm, caffeineStrat, currentCaffeineMg)) {
    const cafProducts = pool.filter((p) => p.caffeine > 0);
    if (cafProducts.length > 0) return pickFromSorted(byCarbProximity(cafProducts, targetCarbsPerPoint), 2);
  }

  // Dual-transporter alternation: solid (glucose) ↔ liquid (often fructose blend)
  if (preferSolidNow) {
    const solids = [...bars, ...chews];
    if (solids.length > 0 && (!segment || segment.type !== 'climb')) {
      return pickFromSorted(byCarbProximity(solids, targetCarbsPerPoint), 3);
    }
    // On climbs, solids are hard to chew — fall back to gels
    if (gels.length > 0) return pickFromSorted(byCarbProximity(gels, targetCarbsPerPoint), 3);
  } else {
    if (drinks.length > 0 && segment?.type !== 'climb') {
      return pickFromSorted(byCarbProximity(drinks, targetCarbsPerPoint), 3);
    }
    // Liquid not ideal on a climb — pivot to a gel
    if (gels.length > 0) {
      return pickFromSorted(byCarbProximity(gels, targetCarbsPerPoint), 3);
    }
  }

  // Last resort: closest match in the whole pool
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

  // Target budget in grams of carbs for the whole effort, and a cap we won't exceed.
  const targetTotalCarbs = Math.round(carbTarget.target * durationHours);
  const maxTotalCarbs = Math.round(carbTarget.max * durationHours);

  // Estimate how many points we'll place based on the average phase-gap across the effort.
  const avgGapMin = (gapMinutesForPhase(0.2, durationHours) + gapMinutesForPhase(0.5, durationHours) + gapMinutesForPhase(0.8, durationHours)) / 3;
  const endBufferKm = Math.max(1, Math.min(3, avgSpeed * 0.15));
  const usableKm = Math.max(0, distanceKm - endBufferKm - firstKm);
  const estimatedPoints = Math.max(1, Math.round((usableKm / avgSpeed) * 60 / avgGapMin) + 1);

  // Short-effort early exit: if there's no useful distance left after the first-fuel
  // offset and the end buffer, or if the total carb budget is tiny (<15g), don't place
  // anything. The previous behaviour stacked multiple products trying to hit a miniscule
  // budget because the per-point floor was larger than the budget itself.
  if (usableKm <= 0 || maxTotalCarbs < 15) {
    return {
      nutritionPoints: [],
      carbTarget,
      hydrationTarget,
      caffeineStrategy,
      metrics: { totalCarbs: 0, carbsPerHour: 0, totalSodium: 0, totalCaffeine: 0, totalCalories: 0, totalCost: 0 },
    };
  }

  const targetCarbsPerPoint = Math.max(10, Math.round(targetTotalCarbs / estimatedPoints));
  // Per-point cap: don't let any single product eat more than 60% of the max total
  // budget, and never exceed 1.5× the per-point target. The floor scales with budget
  // (small budgets → small floor) so 1hr runs don't end up with a 15g floor on a 24g
  // total-carb budget.
  const budgetScaledFloor = Math.min(15, Math.max(8, Math.round(maxTotalCarbs * 0.5)));
  const maxCarbsPerPoint = Math.max(
    budgetScaledFloor,
    Math.min(Math.round(maxTotalCarbs * 0.6), Math.round(targetCarbsPerPoint * 1.5)),
  );

  const points: NutritionPoint[] = [];
  let totalCarbs = 0;
  let totalSodium = 0;
  let totalCaffeine = 0;
  let totalCalories = 0;
  let totalCost = 0;
  let preferSolid = false; // dual-transporter alternation; alternate every point

  let cursorKm = firstKm;

  let safety = 0;
  while (cursorKm < distanceKm - endBufferKm && safety++ < 200) {
    // Stop if we've already met the maximum total-carb budget
    if (totalCarbs >= maxTotalCarbs) break;
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
    // Adjust the per-point dose downward if we're about to overshoot the max budget.
    const remainingCarbBudget = Math.max(0, maxTotalCarbs - totalCarbs);
    const dynamicCap = Math.min(maxCarbsPerPoint, remainingCarbBudget + 5); // allow small overshoot
    const product = selectProduct(
      placeKm,
      distanceKm,
      caffeineStrategy,
      totalCaffeine,
      segForPlacement,
      preferredProducts,
      preferSolid,
      targetCarbsPerPoint,
      dynamicCap,
      preferredCategories,
    );

    // Budget check — swap to an affordable product whose carbs are close to target
    if (budget && totalCost + (product.priceZAR || 0) > budget) {
      const affordable = products
        .filter((p) => isSingleServe(p) && (p.priceZAR || 0) <= budget - totalCost && p.carbs <= dynamicCap);
      if (affordable.length === 0) break;
      const cheapProduct = byCarbProximity(affordable, targetCarbsPerPoint)[0];
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
