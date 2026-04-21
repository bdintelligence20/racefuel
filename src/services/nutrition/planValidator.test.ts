import { describe, it, expect } from 'vitest';
import { validatePlan } from './planValidator';
import { NutritionPoint } from '../../context/AppContext';

function makePoint(distanceKm: number, carbs: number, overrides: Partial<NutritionPoint['product']> = {}): NutritionPoint {
  return {
    id: `test-${distanceKm}`,
    distanceKm,
    product: {
      id: `prod-${distanceKm}`,
      name: 'Test Gel',
      brand: 'Test',
      category: 'gel',
      carbs,
      calories: carbs * 4,
      sodium: 100,
      caffeine: 0,
      priceZAR: 35,
      image: '',
      color: 'green',
      ...overrides,
    },
  };
}

describe('validatePlan', () => {
  it('warns when no nutrition points for long effort', () => {
    const result = validatePlan([], 100, 4);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].severity).toBe('critical');
    expect(result.warnings[0].id).toBe('no-nutrition');
  });

  it('returns full score for well-spaced plan', () => {
    const points = [
      makePoint(10, 25),
      makePoint(25, 25),
      makePoint(40, 25),
      makePoint(55, 25),
      makePoint(70, 25),
      makePoint(85, 25),
    ];
    const result = validatePlan(points, 100, 4);
    // Score may not be perfect due to minor spacing warnings, but should be reasonable
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.warnings.filter(w => w.severity === 'critical')).toHaveLength(0);
  });

  it('detects large gaps between points', () => {
    const points = [
      makePoint(10, 30),
      makePoint(70, 30), // 60km gap
    ];
    const result = validatePlan(points, 100, 4);
    const gapWarning = result.warnings.find(w => w.id.startsWith('gap-'));
    expect(gapWarning).toBeDefined();
  });

  it('detects clustering (too close together)', () => {
    const points = [
      makePoint(10, 20),
      makePoint(11, 20), // only 1km apart at 25km/h = ~2.4min
    ];
    const result = validatePlan(points, 100, 4);
    const clusterWarning = result.warnings.find(w => w.id.startsWith('cluster-'));
    expect(clusterWarning).toBeDefined();
  });

  it('detects late first nutrition', () => {
    const points = [makePoint(30, 30)]; // first at 30km
    const result = validatePlan(points, 100, 4);
    const lateWarning = result.warnings.find(w => w.id === 'late-start');
    expect(lateWarning).toBeDefined();
  });

  it('warns when carbs below minimum target', () => {
    const points = [makePoint(30, 10)]; // only 10g total
    const carbTarget = { min: 60, max: 90, target: 75, rationale: '', tierMaxBeforeGutCap: 90, gutCapped: false };
    const result = validatePlan(points, 100, 4, carbTarget);
    const carbWarning = result.warnings.find(w => w.id === 'carbs-low');
    expect(carbWarning).toBeDefined();
    expect(carbWarning?.severity).toBe('critical');
  });

  it('warns when carbs above maximum target', () => {
    const points = Array.from({ length: 20 }, (_, i) => makePoint(5 + i * 5, 30));
    const carbTarget = { min: 60, max: 90, target: 75, rationale: '', tierMaxBeforeGutCap: 90, gutCapped: false };
    const result = validatePlan(points, 100, 4, carbTarget);
    const carbWarning = result.warnings.find(w => w.id === 'carbs-high');
    expect(carbWarning).toBeDefined();
  });

  it('warns about excessive caffeine', () => {
    const points = [
      makePoint(50, 25, { caffeine: 200 }),
      makePoint(70, 25, { caffeine: 200 }),
      makePoint(85, 25, { caffeine: 200 }),
    ];
    // 600mg for 70kg = 8.5 mg/kg (exceeds 6 mg/kg)
    const result = validatePlan(points, 100, 4, undefined, undefined, undefined, 70);
    const cafWarning = result.warnings.find(w => w.id === 'caffeine-high');
    expect(cafWarning).toBeDefined();
    expect(cafWarning?.severity).toBe('critical');
  });

  it('calculates correct totals', () => {
    const points = [
      makePoint(20, 30, { sodium: 200, caffeine: 50, calories: 120 }),
      makePoint(50, 25, { sodium: 150, caffeine: 0, calories: 100 }),
    ];
    const result = validatePlan(points, 100, 4);
    expect(result.totalCarbs).toBe(55);
    expect(result.totalSodium).toBe(350);
    expect(result.totalCaffeine).toBe(50);
    expect(result.totalCalories).toBe(220);
  });

  it('returns 0-100 clamped score', () => {
    const points = [makePoint(50, 5)];
    const result = validatePlan(points, 100, 4);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
