import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../data/products', () => ({
  // Fake catalog with a mix of real fuel, zero-carb electrolyte tabs, recovery
  // products, and the "missing nutrition" class that bit us in the production feed.
  products: [
    { id: 'gel-30', brand: 'AcmeGels', name: 'Race Gel', carbs: 30, calories: 110, sodium: 50, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 30, image: '' },
    { id: 'gel-22', brand: 'AcmeGels', name: 'Lite Gel', carbs: 22, calories: 90, sodium: 40, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 25, image: '' },
    { id: 'gel-35-caf', brand: 'AcmeGels', name: 'Rocket Caf', carbs: 25, calories: 100, sodium: 50, caffeine: 75, category: 'gel', color: 'red', priceZAR: 35, image: '' },
    { id: 'drink-25', brand: 'AcmeDrink', name: 'Sport Mix', carbs: 25, calories: 100, sodium: 300, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 25, image: '' },
    { id: 'bar-28', brand: 'AcmeBars', name: 'Fuel Bar', carbs: 28, calories: 130, sodium: 60, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 40, image: '' },
    { id: 'bar-40', brand: 'AcmeBars', name: 'Race Bar', carbs: 40, calories: 180, sodium: 80, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 50, image: '' },
    { id: 'drink-45', brand: 'AcmeDrink', name: 'Endurance Mix', carbs: 45, calories: 190, sodium: 350, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 35, image: '' },
    { id: 'drink-60', brand: 'AcmeDrink', name: 'Ultra Mix', carbs: 60, calories: 240, sodium: 400, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 45, image: '' },
    // Zero-carb items — legit electrolyte / salt / creatine products that must NEVER be auto-placed as fuel.
    { id: 'tabs-0',  brand: 'SaltCo', name: 'Hydro Tabs', carbs: 0, calories: 0, sodium: 250, caffeine: 0, category: 'drink', color: 'white', priceZAR: 10, image: '' },
    { id: 'salt-0',  brand: 'SaltCo', name: 'Salt 07', carbs: 0, calories: 0, sodium: 400, caffeine: 0, category: 'drink', color: 'white', priceZAR: 8, image: '' },
    { id: 'creatine-0', brand: 'LabX', name: 'Creatine Cap', carbs: 0, calories: 0, sodium: 0, caffeine: 0, category: 'drink', color: 'white', priceZAR: 20, image: '' },
    // "Missing nutrition" class — real carb products the feed failed to extract data for.
    { id: 'gel-miss', brand: 'GU energy', name: 'Energy Gel', carbs: 0, calories: 0, sodium: 0, caffeine: 0, category: 'gel', color: 'blue', priceZAR: 30, image: '' },
    // Recovery products — must be excluded even though they're single-serve carb-containing.
    { id: 'recov-25', brand: '32Gi', name: 'Recover', carbs: 25, calories: 200, sodium: 100, caffeine: 0, category: 'drink', color: 'green', priceZAR: 40, image: '' },
    { id: 'recov-30', brand: 'Skratch Labs', name: 'Recovery Sport Drink Mix', carbs: 30, calories: 150, sodium: 120, caffeine: 0, category: 'drink', color: 'yellow', priceZAR: 45, image: '' },
  ],
}));

import { generatePlan } from './planGenerator';
import { UserProfile } from '../../context/AppContext';

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

function baseInput(distanceKm: number, durationHours: number) {
  return {
    distanceKm,
    durationHours,
    elevationGainM: 0,
    profile,
    isCompetition: false,
    temperatureCelsius: 22,
    humidity: 50,
  };
}

describe('generatePlan — spec-aligned behaviour', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // deterministic product pick
  });

  it('places zero fuel points on sub-hour efforts', () => {
    const plan = generatePlan(baseInput(8, 0.8));
    expect(plan.nutritionPoints).toHaveLength(0);
  });

  it('9.4km in ~1:05 produces a short, bounded plan (bug: "all products" added)', () => {
    const plan = generatePlan(baseInput(9.4, 1.083));
    // Spec §2 tier for 1–2 h is 30–60 g/h → 30–65g total. Cap ≤ 3 products.
    expect(plan.nutritionPoints.length).toBeLessThanOrEqual(3);
    // Every placed product must have real carbs and not be a recovery formulation.
    for (const pt of plan.nutritionPoints) {
      expect(pt.product.carbs).toBeGreaterThan(0);
      expect(/recover/i.test(`${pt.product.brand} ${pt.product.name}`)).toBe(false);
    }
  });

  it('12km in 1:30 stays within 2–4 products', () => {
    const plan = generatePlan(baseInput(12, 1.5));
    expect(plan.nutritionPoints.length).toBeGreaterThanOrEqual(1);
    expect(plan.nutritionPoints.length).toBeLessThanOrEqual(4);
    for (const pt of plan.nutritionPoints) {
      expect(pt.product.carbs).toBeGreaterThan(0);
      expect(/recover/i.test(`${pt.product.brand} ${pt.product.name}`)).toBe(false);
    }
  });

  it('total carbs land at or below the tier max', () => {
    const plan = generatePlan(baseInput(40, 3));
    expect(plan.metrics.totalCarbs).toBeLessThanOrEqual(plan.carbTarget.max * 3);
    expect(plan.metrics.totalCarbs).toBeGreaterThan(0);
  });

  it('excludes multi-serve tubs even if carbs are set', () => {
    const plan = generatePlan(baseInput(25, 2));
    for (const pt of plan.nutritionPoints) {
      const name = `${pt.product.brand} ${pt.product.name}`.toLowerCase();
      expect(/\btub\b|\bjar\b|\bbulk\b/.test(name)).toBe(false);
    }
  });

  it('no-fuel tier (under 30 min) returns a zero target plan cleanly', () => {
    const plan = generatePlan(baseInput(4, 0.35));
    expect(plan.nutritionPoints).toHaveLength(0);
    expect(plan.metrics.totalCarbs).toBe(0);
  });

  it('21.6km / 2:19 with climbing hits the carb target despite gel-heavy catalog', () => {
    // Regression: the fixed targetCarbsPerPoint formula produced 45g/h on a 75g/h target
    // because early under-shoots (23g gels selected on climbs) were never compensated for.
    // The dynamic per-point target should now catch up.
    const plan = generatePlan({
      ...baseInput(21.6, 2.317),
      elevationGainM: 377.7,
    });
    // Tier is 2–3 h → 60–90 g/h. Must clear the 60 g/h minimum.
    expect(plan.metrics.carbsPerHour).toBeGreaterThanOrEqual(60);
    expect(plan.metrics.totalCarbs).toBeGreaterThanOrEqual(plan.carbTarget.min * 2.3);
  });

  // Feedback fix SM#6: on a 21km route the last fuel point was landing at
  // 8km because the carb cap dropped late placements. Coverage rule says
  // last placement must be ≥ 75% of distance.
  it('21.6km / 2:19 places at least one fuel point in the back half of the route', () => {
    const plan = generatePlan({
      ...baseInput(21.6, 2.317),
      elevationGainM: 377.7,
    });
    const lastKm = plan.nutritionPoints[plan.nutritionPoints.length - 1].distanceKm;
    // Back half = ≥ 50% of distance. Originally cropping at 8km on 21.6km
    // means lastKm < 11. With the coverage rule lastKm should be ≥ ~11.
    expect(lastKm).toBeGreaterThanOrEqual(11);
  });

  // Feedback fix SM#1: hot/humid routes with high sweat-Na need sodium-dense
  // products. The screenshot showed a plan delivering 26% of target (all
  // gels). The sodium-aware scorer should bias toward electrolyte drinks
  // and pick AT LEAST one high-sodium product on a hot route.
  it('hot 30°C 70% humidity route includes at least one electrolyte drink', () => {
    const plan = generatePlan({
      ...baseInput(21.6, 2.317),
      elevationGainM: 200,
      temperatureCelsius: 30,
      humidity: 70,
      profile: { ...profile, sweatRate: 'heavy', sweatSodiumBucket: 'high' },
    });
    // Drinks have 300+ mg sodium per serving; gels and bars are ≤ 80 mg.
    // The fix should land at least one drink in the plan.
    const drinks = plan.nutritionPoints.filter((p) => p.product.category === 'drink');
    expect(drinks.length).toBeGreaterThanOrEqual(1);
    // And sodium delivery should beat the 26%-of-target failure mode shown
    // in the BS+SM testing screenshot.
    const targetTotalSodium = plan.hydrationTarget.sodiumMgPerHour * 2.317;
    expect(plan.metrics.totalSodium).toBeGreaterThan(targetTotalSodium * 0.3);
  });

  // Feedback fix BS#3: sub-10km routes that take longer than an hour (e.g.,
  // a hilly 9km trail run) should still get a plan. Used to be blocked by a
  // distance floor in AppContext, but the planner itself must produce a
  // valid plan for these inputs (the only guard is the duration check).
  it('9km trail run lasting 1h45 produces a non-empty plan', () => {
    const plan = generatePlan({
      ...baseInput(9, 1.75),
      elevationGainM: 600,
    });
    expect(plan.nutritionPoints.length).toBeGreaterThan(0);
  });
});
