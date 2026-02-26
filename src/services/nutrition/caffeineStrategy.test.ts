import { describe, it, expect } from 'vitest';
import { calculateCaffeineStrategy, shouldUseCaffeineProduct } from './caffeineStrategy';

describe('calculateCaffeineStrategy', () => {
  const baseInput = {
    bodyWeightKg: 70,
    durationHours: 3,
    distanceKm: 100,
    isRegularConsumer: false,
    targetMgPerKg: 4,
  };

  it('returns no caffeine for short efforts', () => {
    const result = calculateCaffeineStrategy({ ...baseInput, durationHours: 0.5 });
    expect(result.totalCaffeineMg).toBe(0);
    expect(result.timing).toBe('none');
  });

  it('calculates correct total caffeine based on body weight', () => {
    const result = calculateCaffeineStrategy(baseInput);
    expect(result.totalCaffeineMg).toBe(70 * 4); // 280mg
  });

  it('increases caffeine for regular consumers', () => {
    const regular = calculateCaffeineStrategy({ ...baseInput, isRegularConsumer: true });
    const nonRegular = calculateCaffeineStrategy({ ...baseInput, isRegularConsumer: false });
    expect(regular.totalCaffeineMg).toBeGreaterThan(nonRegular.totalCaffeineMg);
  });

  it('uses late-only timing for short-medium events', () => {
    const result = calculateCaffeineStrategy({ ...baseInput, durationHours: 2 });
    expect(result.timing).toBe('late-only');
    expect(result.firstDosePercent).toBe(40);
  });

  it('uses distributed timing for long events', () => {
    const result = calculateCaffeineStrategy({ ...baseInput, durationHours: 3 });
    expect(result.timing).toBe('distributed');
    expect(result.firstDosePercent).toBe(55);
  });

  it('caps single dose at 200mg', () => {
    const heavy = calculateCaffeineStrategy({ ...baseInput, bodyWeightKg: 100 });
    expect(heavy.maxPerDoseMg).toBeLessThanOrEqual(200);
  });

  it('clamps target between 3-6 mg/kg', () => {
    const low = calculateCaffeineStrategy({ ...baseInput, targetMgPerKg: 1 });
    // 3mg/kg * 70kg = 210mg minimum
    expect(low.totalCaffeineMg).toBe(70 * 3);

    const high = calculateCaffeineStrategy({ ...baseInput, targetMgPerKg: 10 });
    // 6mg/kg * 70kg = 420mg maximum
    expect(high.totalCaffeineMg).toBe(70 * 6);
  });
});

describe('shouldUseCaffeineProduct', () => {
  const strategy = {
    totalCaffeineMg: 300,
    maxPerDoseMg: 200,
    firstDoseKm: 55,
    firstDosePercent: 55,
    rationale: '',
    timing: 'distributed' as const,
  };

  it('returns false before first dose distance', () => {
    expect(shouldUseCaffeineProduct(30, 100, strategy, 0)).toBe(false);
  });

  it('returns true after first dose distance', () => {
    expect(shouldUseCaffeineProduct(60, 100, strategy, 0)).toBe(true);
  });

  it('returns false if caffeine budget already met', () => {
    expect(shouldUseCaffeineProduct(60, 100, strategy, 300)).toBe(false);
  });

  it('returns false if timing is none', () => {
    const noStrat = { ...strategy, timing: 'none' as const };
    expect(shouldUseCaffeineProduct(60, 100, noStrat, 0)).toBe(false);
  });
});
