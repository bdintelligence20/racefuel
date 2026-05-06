#!/usr/bin/env node

/**
 * Live XML Feed Generator for Fuel Lab Products
 *
 * Pulls products from fuellab.co.za Shopify storefront API and emits a
 * structured XML feed for the Energy & Endurance and Hydration & Electrolytes
 * collections. Per-product nutrition data is resolved via a priority chain:
 *
 *   1. data/nutrition-overrides.json   — manual curation, always wins
 *   2. data/nutrition-cache.json       — previous AI/regex extractions, keyed
 *                                        by (handle, descriptionHash) so a
 *                                        description edit invalidates the row
 *   3. Description regex extraction    — cheap, deterministic, handles
 *                                        well-formatted vendor copy
 *   4. Gemini extraction               — VITE_GEMINI_API_KEY required;
 *                                        fills the gap for products that
 *                                        bury nutrition in marketing prose
 *                                        ("100-calorie packets" etc.). Only
 *                                        runs for products with at least one
 *                                        missing field after regex. Results
 *                                        are written back to the cache file
 *                                        so subsequent builds are free.
 *   5. null                            — surfaces in the "Missing" list at
 *                                        the bottom so a maintainer can
 *                                        add an override.
 *
 * Usage: node scripts/generate-xml-feed.mjs
 * Output: public/products-feed.xml
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = process.env.FEED_OUTPUT_PATH || resolve(__dirname, '..', 'public', 'products-feed.xml');
const OVERRIDES_PATH = resolve(__dirname, '..', 'data', 'nutrition-overrides.json');
const CACHE_PATH = resolve(__dirname, '..', 'data', 'nutrition-cache.json');

const SHOPIFY_BASE = 'https://www.fuellab.co.za';
const COLLECTIONS = [
  { handle: 'energy-endurance-1', name: 'Energy & Endurance' },
  { handle: 'electrolyte-powders-tablets-1', name: 'Hydration & Electrolytes' },
];

// Gemini config — same model the planner uses, thinkingBudget 0 keeps
// per-call latency around ~1-2s. The structured output schema gives us
// strict JSON back so parsing is reliable.
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_CONCURRENCY = 8;

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

// ────────────────────────────────────────────────────────────────────────
// Regex extraction (cheap path — runs first, often enough for well-
// formatted vendor copy)
// ────────────────────────────────────────────────────────────────────────

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
    /(\d+(?:\.\d+)?)\s*g\s+(?:[\w-]+\s+){0,4}carb/i,
    /(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?carb/i,
    // "carbohydrate: 22g", "carbs 30g"
    /carb[a-z]*[:\s]+(\d+(?:\.\d+)?)\s*g/i,
    // "delivers 30g", "providing 60g"
    /(?:deliver|provid)\w*\s+(\d+(?:\.\d+)?)\s*g/i,
    /(\d+(?:\.\d+)?)\s*g\s*(?:of\s+)?(?:dual|fast|slow|multi)/i,
    /(\d+(?:\.\d+)?)\s*g\s+carb/i,
    /(\d+(?:\.\d+)?)\s*g\s+(?:[\w-]+\s+){0,3}energy/i,
    /(\d+(?:\.\d+)?)\s*g\s+per/i,
  ]);

  const calories = extractNumber(t, [
    /(\d+)\s*(?:kcal|calories|cals)\b/i,
    /calories[:\s]+(\d+)/i,
    /(\d+)\s*kcal/i,
    /energy[:\s]+(\d+)\s*(?:kcal|cal)/i,
    /(?:less than|under)\s+(\d+)\s*(?:kcal|cal)/i,
    /(\d+)\s*kcal\s+per/i,
    // "100-calorie packets" / "100-cal sachet" — hyphenated compound
    /(\d+)-(?:calorie|cal|kcal)/i,
    // "100 calorie" with no unit attached after "the X-calorie packets"
    /(\d+)\s+calorie\s+(?:packet|sachet|gel|bar|serv)/i,
  ]);

  const sodium = extractNumber(t, [
    /(\d+)\s*(?:mg)?\s*(?:of\s+)?sodium/i,
    /sodium[:\s]+(\d+)\s*mg/i,
    /sodium[:\s]+(\d+)/i,
    /(\d+)\s*mg\s+sodium/i,
  ]);

  const caffeine = extractNumber(t, [
    /(\d+)\s*mg\s*(?:of\s+)?caffeine/i,
    /caffeine[:\s]+(\d+)\s*mg/i,
    /caffeine[:\s]+(\d+)/i,
    /with\s+(\d+)\s*mg\s+(?:of\s+)?caffeine/i,
    /(\d+)\s*mg\s+caffeine/i,
    /caffeine\s+(\d+)\s*mg/i,
  ]);

  return { carbs, calories, sodium, caffeine };
}

// ────────────────────────────────────────────────────────────────────────
// Gemini extraction (filling the gap when regex misses)
// ────────────────────────────────────────────────────────────────────────

const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    carbs_g: { type: 'number', nullable: true },
    calories: { type: 'number', nullable: true },
    sodium_mg: { type: 'number', nullable: true },
    caffeine_mg: { type: 'number', nullable: true },
  },
};

function aiPrompt(product, plainDesc) {
  const tags = Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || '');
  return `You extract per-serving nutrition for sports-nutrition products. The athlete eats ONE sachet/gel/bar/scoop at a time — return per-serving values, never per-pack.

Title: ${product.title}
Vendor: ${product.vendor || 'unknown'}
Type: ${product.product_type || 'unknown'}
Tags: ${tags}

Description:
${plainDesc.slice(0, 2000)}

Rules:
1. Return null for any field the description doesn't explicitly support. Do not guess.
2. carbs_g and sodium_mg and caffeine_mg are PER SERVING (one gel, one bar, one sachet, one scoop of drink mix).
3. For drink mixes sold as a tub, return per-scoop nutrition if stated, else null.
4. If the description says "100-calorie packets" or "100-cal" → calories: 100.
5. For multi-flavour products with different nutrition per flavour, return the most common (or first) flavour's values.
6. If the product is a non-fueling supplement (creatine, BCAAs, salt tabs with 0g carbs), return carbs_g: 0 (not null).

Return strict JSON: {"carbs_g": …, "calories": …, "sodium_mg": …, "caffeine_mg": …}`;
}

async function aiExtractOne(product, plainDesc) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: aiPrompt(product, plainDesc) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn(`  AI extract failed for ${product.handle}: HTTP ${res.status} — ${errText.slice(0, 100)}`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return {
      carbs: typeof parsed.carbs_g === 'number' ? parsed.carbs_g : null,
      calories: typeof parsed.calories === 'number' ? parsed.calories : null,
      sodium: typeof parsed.sodium_mg === 'number' ? parsed.sodium_mg : null,
      caffeine: typeof parsed.caffeine_mg === 'number' ? parsed.caffeine_mg : null,
    };
  } catch (err) {
    console.warn(`  AI extract error for ${product.handle}: ${err.message}`);
    return null;
  }
}

// Run AI extractions in parallel batches so 16 products take ~3s, not 30s.
// Returns { results, usefulCount } — usefulCount is products where Gemini
// returned at least one non-null field. Lots of products have descriptions
// that are pure marketing prose with zero numbers; Gemini correctly returns
// null for those, and we shouldn't claim a "recovery" we didn't make.
async function aiExtractMany(items) {
  const results = new Map();
  let usefulCount = 0;
  for (let i = 0; i < items.length; i += GEMINI_CONCURRENCY) {
    const batch = items.slice(i, i + GEMINI_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async ({ product, plainDesc }) => ({
        handle: product.handle,
        nutrition: await aiExtractOne(product, plainDesc),
      })),
    );
    for (const r of batchResults) {
      if (r.nutrition) {
        results.set(r.handle, r.nutrition);
        const hasAny = r.nutrition.carbs != null
          || r.nutrition.calories != null
          || r.nutrition.sodium != null
          || r.nutrition.caffeine != null;
        if (hasAny) usefulCount++;
      }
    }
  }
  return { results, usefulCount };
}

// ────────────────────────────────────────────────────────────────────────
// Cache (disk-backed, keyed by handle + descriptionHash)
// ────────────────────────────────────────────────────────────────────────

function hashDesc(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}

function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
  } catch { return {}; }
}

function saveCache(cache) {
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// ────────────────────────────────────────────────────────────────────────

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

/**
 * Resolve nutrition for one product through the priority chain.
 * Returns { nutrition, source } where source is one of:
 *   'override' | 'parsed' | 'cache' | 'ai' | 'mixed' | 'missing'
 */
function resolveNutrition(product, plainDesc, overrides, cache, aiResults) {
  const ovr = overrides[product.handle] || overrides[String(product.id)] || {};
  const parsed = extractNutrition(plainDesc);
  const cacheKey = `${product.handle}:${hashDesc(plainDesc)}`;
  const cached = cache[cacheKey] || {};
  const ai = aiResults.get(product.handle) || {};

  // Per-field priority: override > parsed > cache > ai > null
  const pick = (field) =>
    ovr[field] ?? parsed[field] ?? cached[field] ?? ai[field] ?? null;

  const nutrition = {
    carbs: pick('carbs'),
    calories: pick('calories'),
    sodium: pick('sodium'),
    caffeine: pick('caffeine'),
  };

  // Tag the predominant source for the carbs field (the headline).
  let source = 'missing';
  if (ovr.carbs != null) source = 'override';
  else if (parsed.carbs != null) source = 'parsed';
  else if (cached.carbs != null) source = 'cache';
  else if (ai.carbs != null) source = 'ai';

  // Update cache with anything new we learned (AI or freshly-parsed values
  // that the cache didn't already have). Don't store overrides — those
  // belong in nutrition-overrides.json by themselves.
  const cacheUpdate = { ...cached };
  let cacheChanged = false;
  for (const f of ['carbs', 'calories', 'sodium', 'caffeine']) {
    const fromAi = ai[f];
    const fromParsed = parsed[f];
    const newVal = fromAi ?? fromParsed;
    if (newVal != null && cacheUpdate[f] !== newVal) {
      cacheUpdate[f] = newVal;
      cacheChanged = true;
    }
  }
  if (cacheChanged) cache[cacheKey] = cacheUpdate;

  return { nutrition, source, category: ovr.category || detectCategory(product) };
}

function productToXml(product, collectionName, resolved) {
  const plainDesc = stripHtml(product.body_html);
  const { nutrition, source, category } = resolved;

  const lines = [];
  lines.push(`    <product>`);
  lines.push(`      <id>${escapeXml(product.id)}</id>`);
  lines.push(`      <title>${escapeXml(product.title)}</title>`);
  lines.push(`      <handle>${escapeXml(product.handle)}</handle>`);
  lines.push(`      <url>${escapeXml(`${SHOPIFY_BASE}/products/${product.handle}`)}</url>`);
  lines.push(`      <vendor>${escapeXml(product.vendor)}</vendor>`);
  lines.push(`      <product_type>${escapeXml(product.product_type)}</product_type>`);
  lines.push(`      <category>${escapeXml(category)}</category>`);
  lines.push(`      <collection>${escapeXml(collectionName)}</collection>`);

  lines.push(`      <nutrition>`);
  lines.push(`        <carbs_g>${nutrition.carbs ?? ''}</carbs_g>`);
  lines.push(`        <calories>${nutrition.calories ?? ''}</calories>`);
  lines.push(`        <sodium_mg>${nutrition.sodium ?? ''}</sodium_mg>`);
  lines.push(`        <caffeine_mg>${nutrition.caffeine ?? ''}</caffeine_mg>`);
  lines.push(`        <source>${source}</source>`);
  lines.push(`      </nutrition>`);

  lines.push(`      <description>${escapeXml(plainDesc)}</description>`);
  lines.push(`      <description_html><![CDATA[${product.body_html || ''}]]></description_html>`);
  lines.push(`      <created_at>${escapeXml(product.created_at)}</created_at>`);
  lines.push(`      <updated_at>${escapeXml(product.updated_at)}</updated_at>`);
  lines.push(`      <published_at>${escapeXml(product.published_at)}</published_at>`);

  if (product.tags && product.tags.length > 0) {
    const tagList = typeof product.tags === 'string' ? product.tags.split(', ') : product.tags;
    lines.push(`      <tags>`);
    for (const tag of tagList) lines.push(`        <tag>${escapeXml(tag.trim())}</tag>`);
    lines.push(`      </tags>`);
  }

  if (product.options && product.options.length > 0) {
    lines.push(`      <options>`);
    for (const opt of product.options) {
      lines.push(`        <option>`);
      lines.push(`          <name>${escapeXml(opt.name)}</name>`);
      lines.push(`          <position>${opt.position}</position>`);
      if (opt.values) {
        lines.push(`          <values>`);
        for (const v of opt.values) lines.push(`            <value>${escapeXml(v)}</value>`);
        lines.push(`          </values>`);
      }
      lines.push(`        </option>`);
    }
    lines.push(`      </options>`);
  }

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
        for (const vid of img.variant_ids) lines.push(`            <variant_id>${vid}</variant_id>`);
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

  const allProductsMap = new Map();
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

  const overrides = loadOverrides();
  const cache = loadCache();
  console.log(`Loaded ${Object.keys(overrides).length} nutrition overrides`);
  console.log(`Loaded ${Object.keys(cache).length} cached extractions\n`);

  // First pass — figure out which products need AI extraction. A product
  // needs AI if no override covers its carbs AND regex+cache combined still
  // leave at least one of (carbs, calories, sodium, caffeine) null.
  const aiQueue = [];
  for (const [, entry] of allProductsMap) {
    const p = entry.product;
    const plainDesc = stripHtml(p.body_html);
    const ovr = overrides[p.handle] || overrides[String(p.id)] || {};
    if (ovr.carbs != null) continue; // override has it covered

    const parsed = extractNutrition(plainDesc);
    const cached = cache[`${p.handle}:${hashDesc(plainDesc)}`] || {};
    const merged = {
      carbs: parsed.carbs ?? cached.carbs,
      calories: parsed.calories ?? cached.calories,
      sodium: parsed.sodium ?? cached.sodium,
      caffeine: parsed.caffeine ?? cached.caffeine,
    };
    // Only call AI when CARBS specifically is missing — that's the field
    // that drives planner candidacy. Trying to fill caffeine on a non-caf
    // product would just generate nulls anyway.
    if (merged.carbs == null) {
      aiQueue.push({ product: p, plainDesc });
    }
  }

  let aiResults = new Map();
  if (aiQueue.length > 0) {
    if (!GEMINI_API_KEY) {
      console.log(`AI extraction skipped — no VITE_GEMINI_API_KEY set`);
      console.log(`  ${aiQueue.length} product(s) will be marked "missing"\n`);
    } else {
      console.log(`AI extraction: calling Gemini for ${aiQueue.length} product(s)`);
      const t0 = Date.now();
      const { results, usefulCount } = await aiExtractMany(aiQueue);
      aiResults = results;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  Got useful values for ${usefulCount}/${aiQueue.length} in ${elapsed}s`);
      if (usefulCount < aiQueue.length) {
        console.log(`  ${aiQueue.length - usefulCount} product(s) had no numeric data in their descriptions — ` +
                    `Gemini correctly returned null. Add overrides if you have the data.\n`);
      } else {
        console.log('');
      }
    }
  }

  // Second pass — emit XML, count by source.
  const xmlParts = [];
  xmlParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  xmlParts.push(`<feed xmlns:g="http://base.google.com/ns/1.0">`);
  xmlParts.push(`  <title>Fuel Lab Product Feed</title>`);
  xmlParts.push(`  <link>${escapeXml(SHOPIFY_BASE)}</link>`);
  xmlParts.push(`  <description>Live product feed from fuellab.co.za — Energy &amp; Endurance and Hydration &amp; Electrolytes</description>`);
  xmlParts.push(`  <generated_at>${new Date().toISOString()}</generated_at>`);
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
  xmlParts.push(`  <products>`);

  const stats = { override: 0, parsed: 0, cache: 0, ai: 0, missing: 0 };
  const missing = [];

  for (const [, entry] of allProductsMap) {
    const p = entry.product;
    const plainDesc = stripHtml(p.body_html);
    const resolved = resolveNutrition(p, plainDesc, overrides, cache, aiResults);
    stats[resolved.source] = (stats[resolved.source] || 0) + 1;
    if (resolved.source === 'missing') {
      missing.push({ handle: p.handle, title: p.title, id: p.id });
    }
    xmlParts.push(productToXml(p, entry.collections.join(', '), resolved));
  }

  xmlParts.push(`  </products>`);
  xmlParts.push(`</feed>`);

  writeFileSync(OUTPUT_PATH, xmlParts.join('\n'), 'utf-8');
  saveCache(cache);

  const totalVariants = [...allProductsMap.values()].reduce(
    (s, e) => s + (e.product.variants?.length || 0), 0,
  );
  const totalImages = [...allProductsMap.values()].reduce(
    (s, e) => s + (e.product.images?.length || 0), 0,
  );

  console.log(`Done! XML feed written to: ${OUTPUT_PATH}`);
  console.log(`Cache written to:           ${CACHE_PATH}`);
  console.log(`  Products: ${allProductsMap.size}`);
  console.log(`  Variants: ${totalVariants}`);
  console.log(`  Images:   ${totalImages}`);
  console.log(`\nNutrition extraction:`);
  console.log(`  Overrides:        ${stats.override}`);
  console.log(`  Regex parsed:     ${stats.parsed}`);
  console.log(`  Cache hit:        ${stats.cache}`);
  console.log(`  AI (Gemini):      ${stats.ai}`);
  console.log(`  Still missing:    ${stats.missing}`);

  if (missing.length > 0) {
    console.log(`\nProducts with no carb data — add to data/nutrition-overrides.json:`);
    for (const m of missing) {
      console.log(`  "${m.handle}": { "carbs": ?, "calories": ?, "sodium": ?, "caffeine": ? }  // ${m.title}`);
    }
  }
}

main().catch((err) => {
  console.error('Error generating feed:', err);
  process.exit(1);
});
