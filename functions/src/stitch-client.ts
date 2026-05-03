import { logger } from 'firebase-functions';

/**
 * Stitch (stitch.money) payments client.
 *
 * Two responsibilities:
 *   1. OAuth — exchange client_id/client_secret for a short-lived bearer
 *      token (cached in module memory; lifetime is 1h per Stitch's response).
 *   2. GraphQL — issue the createPaymentInitiation mutation that returns a
 *      hosted-payment URL the customer is redirected to.
 *
 * Webhook signature verification lives in checkout.ts where it's used,
 * since it depends on the svix secret and raw request body — both
 * available there but not here.
 */

const TOKEN_URL = 'https://secure.stitch.money/connect/token';
const GRAPHQL_URL = 'https://api.stitch.money/graphql';

// Stitch tokens are 1h. We refresh a bit early to avoid edge expiry.
const TOKEN_REFRESH_LEEWAY_MS = 60 * 1000; // 1 min

let cachedToken: { value: string; expiresAt: number } | null = null;

export interface StitchConfig {
  clientId: string;
  clientSecret: string;
}

async function getAccessToken(cfg: StitchConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_LEEWAY_MS > Date.now()) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'client_paymentrequest',
    audience: 'https://secure.stitch.money/connect/token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text();
    logger.error('Stitch OAuth failed', { status: res.status, body: txt.slice(0, 500) });
    throw new Error(`Stitch OAuth ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: any }>;
}

async function graphql<T>(
  cfg: StitchConfig,
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const token = await getAccessToken(cfg);
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as GraphQLResponse<T>;

  if (!res.ok || json.errors) {
    logger.error('Stitch GraphQL error', { status: res.status, errors: json.errors });
    throw new Error(`Stitch GraphQL: ${JSON.stringify(json.errors ?? json).slice(0, 400)}`);
  }
  if (!json.data) throw new Error('Stitch GraphQL returned no data');
  return json.data;
}

/* ------------------------ payment initiation ------------------------ */

export interface CreatePaymentInput {
  amountZar: number; // e.g. 199.95
  payerReference: string; // ≤ 12 chars, shows on payer bank statement
  beneficiaryReference: string; // ≤ 20 chars, shows on beneficiary bank statement
  externalReference: string; // our internal order id, ≤ 4096 chars
  payer: {
    fullName: string;
    email: string;
    mobileNumber?: string;
  };
}

export interface CreatedPayment {
  id: string;
  url: string; // hosted Stitch checkout URL — we append ?redirect_uri=...
}

const CREATE_PAYMENT_MUTATION = `
  mutation CreatePaymentInitiation(
    $input: ClientPaymentInitiationRequestCreateInput!
  ) {
    clientPaymentInitiationRequestCreate(input: $input) {
      paymentInitiationRequest {
        id
        url
      }
    }
  }
`;

// Beneficiary placeholder. In production, replace with fuelcue's actual ZA
// bank account details. Stitch's test client accepts arbitrary values here
// since no money actually moves; switching to live creds without updating
// these fields will route real money to a non-existent account, so the
// constants are intentionally separated from the test-vs-live flow.
const TEST_BENEFICIARY = {
  name: 'fuelcue test',
  bankId: 'fnb' as const,
  accountNumber: '1234567890',
};

export async function createPaymentInitiation(
  cfg: StitchConfig,
  input: CreatePaymentInput
): Promise<CreatedPayment> {
  const variables = {
    input: {
      amount: { quantity: input.amountZar.toFixed(2), currency: 'ZAR' },
      payerReference: input.payerReference.slice(0, 12),
      beneficiaryReference: input.beneficiaryReference.slice(0, 20),
      externalReference: input.externalReference.slice(0, 4096),
      beneficiary: {
        bankAccount: {
          name: TEST_BENEFICIARY.name,
          bankId: TEST_BENEFICIARY.bankId,
          accountNumber: TEST_BENEFICIARY.accountNumber,
        },
      },
      payerInformation: {
        fullName: input.payer.fullName,
        email: input.payer.email,
        ...(input.payer.mobileNumber ? { mobileNumber: input.payer.mobileNumber } : {}),
      },
    },
  };

  const data = await graphql<{
    clientPaymentInitiationRequestCreate: {
      paymentInitiationRequest: { id: string; url: string };
    };
  }>(cfg, CREATE_PAYMENT_MUTATION, variables);

  return data.clientPaymentInitiationRequestCreate.paymentInitiationRequest;
}

/* ------------------------ webhook subscription registration ------------------------ */

const SUBSCRIBE_WEBHOOK_MUTATION = `
  mutation SubscribeToWebhooks($url: URL!) {
    clientWebhookSubscriptionCreate(input: { url: $url, events: ["payment"] }) {
      subscription {
        id
        url
      }
      secret
    }
  }
`;

export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string; // whsec_… — used to verify all future webhooks
}

/**
 * One-time call to register our webhook URL with Stitch and capture the
 * signing secret. Stitch's UI also exposes this via the Svix Portal but
 * doing it via API keeps the secret out of human view.
 */
export async function registerWebhook(
  cfg: StitchConfig,
  webhookUrl: string
): Promise<WebhookSubscription> {
  const data = await graphql<{
    clientWebhookSubscriptionCreate: {
      subscription: { id: string; url: string };
      secret: string;
    };
  }>(cfg, SUBSCRIBE_WEBHOOK_MUTATION, { url: webhookUrl });
  return {
    id: data.clientWebhookSubscriptionCreate.subscription.id,
    url: data.clientWebhookSubscriptionCreate.subscription.url,
    secret: data.clientWebhookSubscriptionCreate.secret,
  };
}
