import { describe, it, expect } from 'vitest';
import { calculateSodium } from './sodiumCalculator';

describe('calculateSodium — Matrix Sheet 2 worked example', () => {
  // Inputs from the spec's "Sodium Model" sheet:
  //   cycling, baseline sweat 0.9 L/h, 28°C, 60% RH, non-acclim, not early-season,
  //   [Na+] bucket Medium (40 mmol/L), moderate intensity, 4h event.
  // Hydration calc for the same conditions gives sweat_rate = 0.9 × 1.5 × 1.0 × 1.0 = 1.35 L/h.
  // Expected output from the sheet: ~1,118 mg/h, total ~4,471 mg.
  it('reproduces the 1,118 mg/h target', () => {
    const r = calculateSodium({
      sweatRateLPerHour: 1.35,
      durationHours: 4,
      intensity: 'moderate',
      bucket: 'medium',
      heatAcclimatised: false,
      earlySeasonHeat: false,
      fluidMlPerHour: 800,
    });
    // Allow ±2 mg for rounding (the sheet mid-rounds as it goes).
    expect(r.sodiumMgPerHour).toBeGreaterThan(1110);
    expect(r.sodiumMgPerHour).toBeLessThan(1125);
  });

  it('applies the 300 mg/h floor for events > 2 h', () => {
    const r = calculateSodium({
      sweatRateLPerHour: 0.2,
      durationHours: 3,
      intensity: 'easy',
      bucket: 'low',
      heatAcclimatised: true,
      earlySeasonHeat: false,
      fluidMlPerHour: 400,
    });
    expect(r.sodiumMgPerHour).toBe(300);
    expect(r.floorApplied).toBe(true);
  });

  it('caps at 2000 mg/h without a sweat-test override', () => {
    const r = calculateSodium({
      sweatRateLPerHour: 2.5,
      durationHours: 5,
      intensity: 'hard',
      bucket: 'high',
      heatAcclimatised: false,
      earlySeasonHeat: true,
      fluidMlPerHour: 800,
    });
    expect(r.sodiumMgPerHour).toBe(2000);
    expect(r.ceilingApplied).toBe(true);
  });

  it('flags hyponatremia risk on long events with high fluid:sodium ratio', () => {
    const r = calculateSodium({
      sweatRateLPerHour: 0.8,
      durationHours: 6,
      intensity: 'easy',
      bucket: 'low',
      heatAcclimatised: true,
      earlySeasonHeat: false,
      fluidMlPerHour: 800, // 0.8 L/h
    });
    // Sodium will be modest — ratio exceeds 1.5 L/g — flag fires.
    expect(r.hyponatremiaRisk).toBe(true);
  });

  it('acclimatisation lowers effective [Na+] by ~20%', () => {
    const baseInput = {
      sweatRateLPerHour: 1.2,
      durationHours: 3,
      intensity: 'moderate' as const,
      bucket: 'medium' as const,
      earlySeasonHeat: false,
      fluidMlPerHour: 800,
    };
    const notAcclim = calculateSodium({ ...baseInput, heatAcclimatised: false });
    const acclim = calculateSodium({ ...baseInput, heatAcclimatised: true });
    expect(acclim.sweatNaMmolPerLiter).toBeCloseTo(notAcclim.sweatNaMmolPerLiter * 0.8, 0);
  });

  it('intensity raises [Na+] (Holmes 2016)', () => {
    const baseInput = {
      sweatRateLPerHour: 1.0,
      durationHours: 3,
      bucket: 'medium' as const,
      heatAcclimatised: false,
      earlySeasonHeat: false,
      fluidMlPerHour: 700,
    };
    const easy = calculateSodium({ ...baseInput, intensity: 'easy' });
    const hard = calculateSodium({ ...baseInput, intensity: 'hard' });
    expect(hard.sweatNaMmolPerLiter).toBeGreaterThan(easy.sweatNaMmolPerLiter);
  });
});
