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
});
