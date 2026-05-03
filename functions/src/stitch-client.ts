import { logger } from 'firebase-functions';

/**
 * Stitch Express API client.
 *
 * Stitch Express is the e-commerce-focused tier of stitch.money — it has its
 * OWN api at express.stitch.money that's a plain REST + Bearer scheme,
 * completely independent of stitch.money's main GraphQL/OAuth platform at
 * api.stitch.money. Different endpoint, different auth, different request
 * shape.
 *
 *   POST /api/v1/token         → 15-min bearer token
 *   POST /api/v1/payment-links → hosted-checkout URL the customer pays at
 *   POST /api/v1/redirect-urls → register a callback URL (allowlist)
 *   POST /api/v1/webhook       → register a webhook URL + capture signing secret
 *   GET  /api/v1/payment-links/:id → poll status (PENDING/PAID/EXPIRED/CANCELLED)
 *
 * Response wrapper for every endpoint: { success: boolean, data: {...} }.
 * Amounts are integers in cents.
 *
 * Webhook signature: header X-Stitch-Signature, computed as
 * HMAC-SHA256 of the raw body using the secret returned from the webhook
 * registration call. (Verified empirically — Stitch Express docs are sparse
 * on the exact algorithm; updated when we observe the first webhook.)
 */

const BASE_URL = 'https://express.stitch.money';
const TOKEN_TTL_MS = 15 * 60 * 1000; // tokens are 15 min per docs
const TOKEN_REFRESH_LEEWAY_MS = 60 * 1000; // refresh 1 min before expiry

let cachedToken: { value: string; expiresAt: number } | null = null;

export interface StitchConfig {
  clientId: string;
  clientSecret: string;
}

interface TokenResponse {
  success: true;
  data: { accessToken: string };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

async function getAccessToken(cfg: StitchConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_LEEWAY_MS > Date.now()) {
    return cachedToken.value;
  }

  const res = await fetch(`${BASE_URL}/api/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      scope: 'client_paymentrequest',
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error('Stitch Express token failed', { status: res.status, body: txt.slice(0, 500) });
    throw new Error(`Stitch Express token ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as TokenResponse;
  if (!json.success || !json.data?.accessToken) {
    throw new Error(`Stitch Express token: malformed response ${JSON.stringify(json).slice(0, 200)}`);
  }
  cachedToken = {
    value: json.data.accessToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
  return json.data.accessToken;
}

async function expressFetch<T>(
  cfg: StitchConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken(cfg);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!res.ok || !body?.success) {
    logger.error('Stitch Express API error', {
      path,
      status: res.status,
      body: JSON.stringify(body).slice(0, 600),
    });
    throw new Error(
      `Stitch Express ${path} ${res.status}: ${body?.message ?? body?.error ?? 'unknown'}`
    );
  }
  if (body.data === undefined) throw new Error(`Stitch Express ${path}: no data field`);
  return body.data;
}

/* ------------------------ payment links ------------------------ */

export type PaymentLinkStatus = 'PENDING' | 'EXPIRED' | 'PAID' | 'CANCELLED';

export interface CreatePaymentLinkInput {
  /** Total amount in ZAR major units — converted to cents internally. */
  amountZar: number;
  /** Internal reference (alphanumeric + spaces + hyphens, ≤50 chars). */
  merchantReference: string;
  /** Customer name (3–40 chars). */
  payerName: string;
  payerEmailAddress?: string;
  /** E.164 phone number e.g. +27791231234 */
  payerPhoneNumber?: string;
  /** Optional ISO 8601 expiry; defaults to 30 days. */
  expiresAt?: string;
}

export interface PaymentLink {
  id: string;
  amount: number; // cents
  status: PaymentLinkStatus;
  paidAt?: string;
  payerName: string;
  payerEmailAddress?: string;
  payerPhoneNumber?: string;
  /** Hosted-checkout URL the user is sent to to pay. */
  link: string;
  merchantReference: string;
  expireAt: string;
}

function sanitizeRef(s: string): string {
  return s.replace(/[^A-Za-z0-9 -]/g, '').trim().slice(0, 50) || 'fuelcue';
}

export async function createPaymentLink(
  cfg: StitchConfig,
  input: CreatePaymentLinkInput
): Promise<PaymentLink> {
  const amountCents = Math.round(input.amountZar * 100);
  if (amountCents < 100) {
    throw new Error(`Stitch Express minimum amount is R1.00 (got R${input.amountZar})`);
  }

  const body: Record<string, unknown> = {
    amount: amountCents,
    merchantReference: sanitizeRef(input.merchantReference),
    payerName: input.payerName.slice(0, 40),
  };
  if (input.payerEmailAddress) body.payerEmailAddress = input.payerEmailAddress;
  if (input.payerPhoneNumber) body.payerPhoneNumber = input.payerPhoneNumber;
  if (input.expiresAt) body.expiresAt = input.expiresAt;

  const data = await expressFetch<{ payment: PaymentLink }>(cfg, '/api/v1/payment-links', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.payment;
}

export async function getPaymentLink(
  cfg: StitchConfig,
  paymentLinkId: string
): Promise<PaymentLink> {
  const data = await expressFetch<{ payment: PaymentLink }>(
    cfg,
    `/api/v1/payment-links/${encodeURIComponent(paymentLinkId)}`
  );
  return data.payment;
}

/* ------------------------ one-time admin: redirect-urls + webhook ------------------------ */

export async function registerRedirectUrl(
  cfg: StitchConfig,
  redirectUrl: string
): Promise<string[]> {
  const data = await expressFetch<{ redirectUrls: string[] }>(cfg, '/api/v1/redirect-urls', {
    method: 'POST',
    body: JSON.stringify({ redirectUrl }),
  });
  return data.redirectUrls;
}

export async function listRedirectUrls(cfg: StitchConfig): Promise<string[]> {
  const data = await expressFetch<{ redirectUrls: string[] }>(cfg, '/api/v1/redirect-urls');
  return data.redirectUrls;
}

export async function registerWebhook(
  cfg: StitchConfig,
  webhookUrl: string
): Promise<{ secret: string }> {
  const data = await expressFetch<{ secret: string }>(cfg, '/api/v1/webhook', {
    method: 'POST',
    body: JSON.stringify({ url: webhookUrl }),
  });
  return data;
}
