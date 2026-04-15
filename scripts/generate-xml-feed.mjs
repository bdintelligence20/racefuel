#!/usr/bin/env node

/**
 * Live XML Feed Generator for Fuel Lab Products
 * Fetches products from fuellab.co.za Shopify store and generates
 * a comprehensive XML data feed for the Energy & Endurance and
 * Hydration & Electrolytes collections.
 *
 * Usage: node scripts/generate-xml-feed.mjs
 * Output: public/products-feed.xml
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = process.env.FEED_OUTPUT_PATH || resolve(__dirname, '..', 'public', 'products-feed.xml');
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
    console.log(`  Fetching page ${page} for ${collectionHandle}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    if (!data.products || data.products.length === 0) break;
    products.push(...data.products);
    page++;
    // Safety: Shopify storefront API caps at 250 per page
    if (data.products.length < 250) break;
  }
  return products;
}

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// --- Nutrition extraction from description text ---

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
    // "55 g supply of carbohydrates", "22g of carbs", "30g carbohydrate"
    // Allow up to 4 words between "g" and "carb" to handle "g supply of", "g of fast-acting"
    /(\d+(?:\.\d+)?)\s*g\s+(?:[\w-]+\s+){0,4}carb/i,
    /(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?carb/i,
    // "carbohydrate: 22g", "carbs 30g"
    /carb[a-z]*[:\s]+(\d+(?:\.\d+)?)\s*g/i,
    // "delivers 30g", "providing 60g"
    /(?:deliver|provid)\w*\s+(\d+(?:\.\d+)?)\s*g/i,
    // "dual-source carbohydrate" patterns
    /(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?(?:dual|fast|slow|multi)/i,
    // "87g carbohydrates"
    /(\d+(?:\.\d+)?)\s*g\s+carb/i,
    // "Xg" near "energy" (within 3 words)
    /(\d+(?:\.\d+)?)\s*g\s+(?:[\w-]+\s+){0,3}energy/i,
    // "per serving" patterns: "30 g per"
    /(\d+(?:\.\d+)?)\s*g\s+per/i,
    // "Xg of protein" for protein products (fallback — use protein as carb proxy? no, skip)
  ]);

  const calories = extractNumber(t, [
    /(\d+)\s*(?:kcal|calories|cals)\b/i,
    /calories[:\s]+(\d+)/i,
    /(\d+)\s*kcal/i,
    /energy[:\s]+(\d+)\s*(?:kcal|cal)/i,
    // "less than 50 kcal" — take the number
    /(?:less than|under)\s+(\d+)\s*(?:kcal|cal)/i,
    // "200 Kcal per gel"
    /(\d+)\s*kcal\s+per/i,
  ]);

  const sodium = extractNumber(t, [
    /(\d+)\s*(?:mg)?\s*(?:of\s+)?sodium/i,
    /sodium[:\s]+(\d+)\s*mg/i,
    /sodium[:\s]+(\d+)/i,
    // "500mg sodium"
    /(\d+)\s*mg\s+sodium/i,
  ]);

  const caffeine = extractNumber(t, [
    /(\d+)\s*mg\s*(?:of\s+)?caffeine/i,
    /caffeine[:\s]+(\d+)\s*mg/i,
    /caffeine[:\s]+(\d+)/i,
    /with\s+(\d+)\s*mg\s+(?:of\s+)?caffeine/i,
    // "75mg caffeine"
    /(\d+)\s*mg\s+caffeine/i,
    // "caffeine 150mg"
    /caffeine\s+(\d+)\s*mg/i,
  ]);

  return { carbs, calories, sodium, caffeine };
}

function detectCategory(product) {
  const title = (product.title || '').toLowerCase();
  const tags = (typeof product.tags === 'string' ? product.tags : (product.tags || []).join(', ')).toLowerCase();
  const type = (product.product_type || '').toLowerCase();

  if (/gel/i.test(title) || /\bgel\b/.test(tags) || /\bgel\b/.test(type)) return 'gel';
  if (/\bbar\b/i.test(title) || /\bbar\b/.test(tags) || /\bbar\b/.test(type)) return 'bar';
  if (/chew|gumm|shot|blok/i.test(title) || /chew/.test(tags)) return 'chew';
  if (/drink|hydra|electrolyte|isotonic|mix\b|powder|tabs?$|tablet/i.test(title) || /drink/.test(tags) || /electrolyte/.test(tags) || /hydration/.test(tags)) return 'drink';

  return 'other';
}

function loadOverrides() {
  if (existsSync(OVERRIDES_PATH)) {
    try {
      return JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
    } catch { /* ignore parse errors */ }
  }
  return {};
}

function productToXml(product, collectionName, overrides) {
  const plainDesc = stripHtml(product.body_html);
  const parsed = extractNutrition(plainDesc);
  const category = detectCategory(product);
  const ovr = overrides[product.handle] || overrides[String(product.id)] || {};

  // Override wins > parsed from description > null
  const nutrition = {
    carbs: ovr.carbs ?? parsed.carbs,
    calories: ovr.calories ?? parsed.calories,
    sodium: ovr.sodium ?? parsed.sodium,
    caffeine: ovr.caffeine ?? parsed.caffeine,
  };
  const finalCategory = ovr.category || category;

  const lines = [];
  lines.push(`    <product>`);
  lines.push(`      <id>${escapeXml(product.id)}</id>`);
  lines.push(`      <title>${escapeXml(product.title)}</title>`);
  lines.push(`      <handle>${escapeXml(product.handle)}</handle>`);
  lines.push(`      <url>${escapeXml(`${SHOPIFY_BASE}/products/${product.handle}`)}</url>`);
  lines.push(`      <vendor>${escapeXml(product.vendor)}</vendor>`);
  lines.push(`      <product_type>${escapeXml(product.product_type)}</product_type>`);
  lines.push(`      <category>${escapeXml(finalCategory)}</category>`);
  lines.push(`      <collection>${escapeXml(collectionName)}</collection>`);

  // Structured nutrition per serving
  lines.push(`      <nutrition>`);
  lines.push(`        <carbs_g>${nutrition.carbs ?? ''}</carbs_g>`);
  lines.push(`        <calories>${nutrition.calories ?? ''}</calories>`);
  lines.push(`        <sodium_mg>${nutrition.sodium ?? ''}</sodium_mg>`);
  lines.push(`        <caffeine_mg>${nutrition.caffeine ?? ''}</caffeine_mg>`);
  lines.push(`        <source>${ovr.carbs != null ? 'override' : parsed.carbs != null ? 'parsed' : 'missing'}</source>`);
  lines.push(`      </nutrition>`);

  lines.push(`      <description>${escapeXml(plainDesc)}</description>`);
  lines.push(`      <description_html><![CDATA[${product.body_html || ''}]]></description_html>`);
  lines.push(`      <created_at>${escapeXml(product.created_at)}</created_at>`);
  lines.push(`      <updated_at>${escapeXml(product.updated_at)}</updated_at>`);
  lines.push(`      <published_at>${escapeXml(product.published_at)}</published_at>`);

  // Tags
  if (product.tags && product.tags.length > 0) {
    const tagList = typeof product.tags === 'string' ? product.tags.split(', ') : product.tags;
    lines.push(`      <tags>`);
    for (const tag of tagList) {
      lines.push(`        <tag>${escapeXml(tag.trim())}</tag>`);
    }
    lines.push(`      </tags>`);
  }

  // Options (e.g., Flavor, Size)
  if (product.options && product.options.length > 0) {
    lines.push(`      <options>`);
    for (const opt of product.options) {
      lines.push(`        <option>`);
      lines.push(`          <name>${escapeXml(opt.name)}</name>`);
      lines.push(`          <position>${opt.position}</position>`);
      if (opt.values) {
        lines.push(`          <values>`);
        for (const v of opt.values) {
          lines.push(`            <value>${escapeXml(v)}</value>`);
        }
        lines.push(`          </values>`);
      }
      lines.push(`        </option>`);
    }
    lines.push(`      </options>`);
  }

  // Variants
  if (product.variants && product.variants.length > 0) {
    lines.push(`      <variants>`);
    for (const v of product.variants) {
      lines.push(`        <variant>`);
      lines.push(`          <id>${escapeXml(v.id)}</id>`);
      lines.push(`          <title>${escapeXml(v.title)}</title>`);
      lines.push(`          <sku>${escapeXml(v.sku)}</sku>`);
      lines.push(`          <price>${escapeXml(v.price)}</price>`);
      lines.push(`          <compare_at_price>${escapeXml(v.compare_at_price)}</compare_at_price>`);
      lines.push(`          <option1>${escapeXml(v.option1)}</option1>`);
      lines.push(`          <option2>${escapeXml(v.option2)}</option2>`);
      lines.push(`          <option3>${escapeXml(v.option3)}</option3>`);
      lines.push(`          <weight>${v.grams || 0}</weight>`);
      lines.push(`          <weight_unit>g</weight_unit>`);
      lines.push(`          <requires_shipping>${v.requires_shipping ?? true}</requires_shipping>`);
      lines.push(`          <taxable>${v.taxable ?? true}</taxable>`);
      lines.push(`          <available>${v.available ?? false}</available>`);
      lines.push(`          <inventory_quantity>${v.inventory_quantity ?? ''}</inventory_quantity>`);
      lines.push(`          <inventory_policy>${escapeXml(v.inventory_policy)}</inventory_policy>`);
      lines.push(`          <barcode>${escapeXml(v.barcode)}</barcode>`);
      lines.push(`          <position>${v.position ?? ''}</position>`);
      if (v.featured_image) {
        lines.push(`          <featured_image>${escapeXml(v.featured_image.src || v.featured_image)}</featured_image>`);
      }
      lines.push(`        </variant>`);
    }
    lines.push(`      </variants>`);
  }

  // Images
  if (product.images && product.images.length > 0) {
    lines.push(`      <images>`);
    for (const img of product.images) {
      lines.push(`        <image>`);
      lines.push(`          <id>${escapeXml(img.id)}</id>`);
      lines.push(`          <src>${escapeXml(img.src)}</src>`);
      lines.push(`          <alt>${escapeXml(img.alt)}</alt>`);
      lines.push(`          <position>${img.position ?? ''}</position>`);
      lines.push(`          <width>${img.width ?? ''}</width>`);
      lines.push(`          <height>${img.height ?? ''}</height>`);
      if (img.variant_ids && img.variant_ids.length > 0) {
        lines.push(`          <variant_ids>`);
        for (const vid of img.variant_ids) {
          lines.push(`            <variant_id>${vid}</variant_id>`);
        }
        lines.push(`          </variant_ids>`);
      }
      lines.push(`        </image>`);
    }
    lines.push(`      </images>`);
  }

  lines.push(`    </product>`);
  return lines.join('\n');
}

async function main() {
  console.log('Generating Fuel Lab XML product feed...\n');

  const allProductsMap = new Map(); // deduplicate across collections

  for (const col of COLLECTIONS) {
    console.log(`Fetching collection: ${col.name} (${col.handle})`);
    const products = await fetchAllProducts(col.handle);
    console.log(`  Found ${products.length} products\n`);
    for (const p of products) {
      if (!allProductsMap.has(p.id)) {
        allProductsMap.set(p.id, { product: p, collections: [col.name] });
      } else {
        allProductsMap.get(p.id).collections.push(col.name);
      }
    }
  }

  const now = new Date().toISOString();
  const xmlParts = [];

  xmlParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  xmlParts.push(`<feed xmlns:g="http://base.google.com/ns/1.0">`);
  xmlParts.push(`  <title>Fuel Lab Product Feed</title>`);
  xmlParts.push(`  <link>${escapeXml(SHOPIFY_BASE)}</link>`);
  xmlParts.push(`  <description>Live product feed from fuellab.co.za — Energy &amp; Endurance and Hydration &amp; Electrolytes</description>`);
  xmlParts.push(`  <generated_at>${now}</generated_at>`);
  xmlParts.push(`  <currency>ZAR</currency>`);
  xmlParts.push(`  <total_products>${allProductsMap.size}</total_products>`);
  xmlParts.push(`  <collections>`);
  for (const col of COLLECTIONS) {
    xmlParts.push(`    <collection>`);
    xmlParts.push(`      <name>${escapeXml(col.name)}</name>`);
    xmlParts.push(`      <handle>${escapeXml(col.handle)}</handle>`);
    xmlParts.push(`      <url>${escapeXml(`${SHOPIFY_BASE}/collections/${col.handle}`)}</url>`);
    xmlParts.push(`    </collection>`);
  }
  xmlParts.push(`  </collections>`);
  const overrides = loadOverrides();
  console.log(`Loaded ${Object.keys(overrides).length} nutrition overrides\n`);

  xmlParts.push(`  <products>`);

  const missing = [];
  let parsedCount = 0;
  let overrideCount = 0;

  for (const [, entry] of allProductsMap) {
    const p = entry.product;
    const plainDesc = stripHtml(p.body_html);
    const parsed = extractNutrition(plainDesc);
    const ovr = overrides[p.handle] || overrides[String(p.id)] || {};
    const hasOverride = ovr.carbs != null;
    const hasParsed = parsed.carbs != null;

    if (hasOverride) overrideCount++;
    else if (hasParsed) parsedCount++;
    else missing.push({ handle: p.handle, title: p.title, id: p.id });

    xmlParts.push(productToXml(p, entry.collections.join(', '), overrides));
  }

  xmlParts.push(`  </products>`);
  xmlParts.push(`</feed>`);

  const xml = xmlParts.join('\n');
  writeFileSync(OUTPUT_PATH, xml, 'utf-8');

  const totalVariants = [...allProductsMap.values()].reduce(
    (sum, e) => sum + (e.product.variants?.length || 0),
    0
  );
  const totalImages = [...allProductsMap.values()].reduce(
    (sum, e) => sum + (e.product.images?.length || 0),
    0
  );

  console.log(`Done! XML feed written to: ${OUTPUT_PATH}`);
  console.log(`  Products: ${allProductsMap.size}`);
  console.log(`  Variants: ${totalVariants}`);
  console.log(`  Images:   ${totalImages}`);
  console.log(`\nNutrition extraction:`);
  console.log(`  Parsed from description: ${parsedCount}`);
  console.log(`  From overrides file:     ${overrideCount}`);
  console.log(`  Missing (need override): ${missing.length}`);

  if (missing.length > 0) {
    console.log(`\nProducts missing carb data — add to data/nutrition-overrides.json:`);
    for (const m of missing) {
      console.log(`  "${m.handle}": { "carbs": ?, "calories": ?, "sodium": ?, "caffeine": ? }  // ${m.title}`);
    }

    // Auto-generate a skeleton overrides file if none exists
    if (!existsSync(OVERRIDES_PATH)) {
      const skeleton = {};
      for (const m of missing) {
        skeleton[m.handle] = { carbs: null, calories: null, sodium: null, caffeine: null, category: null, _title: m.title };
      }
      writeFileSync(OVERRIDES_PATH, JSON.stringify(skeleton, null, 2), 'utf-8');
      console.log(`\nSkeleton overrides file created at: ${OVERRIDES_PATH}`);
    }
  }
}

main().catch((err) => {
  console.error('Error generating feed:', err);
  process.exit(1);
});
