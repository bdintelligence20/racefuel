import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { type ProductProps } from './NutritionCard';
import { useApp } from '../context/AppContext';
import { useMap } from '../context/MapContext';
import { useProducts } from '../data/products';
import { loadCustomProducts } from './CustomProductModal';

/**
 * Mobile nutrition strip — horizontal product picker above the elevation
 * profile.
 *
 *   - Swipe left/right anywhere on the strip → browser-native horizontal
 *     scroll. NO global non-passive pointermove listener while the user
 *     is just browsing — earlier versions registered one during the
 *     "intent" phase of drag detection and that was racing the browser's
 *     scroll handler, blocking horizontal swipes entirely.
 *   - Long-press a card (~280ms hold) → enters drag mode. We then register
 *     a window-level pointermove listener and follow the finger to a drop
 *     on the route line. Quick taps with motion before the timer fires
 *     cancel the press locally on the card.
 *
 * The split between "card-local pointer events for press detection"
 * and "window-level pointer events for active drag" is the trick that
 * keeps native horizontal scroll working.
 */

const LONG_PRESS_MS = 280;
const PRESS_CANCEL_PX = 8;

export function MobileNutritionStrip() {
  const { addNutritionPoint, routeData } = useApp();
  const map = useMap();
  const products = useProducts();
  const [customProducts, setCustomProducts] = useState<ProductProps[]>(loadCustomProducts);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [drag, setDrag] = useState<{ product: ProductProps; x: number; y: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // Per-card press tracking. Lives in refs so we don't re-render on every
  // pointermove event during the intent phase.
  const pressRef = useRef<{
    product: ProductProps;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

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

  function cancelPress() {
    const p = pressRef.current;
    if (p?.timer) clearTimeout(p.timer);
    pressRef.current = null;
  }

  /* ───────────────── card-local pointer handlers ───────────────── */

  function onCardPointerDown(e: React.PointerEvent, product: ProductProps) {
    if (e.pointerType === 'mouse') return; // mouse uses native HTML5 drag
    cancelPress();
    pressRef.current = {
      product,
      startX: e.clientX,
      startY: e.clientY,
      timer: setTimeout(() => {
        const p = pressRef.current;
        if (!p) return;
        // Long-press tripped → enter drag mode.
        setDrag({ product: p.product, x: p.startX, y: p.startY });
        try { (navigator as any).vibrate?.(15); } catch {}
      }, LONG_PRESS_MS),
    };
  }

  function onCardPointerMove(e: React.PointerEvent) {
    const p = pressRef.current;
    if (!p) return;
    if (Math.abs(e.clientX - p.startX) > PRESS_CANCEL_PX || Math.abs(e.clientY - p.startY) > PRESS_CANCEL_PX) {
      cancelPress();
    }
  }

  /* ─────────── window-level handlers for active drag only ─────────── */

  // Critically: this effect only runs (and only registers the global
  // listeners) once we've actually entered drag mode. During the intent
  // phase, no global non-passive listener exists, so the browser is free
  // to handle horizontal swipes natively.
  useEffect(() => {
    if (!drag) return;

    function onMove(e: PointerEvent) {
      // Now that drag is active, blocking page scroll IS what we want.
      if (e.cancelable) e.preventDefault();
      const cur = dragRef.current;
      if (!cur) return;
      setDrag({ ...cur, x: e.clientX, y: e.clientY });
    }
    function onUp(e: PointerEvent) {
      const cur = dragRef.current;
      setDrag(null);
      if (cur) placeFromScreenCoords(cur.product, e.clientX, e.clientY);
    }
    function onCancel() {
      setDrag(null);
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  function placeFromScreenCoords(product: ProductProps, clientX: number, clientY: number) {
    if (!map) return;
    const mapEl = map.getContainer();
    const rect = mapEl.getBoundingClientRect();
    const inside =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (!inside) return;

    const gps = routeData.gpsPath;
    if (!gps || gps.length === 0) return;

    const lngLat = map.unproject([clientX - rect.left, clientY - rect.top]);
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < gps.length; i++) {
      const dx = gps[i].lng - lngLat.lng;
      const dy = gps[i].lat - lngLat.lat;
      const d = dx * dx + dy * dy;
      if (d < closestDist) {
        closestDist = d;
        closestIdx = i;
      }
    }
    const distanceKm = (closestIdx / Math.max(1, gps.length - 1)) * routeData.distanceKm;
    addNutritionPoint(product, distanceKm);
  }

  function handleDragStart(e: React.DragEvent, product: ProductProps) {
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <>
      <div className="lg:hidden bg-surfaceHighlight border-t border-[var(--color-border)] flex-shrink-0 w-full min-w-0">
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider">
            Fuel · hold &amp; drag onto route
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

        <div
          className="flex gap-2 px-3 pb-2 overflow-x-auto overflow-y-hidden no-scrollbar w-full"
          style={{
            // pan-x lets the browser horizontally scroll the strip natively;
            // none locks scrolling once we're actively dragging.
            touchAction: drag ? 'none' : 'pan-x',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            // Without min-width: 0, the flex container expands to fit its
            // children's intrinsic width and overflow-x-auto never triggers.
            minWidth: 0,
          }}
        >
          {visibleProducts.length === 0 ? (
            <div className="text-[11px] text-text-muted py-3 font-display">
              No products match "{query}".
            </div>
          ) : (
            visibleProducts.map((p) => {
              const isDragging = drag?.product.id === p.id;
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p)}
                  onPointerDown={(e) => onCardPointerDown(e, p)}
                  onPointerMove={onCardPointerMove}
                  onPointerCancel={cancelPress}
                  onPointerUp={cancelPress}
                  style={{
                    background: `${p.color}15`,
                    borderColor: `${p.color}40`,
                    WebkitTapHighlightColor: 'transparent',
                    WebkitTouchCallout: 'none',
                  }}
                  className={`flex-shrink-0 flex flex-col items-start text-left rounded-lg border px-2 py-1.5 w-[110px] cursor-grab active:cursor-grabbing select-none transition-opacity ${
                    isDragging ? 'opacity-30' : 'opacity-100'
                  }`}
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
                </div>
              );
            })
          )}
          <div className="flex-shrink-0 w-1" />
        </div>
      </div>

      {drag &&
        createPortal(
          <div
            aria-hidden
            className="fixed z-[100] pointer-events-none"
            style={{ left: drag.x - 60, top: drag.y - 30, willChange: 'transform' }}
          >
            <div
              style={{ background: `${drag.product.color}30`, borderColor: drag.product.color }}
              className="rounded-lg border-2 px-2.5 py-1.5 shadow-xl bg-surface/95"
            >
              <div
                className="text-[8.5px] font-display font-bold uppercase tracking-wider"
                style={{ color: drag.product.color }}
              >
                {drag.product.brand}
              </div>
              <div className="text-[11px] font-display font-semibold text-text-primary leading-tight max-w-[120px] truncate">
                {drag.product.name}
              </div>
              <div className="text-[9px] text-text-muted font-display tabular-nums mt-0.5">
                {drag.product.carbs}g
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
