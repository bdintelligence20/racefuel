/**
 * Gemini-powered auto-generate. Runs the Fuelcue algorithm spec through a
 * Gemini 2.5 Pro call and returns the same GeneratedPlan shape the legacy
 * algorithm produces, so the rest of the app doesn't need to care which
 * engine produced the plan.
 *
 * Fallback pattern:
 *   - Hard 5s timeout (user requirement).
 *   - Any failure → caller falls back to the deterministic algorithm.
 *   - We still compute carb / hydration / sodium / caffeine TARGETS with
 *     the deterministic calculators, since those are evidence-locked and
 *     don't benefit from AI judgement. The LLM only does product selection
 *     and placement — the part that's hard to encode as rules.
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

const API_KEY = (import.meta as unknown as { env: Record<string, string | undefined> }).env?.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-2.5-pro';

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
  /** Optional progress hook for the UI spinner. */
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
  return Boolean(API_KEY);
}

function inferIntensity(distanceKm: number, durationHours: number, elevationGainM: number, sport: 'running' | 'cycling'): number {
  if (durationHours <= 0) return 0.7;
  const speed = distanceKm / durationHours;
  const refSpeed = sport === 'cycling' ? 28 : 11;
  const speedIntensity = Math.max(0.5, Math.min(1.0, (speed / refSpeed) * 0.75));
  const elevPerKm = distanceKm > 0 ? elevationGainM / distanceKm : 0;
  const elevBoost = sport === 'running' ? elevPerKm * 0.005 : elevPerKm * 0.003;
  return Math.max(0.5, Math.min(1.0, speedIntensity + elevBoost));
}

function toCatalogSummary(catalog: ProductProps[]): Array<{ id: string; brand: string; name: string; category: string; carbs: number; sodium: number; caffeine: number; calories: number; priceZAR: number }> {
  // Give the agent only single-serve, non-recovery, carb-containing products —
  // same filter the algorithm uses, so the model can't choose garbage.
  return catalog
    .filter(isSingleServe)
    .filter((p) => p.carbs > 0 && !/recover(y)?/i.test(`${p.brand} ${p.name}`))
    .map((p) => ({
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

function buildPrompt(
  input: GeminiPlanInput,
  carbTarget: CarbTarget,
  hydrationTarget: HydrationTarget,
  caffeineStrategy: CaffeineRecommendation,
  intensity: 'easy' | 'moderate' | 'hard',
  catalog: ReturnType<typeof toCatalogSummary>,
): string {
  const { distanceKm, durationHours, elevationGainM, profile, temperatureCelsius, humidity, preferredCategories, budget } = input;
  const segments = input.routeAnalysis?.segments?.map((s) => ({
    fromKm: +s.startKm.toFixed(1),
    toKm: +s.endKm.toFixed(1),
    type: s.type,
    avgGradient: +s.avgGradient.toFixed(1),
  })) || [];

  return `You are a sports-nutrition planner. Produce an on-course fueling plan for one endurance athlete on one route, following the Fuelcue evidence-based spec (Jeukendrup 2014, ACSM 2016, Baker 2022, Hew-Butler 2015).

HARD RULES — must not be violated:
1. Pick products ONLY from the provided catalog by id. Never invent ids.
2. Total grams of carbs across all placements MUST be between ${Math.round(carbTarget.min * durationHours)}g and ${Math.round(carbTarget.max * durationHours)}g. Aim for ~${Math.round(carbTarget.target * durationHours)}g (${carbTarget.target} g/h × ${durationHours.toFixed(2)}h).
3. No more than ${Math.min(60, carbTarget.max)}g of carbs in a single placement (per-point gut cap).
4. Placements must be ≥ 12 minutes apart (gut absorption window). At ${(distanceKm / durationHours).toFixed(2)} km/h avg speed that's ≥ ${+(12 * distanceKm / durationHours / 60).toFixed(2)} km between points.
5. First placement: 25–40 minutes into the effort, not earlier.
6. Last placement: leave at least 10 minutes before the finish.
7. Prefer placing fuel ~5 min BEFORE a climb segment (absorbed when demand peaks).
8. Avoid placing mid-descent; shift to the end of a descent.
9. Alternate solid (bar/chew) and liquid (drink) when possible — dual-transporter absorption.
10. Caffeine strategy: ${caffeineStrategy.timing === 'none' ? 'no caffeine needed (short effort).' : caffeineStrategy.timing === 'late-only' ? `single caffeinated product around ${caffeineStrategy.firstDoseKm}km (40% mark).` : `distribute caffeine across the final 45%, starting ~${caffeineStrategy.firstDoseKm}km.`}
11. Do NOT include recovery/protein products. Do NOT include products with 0 carbs.

INPUTS
------
Route: ${distanceKm}km, ${elevationGainM ?? 0}m elevation gain, expected duration ${durationHours.toFixed(2)}h (${(distanceKm / durationHours).toFixed(2)} km/h).
Sport: ${profile.sport ?? 'running'}. Competition mode: ${input.isCompetition}.
Conditions: ${temperatureCelsius}°C, ${humidity}% RH.
Intensity (inferred from pace + elevation): ${intensity}.
Athlete profile: ${profile.weight}kg, sweat rate self-report "${profile.sweatRate}", gut tolerance "${profile.gutTolerance ?? 'trained'}" (≤${carbTarget.max} g/h cap), sweat sodium bucket "${profile.sweatSodiumBucket ?? 'unknown'}", heat-acclimatised: ${profile.heatAcclimatised ?? false}, early-season heat: ${profile.earlySeasonHeat ?? false}.
Preferred product categories: ${preferredCategories && preferredCategories.length ? preferredCategories.join(', ') : 'no preference'}.
Budget cap: ${budget ? `R${budget}` : 'none'}.

TARGETS (computed from the spec — do not second-guess)
------
- Carbs: ${carbTarget.target} g/h (min ${carbTarget.min}, max ${carbTarget.max}). Rationale: ${carbTarget.rationale}
- Fluid: ${hydrationTarget.fluidMlPerHour} ml/h (sweat rate ${hydrationTarget.sweatRateLPerHour} L/h × ${Math.round(hydrationTarget.replacementFraction * 100)}% replacement).
- Sodium: ${hydrationTarget.sodiumMgPerHour} mg/h.
- Caffeine budget for the effort: ${caffeineStrategy.totalCaffeineMg} mg (${caffeineStrategy.timing}).

TERRAIN SEGMENTS (ordered by distance)
------
${segments.length ? segments.map((s) => `  ${s.fromKm}–${s.toKm}km: ${s.type} (${s.avgGradient}%)`).join('\n') : '  (no segment analysis — treat as rolling)'}

PRODUCT CATALOG (${catalog.length} items — choose by id)
------
${catalog.map((p) => `  ${p.id} | ${p.brand} ${p.name} | ${p.category} | ${p.carbs}g carbs · ${p.sodium}mg Na · ${p.caffeine}mg caf · ${p.calories} kcal · R${p.priceZAR}`).join('\n')}

Think carefully. Produce 2–8 placements that hit the carb target while respecting terrain, spacing, and gut rules. Return the JSON plan.`;
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
      description: 'Fuel placements along the route, ordered by distanceKm ascending.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          distanceKm: { type: SchemaType.NUMBER, description: 'Distance from start in km, rounded to 0.1km.' },
          productId: { type: SchemaType.STRING, description: 'Product id taken verbatim from the catalog.' },
          rationale: { type: SchemaType.STRING, description: 'One sentence on why this product at this point.' },
        },
        required: ['distanceKm', 'productId', 'rationale'],
      },
    },
    overallRationale: {
      type: SchemaType.STRING,
      description: 'One short paragraph summarising the whole plan.',
    },
  },
  required: ['placements', 'overallRationale'],
};

export async function generatePlanWithGemini(input: GeminiPlanInput): Promise<GeminiGeneratedPlan | null> {
  if (!API_KEY) return null;

  const { distanceKm, durationHours, profile, isCompetition, temperatureCelsius, humidity } = input;
  const sport = profile.sport ?? 'running';
  const gutTolerance = profile.gutTolerance ?? 'trained';
  const elevationGainM = input.elevationGainM ?? 0;
  const intensityPercent = inferIntensity(distanceKm, durationHours, elevationGainM, sport);
  const intensityBucket: 'easy' | 'moderate' | 'hard' =
    intensityPercent < 0.65 ? 'easy' : intensityPercent < 0.80 ? 'moderate' : 'hard';

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

  // No fueling needed for sub-tier or sub-1h efforts — agent call would be wasted.
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

  input.onPhase?.('Reviewing the product catalog');
  const preferredProducts = input.preferredProductIds
    ? products.filter((p) => input.preferredProductIds!.includes(p.id))
    : products;
  const catalog = toCatalogSummary(preferredProducts);
  if (catalog.length === 0) return null;

  input.onPhase?.('Briefing the agent');
  const prompt = buildPrompt(input, carbTarget, hydrationTarget, caffeineStrategy, intensityBucket, catalog);

  input.onPhase?.('Reasoning through the plan');
  let raw: string;
  try {
    const ai = new GoogleGenerativeAI(API_KEY);
    const model = ai.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: AGENT_SCHEMA,
        temperature: 0.4,
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
    console.warn('[Gemini] response was not JSON:', err);
    return null;
  }

  // Materialise placements against the real catalog so any hallucinated id fails loudly.
  const catalogById = new Map(preferredProducts.map((p) => [p.id, p]));
  const points: NutritionPoint[] = [];
  let totalCarbs = 0;
  let totalSodium = 0;
  let totalCaffeine = 0;
  let totalCalories = 0;
  let totalCost = 0;
  const sorted = [...(parsed.placements ?? [])].sort((a, b) => a.distanceKm - b.distanceKm);
  for (const p of sorted) {
    const product = catalogById.get(p.productId);
    if (!product) continue;
    if (p.distanceKm < 0 || p.distanceKm > distanceKm) continue;
    points.push({
      id: nanoid(),
      distanceKm: Math.round(p.distanceKm * 10) / 10,
      product,
    });
    totalCarbs += product.carbs;
    totalSodium += product.sodium;
    totalCaffeine += product.caffeine;
    totalCalories += product.calories;
    totalCost += product.priceZAR ?? 0;
  }

  if (points.length === 0) {
    console.warn('[Gemini] plan had zero valid placements, falling back');
    return null;
  }

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
    rationale: parsed.overallRationale ?? '',
    source: 'gemini',
  };
}
