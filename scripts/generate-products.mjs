#!/usr/bin/env node

/**
 * Generates src/data/products.ts from the Fuel Lab XML feed data.
 * Fetches live from the Shopify API + nutrition overrides and writes
 * the TypeScript product array used by the app.
 *
 * Usage: node scripts/generate-products.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'src', 'data', 'products.ts');
const OVERRIDES_PATH = resolve(__dirname, '..', 'data', 'nutrition-overrides.json');

const SHOPIFY_BASE = 'https://www.fuellab.co.za';
const COLLECTIONS = [
  { handle: 'energy-endurance-1', name: 'Energy & Endurance' },
  { handle: 'electrolyte-powders-tablets-1', name: 'Hydration & Electrolytes' },
];

async function fetchAllProducts(collectionHandle) {
  const products = [];
  let page = 1;
  while (true) {
    const url = `${SHOPIFY_BASE}/collections/${collectionHandle}/products.json?limit=250&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    if (!data.products || data.products.length === 0) break;
    products.push(...data.products);
    page++;
    if (data.products.length < 250) break;
  }
  return products;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function extractNumber(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function extractNutrition(text) {
  if (!text) return { carbs: null, calories: null, sodium: null, caffeine: null };
  const t = text.toLowerCase();

  const carbs = extractNumber(t, [
    /(\d+(?:\.\d+)?)\s*g\s+(?:[\w-]+\s+){0,4}carb/i,
    /(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?carb/i,
    /carb[a-z]*[:\s]+(\d+(?:\.\d+)?)\s*g/i,
    /(?:deliver|provid)\w*\s+(\d+(?:\.\d+)?)\s*g/i,
    /(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?(?:dual|fast|slow|multi)/i,
    /(\d+(?:\.\d+)?)\s*g\s+carb/i,
    /(\d+(?:\.\d+)?)\s*g\s+(?:[\w-]+\s+){0,3}energy/i,
    /(\d+(?:\.\d+)?)\s*g\s+per/i,
  ]);

  const calories = extractNumber(t, [
    /(\d+)\s*(?:kcal|calories|cals)\b/i,
    /(\d+)\s*kcal/i,
    /(\d+)\s*kcal\s+per/i,
  ]);

  const sodium = extractNumber(t, [
    /(\d+)\s*(?:mg)?\s*(?:of\s+)?sodium/i,
    /sodium[:\s]+(\d+)/i,
  ]);

  const caffeine = extractNumber(t, [
    /(\d+)\s*mg\s*(?:of\s+)?caffeine/i,
    /caffeine[:\s]+(\d+)/i,
    /caffeine\s+(\d+)\s*mg/i,
  ]);

  return { carbs, calories, sodium, caffeine };
}

function detectCategory(product) {
  const title = (product.title || '').toLowerCase();
  const tags = (typeof product.tags === 'string' ? product.tags : (product.tags || []).join(', ')).toLowerCase();

  if (/gel/i.test(title) || /\bgel\b/.test(tags)) return 'gel';
  if (/\bbar\b/i.test(title) || /\bbar\b/.test(tags)) return 'bar';
  if (/chew|gumm|shot|blok/i.test(title) || /chew/.test(tags)) return 'chew';
  if (/drink|hydra|electrolyte|isotonic|mix\b|powder|tabs?$|tablet/i.test(title) || /drink/.test(tags) || /electrolyte/.test(tags) || /hydration/.test(tags)) return 'drink';
  return 'gel'; // default fallback
}

// Assign a color based on brand for visual variety
function brandColor(vendor) {
  const v = (vendor || '').toLowerCase();
  const map = {
    '226ers': 'orange',
    '32gi': 'green',
    'styrkr': 'blue',
    'skratch': 'yellow',
    'high five': 'red',
    'enduren': 'green',
    'never second': 'orange',
    'neversecond': 'orange',
    'named sport': 'blue',
    'pace': 'red',
    'pvm': 'orange',
    'powerbar': 'red',
    'science in sport': 'blue',
    'blast': 'blue',
    '13 nutrition': 'green',
    'nutricon': 'red',
    'nutritech': 'red',
    'racefood': 'yellow',
    'sport rx': 'orange',
    'fixx': 'green',
    'open fuel': 'yellow',
  };
  for (const [key, color] of Object.entries(map)) {
    if (v.includes(key)) return color;
  }
  return 'white';
}

async function main() {
  console.log('Generating products.ts from Fuel Lab feed...\n');

  const overrides = existsSync(OVERRIDES_PATH)
    ? JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'))
    : {};

  const allProductsMap = new Map();
  for (const col of COLLECTIONS) {
    console.log(`Fetching: ${col.name}`);
    const products = await fetchAllProducts(col.handle);
    console.log(`  ${products.length} products`);
    for (const p of products) {
      if (!allProductsMap.has(p.id)) allProductsMap.set(p.id, p);
    }
  }

  const entries = [];
  for (const [, p] of allProductsMap) {
    const plainDesc = stripHtml(p.body_html);
    const parsed = extractNutrition(plainDesc);
    const ovr = overrides[p.handle] || overrides[String(p.id)] || {};

    const carbs = ovr.carbs ?? parsed.carbs ?? 0;
    const calories = ovr.calories ?? parsed.calories ?? 0;
    const sodium = ovr.sodium ?? parsed.sodium ?? 0;
    const caffeine = ovr.caffeine ?? parsed.caffeine ?? 0;
    let category = ovr.category || detectCategory(p);

    // Skip non-sport categories (creatine, protein-only, supplements) unless they have meaningful carbs
    if (category === 'other' && carbs < 10) continue;
    // Map 'other' to 'drink' for products that passed the carbs threshold
    if (category === 'other') category = 'drink';

    const firstImage = p.images?.[0]?.src || '';
    const price = p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : 0;
    const color = brandColor(p.vendor);

    entries.push({
      id: p.handle,
      brand: p.vendor,
      name: p.title.replace(p.vendor, '').replace(/^\s*[-–]\s*/, '').trim() || p.title,
      calories,
      carbs,
      sodium,
      caffeine,
      color,
      priceZAR: price,
      image: firstImage,
      category,
    });
  }

  // Sort: gels first, then drinks, bars, chews
  const catOrder = { gel: 0, drink: 1, bar: 2, chew: 3 };
  entries.sort((a, b) => (catOrder[a.category] ?? 9) - (catOrder[b.category] ?? 9) || a.brand.localeCompare(b.brand));

  const ts = `import { ProductProps } from '../components/NutritionCard';

// Auto-generated from Fuel Lab (fuellab.co.za) product feed
// Run: npm run generate-products
// Last generated: ${new Date().toISOString()}

export const products: ProductProps[] = [
${entries.map(e => `  ${JSON.stringify(e)},`).join('\n')}
];

// Helper function to get products by category
export function getProductsByCategory(category: ProductProps['category']): ProductProps[] {
  return products.filter(p => p.category === category);
}

// Helper function to get all gels
export function getGels(): ProductProps[] {
  return getProductsByCategory('gel');
}

// Helper function to get all drinks
export function getDrinks(): ProductProps[] {
  return getProductsByCategory('drink');
}

// Helper function to get all bars
export function getBars(): ProductProps[] {
  return getProductsByCategory('bar');
}

// Helper function to get all chews
export function getChews(): ProductProps[] {
  return getProductsByCategory('chew');
}

// Search products by name or brand
export function searchProducts(query: string): ProductProps[] {
  const lowerQuery = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.brand.toLowerCase().includes(lowerQuery)
  );
}
`;

  writeFileSync(OUTPUT_PATH, ts, 'utf-8');
  console.log(`\nDone! Written ${entries.length} products to ${OUTPUT_PATH}`);
  console.log(`  Gels: ${entries.filter(e => e.category === 'gel').length}`);
  console.log(`  Drinks: ${entries.filter(e => e.category === 'drink').length}`);
  console.log(`  Bars: ${entries.filter(e => e.category === 'bar').length}`);
  console.log(`  Chews: ${entries.filter(e => e.category === 'chew').length}`);
  console.log(`  Skipped (supplements/protein): ${allProductsMap.size - entries.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
