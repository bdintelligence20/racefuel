import { NutritionPoint } from '../../context/AppContext';

export interface PlanCost {
  /** Per-serving cost of the products consumed on this run — the rand-equivalent
   *  of what actually gets eaten. Fair to label as "cost of this run". */
  runCostZAR: number;
  /** What the athlete has to buy: the full-pack price, rounded up by how many
   *  packs they need to cover the run's servings. Same or higher than runCost. */
  totalCostZAR: number;
  /** Breakdown per unique product used in the plan. Useful for the cart display. */
  lines: Array<{
    productId: string;
    brand: string;
    name: string;
    quantity: number;
    servingsPerPack: number;
    packPrice: number;
    packsRequired: number;
    runCost: number;
    totalCost: number;
  }>;
}

export function calculatePlanCost(points: NutritionPoint[]): PlanCost {
  const grouped = new Map<string, { product: NutritionPoint['product']; quantity: number }>();
  for (const pt of points) {
    const key = pt.product.id;
    const existing = grouped.get(key);
    if (existing) existing.quantity += 1;
    else grouped.set(key, { product: pt.product, quantity: 1 });
  }

  const lines: PlanCost['lines'] = [];
  let runCost = 0;
  let totalCost = 0;
  for (const [, { product, quantity }] of grouped) {
    const packPrice = product.priceZAR ?? 0;
    const servingsPerPack = Math.max(1, product.servingsPerPack ?? 1);
    const perServing = packPrice / servingsPerPack;
    const thisRunCost = perServing * quantity;
    const packsRequired = Math.max(1, Math.ceil(quantity / servingsPerPack));
    const thisTotalCost = packsRequired * packPrice;
    runCost += thisRunCost;
    totalCost += thisTotalCost;
    lines.push({
      productId: product.id,
      brand: product.brand,
      name: product.name,
      quantity,
      servingsPerPack,
      packPrice,
      packsRequired,
      runCost: Math.round(thisRunCost * 100) / 100,
      totalCost: Math.round(thisTotalCost * 100) / 100,
    });
  }

  return {
    runCostZAR: Math.round(runCost * 100) / 100,
    totalCostZAR: Math.round(totalCost * 100) / 100,
    lines,
  };
}
