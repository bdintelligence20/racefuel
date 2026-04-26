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
import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { nanoid } from 'nanoid';
import { NutritionPoint, UserProfile, GpsPoint } from '../../context/AppContext';
import { ProductProps } from '../../components/NutritionCard';
import { products } from '../../data/products';
import { RouteAnalysis } from '../route/routeAnalyzer';
import { calculateCarbTarget, CarbTarget } from './carbCalculator';
import { calculateHydration, HydrationTarget } from './hydrationCalculator';
import { calculateCaffeineStrategy, CaffeineRecommendation } from './caffeineStrategy';
import { isSingleServe } from './planGenerator';

let _testOverrideKey: string | undefined;

/** Test-only override. Not used in production. */
export function __setApiKeyForTesting(key: string | undefined): void {
  _testOverrideKey = key;
}

function getApiKey(): string | undefined {
  if (_testOverrideKey !== undefined) return _testOverrideKey;
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_GEMINI_API_KEY;
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
  return Boolean(getApiKey());
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
 */
export function toFuelCandidates(catalog: ProductProps[]): ProductProps[] {
  return catalog.filter(
    (p) =>
      isSingleServe(p) &&
      p.carbs > 0 &&
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
 */
export function shortlistCatalog(
  candidates: ProductProps[],
  targetPerPointG: number,
  maxPerPointG: number,
  limit = CATALOG_TOP_N,
): ProductProps[] {
  if (candidates.length <= limit) return candidates;

  const score = (p: ProductProps) => {
    const base = Math.abs(p.carbs - targetPerPointG);
    const overcapPenalty = p.carbs > maxPerPointG ? (p.carbs - maxPerPointG) * 3 : 0;
    return base + overcapPenalty;
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
): string {
  const { distanceKm, durationHours, elevationGainM, profile, temperatureCelsius, humidity, preferredCategories } = input;
  // When the catalog had to fall back to all brands (no in-brand product fit),
  // don't tell the model to stay in-brand — the catalog itself isn't filtered.
  const brandsForPrompt = effectivePreferredBrands ?? profile.preferredBrands;
  const segments = input.routeAnalysis?.segments?.map((s) =>
    `${s.startKm.toFixed(1)}-${s.endKm.toFixed(1)}km ${s.type} (${s.avgGradient.toFixed(1)}%)`,
  ) || [];

  const avgSpeed = distanceKm / durationHours;
  const minSpacingKm = +((12 * avgSpeed) / 60).toFixed(2);

  const caffeineRule =
    caffeineStrategy.timing === 'none'
      ? 'no caffeine (short effort)'
      : caffeineStrategy.timing === 'late-only'
      ? `ONE caffeinated product near ${caffeineStrategy.firstDoseKm}km`
      : `caffeine distributed across final 45%, starting ~${caffeineStrategy.firstDoseKm}km`;

  return `You plan on-course nutrition for endurance events.

HARD RULES
1. Pick products by id from the catalog below. Never invent ids.
2. Total carbs: ${Math.round(carbTarget.min * durationHours)}-${Math.round(carbTarget.max * durationHours)}g. Aim ~${Math.round(carbTarget.target * durationHours)}g.
3. Per placement: ≤ ${Math.min(60, carbTarget.max)}g carbs.
4. Placements ≥ ${minSpacingKm}km apart (12-min gut absorption window).
5. First placement: 25-40 min in. Last placement: ≥ 10 min before finish.
6. Pre-fuel before climbs. Place 5–15 minutes BEFORE a climb starts (longer lead for bigger climbs) so carbs are in the bloodstream when power demand peaks. NEVER place fuel mid-climb — it's hard to consume under load. NEVER place mid-descent — stomach tolerance drops while pounding downhill. If a segment is unavoidable, shift to the end of it.
7. Alternate solid (bar/chew) and liquid (drink) for dual-transporter absorption. If a single placement needs ≥45g of carbs, you may pair a solid and a liquid at the SAME distance (within 0.1km) — co-located pairs count as one "fuel point" for the 12-minute gap rule.
8. Caffeine: ${caffeineRule}.

EVENT
${distanceKm}km, ${elevationGainM ?? 0}m gain, ${durationHours.toFixed(2)}h at ${avgSpeed.toFixed(2)} km/h.
Sport: ${profile.sport ?? 'running'}${input.isCompetition ? ' (competition)' : ''}.
Conditions: ${temperatureCelsius}°C / ${humidity}% RH.
Intensity: ${intensity}.
Athlete: ${profile.weight}kg, gut "${profile.gutTolerance ?? 'trained'}" (≤${carbTarget.max} g/h).
Prefs: categories ${preferredCategories?.length ? preferredCategories.join(',') : 'any'}${brandsForPrompt?.length ? ` · brands ${brandsForPrompt.join(', ')} (the catalog below has already been hard-filtered to these brands — DO NOT request products from any other brand)` : ''}.

TARGETS
Carbs ${carbTarget.target} g/h (${carbTarget.min}-${carbTarget.max})
Fluid ${hydrationTarget.fluidMlPerHour} ml/h, Sodium ${hydrationTarget.sodiumMgPerHour} mg/h
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

interface AgentOutput {
  placements: Array<{ distanceKm: number; productId: string; rationale: string }>;
  overallRationale: string;
}

const AGENT_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    placements: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          distanceKm: { type: SchemaType.NUMBER },
          productId: { type: SchemaType.STRING },
          rationale: { type: SchemaType.STRING },
        },
        required: ['distanceKm', 'productId', 'rationale'],
      },
    },
    overallRationale: { type: SchemaType.STRING },
  },
  required: ['placements', 'overallRationale'],
};

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
): { points: NutritionPoint[]; totals: { carbs: number; sodium: number; caffeine: number; calories: number } } {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const points: NutritionPoint[] = [];
  const totals = { carbs: 0, sodium: 0, caffeine: 0, calories: 0 };
  const sorted = [...(raw.placements ?? [])].sort((a, b) => a.distanceKm - b.distanceKm);
  for (const p of sorted) {
    const product = byId.get(p.productId);
    if (!product) continue;
    if (p.distanceKm < 0 || p.distanceKm > distanceKm) continue;
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
  const apiKey = getApiKey();
  if (!apiKey) return null;

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
  const candidates = toFuelCandidates(sourceCatalog);
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

  // Rough per-point dose guide — what we'd aim for if we split the target
  // into ~5 placements. Drives catalog scoring.
  const rawTotal = carbTarget.target * durationHours;
  const targetPerPointG = Math.max(20, Math.min(60, Math.round(rawTotal / 5)));
  const maxPerPointG = Math.min(60, carbTarget.max);

  const shortlist = shortlistCatalog(brandFiltered, targetPerPointG, maxPerPointG);
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
  );

  input.onPhase?.('Reasoning through the plan');
  let raw: string;
  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
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

  const { points, totals } = materialisePlacements(parsed, sourceCatalog, distanceKm);
  if (points.length === 0) {
    console.warn('[FuelCue planner] zero valid placements, falling back');
    return null;
  }

  // The catalog handed to the agent was already brand-filtered, so any
  // off-brand placement only happens when no in-brand product fit the slot —
  // we already detected that case above as brandHonoured=false.
  const carbTargetWithFallback = !brandHonoured && profile.preferredBrands?.length
    ? {
        ...carbTarget,
        rationale: `${carbTarget.rationale} No products in your preferred brand(s) (${profile.preferredBrands.join(', ')}) could fuel this route — fell back to the full catalog.`,
      }
    : carbTarget;

  const baseRationale = parsed.overallRationale ?? '';
  const rationale = !brandHonoured && profile.preferredBrands?.length
    ? `${baseRationale} (Note: stepped outside ${profile.preferredBrands.join(', ')} — no in-brand product fit this route.)`.trim()
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
