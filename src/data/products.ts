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

    let name = title;
    if (name.startsWith(vendor)) {
      name = name.slice(vendor.length).replace(/^\s*[-–]\s*/, '').trim();
    }

    results.push({
      id: text('handle'),
      brand: vendor,
      name: name || title,
      calories: num('nutrition > calories'),
      carbs,
      sodium: num('nutrition > sodium_mg'),
      caffeine: num('nutrition > caffeine_mg'),
      color: brandColor(vendor),
      priceZAR: price,
      image: firstImage,
      category,
    });
  });

  return results;
}

// Shared state + listeners for React reactivity
let _products: ProductProps[] = [];
const _listeners: Set<() => void> = new Set();
let _loaded = false;

function notify() {
  _listeners.forEach(fn => fn());
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
      _products = parseProductsFromXml(xml);
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

/** React hook — returns live products from the XML feed */
export function useProducts(): ProductProps[] {
  const [, setTick] = useState(0);

  useEffect(() => {
    // If already loaded, no need to subscribe
    if (_loaded) return;

    const listener = () => setTick(t => t + 1);
    _listeners.add(listener);
    ensureLoaded();

    return () => { _listeners.delete(listener); };
  }, []);

  return _products;
}

// Backwards-compatible exports for non-component code (planGenerator etc.)
export const products = new Proxy([] as ProductProps[], {
  get(_target, prop) {
    if (prop === 'length') return _products.length;
    if (prop === Symbol.iterator) return _products[Symbol.iterator].bind(_products);
    if (typeof prop === 'string' && !isNaN(Number(prop))) return _products[Number(prop)];
    const val = (_products as any)[prop];
    return typeof val === 'function' ? val.bind(_products) : val;
  },
});

export function getProductsByCategory(category: ProductCategory): ProductProps[] {
  return _products.filter(p => p.category === category);
}
export function getGels(): ProductProps[] { return getProductsByCategory('gel'); }
export function getDrinks(): ProductProps[] { return getProductsByCategory('drink'); }
export function getBars(): ProductProps[] { return getProductsByCategory('bar'); }
export function getChews(): ProductProps[] { return getProductsByCategory('chew'); }

export function searchProducts(query: string): ProductProps[] {
  const q = query.toLowerCase();
  return _products.filter(p =>
    p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
  );
}
