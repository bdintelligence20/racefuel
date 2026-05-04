import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { type ProductProps } from './NutritionCard';
import { useApp } from '../context/AppContext';
import { useMap } from '../context/MapContext';
import { useProducts } from '../data/products';
import { loadCustomProducts } from './CustomProductModal';

/**
 * Mobile nutrition strip — a horizontal product picker that lives just
 * above the elevation profile.
 *
 *   - Swipe left/right anywhere on the strip → scrolls horizontally
 *     through the catalogue. Native browser pan, no JS in the way.
 *   - Long-press a card (~280ms hold) → enters drag mode. A floating
 *     ghost follows the finger; release over the route on the map to
 *     drop a fuel point at the closest GPS vertex.
 *
 * The long-press gate is the key trick: until it fires, we don't
 * interfere with the browser's scroll handling at all. Once it fires we
 * preventDefault on subsequent moves so the page doesn't try to scroll
 * with the drag.
 */

const LONG_PRESS_MS = 280;
// If the finger moves beyond this in either axis BEFORE the timer
// fires, we cancel the press — it's a scroll gesture, not a drag.
const LONG_PRESS_CANCEL_PX = 8;

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

  // Long-press machinery lives in refs so the timer/state across pointer
  // events doesn't trigger React re-renders unnecessarily.
  const pressRef = useRef<{
    pointerId: number;
    product: ProductProps;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  useEffect(() => {
    setCustomProducts(loadCustomProducts());
  }, []);

  const allProducts = useMemo(
    () => [...customProducts, ...products],
    [products, customProducts]
  );

  const visibleProducts = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase();
      return allProducts
        .filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
        .slice(0, 30);
    }
    return allProducts.slice(0, 24);
  }, [allProducts, query]);

  /* ───────────────── pointer event flow ───────────────── */

  function cancelPress() {
    const p = pressRef.current;
    if (p?.timer) clearTimeout(p.timer);
    pressRef.current = null;
  }

  function handlePointerDown(e: React.PointerEvent, product: ProductProps) {
    // Mouse uses the existing HTML5 native drag pipeline (already wired
    // by MapView.handleDrop). We only handle touch + pen here.
    if (e.pointerType === 'mouse') return;

    cancelPress();

    const timer = setTimeout(() => {
      const cur = pressRef.current;
      if (!cur) return;
      // Long-press tripped → enter drag mode.
      setDrag({ product, x: cur.startX, y: cur.startY });
      // Optional haptic — quietly fails if the browser doesn't support it.
      try { (navigator as any).vibrate?.(15); } catch {}
    }, LONG_PRESS_MS);

    pressRef.current = {
      pointerId: e.pointerId,
      product,
      startX: e.clientX,
      startY: e.clientY,
      timer,
    };
  }

  // Window listeners while a press is active OR a drag is in progress.
  // Listeners are passive whenever possible so they never fight the
  // browser's scroll detection.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (dragRef.current) {
        // Already dragging — follow the finger, block the page scroll.
        if (e.cancelable) e.preventDefault();
        setDrag({ ...dragRef.current!, x: e.clientX, y: e.clientY });
        return;
      }
      // Pre-drag: if the finger has wandered, this is a scroll, not a drag.
      const p = pressRef.current;
      if (!p) return;
      const dx = Math.abs(e.clientX - p.startX);
      const dy = Math.abs(e.clientY - p.startY);
      if (dx > LONG_PRESS_CANCEL_PX || dy > LONG_PRESS_CANCEL_PX) {
        cancelPress();
      }
    }

    function onUp(e: PointerEvent) {
      const cur = dragRef.current;
      cancelPress();
      setDrag(null);
      if (cur) placeFromScreenCoords(cur.product, e.clientX, e.clientY);
    }

    function onCancel() {
      cancelPress();
      setDrag(null);
    }

    // Non-passive only matters when we want to preventDefault. We do that
    // exclusively during active drag (handled inside onMove); registering
    // the listener as non-passive is fine.
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, []);

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
    // Native HTML5 drag for mouse users — picked up by MapView.handleDrop.
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <>
      <div className="lg:hidden bg-surfaceHighlight border-t border-[var(--color-border)] flex-shrink-0">
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

        {/* Scrollable card row. touch-action:pan-x lets the browser fully
            handle horizontal swipes; vertical pans are absorbed by our
            long-press detection. */}
        <div
          className="flex gap-2 px-3 pb-2 overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{
            touchAction: drag ? 'none' : 'pan-x',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
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
                  onPointerDown={(e) => handlePointerDown(e, p)}
                  onPointerCancel={cancelPress}
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
