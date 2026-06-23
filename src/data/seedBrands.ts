import { ProductProps } from '../components/NutritionCard';

/**
 * Seed brands the redesign brief mandates: products endurance athletes
 * actually use but that Fuel Lab does NOT currently stock. They exist in the
 * product database as *plannable-but-not-deliverable* so a beginner like Anina
 * — who couldn't find USN and felt stupid — can build a complete, accurate
 * plan around the products they already own.
 *
 * Each carries `deliverable: false` and no `variantId`, so:
 *  - they appear in every picker with a "Bring your own" badge,
 *  - they place on the route and export to the watch as cues like any product,
 *  - they're excluded from the cart at checkout and listed under
 *    "you're supplying these yourself".
 *
 * SKU coverage is the real product ranges, sourced from each brand's site
 * (June 2026): Maurten, Tailwind, USN (Vooma/Race Fuel), Biogen (Elite/Real
 * Food), Cadence (Energy Gel/CarboFuel/Marathon). Maurten's carb figures are
 * exact; the rest use the brands' published carbs where given and brand-typical
 * sodium/caffeine where the label wasn't public. These are best-effort starting
 * values — Brad & Scott will provide the authoritative per-serving numbers and
 * the accurate deliverable flags at launch; `deliverable` is the only thing
 * that gates the cart, so a wrong sodium value never sells the wrong product.
 *
 * 32Gi is intentionally absent: Fuel Lab already stocks it, so it comes through
 * the live feed as deliverable SKUs. Cadence is in the brief as already-stocked
 * too, but it isn't in the live feed yet, so it's seeded here as bring-your-own
 * and auto-upgrades to deliverable (via the brand-dedup guard in products.ts)
 * the moment it lands in the feed. This is the STARTING list, not the final one
 * — expect it to grow from the "Can't find it? Tell us" requests.
 */
export const SEED_BRAND_PRODUCTS: ProductProps[] = [
  // ── Maurten ── hydrogel; gels are sodium-free, drink mixes carry sodium. Carbs exact.
  { id: 'seed-maurten-gel-100',          brand: 'Maurten', name: 'GEL 100',            calories: 100, carbs: 25, sodium: 0,   caffeine: 0,   color: 'orange', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-maurten-gel-100-caf',      brand: 'Maurten', name: 'GEL 100 CAF 100',    calories: 100, carbs: 25, sodium: 0,   caffeine: 100, color: 'orange', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-maurten-gel-160',          brand: 'Maurten', name: 'GEL 160',            calories: 160, carbs: 40, sodium: 0,   caffeine: 0,   color: 'orange', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-maurten-solid-160',        brand: 'Maurten', name: 'SOLID 160',          calories: 160, carbs: 43, sodium: 0,   caffeine: 0,   color: 'orange', priceZAR: 0, image: '', category: 'bar',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-maurten-drink-mix-160',    brand: 'Maurten', name: 'DRINK MIX 160',      calories: 160, carbs: 40, sodium: 200, caffeine: 0,   color: 'orange', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-maurten-drink-mix-320',    brand: 'Maurten', name: 'DRINK MIX 320',      calories: 320, carbs: 80, sodium: 400, caffeine: 0,   color: 'orange', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-maurten-drink-mix-320-caf',brand: 'Maurten', name: 'DRINK MIX 320 CAF 100', calories: 320, carbs: 80, sodium: 400, caffeine: 100, color: 'orange', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },

  // ── Tailwind ── all-in-one drink mix; values per single-serve stickpack.
  { id: 'seed-tailwind-endurance-fuel',     brand: 'Tailwind', name: 'Endurance Fuel',              calories: 200, carbs: 50, sodium: 620, caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-tailwind-endurance-fuel-caf', brand: 'Tailwind', name: 'Caffeinated Endurance Fuel',  calories: 200, carbs: 50, sodium: 620, caffeine: 70, color: 'green', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-tailwind-high-carb',          brand: 'Tailwind', name: 'High Carb',                   calories: 240, carbs: 60, sodium: 300, caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-tailwind-rapid-hydration',    brand: 'Tailwind', name: 'Rapid Hydration',             calories: 45,  carbs: 11, sodium: 470, caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },

  // ── USN ── the brand Anina went looking for; SA endurance line is Vooma + Race Fuel.
  { id: 'seed-usn-vooma-gel',          brand: 'USN', name: 'Vooma Energy Gel',           calories: 128, carbs: 32, sodium: 40,  caffeine: 0,  color: 'blue', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-usn-vooma-gel-caf',      brand: 'USN', name: 'Vooma Energy Gel + Caffeine', calories: 128, carbs: 32, sodium: 40,  caffeine: 75, color: 'blue', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-usn-vooma-ultra-gel',    brand: 'USN', name: 'Vooma Ultra Energy Gel',     calories: 100, carbs: 25, sodium: 30,  caffeine: 0,  color: 'blue', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-usn-iso-fuel-gel',       brand: 'USN', name: 'Iso Fuel Gel',               calories: 160, carbs: 40, sodium: 50,  caffeine: 0,  color: 'blue', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-usn-carb-race-fuel-300', brand: 'USN', name: 'Carb Race Fuel 300',         calories: 240, carbs: 60, sodium: 300, caffeine: 80, color: 'blue', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-usn-immune-hydrator',    brand: 'USN', name: 'Super-Immune Hydrator',      calories: 32,  carbs: 8,  sodium: 300, caffeine: 0,  color: 'blue', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },

  // ── Biogen ── Elite Carb + Real Food gel lines, electrolyte jellies, Cyclone drink.
  { id: 'seed-biogen-elite-carb-gel',      brand: 'Biogen', name: 'Elite Carb Energy Gel',            calories: 160, carbs: 40, sodium: 30,  caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-biogen-elite-carb-gel-60',   brand: 'Biogen', name: 'Elite Carb Energy Gel 60g',        calories: 180, carbs: 45, sodium: 30,  caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-biogen-real-food-gel',       brand: 'Biogen', name: 'Real Food Based Energy Gel',       calories: 100, carbs: 25, sodium: 40,  caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-biogen-real-food-gel-cocoa', brand: 'Biogen', name: 'Real Food Energy Gel (Cocoa, Caffeine)', calories: 100, carbs: 25, sodium: 40, caffeine: 36, color: 'green', priceZAR: 0, image: '', category: 'gel', servingsPerPack: 1, deliverable: false },
  { id: 'seed-biogen-energy-chews',        brand: 'Biogen', name: 'Energy Chews Electrolyte Jellies',  calories: 144, carbs: 30, sodium: 125, caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'chew',  servingsPerPack: 1, deliverable: false },
  { id: 'seed-biogen-cyclone',             brand: 'Biogen', name: 'Cyclone',                          calories: 170, carbs: 42, sodium: 110, caffeine: 0,  color: 'green', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },

  // ── Cadence ── SA brand; real SKUs: Energy Gel, CarboFuel, Marathon, bars.
  { id: 'seed-cadence-gel-citrus',     brand: 'Cadence', name: 'Energy Gel (Citrus)',       calories: 100, carbs: 25, sodium: 55,  caffeine: 0,   color: 'red', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-cadence-gel-mango',      brand: 'Cadence', name: 'Energy Gel (Mango)',        calories: 100, carbs: 25, sodium: 55,  caffeine: 0,   color: 'red', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-cadence-gel-caf',        brand: 'Cadence', name: 'Energy Gel + Caffeine',     calories: 100, carbs: 25, sodium: 55,  caffeine: 100, color: 'red', priceZAR: 0, image: '', category: 'gel',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-cadence-carbofuel',      brand: 'Cadence', name: 'CarboFuel',                 calories: 160, carbs: 40, sodium: 300, caffeine: 0,   color: 'red', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-cadence-marathon',       brand: 'Cadence', name: 'Marathon (Carb + Protein)', calories: 200, carbs: 40, sodium: 300, caffeine: 0,   color: 'red', priceZAR: 0, image: '', category: 'drink', servingsPerPack: 1, deliverable: false },
  { id: 'seed-cadence-bar-redberry',   brand: 'Cadence', name: 'CarboFuel Bar (Red Berry)', calories: 170, carbs: 30, sodium: 50,  caffeine: 0,   color: 'red', priceZAR: 0, image: '', category: 'bar',   servingsPerPack: 1, deliverable: false },
  { id: 'seed-cadence-bar-choc',       brand: 'Cadence', name: 'CarboFuel Bar (Salted Choc Caramel)', calories: 170, carbs: 30, sodium: 50, caffeine: 0, color: 'red', priceZAR: 0, image: '', category: 'bar', servingsPerPack: 1, deliverable: false },
];
