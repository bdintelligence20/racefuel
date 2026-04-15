export type BundleTier = 'starter' | 'standard' | 'premium';

export interface ProductBundle {
  id: string;
  name: string;
  description: string;
  tier: BundleTier;
  products: { productId: string; quantity: number }[];
  priceZAR: number;
  retailPriceZAR: number;
  targetDistance: string;
}

export const bundles: ProductBundle[] = [
  // Starter Tier
  {
    id: 'starter-5k-10k',
    name: 'First Race Pack',
    description: 'Everything you need for your first 5K-10K',
    tier: 'starter',
    products: [
      { productId: 'high-five-energy-gel', quantity: 2 },
      { productId: 'high-five-zero-hydration', quantity: 1 },
    ],
    priceZAR: 140,
    retailPriceZAR: 165,
    targetDistance: '5K - 10K',
  },
  {
    id: 'starter-half',
    name: 'Half Marathon Starter',
    description: 'Budget-friendly nutrition for your half marathon',
    tier: 'starter',
    products: [
      { productId: '32gi-sport-gel', quantity: 3 },
      { productId: '32gi-hydrate-tabs', quantity: 1 },
      { productId: '32gi-chews', quantity: 1 },
    ],
    priceZAR: 220,
    retailPriceZAR: 265,
    targetDistance: 'Half Marathon',
  },

  // Standard Tier
  {
    id: 'standard-marathon',
    name: 'Marathon Fuel Pack',
    description: 'Proven nutrition strategy for the full 42.2km',
    tier: 'standard',
    products: [
      { productId: 'science-in-sport-go-isotonic-energy-gel', quantity: 4 },
      { productId: 'science-in-sport-beta-fuel-gel', quantity: 2 },
      { productId: 'high-five-energy-gummies', quantity: 2 },
      { productId: 'skratch-labs-sport-hydration', quantity: 1 },
    ],
    priceZAR: 420,
    retailPriceZAR: 500,
    targetDistance: 'Marathon',
  },
  {
    id: 'standard-trail',
    name: 'Trail Runner Kit',
    description: 'Mixed nutrition for trail runs with varied terrain',
    tier: 'standard',
    products: [
      { productId: 'enduren-endurance-energy-gel', quantity: 3 },
      { productId: 'enduren-endurance-energy-gel-with-caffeine', quantity: 2 },
      { productId: 'enduren-energy-bar', quantity: 2 },
      { productId: 'enduren-zero-sports-drink-mix', quantity: 1 },
    ],
    priceZAR: 380,
    retailPriceZAR: 450,
    targetDistance: 'Trail 20-50K',
  },
  {
    id: 'standard-cycling',
    name: 'Century Ride Pack',
    description: 'Sustained energy for 100km+ cycling events',
    tier: 'standard',
    products: [
      { productId: 'styrkr-gel-30', quantity: 4 },
      { productId: 'styrkr-mix-90', quantity: 2 },
      { productId: 'styrkr-bar-50', quantity: 2 },
      { productId: 'styrkr-slt', quantity: 1 },
    ],
    priceZAR: 480,
    retailPriceZAR: 570,
    targetDistance: '100km+ Cycling',
  },

  // Premium Tier
  {
    id: 'premium-ultra',
    name: 'Ultra Endurance Pro',
    description: 'Premium nutrition for ultra-distance events (50K+)',
    tier: 'premium',
    products: [
      { productId: 'neversecond-c30energy-gels-60ml', quantity: 4 },
      { productId: 'neversecond-c30energy-gels-caffeine-60ml', quantity: 2 },
      { productId: 'neversecond-c90-high-carb-drink-mix-94g', quantity: 2 },
      { productId: 'neversecond-c30-fuel-bar-45g', quantity: 2 },
      { productId: 'skratch-labs-energy-chews', quantity: 2 },
    ],
    priceZAR: 750,
    retailPriceZAR: 910,
    targetDistance: 'Ultra 50K+',
  },
  {
    id: 'premium-226ers',
    name: '226ERS Race Day',
    description: 'Full 226ERS race nutrition system',
    tier: 'premium',
    products: [
      { productId: '226ers-high-fructose-gel', quantity: 4 },
      { productId: '226ers-isotonic-gel', quantity: 2 },
      { productId: '226ers-high-fructose-energy-drink', quantity: 2 },
      { productId: '226ers-energy-drink-sub-9', quantity: 2 },
      { productId: '226ers-hydrazero', quantity: 1 },
    ],
    priceZAR: 820,
    retailPriceZAR: 980,
    targetDistance: 'Ironman / Long Triathlon',
  },
  {
    id: 'premium-comrades',
    name: 'Comrades Pack',
    description: "South Africa's iconic ultra — fueled properly",
    tier: 'premium',
    products: [
      { productId: '32gi-race-pro-gel', quantity: 4 },
      { productId: '32gi-endure-drink', quantity: 3 },
      { productId: '32gi-chews', quantity: 3 },
      { productId: 'pvm-octane-gel', quantity: 2 },
      { productId: '32gi-race-bar', quantity: 2 },
    ],
    priceZAR: 650,
    retailPriceZAR: 790,
    targetDistance: 'Comrades / 89km',
  },
];
