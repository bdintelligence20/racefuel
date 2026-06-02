/**
 * AI-powered auto-generate. Returns the same GeneratedPlan shape the legacy
 * algorithm produces, so the rest of the app doesn't need to know which
 * engine ran.
 *
 * Latency strategy:
 *   - Model: Gemini 2.5 Flash, thinking budget 0. Pro's extra reasoning
 *     doesn't help here — the spec rules are deterministic and the agent's
 *     only real job is picking and placing products.
 *   - Catalog: pre-filtered to a relevance-scored shortlist (≤ ~35 items)
 *     before it hits the prompt. Sending 119 products when only 30 are
 *     tier-appropriate is the main thing that was making this slow.
 *   - Targets: computed deterministically locally and passed in as hard
 *     numbers. The model doesn't redo any of the carb/hydration/sodium
 *     math — those are evidence-locked.
 *
 * Fallback: any failure (network, invalid JSON, hallucinated ids,
 * zero valid placements) returns null → caller falls back to the
 * deterministic algorithm so Auto Generate never just errors.
 */
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';
import { app } from '../firebase/config';
import { nanoid } from 'nanoid';
import { NutritionPoint, UserProfile, GpsPoint } from '../../context/AppContext';
import { ProductProps } from '../../components/NutritionCard';
import { products } from '../../data/products';
import { RouteAnalysis } from '../route/routeAnalyzer';
import { calculateCarbTarget, CarbTarget } from './carbCalculator';
import { calculateHydration, HydrationTarget } from './hydrationCalculator';
import { calculateCaffeineStrategy, CaffeineRecommendation } from './caffeineStrategy';
import { isSingleServe } from './planGenerator';

// AI runs through Firebase AI Logic (App Check–gated) — there is NO Gemini
// API key in the browser bundle. The feature is gated by enablement only.
let _testEnabledOverride: boolean | undefined;

/** Test-only override to force-enable/disable the AI planner. */
export function __setApiKeyForTesting(enabled: string | boolean | undefined): void {
  _testEnabledOverride = enabled === undefined ? undefined : Boolean(enabled);
}
const MODEL = 'gemini-2.5-flash';
const CATALOG_TOP_N = 35;

export interface GeminiPlanInput {
  distanceKm: number;
  durationHours: number;
  elevationGainM?: number;
  gpsPath?: GpsPoint[];
  routeAnalysis?: RouteAnalysis;
  profile: UserProfile;
  isCompetition: boolean;
  temperatureCelsius: number;
  humidity: number;
  /** True when temp/humidity came from a real forecast for the planned date.
   *  When false (no date set), the prompt tells the model not to attribute
   *  conditions to the athlete's day — they used neutral defaults. */
  weatherFromForecast?: boolean;
  preferredProductIds?: string[];
  preferredCategories?: Array<'gel' | 'drink' | 'bar' | 'chew'>;
  /** User's perceived effort on a 1–10 scale. Overrides inferred intensity. */
  effortLevel?: number;
  onPhase?: (phase: string) => void;
}

function effortToIntensity(effort: number): number {
  const clamped = Math.max(1, Math.min(10, effort));
  return Math.max(0.5, Math.min(1.0, 0.5 + (clamped / 10) * 0.45));
}

export interface GeminiGeneratedPlan {
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
  };
  rationale: string;
  source: 'gemini';
}

export function isGeminiEnabled(): boolean {
  if (_testEnabledOverride !== undefined) return _testEnabledOverride;
  // On by default. Set VITE_AI_PLANNER_ENABLED="false" to kill-switch via config (no code change).
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_AI_PLANNER_ENABLED !== 'false';
}

export function inferIntensityPercent(distanceKm: number, durationHours: number, elevationGainM: number, sport: 'running' | 'cycling'): number {
  if (durationHours <= 0) return 0.7;
  const speed = distanceKm / durationHours;
  const refSpeed = sport === 'cycling' ? 28 : 11;
  const speedIntensity = Math.max(0.5, Math.min(1.0, (speed / refSpeed) * 0.75));
  const elevPerKm = distanceKm > 0 ? elevationGainM / distanceKm : 0;
  const elevBoost = sport === 'running' ? elevPerKm * 0.005 : elevPerKm * 0.003;
  return Math.max(0.5, Math.min(1.0, speedIntensity + elevBoost));
}

/**
 * Candidate-only filter — strip out anything that can't be used on-course
 * for this event. Exported for testing.
 *
 * Drinks are excluded by default (per-pack pricing makes auto-gen plans
 * expensive, and gels/bars/chews can satisfy the sodium target via the
 * sodium-aware scorer). Pass `includeDrinks: true` only when the athlete
 * has explicitly opted in via preferredCategories.
 */
export function toFuelCandidates(
  catalog: ProductProps[],
  includeDrinks = false,
): ProductProps[] {
  return catalog.filter(
    (p) =>
      isSingleServe(p) &&
      p.carbs > 0 &&
      (includeDrinks || p.category !== 'drink') &&
      !/recover(y)?/i.test(`${p.brand} ${p.name}`),
  );
}

/**
 * Shortlist the catalog down to the items actually useful for THIS event.
 * Keeps enough variety that the agent can alternate categories and handle
 * terrain, and deliberately introduces run-to-run variety by sampling from
 * the top candidates rather than always taking the deterministic top-N.
 *
 * The latter is important: with a fixed shortlist + structured JSON output,
 * Flash was picking the same products every run even at high temperature.
 * Sampling the pool itself forces real variety.
 *
 * `sodiumPriority` (0–1) biases scoring toward sodium-dense products when
 * the route's sodium target is hard to hit with low-sodium gels alone. At 0,
 * scoring is carb-only (legacy behaviour). At 1, sodium-per-gram heavily
 * shapes which products the agent sees.
 */
export function shortlistCatalog(
  candidates: ProductProps[],
  targetPerPointG: number,
  maxPerPointG: number,
  limit = CATALOG_TOP_N,
  sodiumPriority = 0,
): ProductProps[] {
  if (candidates.length <= limit) return candidates;

  const score = (p: ProductProps) => {
    const base = Math.abs(p.carbs - targetPerPointG);
    const overcapPenalty = p.carbs > maxPerPointG ? (p.carbs - maxPerPointG) * 3 : 0;
    // Sodium credit: max ~12 points for a 600 mg/serving electrolyte drink at
    // priority 1, ~3 points at the typical priority of 0.25. Subtracted so
    // higher sodium = lower (better) score.
    const sodiumCredit = sodiumPriority > 0 ? Math.min(12, p.sodium / 50) * sodiumPriority : 0;
    return base + overcapPenalty - sodiumCredit;
  };

  const byCategory: Record<string, ProductProps[]> = { gel: [], drink: [], bar: [], chew: [] };
  for (const p of candidates) {
    if (byCategory[p.category]) byCategory[p.category].push(p);
  }
  for (const k of Object.keys(byCategory)) byCategory[k].sort((a, b) => score(a) - score(b));

  const picked: ProductProps[] = [];
  const seen = new Set<string>();
  const add = (p?: ProductProps) => {
    if (!p || seen.has(p.id)) return;
    seen.add(p.id);
    picked.push(p);
  };

  // Per-category floor — randomly sample from the top-scoring 2x slice so
  // every run gets different "best" picks per category.
  const perCategoryFloor = Math.max(3, Math.floor(limit / 8));
  for (const cat of ['gel', 'drink', 'bar', 'chew']) {
    const topSlice = byCategory[cat].slice(0, Math.max(perCategoryFloor * 2, perCategoryFloor + 2));
    const sampled = sampleWithoutReplacement(topSlice, perCategoryFloor);
    for (const p of sampled) add(p);
  }

  // Keep one caffeinated option — sample from the top 3 caf options instead of
  // always taking #1, so the same route doesn't always get the same caf pick.
  const cafOptions = [...candidates].filter((p) => p.caffeine > 0).sort((a, b) => score(a) - score(b));
  if (cafOptions.length > 0) add(sampleWithoutReplacement(cafOptions.slice(0, 3), 1)[0]);

  // Fill remainder by sampling from the top 2x remaining slots — keeps the
  // pool relevant without making it identical run-to-run.
  const remaining = candidates.filter((p) => !seen.has(p.id)).sort((a, b) => score(a) - score(b));
  const remainingSlots = limit - picked.length;
  const poolSize = Math.min(remaining.length, Math.max(remainingSlots * 2, remainingSlots + 5));
  const fillPool = remaining.slice(0, poolSize);
  const filled = sampleWithoutReplacement(fillPool, remainingSlots);
  for (const p of filled) add(p);

  return picked;
}

function sampleWithoutReplacement<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return [...arr];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

type CatalogLine = {
  id: string;
  brand: string;
  name: string;
  category: string;
  carbs: number;
  sodium: number;
  caffeine: number;
  calories: number;
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function toCatalogLines(catalog: ProductProps[]): CatalogLine[] {
  // Price is intentionally absent — including it would invite the agent to
  // make implicit cost trade-offs. Cost is a display-layer concern only.
  return catalog.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    category: p.category,
    carbs: p.carbs,
    sodium: p.sodium,
    caffeine: p.caffeine,
    calories: p.calories,
  }));
}

/**
 * Build the prompt sent to the model. Exported for testing so we can assert
 * that hard rules (targets, per-point cap, terrain hints) actually end up
 * in the prompt without making a real network call.
 */
export function buildPrompt(
  input: GeminiPlanInput,
  carbTarget: CarbTarget,
  hydrationTarget: HydrationTarget,
  caffeineStrategy: CaffeineRecommendation,
  intensity: 'easy' | 'moderate' | 'hard',
  catalog: CatalogLine[],
  effectivePreferredBrands?: string[],
  effectivePreferredCategories?: Array<'gel' | 'drink' | 'bar' | 'chew'>,
  weatherKnown = true,
): string {
  const { distanceKm, durationHours, elevationGainM, profile, temperatureCelsius, humidity } = input;
  // When the catalog had to fall back to all brands or all categories (no
  // in-pref product fit), don't tell the model to stay in-pref — the catalog
  // itself isn't filtered, so reminding it would invite hallucinated ids.
  const brandsForPrompt = effectivePreferredBrands ?? profile.preferredBrands;
  const categoriesForPrompt = effectivePreferredCategories ?? input.preferredCategories;
  const segments = input.routeAnalysis?.segments?.map((s) =>
    `${s.startKm.toFixed(1)}-${s.endKm.toFixed(1)}km ${s.type} (${s.avgGradient.toFixed(1)}%)`,
  ) || [];

  const avgSpeed = distanceKm / durationHours;
  const minSpacingKm = +((12 * avgSpeed) / 60).toFixed(2);

  const targetTotalCarbsG = Math.round(carbTarget.target * durationHours);
  const targetTotalSodiumMg = Math.round(hydrationTarget.sodiumMgPerHour * durationHours);
  // Coverage rule: last placement ≥ 75% of distance keeps the back half of
  // the route fueled. On 21km routes Gemini was front-loading and stopping
  // at ~8km because the carb cap was hit early — the explicit coverage rule
  // forces it to space placements across the whole effort.
  const lastPlacementMinKm = +(distanceKm * 0.75).toFixed(1);
  const conditionsLine = weatherKnown
    ? `${temperatureCelsius}°C / ${humidity}% RH`
    : 'no race-day forecast (athlete has not picked a date) — plan with neutral conditions';

  return `You plan on-course nutrition for endurance events.

HARD RULES
1. Pick products by id from the catalog below. Never invent ids.
2. Total carbs: ${Math.round(carbTarget.min * durationHours)}-${Math.round(carbTarget.max * durationHours)}g. Aim ~${targetTotalCarbsG}g.
3. Per placement: ≤ ${Math.min(60, carbTarget.max)}g carbs.
4. Placements ≥ ${minSpacingKm}km apart (12-min gut absorption window).
5. First placement: 25-40 min in. Last placement: ≥ ${lastPlacementMinKm}km (no gap > 25% of total distance — if the route is 21km, the last fuel point cannot be earlier than ~16km).
6. Pre-fuel before climbs. Place 5–15 minutes BEFORE a climb starts (longer lead for bigger climbs) so carbs are in the bloodstream when power demand peaks. NEVER place fuel mid-climb — it's hard to consume under load. NEVER place mid-descent — stomach tolerance drops while pounding downhill. If a segment is unavoidable, shift to the end of it.
7. Alternate solid (bar/chew) and liquid (drink) for dual-transporter absorption. If a single placement needs ≥45g of carbs, you may pair a solid and a liquid at the SAME distance (within 0.1km) — co-located pairs count as one "fuel point" for the 12-minute gap rule.
8. Caffeine: ${caffeineToRule(caffeineStrategy)}.
9. Sodium target: aim for total sodium ≥ ${Math.round(targetTotalSodiumMg * 0.6)}mg (60% of the ~${targetTotalSodiumMg}mg/event target). When two products have similar carbs, prefer the one with higher sodium — gels rarely deliver enough alone, so include at least one electrolyte drink or salt-rich product on any event > 90 min unless forbidden by category prefs.

EVENT
${distanceKm}km, ${elevationGainM ?? 0}m gain, ${durationHours.toFixed(2)}h at ${avgSpeed.toFixed(2)} km/h.
Sport: ${profile.sport ?? 'running'}${input.isCompetition ? ' (competition)' : ''}.
Conditions: ${conditionsLine}.
Intensity: ${intensity}.
Athlete: ${profile.weight}kg, gut "${profile.gutTolerance ?? 'trained'}" (≤${carbTarget.max} g/h).
Prefs: ${categoriesForPrompt?.length ? `categories ${categoriesForPrompt.join(',')} (the catalog below has already been hard-filtered to these categories — DO NOT request products from any other category)` : 'no category preference'}${brandsForPrompt?.length ? ` · brands ${brandsForPrompt.join(', ')} (the catalog below has already been hard-filtered to these brands — DO NOT request products from any other brand)` : ''}.

TARGETS
Carbs ${carbTarget.target} g/h (${carbTarget.min}-${carbTarget.max})
Fluid ${hydrationTarget.fluidMlPerHour} ml/h, Sodium ${hydrationTarget.sodiumMgPerHour} mg/h (≈${targetTotalSodiumMg}mg over the event)
Caffeine budget ${caffeineStrategy.totalCaffeineMg}mg

TERRAIN
${segments.length ? segments.join(', ') : 'rolling (no segment data)'}

CATALOG (${catalog.length} items)
id | brand name | cat | carbs·Na·caf·kcal
${catalog.map((p) => `${p.id} | ${p.brand} ${p.name} | ${p.category} | ${p.carbs}·${p.sodium}·${p.caffeine}·${p.calories}`).join('\n')}

VARIETY
If multiple catalog items fit equally well, prefer ones you'd use less often to avoid recommending the same products every run. Mix brands across placements when possible.

OVERALL RATIONALE
Explain your strategic reasoning in 2-3 short sentences (terrain awareness, dual-transporter logic, caffeine timing). Do NOT cite specific gram, mg, or hourly figures — totals are computed from your placements and shown separately, so any numbers you write will conflict with the displayed totals.

Return JSON with 2-8 placements hitting the carb target. Be decisive.

(run ${Math.random().toString(36).slice(2, 10)})`;
}

function caffeineToRule(c: CaffeineRecommendation): string {
  if (c.timing === 'none') return 'no caffeine (short effort)';
  if (c.timing === 'late-only') return `ONE caffeinated product near ${c.firstDoseKm}km`;
  return `caffeine distributed across final 45%, starting ~${c.firstDoseKm}km`;
}

interface AgentOutput {
  placements: Array<{ distanceKm: number; productId: string; rationale: string }>;
  overallRationale: string;
}

// firebase/ai Schema: all object properties are required by default
// (matches the original all-required schema).
const AGENT_SCHEMA = Schema.object({
  properties: {
    placements: Schema.array({
      items: Schema.object({
        properties: {
          distanceKm: Schema.number(),
          productId: Schema.string(),
          rationale: Schema.string(),
        },
      }),
    }),
    overallRationale: Schema.string(),
  },
});

/**
 * Materialise a raw agent response against the real catalog. Exported for
 * testing — lets us validate the response-handling code without hitting
 * the network. Drops hallucinated ids, out-of-range distances, and sorts
 * by distance ascending.
 */
export function materialisePlacements(
  raw: AgentOutput,
  catalog: ProductProps[],
  distanceKm: number,
  /** Hard ceiling on total carbs. Placements that would push us above it
   *  are skipped (the model occasionally overshoots, e.g. recommending
   *  60 g/h but placing enough product for 100+ g/h — without this the
   *  PlanStrategyModal "Plan: X g/h" sub-line drifts way past the
   *  headline target). Optional for backward compat with tests. */
  maxTotalCarbsG?: number,
): { points: NutritionPoint[]; totals: { carbs: number; sodium: number; caffeine: number; calories: number } } {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const points: NutritionPoint[] = [];
  const totals = { carbs: 0, sodium: 0, caffeine: 0, calories: 0 };
  const sorted = [...(raw.placements ?? [])].sort((a, b) => a.distanceKm - b.distanceKm);
  // Coverage rule: the user-visible bug from testing (last fuel point at 8km
  // on a 21km route) was the cap dropping ALL late placements once early ones
  // ate the budget. We now keep late placements that close a >25%-of-distance
  // coverage gap, even if they push us a bit over the cap. Carb cap is a soft
  // guardrail, route coverage is non-negotiable for the back half.
  const coverageThresholdKm = distanceKm * 0.25;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const product = byId.get(p.productId);
    if (!product) continue;
    if (p.distanceKm < 0 || p.distanceKm > distanceKm) continue;

    const wouldOvershoot =
      maxTotalCarbsG != null && totals.carbs + product.carbs > maxTotalCarbsG + 5;
    if (wouldOvershoot) {
      const lastPlacedKm = points.length > 0 ? points[points.length - 1].distanceKm : 0;
      const remainingPlacements = sorted.length - i;
      const closesCoverageGap = p.distanceKm - lastPlacedKm > coverageThresholdKm;
      const isLastPlacement = remainingPlacements === 1;
      // Skip only when this placement is in the early/mid route AND the cap
      // is genuinely at risk. A late placement that closes a coverage gap
      // is more important than the cap.
      if (!closesCoverageGap && !isLastPlacement) continue;
    }
    points.push({
      id: nanoid(),
      distanceKm: Math.round(p.distanceKm * 10) / 10,
      product,
    });
    totals.carbs += product.carbs;
    totals.sodium += product.sodium;
    totals.caffeine += product.caffeine;
    totals.calories += product.calories;
  }
  return { points, totals };
}

export async function generatePlanWithGemini(input: GeminiPlanInput): Promise<GeminiGeneratedPlan | null> {
  if (!isGeminiEnabled()) return null;

  const { distanceKm, durationHours, profile, isCompetition, temperatureCelsius, humidity } = input;
  const sport = profile.sport ?? 'running';
  const gutTolerance = profile.gutTolerance ?? 'trained';
  const elevationGainM = input.elevationGainM ?? 0;
  const intensityPercent = input.effortLevel != null
    ? effortToIntensity(input.effortLevel)
    : inferIntensityPercent(distanceKm, durationHours, elevationGainM, sport);
  const intensityBucket: 'easy' | 'moderate' | 'hard' =
    intensityPercent < 0.65 ? 'easy' : intensityPercent < 0.80 ? 'moderate' : 'hard';

  const carbTarget = calculateCarbTarget({
    durationHours,
    intensityPercent,
    gutTolerance,
    isCompetition,
    bodyWeightKg: profile.weight,
    userOverrideGPerHour: profile.carbTargetGPerHour,
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

  if (carbTarget.target === 0 || durationHours < 1) {
    return {
      nutritionPoints: [],
      carbTarget,
      hydrationTarget,
      caffeineStrategy,
      metrics: { totalCarbs: 0, carbsPerHour: 0, totalSodium: 0, totalCaffeine: 0, totalCalories: 0 },
      rationale: 'Effort is too short for on-course fueling — glycogen covers it.',
      source: 'gemini',
    };
  }

  input.onPhase?.('Shortlisting products');
  const sourceCatalog = input.preferredProductIds
    ? products.filter((p) => input.preferredProductIds!.includes(p.id))
    : products;
  // Include drinks only if the athlete explicitly opted in via category prefs.
  const optedIntoDrinks = !!input.preferredCategories?.includes('drink');
  const candidates = toFuelCandidates(sourceCatalog, optedIntoDrinks);
  if (candidates.length === 0) return null;

  // Brand preference is a HARD filter. If the user picks "Gu", the agent
  // should not see Maurten in its catalog — the soft bias kept leaking
  // off-brand picks because the agent had to balance other goals (variety,
  // dual transporters). Fall back to the full catalog only if no in-brand
  // product can fuel the route, and surface the fallback in the rationale.
  let brandHonoured = true;
  let brandFiltered = candidates;
  const preferredBrandSet = profile.preferredBrands && profile.preferredBrands.length > 0
    ? new Set(profile.preferredBrands.map((b) => b.toLowerCase()))
    : null;
  if (preferredBrandSet) {
    const inBrand = candidates.filter((p) => preferredBrandSet.has(p.brand.toLowerCase()));
    if (inBrand.length > 0) {
      brandFiltered = inBrand;
    } else {
      brandHonoured = false;
    }
  }

  // Category preference is also a HARD filter — same reasoning. Soft hints
  // were leaking carb mixes onto routes where the athlete had ticked "Gels
  // only", because the model balanced the soft hint against dual-transporter
  // logic. Fall back to all categories only if no in-category product fits.
  let categoryHonoured = true;
  let categoryFiltered = brandFiltered;
  const preferredCategorySet = input.preferredCategories && input.preferredCategories.length > 0
    ? new Set(input.preferredCategories)
    : null;
  if (preferredCategorySet) {
    const inCategory = brandFiltered.filter((p) => preferredCategorySet.has(p.category as 'gel' | 'drink' | 'bar' | 'chew'));
    if (inCategory.length > 0) {
      categoryFiltered = inCategory;
    } else {
      categoryHonoured = false;
    }
  }

  // Rough per-point dose guide — what we'd aim for if we split the target
  // into ~5 placements. Drives catalog scoring.
  const rawTotal = carbTarget.target * durationHours;
  const targetPerPointG = Math.max(20, Math.min(60, Math.round(rawTotal / 5)));
  const maxPerPointG = Math.min(60, carbTarget.max);

  // Sodium priority — how aggressively we should bias the shortlist toward
  // sodium-dense products. We compute it from the gap between the per-event
  // sodium target and what a typical "all-gel" plan would deliver. When the
  // target is very high (heat, high sweat-Na) and the candidate pool is
  // gel-heavy, this nudges drinks/electrolyte tabs into the shortlist so the
  // model can actually meet the sodium goal rather than under-deliver by
  // 70%+ as in the testing screenshots.
  const targetSodiumMg = hydrationTarget.sodiumMgPerHour * durationHours;
  const expectedPlacements = Math.max(2, Math.round(durationHours * 2.5));
  const expectedSodiumPerPlacement =
    categoryFiltered.length > 0
      ? categoryFiltered.reduce((s, p) => s + p.sodium, 0) / categoryFiltered.length
      : 100;
  const expectedTotalSodium = expectedSodiumPerPlacement * expectedPlacements;
  const sodiumPriority = Math.max(0, Math.min(0.6, 1 - expectedTotalSodium / Math.max(1, targetSodiumMg)));

  const shortlist = shortlistCatalog(categoryFiltered, targetPerPointG, maxPerPointG, CATALOG_TOP_N, sodiumPriority);
  // Shuffle the order we present products to the agent. With identical inputs
  // and a fixed sort, Flash was anchoring on whichever brand appeared first in
  // the catalog each run. Shuffle + higher temperature breaks that.
  const presented = shuffle(shortlist);

  input.onPhase?.('Drafting the plan');
  const prompt = buildPrompt(
    input,
    carbTarget,
    hydrationTarget,
    caffeineStrategy,
    intensityBucket,
    toCatalogLines(presented),
    brandHonoured ? profile.preferredBrands : [],
    categoryHonoured ? input.preferredCategories : [],
    input.weatherFromForecast !== false,
  );

  input.onPhase?.('Reasoning through the plan');
  let raw: string;
  try {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: AGENT_SCHEMA,
        // Higher temperature + the shortlist sampling + run nonce all work
        // together to break the "same products every run" determinism that
        // structured JSON output tends toward.
        temperature: 0.95,
        // Flash supports turning thinking off — for a well-scoped task like this
        // the extra reasoning tokens just add latency without improving output.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ thinkingConfig: { thinkingBudget: 0 } } as any),
      },
    });
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    console.warn('[FuelCue planner] call failed, falling back:', err);
    return null;
  }

  input.onPhase?.('Placing fuel points on the route');
  let parsed: AgentOutput;
  try {
    parsed = JSON.parse(raw) as AgentOutput;
  } catch (err) {
    console.warn('[FuelCue planner] response was not JSON, falling back:', err);
    return null;
  }

  // Cap the LLM's total carbs at the gut-tier max — placements past that
  // get dropped rather than blowing the headline target.
  const maxTotalCarbsG = Math.round(carbTarget.max * durationHours);
  const { points, totals } = materialisePlacements(parsed, sourceCatalog, distanceKm, maxTotalCarbsG);
  if (points.length === 0) {
    console.warn('[FuelCue planner] zero valid placements, falling back');
    return null;
  }

  // The catalog handed to the agent was already brand- and category-filtered,
  // so any off-pref placement only happens when no in-pref product fit the
  // slot — we already detected those cases above.
  const fallbackNotes: string[] = [];
  if (!brandHonoured && profile.preferredBrands?.length) {
    fallbackNotes.push(
      `No products in your preferred brand(s) (${profile.preferredBrands.join(', ')}) could fuel this route — fell back to the full catalog.`,
    );
  }
  if (!categoryHonoured && input.preferredCategories?.length) {
    fallbackNotes.push(
      `No products in your preferred categor${input.preferredCategories.length > 1 ? 'ies' : 'y'} (${input.preferredCategories.join(', ')}) could cover the carb target — included other categories to make the numbers work.`,
    );
  }
  const carbTargetWithFallback = fallbackNotes.length
    ? { ...carbTarget, rationale: `${carbTarget.rationale} ${fallbackNotes.join(' ')}` }
    : carbTarget;

  const baseRationale = parsed.overallRationale ?? '';
  const rationaleNotes: string[] = [];
  if (!brandHonoured && profile.preferredBrands?.length) {
    rationaleNotes.push(`stepped outside ${profile.preferredBrands.join(', ')} — no in-brand product fit this route`);
  }
  if (!categoryHonoured && input.preferredCategories?.length) {
    rationaleNotes.push(`needed non-${input.preferredCategories.join('/')} products to cover the carb target`);
  }
  const rationale = rationaleNotes.length
    ? `${baseRationale} (Note: ${rationaleNotes.join('; ')}.)`.trim()
    : baseRationale;

  return {
    nutritionPoints: points,
    carbTarget: carbTargetWithFallback,
    hydrationTarget,
    caffeineStrategy,
    metrics: {
      totalCarbs: totals.carbs,
      carbsPerHour: durationHours > 0 ? Math.round(totals.carbs / durationHours) : 0,
      totalSodium: totals.sodium,
      totalCaffeine: totals.caffeine,
      totalCalories: totals.calories,
    },
    rationale,
    source: 'gemini',
  };
}
