/**
 * Gut Training v2 (beta) fuel picker.
 *
 * Lets the athlete choose the exact products (and brands) they will fuel with,
 * so the session breakdown speaks in real products instead of generic
 * mix/gel/chews. Reads the live catalog via useProducts, filterable by brand
 * and category, and hands back a snapshot kit the plan stores.
 */
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Check } from 'lucide-react';
import { useProducts } from '../../data/products';
import type { FuelKitItem } from '../../services/nutrition/gutTrainingV2';

const MAX_KIT = 4;

const CATEGORY_TABS: { value: 'all' | 'gel' | 'drink' | 'bar' | 'chew'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'drink', label: 'Drinks' },
  { value: 'gel', label: 'Gels' },
  { value: 'chew', label: 'Chews' },
  { value: 'bar', label: 'Bars' },
];

interface FuelPickerProps {
  isOpen: boolean;
  initialKit: FuelKitItem[];
  preferredBrands?: string[];
  onClose: () => void;
  onSave: (kit: FuelKitItem[]) => void;
}

export function FuelPicker({ isOpen, initialKit, preferredBrands, onClose, onSave }: FuelPickerProps) {
  const products = useProducts();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'gel' | 'drink' | 'bar' | 'chew'>('all');
  const [brand, setBrand] = useState<string>('all');
  const [kit, setKit] = useState<FuelKitItem[]>(initialKit);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.brand) set.add(p.brand);
    const all = [...set].sort((a, b) => a.localeCompare(b));
    // Float the athlete's preferred brands to the front, if any.
    if (preferredBrands && preferredBrands.length > 0) {
      const pref = new Set(preferredBrands.map((b) => b.toLowerCase()));
      all.sort((a, b) => Number(pref.has(b.toLowerCase())) - Number(pref.has(a.toLowerCase())));
    }
    return all;
  }, [products, preferredBrands]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => (category === 'all' ? true : p.category === category))
      .filter((p) => (brand === 'all' ? true : p.brand === brand))
      .filter((p) => (q ? `${p.brand} ${p.name}`.toLowerCase().includes(q) : true))
      .filter((p) => p.carbs > 0)
      .slice(0, 120);
  }, [products, query, category, brand]);

  if (!isOpen) return null;

  const inKit = (id: string) => kit.some((k) => k.productId === id);

  const toggle = (p: (typeof products)[number]) => {
    setKit((prev) => {
      if (prev.some((k) => k.productId === p.id)) return prev.filter((k) => k.productId !== p.id);
      if (prev.length >= MAX_KIT) return prev;
      return [...prev, { productId: p.id, brand: p.brand, name: p.name, category: p.category, carbs: p.carbs }];
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background w-full sm:max-w-md max-h-[92dvh] sm:max-h-[85dvh] rounded-t-2xl sm:rounded-2xl border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden safe-bottom">
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
          <div>
            <h2 className="text-lg font-display font-black text-text-primary">Choose your fuel</h2>
            <p className="text-[11px] text-text-muted">Pick up to {MAX_KIT} products you'll actually use.</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-shrink-0 px-5 pt-3 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or brands"
              className="w-full bg-surface border border-[var(--color-border)] rounded-xl text-text-primary text-sm p-2.5 pl-9 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
            {CATEGORY_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setCategory(t.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  category === t.value ? 'border-accent text-accent' : 'border-[var(--color-border)] text-text-secondary hover:border-accent/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            <button
              onClick={() => setBrand('all')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                brand === 'all' ? 'border-accent text-accent' : 'border-[var(--color-border)] text-text-secondary hover:border-accent/40'
              }`}
            >
              All brands
            </button>
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  brand === b ? 'border-accent text-accent' : 'border-[var(--color-border)] text-text-secondary hover:border-accent/40'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-2 space-y-1.5">
          {results.length === 0 ? (
            <p className="text-xs text-text-muted py-6 text-center">No products match. Try another brand or search.</p>
          ) : (
            results.map((p) => {
              const selected = inKit(p.id);
              const atCap = !selected && kit.length >= MAX_KIT;
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p)}
                  disabled={atCap}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border flex items-center gap-3 transition-colors ${
                    selected ? 'border-accent bg-accent/[0.05]' : 'border-[var(--color-border)] hover:border-accent/40'
                  } ${atCap ? 'opacity-40' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-display font-semibold text-text-primary truncate">{p.brand} {p.name}</div>
                    <div className="text-[11px] text-text-muted capitalize">{p.category} · {p.carbs}g carbs</div>
                  </div>
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${selected ? 'bg-accent border-accent' : 'border-[var(--color-border)]'}`}>
                    {selected && <Check className="w-3 h-3 text-background" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex-shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-[var(--color-border)] space-y-2">
          {kit.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {kit.map((k) => (
                <span key={k.productId} className="text-[11px] font-display font-medium text-accent bg-accent/10 rounded-full px-2 py-0.5">
                  {k.brand} {k.name}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => onSave(kit)}
            disabled={kit.length === 0}
            className="w-full py-3.5 bg-accent text-background text-sm font-display font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {kit.length === 0 ? 'Pick at least one' : `Use ${kit.length} product${kit.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
