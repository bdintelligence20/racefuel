import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProductProps } from '../../components/NutritionCard';

// Shared state between the SDK mock factory (hoisted above imports) and the
// tests. vi.hoisted lets us define a ref the factory can close over.
const agentState = vi.hoisted(() => ({
  responseText: '' as string,
  thrown: null as Error | null,
  calls: [] as unknown[][],
}));

vi.mock('../../data/products', () => ({
  products: [
    { id: 'gel-30', brand: 'AcmeGels', name: 'Race Gel', carbs: 30, calories: 110, sodium: 50, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 30, image: '' },
    { id: 'gel-22', brand: 'AcmeGels', name: 'Lite Gel', carbs: 22, calories: 90, sodium: 40, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 25, image: '' },
    { id: 'gel-25-caf', brand: 'AcmeGels', name: 'Rocket Caf', carbs: 25, calories: 100, sodium: 50, caffeine: 75, category: 'gel', color: 'red', priceZAR: 35, image: '' },
    { id: 'gel-55', brand: 'HighFlow', name: 'Mega Gel', carbs: 55, calories: 210, sodium: 60, caffeine: 0, category: 'gel', color: 'green', priceZAR: 55, image: '' },
    { id: 'drink-25', brand: 'AcmeDrink', name: 'Sport Mix', carbs: 25, calories: 100, sodium: 300, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 25, image: '' },
    { id: 'drink-45', brand: 'AcmeDrink', name: 'Endurance Mix', carbs: 45, calories: 190, sodium: 350, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 35, image: '' },
    { id: 'drink-60', brand: 'AcmeDrink', name: 'Ultra Mix', carbs: 60, calories: 240, sodium: 400, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 45, image: '' },
    { id: 'bar-28', brand: 'AcmeBars', name: 'Fuel Bar', carbs: 28, calories: 130, sodium: 60, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 40, image: '' },
    { id: 'bar-40', brand: 'AcmeBars', name: 'Race Bar', carbs: 40, calories: 180, sodium: 80, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 50, image: '' },
    { id: 'chew-36', brand: 'AcmeChews', name: 'Fuel Chews', carbs: 36, calories: 140, sodium: 100, caffeine: 0, category: 'chew', color: 'green', priceZAR: 35, image: '' },
    // Edge cases the filter must reject:
    { id: 'tabs-0',   brand: 'SaltCo', name: 'Hydro Tabs', carbs: 0,  calories: 0,   sodium: 250, caffeine: 0, category: 'drink', color: 'white', priceZAR: 10, image: '' },
    { id: 'recov-30', brand: '32Gi',   name: 'Recover',   carbs: 30, calories: 200, sodium: 100, caffeine: 0, category: 'drink', color: 'green', priceZAR: 40, image: '' },
  ],
}));

vi.mock('@google/generative-ai', async () => {
  const actual = await vi.importActual<typeof import('@google/generative-ai')>('@google/generative-ai');
  return {
    ...actual,
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: async (...args: unknown[]) => {
            agentState.calls.push(args);
            if (agentState.thrown) throw agentState.thrown;
            return { response: { text: () => agentState.responseText } };
          },
        };
      }
    },
  };
});

// Mirror the catalog as a locally-typed constant for test assertions.
const TEST_CATALOG: ProductProps[] = [
  { id: 'gel-30', brand: 'AcmeGels', name: 'Race Gel', carbs: 30, calories: 110, sodium: 50, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 30, image: '' },
  { id: 'gel-22', brand: 'AcmeGels', name: 'Lite Gel', carbs: 22, calories: 90, sodium: 40, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 25, image: '' },
  { id: 'gel-25-caf', brand: 'AcmeGels', name: 'Rocket Caf', carbs: 25, calories: 100, sodium: 50, caffeine: 75, category: 'gel', color: 'red', priceZAR: 35, image: '' },
  { id: 'gel-55', brand: 'HighFlow', name: 'Mega Gel', carbs: 55, calories: 210, sodium: 60, caffeine: 0, category: 'gel', color: 'green', priceZAR: 55, image: '' },
  { id: 'drink-25', brand: 'AcmeDrink', name: 'Sport Mix', carbs: 25, calories: 100, sodium: 300, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 25, image: '' },
  { id: 'drink-45', brand: 'AcmeDrink', name: 'Endurance Mix', carbs: 45, calories: 190, sodium: 350, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 35, image: '' },
  { id: 'drink-60', brand: 'AcmeDrink', name: 'Ultra Mix', carbs: 60, calories: 240, sodium: 400, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 45, image: '' },
  { id: 'bar-28', brand: 'AcmeBars', name: 'Fuel Bar', carbs: 28, calories: 130, sodium: 60, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 40, image: '' },
  { id: 'bar-40', brand: 'AcmeBars', name: 'Race Bar', carbs: 40, calories: 180, sodium: 80, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 50, image: '' },
  { id: 'chew-36', brand: 'AcmeChews', name: 'Fuel Chews', carbs: 36, calories: 140, sodium: 100, caffeine: 0, category: 'chew', color: 'green', priceZAR: 35, image: '' },
  { id: 'tabs-0',   brand: 'SaltCo', name: 'Hydro Tabs', carbs: 0,  calories: 0,   sodium: 250, caffeine: 0, category: 'drink', color: 'white', priceZAR: 10, image: '' },
  { id: 'recov-30', brand: '32Gi',   name: 'Recover',   carbs: 30, calories: 200, sodium: 100, caffeine: 0, category: 'drink', color: 'green', priceZAR: 40, image: '' },
];

import {
  generatePlanWithGemini,
  isGeminiEnabled,
  toFuelCandidates,
  shortlistCatalog,
  materialisePlacements,
  buildPrompt,
  __setApiKeyForTesting,
} from './geminiPlanner';
import type { UserProfile } from '../../context/AppContext';
import { calculateCarbTarget } from './carbCalculator';
import { calculateHydration } from './hydrationCalculator';
import { calculateCaffeineStrategy } from './caffeineStrategy';

const profile: UserProfile = {
  weight: 70,
  height: 175,
  sweatRate: 'moderate',
  ftp: 250,
  sport: 'running',
  gutTolerance: 'trained',
  sweatSodiumBucket: 'unknown',
  heatAcclimatised: false,
  earlySeasonHeat: false,
};

function baseInput(distanceKm: number, durationHours: number, elevationGainM = 0) {
  return {
    distanceKm,
    durationHours,
    elevationGainM,
    profile,
    isCompetition: false,
    temperatureCelsius: 22,
    humidity: 50,
  };
}

beforeEach(() => {
  agentState.responseText = '';
  agentState.thrown = null;
  agentState.calls = [];
  __setApiKeyForTesting('test-key');
});

describe('isGeminiEnabled', () => {
  it('is true when an API key is present', () => {
    expect(isGeminiEnabled()).toBe(true);
  });

});

describe('toFuelCandidates', () => {
  it('rejects zero-carb, recovery, and non-single-serve items', () => {
    const candidates = toFuelCandidates(TEST_CATALOG);
    const ids = candidates.map((p) => p.id);
    expect(ids).not.toContain('tabs-0');
    expect(ids).not.toContain('recov-30');
    // All legit fuel products should survive.
    expect(ids).toContain('gel-30');
    expect(ids).toContain('drink-45');
    expect(ids).toContain('bar-40');
    expect(ids).toContain('chew-36');
  });
});

describe('shortlistCatalog', () => {
  const fuel = toFuelCandidates(TEST_CATALOG);

  it('returns the input unchanged if already under the limit', () => {
    const out = shortlistCatalog(fuel, 40, 60, 50);
    expect(out.length).toBe(fuel.length);
  });

  it('caps at the requested limit when oversized', () => {
    const bloated = Array.from({ length: 80 }, (_, i) => ({
      ...fuel[i % fuel.length],
      id: `syn-${i}`,
    }));
    const out = shortlistCatalog(bloated, 35, 60, 30);
    expect(out.length).toBe(30);
  });

  it('keeps at least one option in each category when shortlisting', () => {
    const bloated = Array.from({ length: 80 }, (_, i) => ({
      ...fuel[i % fuel.length],
      id: `syn-${i}`,
    }));
    const out = shortlistCatalog(bloated, 40, 60, 20);
    const categories = new Set(out.map((p) => p.category));
    expect(categories.has('gel')).toBe(true);
    expect(categories.has('drink')).toBe(true);
    expect(categories.has('bar')).toBe(true);
  });

  it('always retains at least one caffeinated option if any exist', () => {
    const out = shortlistCatalog(fuel, 40, 60, 4);
    // fuel contains one caf gel; shortlist of size 4 must still include it.
    expect(out.some((p) => p.caffeine > 0)).toBe(true);
  });

  it('prefers products close to the target per-point dose', () => {
    // Sample 20 shortlists; the median pick should land in the target band.
    // Randomised sampling means a single run could grab an outlier, but the
    // central tendency must still be close to target.
    const firstPicks: number[] = [];
    for (let i = 0; i < 20; i++) {
      const out = shortlistCatalog(fuel, 40, 60, 3);
      firstPicks.push(out[0].carbs);
    }
    firstPicks.sort((a, b) => a - b);
    const median = firstPicks[10];
    expect(median).toBeGreaterThanOrEqual(28);
    expect(median).toBeLessThanOrEqual(50);
  });

  it('varies across runs — different subsets when the pool is much larger than the limit', () => {
    // Build a big synthetic pool so shortlist has real choice.
    const big = Array.from({ length: 60 }, (_, i) => ({
      ...fuel[i % fuel.length],
      id: `big-${i}`,
      carbs: 20 + (i % 30),
    }));
    const seenCombos = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const out = shortlistCatalog(big, 35, 60, 12);
      seenCombos.add(out.map((p) => p.id).sort().join(','));
    }
    // 10 runs should produce at least 3 distinct shortlists. Anything fewer
    // than that means we've regressed to deterministic shortlisting.
    expect(seenCombos.size).toBeGreaterThanOrEqual(3);
  });
});

describe('materialisePlacements', () => {
  it('drops hallucinated product ids', () => {
    const raw = {
      placements: [
        { distanceKm: 5, productId: 'gel-30', rationale: 'real' },
        { distanceKm: 10, productId: 'does-not-exist', rationale: 'fake' },
      ],
      overallRationale: '',
    };
    const { points } = materialisePlacements(raw, TEST_CATALOG, 20);
    expect(points.length).toBe(1);
    expect(points[0].product.id).toBe('gel-30');
  });

  it('drops placements outside the route distance', () => {
    const raw = {
      placements: [
        { distanceKm: -1, productId: 'gel-30', rationale: '' },
        { distanceKm: 50, productId: 'gel-30', rationale: '' },
        { distanceKm: 10, productId: 'gel-30', rationale: '' },
      ],
      overallRationale: '',
    };
    const { points } = materialisePlacements(raw, TEST_CATALOG, 20);
    expect(points.length).toBe(1);
    expect(points[0].distanceKm).toBe(10);
  });

  it('sorts placements by distance ascending', () => {
    const raw = {
      placements: [
        { distanceKm: 18, productId: 'gel-30', rationale: '' },
        { distanceKm: 4, productId: 'drink-45', rationale: '' },
        { distanceKm: 11, productId: 'bar-40', rationale: '' },
      ],
      overallRationale: '',
    };
    const { points } = materialisePlacements(raw, TEST_CATALOG, 25);
    expect(points.map((p) => p.distanceKm)).toEqual([4, 11, 18]);
  });

  it('accumulates totals accurately', () => {
    const raw = {
      placements: [
        { distanceKm: 5, productId: 'gel-30', rationale: '' },   // 30g carbs, 50 Na
        { distanceKm: 12, productId: 'drink-45', rationale: '' }, // 45g, 350 Na
      ],
      overallRationale: '',
    };
    const { totals } = materialisePlacements(raw, TEST_CATALOG, 20);
    expect(totals.carbs).toBe(75);
    expect(totals.sodium).toBe(400);
  });
});

describe('buildPrompt', () => {
  const input = baseInput(21.6, 2.317, 377.7);
  const carbTarget = calculateCarbTarget({
    durationHours: input.durationHours,
    intensityPercent: 0.72,
    gutTolerance: 'trained',
    isCompetition: false,
    bodyWeightKg: 70,
  });
  const hydrationTarget = calculateHydration({
    bodyWeightKg: 70,
    durationHours: input.durationHours,
    temperatureCelsius: 22,
    humidity: 50,
    intensityPercent: 0.72,
    sweatRate: 'moderate',
    sport: 'running',
  });
  const caff = calculateCaffeineStrategy({
    bodyWeightKg: 70,
    durationHours: input.durationHours,
    distanceKm: 21.6,
    isRegularConsumer: true,
    targetMgPerKg: 3,
  });
  const catalog = toFuelCandidates(TEST_CATALOG).map((p) => ({
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

  it('includes the carb target total as a hard band', () => {
    const prompt = buildPrompt(input, carbTarget, hydrationTarget, caff, 'moderate', catalog);
    expect(prompt).toMatch(/Total carbs: \d+-\d+g/);
    expect(prompt).toMatch(/Aim ~\d+g/);
  });

  it('includes the per-point gut cap', () => {
    const prompt = buildPrompt(input, carbTarget, hydrationTarget, caff, 'moderate', catalog);
    expect(prompt).toMatch(/Per placement: ≤ \d+g/);
  });

  it('includes every catalog id the agent is allowed to pick', () => {
    const prompt = buildPrompt(input, carbTarget, hydrationTarget, caff, 'moderate', catalog);
    for (const p of catalog) expect(prompt).toContain(p.id);
  });

  it('forbids recovery products and zero-carb items implicitly via catalog (not in prompt)', () => {
    const prompt = buildPrompt(input, carbTarget, hydrationTarget, caff, 'moderate', catalog);
    expect(prompt).not.toContain('recov-30');
    expect(prompt).not.toContain('tabs-0');
  });
});

describe('generatePlanWithGemini — end-to-end with stubbed SDK', () => {
  it('under-1h effort returns empty plan without calling the model', async () => {
    agentState.responseText = 'this should not be used';
    const plan = await generatePlanWithGemini(baseInput(6, 0.8));
    expect(plan?.nutritionPoints).toEqual([]);
    expect(agentState.calls.length).toBe(0);
  });

  it('happy path materialises a valid agent response into a plan', async () => {
    agentState.responseText = JSON.stringify({
      placements: [
        { distanceKm: 5.4, productId: 'drink-60', rationale: 'Heavy load early to bank carbs' },
        { distanceKm: 10.5, productId: 'gel-25-caf', rationale: 'Caffeine kicks in for final push' },
        { distanceKm: 15, productId: 'bar-40', rationale: 'Solid before the last climb' },
      ],
      overallRationale: 'Front-loaded to hit the 2–3h tier target.',
    });
    const plan = await generatePlanWithGemini(baseInput(21.6, 2.317, 377.7));
    expect(plan).not.toBeNull();
    expect(plan!.nutritionPoints.length).toBe(3);
    expect(plan!.metrics.totalCarbs).toBe(60 + 25 + 40);
    expect(plan!.metrics.totalCaffeine).toBe(75);
    expect(plan!.rationale).toMatch(/tier target/i);
    expect(plan!.source).toBe('gemini');
  });

  it('drops hallucinated product ids silently', async () => {
    agentState.responseText = JSON.stringify({
      placements: [
        { distanceKm: 5, productId: 'gel-30', rationale: '' },
        { distanceKm: 10, productId: 'definitely-not-a-real-id', rationale: '' },
        { distanceKm: 15, productId: 'bar-40', rationale: '' },
      ],
      overallRationale: '',
    });
    const plan = await generatePlanWithGemini(baseInput(21.6, 2.3, 300));
    expect(plan).not.toBeNull();
    expect(plan!.nutritionPoints.length).toBe(2);
    expect(plan!.nutritionPoints.every((p) => p.product.id !== 'definitely-not-a-real-id')).toBe(true);
  });

  it('returns null when the response is not valid JSON', async () => {
    agentState.responseText = 'not json at all!';
    const plan = await generatePlanWithGemini(baseInput(21.6, 2.3, 300));
    expect(plan).toBeNull();
  });

  it('returns null when the network throws', async () => {
    agentState.thrown = new Error('upstream down');
    const plan = await generatePlanWithGemini(baseInput(21.6, 2.3, 300));
    expect(plan).toBeNull();
  });

  it('returns null when every placement references a hallucinated id', async () => {
    agentState.responseText = JSON.stringify({
      placements: [
        { distanceKm: 5, productId: 'no-such-thing-1', rationale: '' },
        { distanceKm: 12, productId: 'no-such-thing-2', rationale: '' },
      ],
      overallRationale: '',
    });
    const plan = await generatePlanWithGemini(baseInput(21.6, 2.3, 300));
    expect(plan).toBeNull();
  });

  it('reports pipeline phases to the onPhase callback', async () => {
    agentState.responseText = JSON.stringify({
      placements: [{ distanceKm: 5, productId: 'gel-30', rationale: '' }],
      overallRationale: '',
    });
    const phases: string[] = [];
    await generatePlanWithGemini({
      ...baseInput(12, 1.5),
      onPhase: (phase) => phases.push(phase),
    });
    expect(phases.length).toBeGreaterThan(0);
    // Must include at least one pre-call and one post-call phase.
    expect(phases.some((p) => /shortlisting|drafting|reasoning/i.test(p))).toBe(true);
    expect(phases.some((p) => /placing/i.test(p))).toBe(true);
  });

  it('uses gemini-2.5-flash and requests JSON', async () => {
    agentState.responseText = JSON.stringify({
      placements: [{ distanceKm: 5, productId: 'gel-30', rationale: '' }],
      overallRationale: '',
    });
    await generatePlanWithGemini(baseInput(12, 1.5));
    expect(agentState.calls.length).toBe(1);
    const [prompt] = agentState.calls[0] as [string];
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(200);
  });
});
