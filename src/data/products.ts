import { useState, useEffect } from 'react';
import { ProductProps, ProductCategory } from '../components/NutritionCard';

const FEED_URL = '/products-feed.xml';

const BRAND_COLORS: Record<string, ProductProps['color']> = {
  '226ers': 'orange', '32gi': 'green', 'styrkr': 'blue', 'skratch': 'yellow',
  'high five': 'red', 'enduren': 'green', 'never second': 'orange',
  'named sport': 'blue', 'pace': 'red', 'pvm': 'orange', 'powerbar': 'red',
  'science in sport': 'blue', 'blast': 'blue', '13 nutrition': 'green',
  'nutricon': 'red', 'nutritech': 'red', 'racefood': 'yellow',
  'sport rx': 'orange', 'fixx': 'green', 'open fuel': 'yellow',
};

function brandColor(vendor: string): ProductProps['color'] {
  const v = vendor.toLowerCase();
  for (const [key, color] of Object.entries(BRAND_COLORS)) {
    if (v.includes(key)) return color;
  }
  return 'white';
}

function detectCategory(title: string, tags: string[]): ProductCategory {
  const t = title.toLowerCase();
  const tagStr = tags.join(' ').toLowerCase();
  if (/gel/i.test(t) || /\bgel\b/.test(tagStr)) return 'gel';
  if (/\bbar\b/i.test(t) || /\bbar\b/.test(tagStr)) return 'bar';
  if (/chew|gumm|shot|blok/i.test(t) || /chew/.test(tagStr)) return 'chew';
  if (/drink|hydra|electrolyte|isotonic|mix\b|powder|tabs?$|tablet/i.test(t) || /drink/.test(tagStr) || /electrolyte/.test(tagStr) || /hydration/.test(tagStr)) return 'drink';
  return 'gel';
}

/**
 * Single-serve filter: this app is for on-course fueling, so tubs / bulk packs /
 * multi-serve containers should never show up. Kept in sync with the plan generator.
 */
function isSingleServeProduct(p: ProductProps): boolean {
  const name = `${p.brand} ${p.name}`.toLowerCase();
  const multiServePatterns = [
    /\btub\b/,
    /\btin\b/,
    /\bjar\b/,
    /\bbulk\b/,
    /\bmultipack\b/,
    /\bmulti-?pack\b/,
    /\bpack of \d+/,
    /\bbox of \d+/,
    /\b\d+\s*(tabs?|tablets?|serv(ing|e)s?|sachets?|gels?|bars?|chews?)\b(?!\s*per)/,
    /\b([3-9]\d{2}|[1-9]\d{3})\s*g\b/,
    /\b[1-9](\.[0-9]+)?\s*kg\b/,
  ];
  if (multiServePatterns.some((re) => re.test(name))) return false;
  if (p.carbs > 70) return false;
  return true;
}

/**
 * Infer servings-per-pack from a product's name+description when the feed
 * doesn't explicitly provide it. Conservative heuristic: we only return > 1
 * when the pack is clearly multi-serve (tub, big weight, explicit count).
 * Otherwise we return 1 so cost maths stays correct for true single-serves.
 */
function inferServingsPerPack(
  title: string,
  description: string,
  category: ProductCategory,
  carbs: number,
  variantWeightGrams?: number,
  variantTitle?: string,
): number {
  const text = `${title} ${description} ${variantTitle ?? ''}`.toLowerCase();

  // Explicit count in the name: "pack of 20", "20 servings", "30 gels".
  const countMatch = text.match(/(\d{1,3})\s*(serv(ing|e)s?|sachets?|gels?|bars?|chews?|tablets?|tabs?)\b/);
  if (countMatch) {
    const n = parseInt(countMatch[1], 10);
    if (n >= 2 && n <= 200) return n;
  }

  // Drink-mix tubs — prefer the explicit variant weight (Shopify ships
  // <weight> per variant), then fall back to text-mined weights. The per-pack
  // gram count divided by an estimated grams-per-serving yields servings.
  // Most race drinks are 70-90% carb by weight, so grams-per-serving ≈
  // carbs / 0.75. This gives an order-of-magnitude correct count even when
  // the actual scoop size isn't published.
  const isTubLike = /\btub\b|\btin\b|\bjar\b|\bmix\b|\bpowder\b/.test(text);
  if (category === 'drink' && carbs > 0) {
    let packGrams: number | null = null;
    if (variantWeightGrams && variantWeightGrams >= 200) {
      packGrams = variantWeightGrams;
    } else {
      const kgMatch = text.match(/(\d+(?:\.\d+)?)\s*kg\b/);
      if (kgMatch) {
        packGrams = Math.round(parseFloat(kgMatch[1]) * 1000);
      } else {
        const gMatch = text.match(/(\d{3,4})\s*g\b/);
        if (gMatch) packGrams = parseInt(gMatch[1], 10);
      }
    }
    if (packGrams && (isTubLike || packGrams >= 400)) {
      const gramsPerServing = Math.max(20, carbs / 0.75);
      const est = Math.round(packGrams / gramsPerServing);
      if (est >= 4 && est <= 80) return est;
    }
  }

  return 1;
}

function parseProductsFromXml(xml: string): ProductProps[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const productEls = doc.querySelectorAll('product');
  const results: ProductProps[] = [];

  productEls.forEach((el) => {
    const text = (tag: string) => el.querySelector(tag)?.textContent?.trim() || '';
    const num = (tag: string) => {
      const v = text(tag);
      return v ? parseFloat(v) : 0;
    };

    const vendor = text('vendor');
    const title = text('title');
    const tags = Array.from(el.querySelectorAll('tags > tag')).map(t => t.textContent || '');
    const carbs = num('nutrition > carbs_g');
    const xmlCategory = text('category');
    let category: ProductCategory = (['gel', 'drink', 'bar', 'chew'].includes(xmlCategory)
      ? xmlCategory
      : detectCategory(title, tags)) as ProductCategory;

    if (xmlCategory === 'other' && carbs < 10) return;
    if (xmlCategory === 'other') category = 'drink';

    const firstVariant = el.querySelector('variants > variant');
    const price = firstVariant ? parseFloat(firstVariant.querySelector('price')?.textContent || '0') : 0;
    const firstImage = el.querySelector('images > image > src')?.textContent || '';

    // Variant-level pack weight is the most reliable cue for tub-vs-sachet —
    // Shopify exports it per variant. Normalise to grams.
    let variantWeightGrams: number | undefined;
    let variantTitle: string | undefined;
    let variantId: number | undefined;
    if (firstVariant) {
      const w = parseFloat(firstVariant.querySelector('weight')?.textContent || '0');
      const unit = (firstVariant.querySelector('weight_unit')?.textContent || 'g').trim().toLowerCase();
      if (w > 0) {
        variantWeightGrams = unit === 'kg' ? Math.round(w * 1000) : Math.round(w);
      }
      variantTitle = firstVariant.querySelector('title')?.textContent?.trim() || undefined;
      const idText = firstVariant.querySelector('id')?.textContent?.trim();
      const idNum = idText ? parseInt(idText, 10) : NaN;
      if (Number.isFinite(idNum) && idNum > 0) variantId = idNum;
    }

    let name = title;
    if (name.startsWith(vendor)) {
      name = name.slice(vendor.length).replace(/^\s*[-–]\s*/, '').trim();
    }

    // Servings — prefer the feed's explicit value, else infer from name/desc + variant weight.
    const feedServings = num('servings_per_pack');
    const description = text('description');
    const servingsPerPack = feedServings > 0
      ? Math.round(feedServings)
      : inferServingsPerPack(title, description, category, carbs, variantWeightGrams, variantTitle);

    // Calories — when the feed has an empty <calories> tag we fall back to a
    // carb-derived estimate (4 kcal/g) rather than displaying "0 cal". The
    // High Five Energy Gel with Caffeine ships with calories blank in the
    // feed and was rendering "23g · 0 cal" in the cart.
    const feedCalories = num('nutrition > calories');
    const estimatedCalories = carbs > 0 ? Math.round(carbs * 4) : 0;
    const calories = feedCalories > 0 ? feedCalories : estimatedCalories;

    results.push({
      id: text('handle'),
      brand: vendor,
      name: name || title,
      calories,
      carbs,
      sodium: num('nutrition > sodium_mg'),
      caffeine: num('nutrition > caffeine_mg'),
      color: brandColor(vendor),
      priceZAR: price,
      image: firstImage,
      category,
      servingsPerPack,
      variantId,
    });
  });

  return results;
}

// Shared state + listeners for React reactivity
let _products: ProductProps[] = [];
let _customProducts: ProductProps[] = readCustomProductsFromStorage();
let _combined: ProductProps[] = _customProducts.slice();
const _listeners: Set<() => void> = new Set();
let _loaded = false;

const CUSTOM_PRODUCTS_STORAGE_KEY = 'fuelcue_custom_products';

function readCustomProductsFromStorage(): ProductProps[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRODUCTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProductProps[]) : [];
  } catch {
    return [];
  }
}

function recomputeCombined() {
  _combined = [..._products, ..._customProducts];
}

function notify() {
  _listeners.forEach(fn => fn());
}

/** Replace the in-memory custom-product list and notify subscribers.
 *  Custom products live alongside feed products in `useProducts()` and the
 *  `products` proxy so brand pickers, planners, and pickers all see them
 *  without caller-side merging. The localStorage write is the caller's
 *  responsibility (see CustomProductModal helpers) — this only updates the
 *  reactive in-memory mirror. */
export function setCustomProducts(list: ProductProps[]): void {
  _customProducts = list.slice();
  recomputeCombined();
  notify();
}

// Fetch once, cache forever (until page reload)
let _fetchPromise: Promise<void> | null = null;
function ensureLoaded(): Promise<void> {
  if (_loaded) return Promise.resolve();
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = fetch(FEED_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
      return res.text();
    })
    .then((xml) => {
      _products = parseProductsFromXml(xml).filter(isSingleServeProduct);
      recomputeCombined();
      _loaded = true;
      notify();
    })
    .catch((err) => {
      console.error('Failed to load product feed:', err);
    });

  return _fetchPromise;
}

// Start loading immediately on module import
ensureLoaded();

/** React hook — returns live products from the XML feed merged with the
 *  user's custom additions. Subscribes for reactivity even after the feed
 *  is loaded so custom-product saves/removals re-render. */
export function useProducts(): ProductProps[] {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    _listeners.add(listener);
    ensureLoaded();
    return () => { _listeners.delete(listener); };
  }, []);

  return _combined;
}

// Backwards-compatible exports for non-component code (planGenerator etc.)
export const products = new Proxy([] as ProductProps[], {
  get(_target, prop) {
    if (prop === 'length') return _combined.length;
    if (prop === Symbol.iterator) return _combined[Symbol.iterator].bind(_combined);
    if (typeof prop === 'string' && !isNaN(Number(prop))) return _combined[Number(prop)];
    const val = (_combined as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === 'function' ? val.bind(_combined) : val;
  },
});

export function getProductsByCategory(category: ProductCategory): ProductProps[] {
  return _combined.filter(p => p.category === category);
}
export function getGels(): ProductProps[] { return getProductsByCategory('gel'); }
export function getDrinks(): ProductProps[] { return getProductsByCategory('drink'); }
export function getBars(): ProductProps[] { return getProductsByCategory('bar'); }
export function getChews(): ProductProps[] { return getProductsByCategory('chew'); }

export function searchProducts(query: string): ProductProps[] {
  const q = query.toLowerCase();
  return _combined.filter(p =>
    p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
  );
}
