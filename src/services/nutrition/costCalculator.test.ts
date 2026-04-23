import { describe, it, expect } from 'vitest';
import type { NutritionPoint } from '../../context/AppContext';
import type { ProductProps } from '../../components/NutritionCard';
import { calculatePlanCost } from './costCalculator';

function pt(product: ProductProps, km: number): NutritionPoint {
  return { id: `pt-${km}-${product.id}`, distanceKm: km, product };
}

const gel: ProductProps = {
  id: 'gel-30', brand: 'AcmeGels', name: 'Race Gel', carbs: 30, calories: 110, sodium: 50, caffeine: 0,
  category: 'gel', color: 'orange', priceZAR: 35, image: '', servingsPerPack: 1,
};

const tub20: ProductProps = {
  id: 'tub-20', brand: 'AcmeMix', name: 'Endurance Mix 900g', carbs: 45, calories: 190, sodium: 350, caffeine: 0,
  category: 'drink', color: 'blue', priceZAR: 400, image: '', servingsPerPack: 20,
};

const tub15: ProductProps = {
  id: 'tub-15', brand: 'Beta', name: 'Tub', carbs: 40, calories: 170, sodium: 300, caffeine: 0,
  category: 'drink', color: 'blue', priceZAR: 300, image: '', servingsPerPack: 15,
};

describe('calculatePlanCost', () => {
  it('single-serve products: run cost equals pack price times quantity', () => {
    const cost = calculatePlanCost([pt(gel, 5), pt(gel, 10), pt(gel, 15)]);
    expect(cost.runCostZAR).toBe(35 * 3);
    expect(cost.totalCostZAR).toBe(35 * 3);
  });

  it('tub servings: run cost is per-serving, total is full pack', () => {
    // 3 servings of a 20-serving R400 tub → run cost = 60 (3 × 20), total = 400 (one tub)
    const cost = calculatePlanCost([pt(tub20, 5), pt(tub20, 10), pt(tub20, 15)]);
    expect(cost.runCostZAR).toBe(60);
    expect(cost.totalCostZAR).toBe(400);
  });

  it('tub overflow: rounds up to the number of packs the athlete needs', () => {
    // 22 servings of a 20-serving tub → need 2 tubs
    const points = Array.from({ length: 22 }, (_, i) => pt(tub20, i + 1));
    const cost = calculatePlanCost(points);
    expect(cost.runCostZAR).toBe(22 * 20); // 22 × R20/serving
    expect(cost.totalCostZAR).toBe(800); // 2 × R400
  });

  it('mixed cart: totals combine single-serve + tub correctly', () => {
    // 2 gels (R35 each) + 4 servings of a 15-serving R300 tub
    const points = [pt(gel, 5), pt(gel, 20), pt(tub15, 8), pt(tub15, 12), pt(tub15, 16), pt(tub15, 20)];
    const cost = calculatePlanCost(points);
    // run: 2*35 + 4*20 = 70 + 80 = 150
    // total: 2*35 + 1*300 = 70 + 300 = 370
    expect(cost.runCostZAR).toBe(150);
    expect(cost.totalCostZAR).toBe(370);
  });

  it('exposes a per-product line breakdown', () => {
    const cost = calculatePlanCost([pt(gel, 5), pt(tub20, 10), pt(tub20, 15)]);
    const gelLine = cost.lines.find((l) => l.productId === 'gel-30');
    const tubLine = cost.lines.find((l) => l.productId === 'tub-20');
    expect(gelLine?.quantity).toBe(1);
    expect(gelLine?.packsRequired).toBe(1);
    expect(tubLine?.quantity).toBe(2);
    expect(tubLine?.packsRequired).toBe(1);
    expect(tubLine?.runCost).toBe(40); // 2 × R20
    expect(tubLine?.totalCost).toBe(400); // one tub
  });

  it('missing servingsPerPack defaults to 1 (treats it as single-serve)', () => {
    const rawTub = { ...tub20, servingsPerPack: undefined };
    const cost = calculatePlanCost([pt(rawTub, 5), pt(rawTub, 10)]);
    expect(cost.runCostZAR).toBe(800);
    expect(cost.totalCostZAR).toBe(800);
  });
});
