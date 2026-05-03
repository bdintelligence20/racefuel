import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, ShoppingBag, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ADMIN_EMAIL = 'nicholasflemmer@gmail.com';
const FUNCTION_BASE = 'https://us-central1-promogroup.cloudfunctions.net';

interface Variant {
  variantId: number;
  productTitle: string;
  variantTitle: string | null;
  price: string;
  inventoryQuantity: number | null;
  sku: string | null;
}

/**
 * Admin-gated test checkout. Fetches a small set of real Shopify variants,
 * lets you pick one, fills in test customer data, and POSTs to the
 * createCheckout function. On success: redirects to Stitch's hosted
 * checkout page.
 */
export function CheckoutTest() {
  const { user, loading } = useAuth();
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [variantsErr, setVariantsErr] = useState<string | null>(null);

  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  const [firstName, setFirstName] = useState('Fuelcue');
  const [lastName, setLastName] = useState('Test');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+27821234567');
  const [address1, setAddress1] = useState('1 Test Avenue');
  const [city, setCity] = useState('Cape Town');
  const [province, setProvince] = useState('Western Cape');
  const [zip, setZip] = useState('8001');

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Pre-fill email with the signed-in admin's email so we can receive the
  // Shopify confirmation directly.
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  // Load real variants from Shopify.
  useEffect(() => {
    let cancelled = false;
    fetch(`${FUNCTION_BASE}/listShopifyProducts`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { variants: Variant[] };
        if (cancelled) return;
        const sorted = [...j.variants].sort(
          (a, b) => parseFloat(a.price) - parseFloat(b.price)
        );
        setVariants(sorted);
        if (sorted.length && selectedVariantId == null) {
          setSelectedVariantId(sorted[0].variantId);
        }
      })
      .catch((e) => !cancelled && setVariantsErr(String(e)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Loading />;
  if (!user) return <Gate message="Sign in to access the checkout test." />;
  if (user.email !== ADMIN_EMAIL) {
    return <Gate message={`Admin only — signed in as ${user.email}`} />;
  }

  const selectedVariant = variants?.find((v) => v.variantId === selectedVariantId) ?? null;
  const total = selectedVariant ? parseFloat(selectedVariant.price) * quantity : 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;
    setSubmitting(true);
    setSubmitErr(null);

    try {
      const res = await fetch(`${FUNCTION_BASE}/createCheckout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { firstName, lastName, email, phone },
          shippingAddress: {
            address1,
            city,
            province,
            country: 'South Africa',
            zip,
          },
          lineItems: [
            {
              variantId: selectedVariant.variantId,
              quantity,
              title: `${selectedVariant.productTitle}${selectedVariant.variantTitle ? ` — ${selectedVariant.variantTitle}` : ''}`,
              unitPrice: parseFloat(selectedVariant.price),
            },
          ],
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      window.location.href = j.paymentUrl;
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] py-12 px-4 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-px w-10 bg-[#F5A020]" />
          <span className="text-[10px] font-display uppercase tracking-[0.28em] font-bold text-[#F5A020]">
            Checkout test
          </span>
        </div>

        <h1 className="text-3xl font-display font-black text-[#3D2152] mb-2 tracking-tight leading-[1.05]">
          Run a test purchase.
        </h1>
        <p className="text-[#6B5A7A] text-sm mb-8">
          Picks one of Fuel Lab's real products, builds a fuelcue order, sends you to Stitch's
          hosted checkout. Pay with a Stitch test card to fire the webhook → Shopify order
          creation flow end-to-end.
        </p>

        <form
          onSubmit={onSubmit}
          className="bg-white border border-[#3D2152]/10 rounded-2xl p-6 shadow-[0_20px_60px_-30px_rgba(61,33,82,0.2)] space-y-5"
        >
          {/* Product picker */}
          <div>
            <Label>Product</Label>
            {variantsErr ? (
              <ErrorBox>Failed to load products: {variantsErr}</ErrorBox>
            ) : variants == null ? (
              <div className="text-[12px] text-[#A0929E]">Loading products from Shopify…</div>
            ) : variants.length === 0 ? (
              <ErrorBox>No active in-stock variants on Fuel Lab's store.</ErrorBox>
            ) : (
              <select
                value={selectedVariantId ?? ''}
                onChange={(e) => setSelectedVariantId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-[#FFF9F0] border border-[#3D2152]/12 text-[14px] text-[#3D2152] focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 transition-colors"
              >
                {variants.map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    R{parseFloat(v.price).toFixed(2)} — {v.productTitle}
                    {v.variantTitle ? ` · ${v.variantTitle}` : ''}
                    {v.inventoryQuantity != null ? ` (${v.inventoryQuantity} in stock)` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Qty */}
          <Row>
            <Field label="Quantity">
              <Input
                type="number"
                min={1}
                max={5}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </Field>
            <Field label="Total (ZAR)">
              <div className="px-3 py-2.5 rounded-xl bg-[#FFF5E8] border border-[#F5A020]/30 text-[14px] font-display font-black text-[#3D2152]">
                R{total.toFixed(2)}
              </div>
            </Field>
          </Row>

          {/* Customer */}
          <Row>
            <Field label="First name">
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </Field>
            <Field label="Last name">
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </Field>
          </Row>

          <Row>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </Row>

          {/* Address */}
          <Field label="Address line 1">
            <Input value={address1} onChange={(e) => setAddress1(e.target.value)} required />
          </Field>

          <Row>
            <Field label="City">
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </Field>
            <Field label="Province">
              <Input value={province} onChange={(e) => setProvince(e.target.value)} />
            </Field>
            <Field label="Postal code">
              <Input value={zip} onChange={(e) => setZip(e.target.value)} required />
            </Field>
          </Row>

          {submitErr && (
            <div className="flex items-start gap-2 text-[12px] text-[#E8671A] bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-3 py-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Checkout failed</div>
                <div>{submitErr}</div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedVariant || submitting}
            className="group relative w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#3D2152] text-white font-display font-bold text-[13px] uppercase tracking-wider overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_30px_-12px_rgba(61,33,82,0.4)] transition-shadow hover:shadow-[0_14px_36px_-10px_rgba(61,33,82,0.5)]"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-[#F5A020] to-[#E8671A] opacity-0 group-hover:opacity-100 group-disabled:opacity-0 transition-opacity duration-500" />
            <span className="relative flex items-center gap-2.5">
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
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------ small helpers ------------------ */

function Loading() {
  return (
    <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-[#F5A020]" />
    </div>
  );
}

function Gate({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center px-6">
      <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-8 max-w-sm text-center">
        <h1 className="text-lg font-display font-black text-[#3D2152] mb-2">Restricted</h1>
        <p className="text-[13px] text-[#6B5A7A]">{message}</p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-display uppercase tracking-[0.2em] font-bold text-[#3D2152] mb-2">
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1">
      <Label>{label}</Label>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-4 [&>label]:min-w-[150px]">{children}</div>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2.5 rounded-xl bg-[#FFF9F0] border border-[#3D2152]/12 text-[14px] text-[#3D2152] placeholder:text-[#A0929E]/70 focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 transition-colors"
    />
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] text-[#E8671A] bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-3 py-2 leading-relaxed">
      {children}
    </div>
  );
}
