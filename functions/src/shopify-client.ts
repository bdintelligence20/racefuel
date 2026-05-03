import { logger } from 'firebase-functions';

/**
 * Thin wrapper around Shopify's Admin REST API for the single Fuel Lab store.
 *
 * The token + store URL are passed in by callers (read from Secret Manager
 * via defineSecret + .value() inside each function) so this module is
 * trivially testable and stateless.
 */

const API_VERSION = '2026-01';

export interface ShopifyConfig {
  storeUrl: string; // e.g. 'andhuz-uc.myshopify.com'
  accessToken: string; // shpat_…
}

export interface OrderLineItem {
  variantId: number; // Shopify variant ID, NOT product ID
  quantity: number;
  // Optional override — by default Shopify uses the variant's stored price.
  // Pass this only when fuelcue is selling at a different price than retail.
  priceOverride?: string;
}

export interface OrderAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string; // e.g. 'Western Cape'
  country: string; // e.g. 'South Africa'
  zip: string;
  phone?: string;
}

export interface CreateOrderInput {
  customer: { firstName: string; lastName: string; email: string; phone?: string };
  shippingAddress: OrderAddress;
  billingAddress?: OrderAddress; // defaults to shippingAddress
  lineItems: OrderLineItem[];
  // Free-form note shown in Shopify admin so Fuel Lab knows this was placed
  // through fuelcue.
  note?: string;
  // External reference (e.g. our orderId) so we can join Shopify ↔ Firestore.
  externalOrderId: string;
  // Tag(s) — useful for filtering in Shopify admin.
  tags?: string[];
}

export interface CreatedOrder {
  id: number;
  name: string; // e.g. '#1042'
  orderNumber: number;
  totalPrice: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  adminUrl: string; // direct link to the order in Shopify admin
}

function adminBase(cfg: ShopifyConfig): string {
  return `https://${cfg.storeUrl}/admin/api/${API_VERSION}`;
}

async function shopifyFetch<T>(
  cfg: ShopifyConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${adminBase(cfg)}${path}`, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': cfg.accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error('Shopify API error', { path, status: res.status, body: body.slice(0, 1000) });
    throw new Error(`Shopify ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function getShopInfo(cfg: ShopifyConfig): Promise<{
  name: string;
  domain: string;
  currency: string;
  email: string;
}> {
  const { shop } = await shopifyFetch<{ shop: any }>(cfg, '/shop.json');
  return {
    name: shop.name,
    domain: shop.domain,
    currency: shop.currency,
    email: shop.email,
  };
}

export async function createOrder(
  cfg: ShopifyConfig,
  input: CreateOrderInput
): Promise<CreatedOrder> {
  const billing = input.billingAddress ?? input.shippingAddress;

  const orderPayload = {
    order: {
      // Customer-facing fields
      email: input.customer.email,
      phone: input.customer.phone,
      customer: {
        first_name: input.customer.firstName,
        last_name: input.customer.lastName,
        email: input.customer.email,
        phone: input.customer.phone,
      },

      // Address blocks — Shopify uses these for tax + shipping rate calc.
      shipping_address: addressToShopify(input.shippingAddress, input.customer),
      billing_address: addressToShopify(billing, input.customer),

      line_items: input.lineItems.map((li) => ({
        variant_id: li.variantId,
        quantity: li.quantity,
        ...(li.priceOverride !== undefined ? { price: li.priceOverride } : {}),
      })),

      // Mark as paid — fuelcue collects payment via Stitch BEFORE this call,
      // so by the time we create the Shopify order the money is already in
      // fuelcue's account. Fuel Lab fulfills against this signal.
      financial_status: 'paid',

      // Decrement Shopify stock when the order is created. Fuel Lab's existing
      // catalog therefore reflects the right availability for their own
      // direct customers without us having to do anything else.
      inventory_behaviour: 'decrement_obeying_policy',

      note: input.note ?? `Placed via fuelcue.com — external ref ${input.externalOrderId}`,
      note_attributes: [
        { name: 'fuelcue_order_id', value: input.externalOrderId },
        { name: 'placed_via', value: 'fuelcue.com' },
      ],
      tags: ['fuelcue', ...(input.tags ?? [])].join(', '),

      // Send the customer a Shopify order confirmation directly. Fuel Lab's
      // Shopify settings already have nice transactional emails set up; no
      // point us building duplicates.
      send_receipt: true,
      send_fulfillment_receipt: true,

      // Currency must match the shop's currency (ZAR in our case).
      currency: 'ZAR',
    },
  };

  const { order } = await shopifyFetch<{ order: any }>(cfg, '/orders.json', {
    method: 'POST',
    body: JSON.stringify(orderPayload),
  });

  return {
    id: order.id,
    name: order.name,
    orderNumber: order.order_number,
    totalPrice: order.total_price,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    adminUrl: `https://${cfg.storeUrl.replace('.myshopify.com', '')}.myshopify.com/admin/orders/${order.id}`,
  };
}

function addressToShopify(addr: OrderAddress, customer: CreateOrderInput['customer']) {
  return {
    first_name: addr.firstName || customer.firstName,
    last_name: addr.lastName || customer.lastName,
    address1: addr.address1,
    address2: addr.address2 ?? null,
    city: addr.city,
    province: addr.province ?? null,
    country: addr.country,
    zip: addr.zip,
    phone: addr.phone ?? customer.phone ?? null,
  };
}

/* ---------- Read helpers (used by inventory sync + dashboard) ---------- */

export interface ProductVariantSummary {
  variantId: number;
  productId: number;
  productTitle: string;
  variantTitle: string | null; // null if "Default Title"
  sku: string | null;
  price: string;
  inventoryQuantity: number | null;
  available: boolean;
}

export async function listVariants(
  cfg: ShopifyConfig,
  limit = 50
): Promise<ProductVariantSummary[]> {
  const { products } = await shopifyFetch<{ products: any[] }>(
    cfg,
    `/products.json?limit=${limit}&fields=id,title,variants,status`
  );
  const out: ProductVariantSummary[] = [];
  for (const p of products) {
    if (p.status !== 'active') continue;
    for (const v of p.variants ?? []) {
      out.push({
        variantId: v.id,
        productId: p.id,
        productTitle: p.title,
        variantTitle: v.title === 'Default Title' ? null : v.title,
        sku: v.sku || null,
        price: v.price,
        inventoryQuantity: v.inventory_quantity ?? null,
        available: (v.inventory_quantity ?? 0) > 0 || v.inventory_management !== 'shopify',
      });
    }
  }
  return out;
}
