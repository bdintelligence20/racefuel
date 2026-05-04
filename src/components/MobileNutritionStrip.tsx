import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { type ProductProps } from './NutritionCard';
import { useApp } from '../context/AppContext';
import { useProducts } from '../data/products';
import { loadCustomProducts } from './CustomProductModal';
import { toast } from 'sonner';

/**
 * Mobile nutrition strip — a horizontal product carousel above the
 * elevation profile. Pure native scroll: no pointer events, no JS-driven
 * drag detection, no global listeners. Earlier versions tried to layer a
 * long-press-to-drag gesture on top and that subtly broke iOS Safari's
 * horizontal swipe handling.
 *
 * Tap a card to add it as a fuel point at the next-best position along
 * the route (evenly distributed). Users can move the marker afterwards
 * by dragging it on the map. Drag-from-strip to place can be re-added
 * later if needed, but only with a gesture model that doesn't interfere
 * with the native scroll.
 */

export function MobileNutritionStrip() {
  const { addNutritionPoint, routeData } = useApp();
  const products = useProducts();
  const [customProducts, setCustomProducts] = useState<ProductProps[]>(loadCustomProducts);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setCustomProducts(loadCustomProducts());
  }, []);

  const allProducts = useMemo(() => [...customProducts, ...products], [products, customProducts]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allProducts;
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    );
  }, [allProducts, query]);

  function onCardTap(product: ProductProps) {
    // Place the fuel point at an evenly distributed position. We slot it
    // into the largest gap between existing fuel points (or the start/end
    // of the route if none yet). Users can drag the marker on the map to
    // move it after.
    const totalKm = routeData.distanceKm;
    if (!totalKm) return;
    const existing = [...routeData.nutritionPoints]
      .map((n) => n.distanceKm)
      .sort((a, b) => a - b);
    const points = [0, ...existing, totalKm];
    let bestGapKm = 0;
    let bestMidKm = totalKm / 2;
    for (let i = 1; i < points.length; i++) {
      const gap = points[i] - points[i - 1];
      if (gap > bestGapKm) {
        bestGapKm = gap;
        bestMidKm = (points[i - 1] + points[i]) / 2;
      }
    }
    addNutritionPoint(product, bestMidKm);
    toast.success(`Added ${product.name} at ${bestMidKm.toFixed(1)} km — drag on map to move`);
  }

  return (
    <div className="lg:hidden bg-surfaceHighlight border-t border-[var(--color-border)] flex-shrink-0">
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider">
          Fuel · tap to add
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setSearchOpen((o) => !o)}
          aria-label={searchOpen ? 'Close search' : 'Search products'}
          className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
        >
          {searchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
        </button>
      </div>

      {searchOpen && (
        <div className="px-3 pb-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Search products…"
            className="w-full h-8 bg-surface border border-[var(--color-border)] rounded-lg px-2.5 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 font-display"
          />
        </div>
      )}

      {/* Bare native scroll. No pointer events, no touch-action overrides,
          no JS interference. Just a flex row with overflow-x: auto and
          fixed-width children. */}
      <div
        className="flex gap-2 px-3 pb-2 overflow-x-auto overflow-y-hidden no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {visibleProducts.length === 0 ? (
          <div className="text-[11px] text-text-muted py-3 font-display">
            No products match "{query}".
          </div>
        ) : (
          visibleProducts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onCardTap(p)}
              style={{
                background: `${p.color}15`,
                borderColor: `${p.color}40`,
              }}
              className="flex-shrink-0 flex flex-col items-start text-left rounded-lg border px-2 py-1.5 w-[110px] active:opacity-70 transition-opacity"
            >
              <div
                className="text-[8.5px] font-display font-bold uppercase tracking-wider truncate w-full"
                style={{ color: p.color }}
              >
                {p.brand}
              </div>
              <div className="text-[11px] font-display font-semibold text-text-primary truncate w-full leading-tight mt-0.5">
                {p.name}
              </div>
              <div className="text-[9.5px] text-text-muted font-display tabular-nums mt-1">
                {p.carbs}g · {p.calories}kcal
              </div>
            </button>
          ))
        )}
        <div className="flex-shrink-0 w-1" aria-hidden />
      </div>
    </div>
  );
}
