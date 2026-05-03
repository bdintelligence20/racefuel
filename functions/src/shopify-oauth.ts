import './firebase';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as crypto from 'crypto';

/**
 * One-time Shopify OAuth installer.
 *
 * Custom-distribution apps in Shopify (the only kind you can create from
 * Jan 2026 onwards) no longer expose a static admin API token in the UI.
 * You must do the OAuth Authorization Code flow once to obtain an offline
 * (non-expiring) access token. These two endpoints handle that exchange,
 * then write the captured token to Secret Manager as SHOPIFY_ADMIN_TOKEN
 * for the rest of the integration to consume.
 *
 * Setup:
 *   1. Deploy these functions.
 *   2. In Shopify Partner Dashboard for the `fuelcue-orders` app, set:
 *        - App URL                      → URL of `shopifyInstallStart`
 *        - Allowed redirection URL(s)   → URL of `shopifyOAuthCallback`
 *   3. Visit `<install-start-url>?shop=andhuz-uc.myshopify.com`. Shopify
 *      asks the merchant to approve scopes; on approval we capture the
 *      offline token.
 *
 * After that, `SHOPIFY_ADMIN_TOKEN` is populated and we never run this
 * dance again unless the app is uninstalled.
 */

const SHOPIFY_API_KEY = defineSecret('SHOPIFY_API_KEY');
const SHOPIFY_API_SECRET = defineSecret('SHOPIFY_API_SECRET');

// Single-store install: lock the OAuth flow to this shop only. Anyone else
// hitting the install URL with a different `shop=` parameter is rejected.
const ALLOWED_SHOP = 'andhuz-uc.myshopify.com';

const SCOPES = [
  'read_customers',
  'write_customers',
  'read_fulfillments',
  'read_inventory',
  'read_orders',
  'write_orders',
  'read_products',
].join(',');

const PROJECT_ID = 'promogroup';
const TOKEN_SECRET_NAME = 'SHOPIFY_ADMIN_TOKEN';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const sm = new SecretManagerServiceClient();

/* ------------------------ HMAC + state helpers ------------------------ */

function verifyShopifyHmac(query: Record<string, string | string[] | undefined>, secret: string): boolean {
  const { hmac, signature: _signature, ...rest } = query;
  if (!hmac || typeof hmac !== 'string') return false;

  const message = Object.keys(rest)
    .sort()
    .map((k) => {
      const v = rest[k];
      return `${k}=${Array.isArray(v) ? v[0] : v ?? ''}`;
    })
    .join('&');

  const computed = crypto.createHmac('sha256', secret).update(message).digest('hex');

  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(hmac, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signState(payload: string, secret: string): string {
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 24);
  return `${payload}.${sig}`;
}

function verifyState(state: string, secret: string): { ok: boolean; shop?: string } {
  const lastDot = state.lastIndexOf('.');
  if (lastDot < 0) return { ok: false };
  const payload = state.slice(0, lastDot);
  const sig = state.slice(lastDot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 24);
  if (sig !== expected) return { ok: false };
  const [tsStr, shop] = payload.split(':');
  const ts = parseInt(tsStr, 10);
  if (isNaN(ts) || Date.now() - ts > STATE_TTL_MS) return { ok: false };
  return { ok: true, shop };
}

// Stable cloudfunctions.net URL prefix for this project + region. Hardcoded
// because Gen 2 functions don't always surface the original host header.
const SELF_BASE_URL = 'https://us-central1-promogroup.cloudfunctions.net';

function isAllowedShop(shop: string): boolean {
  return shop === ALLOWED_SHOP;
}

/* ------------------------ install start ------------------------ */

export const shopifyInstallStart = onRequest(
  {
    region: 'us-central1',
    secrets: [SHOPIFY_API_KEY, SHOPIFY_API_SECRET],
  },
  async (req, res) => {
    const shop = String(req.query.shop || '');

    if (!shop) {
      res.status(400).send('Missing shop parameter. Try ?shop=andhuz-uc.myshopify.com');
      return;
    }
    if (!isAllowedShop(shop)) {
      logger.warn('Install attempt from disallowed shop', { shop });
      res.status(403).send('This app is restricted to a single configured store.');
      return;
    }

    // If Shopify invoked us (App URL ping), it signs the request. Browser-initiated
    // installs have no hmac — both paths are legitimate, so HMAC is only required
    // when present.
    if (req.query.hmac) {
      const ok = verifyShopifyHmac(req.query as Record<string, string | string[] | undefined>, SHOPIFY_API_SECRET.value());
      if (!ok) {
        logger.warn('Bad HMAC on install start', { shop });
        res.status(401).send('Invalid HMAC');
        return;
      }
    }

    const callbackUrl = `${SELF_BASE_URL}/shopifyOAuthCallback`;
    const state = signState(`${Date.now()}:${shop}`, SHOPIFY_API_SECRET.value());

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', SHOPIFY_API_KEY.value());
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);

    logger.info('Redirecting to Shopify OAuth consent', { shop, callbackUrl });
    res.redirect(302, authUrl.toString());
  }
);

/* ------------------------ OAuth callback ------------------------ */

export const shopifyOAuthCallback = onRequest(
  {
    region: 'us-central1',
    secrets: [SHOPIFY_API_KEY, SHOPIFY_API_SECRET],
  },
  async (req, res) => {
    const shop = String(req.query.shop || '');
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');

    if (!shop || !code || !state) {
      res.status(400).send('Missing required parameters (shop, code, state)');
      return;
    }
    if (!isAllowedShop(shop)) {
      res.status(403).send('Disallowed shop');
      return;
    }

    if (!verifyShopifyHmac(req.query as Record<string, string | string[] | undefined>, SHOPIFY_API_SECRET.value())) {
      logger.warn('Bad HMAC on OAuth callback', { shop });
      res.status(401).send('Invalid HMAC — request not signed by Shopify');
      return;
    }

    const stateCheck = verifyState(state, SHOPIFY_API_SECRET.value());
    if (!stateCheck.ok || stateCheck.shop !== shop) {
      logger.warn('Invalid state on OAuth callback', { shop });
      res.status(401).send('Invalid state — possible CSRF or expired install link');
      return;
    }

    // Exchange the code for an offline access token.
    let accessToken: string;
    let scope: string;
    try {
      const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: SHOPIFY_API_KEY.value(),
          client_secret: SHOPIFY_API_SECRET.value(),
          code,
        }).toString(),
      });
      if (!tokenRes.ok) {
        const txt = await tokenRes.text();
        logger.error('Shopify token exchange failed', { status: tokenRes.status, body: txt.slice(0, 500) });
        res.status(502).send(`Token exchange failed (${tokenRes.status}). Check function logs.`);
        return;
      }
      const body = (await tokenRes.json()) as { access_token: string; scope: string };
      accessToken = body.access_token;
      scope = body.scope;
    } catch (err) {
      logger.error('Token exchange error', err);
      res.status(502).send('Token exchange threw — check function logs.');
      return;
    }

    // Persist as a new version of SHOPIFY_ADMIN_TOKEN. The secret was pre-created
    // out-of-band so the function only needs secretVersionAdder permission.
    try {
      await sm.addSecretVersion({
        parent: `projects/${PROJECT_ID}/secrets/${TOKEN_SECRET_NAME}`,
        payload: { data: Buffer.from(accessToken, 'utf8') },
      });
      logger.info('Stashed Shopify access token', { shop, scope });
    } catch (err) {
      logger.error('Failed to write SHOPIFY_ADMIN_TOKEN', err);
      res.status(500).send('Token captured but failed to persist — check function logs.');
      return;
    }

    res.status(200).send(`<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#FFF9F0;margin:0;padding:80px 24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid rgba(61,33,82,0.1);border-radius:16px;padding:36px;text-align:center;">
    <div style="width:56px;height:56px;border-radius:28px;background:linear-gradient(135deg,#F5A020,#E8671A);margin:0 auto 18px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:30px;font-weight:900;">✓</div>
    <h1 style="color:#3D2152;font-size:22px;font-weight:900;margin:0 0 12px;letter-spacing:-0.01em;">Shopify connected</h1>
    <p style="color:#6B5A7A;font-size:14px;line-height:1.55;margin:0 0 18px;">
      Admin API access token captured for <b>${shop}</b> and stored as <code style="background:#FFF5E8;padding:2px 6px;border-radius:4px;font-size:12px;">SHOPIFY_ADMIN_TOKEN</code>.
    </p>
    <p style="color:#A0929E;font-size:11px;font-family:'SFMono-Regular',Menlo,monospace;letter-spacing:0.04em;word-break:break-all;">
      scopes: ${scope}
    </p>
    <p style="color:#A0929E;font-size:11px;margin-top:24px;">You can close this tab.</p>
  </div>
</body></html>`);
  }
);
