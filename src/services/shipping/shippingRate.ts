/**
 * Fuel Lab shipping rates.
 *
 * Single rule, set by the merchant: R140 flat for orders under R999,
 * free over R999 (rising courier fees triggered the rate, but big
 * baskets absorb the cost). One source of truth so CartModal,
 * CheckoutModal and any future totals row stay in lockstep.
 */

export const FUEL_LAB_SHIPPING = {
  flatRateZAR: 140,
  freeShippingThresholdZAR: 999,
} as const;

export interface ShippingResult {
  amountZAR: number;
  isFree: boolean;
  /** Threshold for free shipping (R999). Useful for "spend R{remaining} more for free shipping" UX. */
  freeAtZAR: number;
  /** Currency-formatted explanation, e.g. "Free over R999". */
  reason: string;
}

export function calculateShipping(subtotalZAR: number): ShippingResult {
  const { flatRateZAR, freeShippingThresholdZAR } = FUEL_LAB_SHIPPING;
  if (subtotalZAR >= freeShippingThresholdZAR) {
    return {
      amountZAR: 0,
      isFree: true,
      freeAtZAR: freeShippingThresholdZAR,
      reason: `Free shipping (over R${freeShippingThresholdZAR})`,
    };
  }
  return {
    amountZAR: flatRateZAR,
    isFree: false,
    freeAtZAR: freeShippingThresholdZAR,
    reason: `R${flatRateZAR} flat (free over R${freeShippingThresholdZAR})`,
  };
}
