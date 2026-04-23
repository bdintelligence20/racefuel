import { useEffect, useState } from 'react';
import { Check, ArrowLeft } from 'lucide-react';
import { ProductBundle } from '../data/bundles';
import { useProducts } from '../data/products';

interface Props {
  bundle: ProductBundle;
  initialSelections: Record<string, string>;
  onBack: () => void;
  onConfirm: (selections: Record<string, string>) => void;
}

// Common flavour buckets so most products have at least a sensible default.
// Stored as lowercase strings keyed by product id in localStorage.
const COMMON_FLAVOURS = [
  'Citrus',
  'Berry',
  'Cola',
  'Tropical',
  'Chocolate',
  'Vanilla',
  'Mint',
  'Neutral',
  'Any',
];

const STORAGE_KEY = 'fuelcue_kit_flavours';

export function loadStoredFlavours(bundleId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Record<string, string>>;
    return parsed[bundleId] ?? {};
  } catch {
    return {};
  }
}

export function saveStoredFlavours(bundleId: string, selections: Record<string, string>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    all[bundleId] = selections;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage full / disabled — silently skip persistence.
  }
}

/**
 * Inline second step of the Bundle picker. Lists each product in the bundle
 * and lets the user pick a flavour preference before checkout. We don't yet
 * have variant-level feed data, so the picker captures the athlete's stated
 * preference as a free-text choice; when real variants ship, this same UI
 * becomes the actual variant selector.
 */
export function FlavourPicker({ bundle, initialSelections, onBack, onConfirm }: Props) {
  const products = useProducts();
  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);

  useEffect(() => {
    setSelections(initialSelections);
  }, [initialSelections, bundle.id]);

  const bundleProducts = bundle.products
    .map((bp) => {
      const product = products.find((p) => p.id === bp.productId);
      return product ? { ...product, quantity: bp.quantity } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const allPicked = bundleProducts.every((p) => Boolean(selections[p.id]));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="p-4 pb-0 flex items-center gap-2">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full hover:bg-surfaceHighlight flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          aria-label="Back to bundle list"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">Pick your flavours</div>
          <h2 className="text-lg font-display font-bold text-text-primary">{bundle.name}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {bundleProducts.map((p) => (
          <div key={p.id} className="rounded-lg bg-surfaceHighlight border border-[var(--color-border)] p-3">
            <div className="flex items-baseline justify-between mb-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">{p.brand}</div>
                <div className="text-sm font-display font-bold text-text-primary truncate">{p.name}</div>
              </div>
              <div className="text-[11px] font-display text-text-muted whitespace-nowrap ml-2">× {p.quantity}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {COMMON_FLAVOURS.map((flavour) => {
                const on = selections[p.id] === flavour;
                return (
                  <button
                    key={flavour}
                    type="button"
                    onClick={() => setSelections((s) => ({ ...s, [p.id]: flavour }))}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-display font-semibold transition-colors ${
                      on
                        ? 'bg-accent/20 border border-accent/50 text-accent'
                        : 'bg-surface border border-[var(--color-border)] text-text-muted hover:text-text-primary hover:border-warm/40'
                    }`}
                  >
                    {flavour}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-[10px] text-text-muted italic leading-snug">
          Your selections are saved for this bundle. Once we have live variant data from the store, these choices will pass straight through to checkout.
        </p>
      </div>

      <div className="p-4 border-t border-[var(--color-border)] bg-surfaceHighlight flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-lg bg-surface border border-[var(--color-border)] text-text-primary text-xs font-display font-bold uppercase tracking-wider hover:bg-accent/[0.08] transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => onConfirm(selections)}
          disabled={!allPicked}
          className={`flex-[2] inline-flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition-colors ${
            allPicked
              ? 'bg-warm text-white hover:bg-warm-light'
              : 'bg-surfaceHighlight text-text-muted cursor-not-allowed'
          }`}
        >
          <Check className="w-3 h-3" />
          {allPicked ? 'Confirm & use bundle' : 'Pick a flavour for each'}
        </button>
      </div>
    </div>
  );
}
