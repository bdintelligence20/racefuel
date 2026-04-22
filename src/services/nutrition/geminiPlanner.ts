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
  budget?: number | null;
  onPhase?: (phase: string) => void;
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
    totalCost: number;
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
 * Scoring:
 *   - Penalise products far from the target per-point dose.
 *   - Require enough within-category variety (at least a couple of each
 *     gel / drink / bar / chew) so the agent can alternate & handle climbs.
 *   - Always keep at least one caffeinated option if one exists.
 *   - Cap total at ~CATALOG_TOP_N items to keep the prompt compact.
 */
export function shortlistCatalog(
  candidates: ProductProps[],
  targetPerPointG: number,
  maxPerPointG: number,
  limit = CATALOG_TOP_N,
): ProductProps[] {
  if (candidates.length <= limit) return candidates;

  const score = (p: ProductProps) => {
    // Distance from target, with a soft cap — everything above maxPerPoint gets punished.
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

  // Guarantee a bit of variety per category first.
  const perCategoryFloor = Math.max(3, Math.floor(limit / 8));
  for (const cat of ['gel', 'drink', 'bar', 'chew']) {
    for (const p of byCategory[cat].slice(0, perCategoryFloor)) add(p);
  }

  // Keep the best caffeinated option if not already in.
  const caf = [...candidates].filter((p) => p.caffeine > 0).sort((a, b) => score(a) - score(b))[0];
  add(caf);

  // Fill remainder with globally-best-scoring products.
  const rest = [...candidates].sort((a, b) => score(a) - score(b));
  for (const p of rest) {
    if (picked.length >= limit) break;
    add(p);
  }

  return picked;
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
  priceZAR: number;
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
  return catalog.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    category: p.category,
    carbs: p.carbs,
    sodium: p.sodium,
    caffeine: p.caffeine,
    calories: p.calories,
    priceZAR: p.priceZAR ?? 0,
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
): string {
  const { distanceKm, durationHours, elevationGainM, profile, temperatureCelsius, humidity, preferredCategories, budget } = input;
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
6. Place ~5 min BEFORE a climb. Avoid mid-descent.
7. Alternate solid (bar/chew) and liquid (drink) for dual-transporter absorption.
8. Caffeine: ${caffeineRule}.

EVENT
${distanceKm}km, ${elevationGainM ?? 0}m gain, ${durationHours.toFixed(2)}h at ${avgSpeed.toFixed(2)} km/h.
Sport: ${profile.sport ?? 'running'}${input.isCompetition ? ' (competition)' : ''}.
Conditions: ${temperatureCelsius}°C / ${humidity}% RH.
Intensity: ${intensity}.
Athlete: ${profile.weight}kg, gut "${profile.gutTolerance ?? 'trained'}" (≤${carbTarget.max} g/h).
Prefs: categories ${preferredCategories?.length ? preferredCategories.join(',') : 'any'}${profile.preferredBrands?.length ? ` · brands ${profile.preferredBrands.join(', ')} (prioritise if suitable)` : ''}${budget ? ` · budget R${budget}` : ''}.

TARGETS
Carbs ${carbTarget.target} g/h (${carbTarget.min}-${carbTarget.max})
Fluid ${hydrationTarget.fluidMlPerHour} ml/h, Sodium ${hydrationTarget.sodiumMgPerHour} mg/h
Caffeine budget ${caffeineStrategy.totalCaffeineMg}mg

TERRAIN
${segments.length ? segments.join(', ') : 'rolling (no segment data)'}

CATALOG (${catalog.length} items)
id | brand name | cat | carbs·Na·caf·kcal·R
${catalog.map((p) => `${p.id} | ${p.brand} ${p.name} | ${p.category} | ${p.carbs}·${p.sodium}·${p.caffeine}·${p.calories}·${p.priceZAR}`).join('\n')}

Return JSON with 2-8 placements hitting the carb target. Be decisive.`;
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
): { points: NutritionPoint[]; totals: { carbs: number; sodium: number; caffeine: number; calories: number; cost: number } } {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const points: NutritionPoint[] = [];
  const totals = { carbs: 0, sodium: 0, caffeine: 0, calories: 0, cost: 0 };
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
    totals.cost += product.priceZAR ?? 0;
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
  const intensityPercent = inferIntensityPercent(distanceKm, durationHours, elevationGainM, sport);
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
      metrics: { totalCarbs: 0, carbsPerHour: 0, totalSodium: 0, totalCaffeine: 0, totalCalories: 0, totalCost: 0 },
      rationale: 'Effort is too short for on-course fueling — glycogen covers it.',
      source: 'gemini',
    };
  }

  input.onPhase?.('Shortlisting products');
  const sourceCatalog = input.preferredProductIds
    ? products.filter((p) => input.preferredProductIds!.includes(p.id))
    : products;
  const allCandidates = toFuelCandidates(sourceCatalog);
  if (allCandidates.length === 0) return null;

  // Soft brand filter — only applied if the brand's catalog is rich enough to
  // cover the event (≥ 4 products spanning at least 2 categories). Otherwise
  // we'd cripple the plan to satisfy a preference that can't work for this route.
  const brands = (profile.preferredBrands ?? []).map((b) => b.toLowerCase());
  let candidates = allCandidates;
  if (brands.length > 0) {
    const branded = allCandidates.filter((p) => brands.includes(p.brand.toLowerCase()));
    const categories = new Set(branded.map((p) => p.category));
    if (branded.length >= 4 && categories.size >= 2) {
      candidates = branded;
    }
  }

  // Rough per-point dose guide — what we'd aim for if we split the target
  // into ~5 placements. Drives catalog scoring.
  const rawTotal = carbTarget.target * durationHours;
  const targetPerPointG = Math.max(20, Math.min(60, Math.round(rawTotal / 5)));
  const maxPerPointG = Math.min(60, carbTarget.max);

  const shortlist = shortlistCatalog(candidates, targetPerPointG, maxPerPointG);
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
        // Bumped from 0.3 → 0.75 so the agent actually explores the catalog.
        // At low temperature + identical prompts Flash was returning the same
        // products every run; 0.75 keeps outputs inside the rule set while
        // picking from a wider shortlist band.
        temperature: 0.75,
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

  return {
    nutritionPoints: points,
    carbTarget,
    hydrationTarget,
    caffeineStrategy,
    metrics: {
      totalCarbs: totals.carbs,
      carbsPerHour: durationHours > 0 ? Math.round(totals.carbs / durationHours) : 0,
      totalSodium: totals.sodium,
      totalCaffeine: totals.caffeine,
      totalCalories: totals.calories,
      totalCost: Math.round(totals.cost * 100) / 100,
    },
    rationale: parsed.overallRationale ?? '',
    source: 'gemini',
  };
}
