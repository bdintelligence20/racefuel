/**
 * Refactor guard for Phase 1 (shared fueling-target extraction).
 *
 * generatePlan is non-deterministic in production — it mints point ids with
 * nanoid() and picks products with Math.random(). Both are frozen here so the
 * FULL plan (targets AND placement) is byte-stable, giving a real snapshot to
 * assert against across the computeFuelingTargets extraction. If the snapshot
 * changes after the refactor, the extraction was not behaviour-preserving —
 * stop and investigate rather than updating the snapshot.
 *
 * The catalog mirrors planGenerator.test.ts so placement has realistic fuel to
 * choose from. Cases span distance, elevation (via intensity) and an explicit
 * effort override.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../data/products', () => ({
  products: [
    { id: 'gel-30', brand: 'AcmeGels', name: 'Race Gel', carbs: 30, calories: 110, sodium: 50, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 30, image: '' },
    { id: 'gel-22', brand: 'AcmeGels', name: 'Lite Gel', carbs: 22, calories: 90, sodium: 40, caffeine: 0, category: 'gel', color: 'orange', priceZAR: 25, image: '' },
    { id: 'gel-35-caf', brand: 'AcmeGels', name: 'Rocket Caf', carbs: 25, calories: 100, sodium: 50, caffeine: 75, category: 'gel', color: 'red', priceZAR: 35, image: '' },
    { id: 'drink-25', brand: 'AcmeDrink', name: 'Sport Mix', carbs: 25, calories: 100, sodium: 300, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 25, image: '' },
    { id: 'bar-28', brand: 'AcmeBars', name: 'Fuel Bar', carbs: 28, calories: 130, sodium: 60, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 40, image: '' },
    { id: 'bar-40', brand: 'AcmeBars', name: 'Race Bar', carbs: 40, calories: 180, sodium: 80, caffeine: 0, category: 'bar', color: 'yellow', priceZAR: 50, image: '' },
    { id: 'drink-45', brand: 'AcmeDrink', name: 'Endurance Mix', carbs: 45, calories: 190, sodium: 350, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 35, image: '' },
    { id: 'drink-60', brand: 'AcmeDrink', name: 'Ultra Mix', carbs: 60, calories: 240, sodium: 400, caffeine: 0, category: 'drink', color: 'blue', priceZAR: 45, image: '' },
  ],
}));

vi.mock('nanoid', () => ({ nanoid: vi.fn() }));

import { nanoid } from 'nanoid';
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

describe('generatePlan — Phase 1 refactor snapshot (frozen randomness)', () => {
  beforeEach(() => {
    let n = 0;
    (nanoid as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => `id-${n++}`);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('half-marathon, rolling', () => {
    const plan = generatePlan({
      distanceKm: 21.6,
      durationHours: 2.317,
      elevationGainM: 377.7,
      profile,
      isCompetition: false,
      temperatureCelsius: 22,
      humidity: 50,
    });
    expect(plan).toMatchSnapshot();
  });

  it('long, hilly, hot', () => {
    const plan = generatePlan({
      distanceKm: 60,
      durationHours: 6,
      elevationGainM: 1500,
      profile,
      isCompetition: true,
      temperatureCelsius: 30,
      humidity: 65,
    });
    expect(plan).toMatchSnapshot();
  });

  it('explicit effort override', () => {
    const plan = generatePlan({
      distanceKm: 30,
      durationHours: 2.5,
      elevationGainM: 200,
      profile,
      isCompetition: false,
      temperatureCelsius: 18,
      humidity: 40,
      effortLevel: 8,
    });
    expect(plan).toMatchSnapshot();
  });
});
