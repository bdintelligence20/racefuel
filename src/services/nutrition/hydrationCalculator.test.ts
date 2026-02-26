import { describe, it, expect } from 'vitest';
import { calculateHydration } from './hydrationCalculator';

describe('calculateHydration', () => {
  const baseInput = {
    bodyWeightKg: 70,
    durationHours: 3,
    temperatureCelsius: 25,
    humidity: 50,
    intensityPercent: 0.75,
    sweatRate: 'moderate' as const,
  };

  it('returns positive fluid and sodium targets', () => {
    const result = calculateHydration(baseInput);
    expect(result.fluidMlPerHour).toBeGreaterThan(0);
    expect(result.sodiumMgPerHour).toBeGreaterThan(0);
    expect(result.totalFluidLiters).toBeGreaterThan(0);
    expect(result.totalSodiumMg).toBeGreaterThan(0);
  });

  it('increases fluid needs in hot conditions', () => {
    const cool = calculateHydration({ ...baseInput, temperatureCelsius: 15 });
    const hot = calculateHydration({ ...baseInput, temperatureCelsius: 35 });
    expect(hot.fluidMlPerHour).toBeGreaterThan(cool.fluidMlPerHour);
  });

  it('scales with sweat rate category', () => {
    const light = calculateHydration({ ...baseInput, sweatRate: 'light' });
    const moderate = calculateHydration({ ...baseInput, sweatRate: 'moderate' });
    const heavy = calculateHydration({ ...baseInput, sweatRate: 'heavy' });

    expect(light.fluidMlPerHour).toBeLessThan(moderate.fluidMlPerHour);
    expect(moderate.fluidMlPerHour).toBeLessThan(heavy.fluidMlPerHour);
  });

  it('scales total fluid with duration', () => {
    const short = calculateHydration({ ...baseInput, durationHours: 1 });
    const long = calculateHydration({ ...baseInput, durationHours: 5 });
    expect(long.totalFluidLiters).toBeGreaterThan(short.totalFluidLiters);
  });

  it('adjusts sodium for sweat rate', () => {
    const light = calculateHydration({ ...baseInput, sweatRate: 'light' });
    const heavy = calculateHydration({ ...baseInput, sweatRate: 'heavy' });
    expect(heavy.sodiumMgPerHour).toBeGreaterThan(light.sodiumMgPerHour);
  });

  it('reduces sweat rate in cold conditions', () => {
    const cold = calculateHydration({ ...baseInput, temperatureCelsius: 5 });
    const warm = calculateHydration({ ...baseInput, temperatureCelsius: 25 });
    expect(cold.sweatRateLPerHour).toBeLessThan(warm.sweatRateLPerHour);
  });

  it('includes rationale string', () => {
    const result = calculateHydration(baseInput);
    expect(result.rationale).toContain('sweat rate');
  });
});
