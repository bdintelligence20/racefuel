import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { Loader2, ShoppingBag, X, AlertCircle, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../data/products';
import { useModalBehavior } from '../hooks/useModalBehavior';

const FUNCTION_BASE = 'https://us-central1-promogroup.cloudfunctions.net';
const ADDR_STORAGE_KEY = 'fuelcue_shipping_address';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SavedAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  city: string;
  province: string;
  zip: string;
}

const EMPTY_ADDRESS: SavedAddress = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address1: '',
  city: '',
  province: '',
  zip: '',
};

function loadAddress(): SavedAddress {
  try {
    const raw = localStorage.getItem(ADDR_STORAGE_KEY);
    if (!raw) return EMPTY_ADDRESS;
    return { ...EMPTY_ADDRESS, ...JSON.parse(raw) };
  } catch {
    return EMPTY_ADDRESS;
  }
}

function saveAddress(addr: SavedAddress): void {
  try {
    localStorage.setItem(ADDR_STORAGE_KEY, JSON.stringify(addr));
  } catch { /* swallow */ }
}

/**
 * Real Shopify checkout via the createCheckout Cloud Function.
 *
 * Flow:
 *  1. Map every cart item (route placements + extras) to its Shopify
 *     variantId — this lives on the product object after the products
 *     feed parser added it.
 *  2. Collect customer + shipping details (pre-filled from auth + last
 *     saved address in localStorage).
 *  3. POST to createCheckout. The function creates a Shopify draft order,
 *     pushes it to Stitch's hosted payment page, returns paymentUrl.
 *  4. Redirect to Stitch. Webhook on payment success creates the real
 *     Shopify order (already wired up on the backend).
 */
export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { routeData, cartExtras } = useApp();
  const { user } = useAuth();
  const products = useProducts();
  useModalBehavior(isOpen, onClose);

  const [addr, setAddr] = useState<SavedAddress>(EMPTY_ADDRESS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const saved = loadAddress();
    setAddr({
      ...saved,
      // Prefer the signed-in user's email if no email saved yet
      email: saved.email || user?.email || '',
      firstName: saved.firstName || (user?.displayName?.split(' ')[0] ?? ''),
      lastName: saved.lastName || (user?.displayName?.split(' ').slice(1).join(' ') ?? ''),
    });
    setError(null);
    setSubmitting(false);
  }, [isOpen, user]);

  // Build line items by combining nutrition placements (each placement = 1 qty)
  // with cart extras (which carry their own quantity).
  const lineItems = useMemo(() => {
    const productById = new Map(products.map((p) => [p.id, p]));
    const groups = new Map<number, { quantity: number; title: string; unitPrice: number }>();

    const add = (productId: string, qty: number) => {
      const p = productById.get(productId);
      if (!p || !p.variantId) return;
      const existing = groups.get(p.variantId);
      const title = `${p.brand} ${p.name}`.trim();
      const unitPrice = p.priceZAR ?? 0;
      if (existing) existing.quantity += qty;
      else groups.set(p.variantId, { quantity: qty, title, unitPrice });
    };

    for (const point of routeData.nutritionPoints) add(point.product.id, 1);
    for (const e of cartExtras) add(e.productId, e.quantity);

    return Array.from(groups.entries()).map(([variantId, g]) => ({
      variantId,
      quantity: g.quantity,
      title: g.title,
      unitPrice: g.unitPrice,
    }));
  }, [routeData.nutritionPoints, cartExtras, products]);

  const total = lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const itemsCount = lineItems.reduce((s, li) => s + li.quantity, 0);

  // Items that couldn't be matched to a variantId — surface clearly so the
  // athlete knows what's about to be left out instead of a silent failure.
  const unmatched = useMemo(() => {
    const unmatchedItems: Array<{ name: string; quantity: number }> = [];
    const productById = new Map(products.map((p) => [p.id, p]));
    const seen = new Set<string>();
    const collect = (productId: string, qty: number) => {
      const p = productById.get(productId);
      if (!p) return;
      if (p.variantId) return;
      if (seen.has(p.id)) return;
      seen.add(p.id);
      unmatchedItems.push({ name: `${p.brand} ${p.name}`.trim(), quantity: qty });
    };
    for (const point of routeData.nutritionPoints) collect(point.product.id, 1);
    for (const e of cartExtras) collect(e.productId, e.quantity);
    return unmatchedItems;
  }, [routeData.nutritionPoints, cartExtras, products]);

  if (!isOpen) return null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      saveAddress(addr);
      const res = await fetch(`${FUNCTION_BASE}/createCheckout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            firstName: addr.firstName,
            lastName: addr.lastName,
            email: addr.email,
            phone: addr.phone,
          },
          shippingAddress: {
            address1: addr.address1,
            city: addr.city,
            province: addr.province,
            country: 'South Africa',
            zip: addr.zip,
          },
          lineItems,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      // Off to Stitch's hosted payment page. Successful payment fires the
      // backend webhook which creates the Shopify order.
      window.location.href = json.paymentUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-surfaceHighlight flex-shrink-0">
          <div>
            <div className="text-[10px] text-warm uppercase tracking-wider font-display font-bold">Checkout · Fuel Lab</div>
            <h2 className="text-lg font-display font-bold text-text-primary">Buy your fuel</h2>
            <div className="text-[11px] text-text-muted font-display">
              {itemsCount} item{itemsCount === 1 ? '' : 's'} · R{total.toFixed(2)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          {unmatched.length > 0 && (
            <div className="text-[11px] text-warm bg-warm/[0.08] border border-warm/30 rounded-lg p-2.5">
              <div className="font-display font-bold uppercase tracking-wider text-[10px] mb-1">Heads up</div>
              <div>
                {unmatched.length} item{unmatched.length === 1 ? '' : 's'} couldn't be matched to a Shopify variant and will be skipped at checkout:
              </div>
              <ul className="list-disc list-inside mt-1">
                {unmatched.map((u) => (
                  <li key={u.name}>{u.name}</li>
                ))}
              </ul>
            </div>
          )}

          <Row>
            <Field label="First name">
              <Input value={addr.firstName} onChange={(e) => setAddr((a) => ({ ...a, firstName: e.target.value }))} required />
            </Field>
            <Field label="Last name">
              <Input value={addr.lastName} onChange={(e) => setAddr((a) => ({ ...a, lastName: e.target.value }))} required />
            </Field>
          </Row>

          <Row>
            <Field label="Email">
              <Input type="email" value={addr.email} onChange={(e) => setAddr((a) => ({ ...a, email: e.target.value }))} required />
            </Field>
            <Field label="Phone">
              <Input value={addr.phone} onChange={(e) => setAddr((a) => ({ ...a, phone: e.target.value }))} placeholder="+27..." />
            </Field>
          </Row>

          <Field label="Shipping address">
            <Input value={addr.address1} onChange={(e) => setAddr((a) => ({ ...a, address1: e.target.value }))} placeholder="123 Main Street" required />
          </Field>

          <Row>
            <Field label="City">
              <Input value={addr.city} onChange={(e) => setAddr((a) => ({ ...a, city: e.target.value }))} required />
            </Field>
            <Field label="Province">
              <Input value={addr.province} onChange={(e) => setAddr((a) => ({ ...a, province: e.target.value }))} placeholder="Western Cape" />
            </Field>
            <Field label="Postal code">
              <Input value={addr.zip} onChange={(e) => setAddr((a) => ({ ...a, zip: e.target.value }))} required />
            </Field>
          </Row>

          {error && (
            <div className="flex items-start gap-2 text-[12px] text-warm bg-warm/[0.08] border border-warm/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Checkout failed</div>
                <div>{error}</div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || lineItems.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-accent text-white font-display font-bold uppercase tracking-wider text-sm hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_20px_rgba(245,160,32,0.2)]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating payment…
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                Pay R{total.toFixed(2)} via Stitch
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-[10px] text-text-muted text-center font-display">
            Secure payment processed by Stitch · order fulfilled by Fuel Lab
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1 min-w-[120px]">
      <div className="text-[10px] font-display uppercase tracking-wider font-bold text-text-secondary mb-1">{label}</div>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2.5 rounded-lg bg-surface border border-[var(--color-border)] text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors font-display"
    />
  );
}
