import './firebase';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { listVariants, type ShopifyConfig } from './shopify-client';

const SHOPIFY_ADMIN_TOKEN = defineSecret('SHOPIFY_ADMIN_TOKEN');
const SHOPIFY_STORE_URL = defineSecret('SHOPIFY_STORE_URL');

const ALLOWED_ORIGINS = new Set([
  'https://fuelcue.com',
  'https://www.fuelcue.com',
  'https://racefuel-dtlkpe56ha-uc.a.run.app',
  'http://localhost:5173',
]);

/**
 * Read-only list of in-stock active product variants on Fuel Lab's store.
 * Used by the SPA's checkout-test page to populate a real product picker
 * with valid variant IDs (Shopify rejects orders that reference IDs the
 * store doesn't recognise, so hardcoded values rot fast).
 *
 * Cache: 60s in-memory, returned with Cache-Control: max-age=60 so the SPA
 * doesn't hit this every keystroke.
 */

let cache: { ts: number; payload: any } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export const listShopifyProducts = onRequest(
  {
    region: 'us-central1',
    secrets: [SHOPIFY_ADMIN_TOKEN, SHOPIFY_STORE_URL],
    cors: false,
  },
  async (req, res) => {
    const origin = req.get('origin');
    res.set('Access-Control-Allow-Origin', origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://fuelcue.com');
    res.set('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method-not-allowed' });
      return;
    }

    if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
      res.set('Cache-Control', 'public, max-age=60');
      res.json({ ...cache.payload, cached: true });
      return;
    }

    try {
      const cfg: ShopifyConfig = {
        storeUrl: SHOPIFY_STORE_URL.value(),
        accessToken: SHOPIFY_ADMIN_TOKEN.value(),
      };
      const variants = await listVariants(cfg, 50);
      const payload = {
        variants: variants
          .filter((v) => v.available)
          .map((v) => ({
            variantId: v.variantId,
            productTitle: v.productTitle,
            variantTitle: v.variantTitle,
            sku: v.sku,
            price: v.price,
            inventoryQuantity: v.inventoryQuantity,
          })),
        currency: 'ZAR',
      };
      cache = { ts: Date.now(), payload };
      res.set('Cache-Control', 'public, max-age=60');
      res.json({ ...payload, cached: false });
    } catch (err) {
      logger.error('listShopifyProducts failed', err);
      res.status(502).json({ error: 'shopify-fetch-failed' });
    }
  }
);
