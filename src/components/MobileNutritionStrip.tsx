import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { type ProductProps } from './NutritionCard';
import { useApp } from '../context/AppContext';
import { useMap } from '../context/MapContext';
import { useProducts } from '../data/products';
import { loadCustomProducts } from './CustomProductModal';

/**
 * Mobile-only nutrition strip rendered just above the elevation profile.
 * Drag a card *down onto the map* to drop a fuel point at the closest
 * position on the route line.
 *
 * Drag mechanics:
 *  - Mouse: native HTML5 dragstart with the existing application/json
 *    payload, picked up by MapView.handleDrop unchanged.
 *  - Touch / pen: pointer-events drag with vertical-intent detection.
 *    pointerdown on a card enters intent. If the finger moves >8px
 *    vertically before significant horizontal motion, we lock into
 *    drag mode and follow the finger with a portal-mounted ghost.
 *    Horizontal swipes still scroll the strip naturally because we only
 *    intercept once vertical intent is clear. On pointerup over the map
 *    container, we use mapbox.unproject to convert the screen coords to
 *    lng/lat, find the closest GPS path vertex, and place the fuel
 *    point at that distance.
 */

const VERTICAL_DRAG_THRESHOLD = 8; // px before we lock into drag mode

export function MobileNutritionStrip() {
  const { addNutritionPoint, routeData, selectedBundleId } = useApp();
  const map = useMap();
  const products = useProducts();
  const [customProducts, setCustomProducts] = useState<ProductProps[]>(loadCustomProducts);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

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
        .filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
        .slice(0, 30);
    }
    return allProducts.slice(0, 24);
  }, [allProducts, query]);

  /* -------------------- pointer-events drag -------------------- */

  useEffect(() => {
    if (!drag) return;

    function onMove(e: PointerEvent) {
      const cur = dragRef.current;
      if (!cur) return;
      if (cur.phase === 'intent') {
        const dx = e.clientX - cur.startX;
        const dy = e.clientY - cur.startY;
        if (dy < -VERTICAL_DRAG_THRESHOLD || (Math.abs(dy) > VERTICAL_DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx))) {
          // Lock into drag — vertical motion clearly intended.
          setDrag({ ...cur, phase: 'dragging', x: e.clientX, y: e.clientY });
          // Once we're dragging we want absolute control over pointer events.
          if (e.cancelable) e.preventDefault();
        } else if (Math.abs(dx) > VERTICAL_DRAG_THRESHOLD * 1.5) {
          // Mostly horizontal — user is trying to scroll the strip; bail.
          setDrag(null);
        }
        return;
      }
      // dragging
      if (e.cancelable) e.preventDefault();
      setDrag({ ...cur, x: e.clientX, y: e.clientY });
    }

    function onUp(e: PointerEvent) {
      const cur = dragRef.current;
      setDrag(null);
      if (!cur || cur.phase !== 'dragging') return;
      placeFromScreenCoords(cur.product, e.clientX, e.clientY);
    }

    function onCancel() {
      setDrag(null);
    }

    // passive: false so we can preventDefault on pointermove during drag,
    // which stops the browser from interpreting it as a page scroll.
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // The handlers read the latest drag via dragRef, so we only re-bind on
    // the on/off transition, not every drag-state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  function placeFromScreenCoords(product: ProductProps, clientX: number, clientY: number) {
    if (!map) return;
    const mapEl = map.getContainer();
    const rect = mapEl.getBoundingClientRect();
    const inside =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;
    if (!inside) return;

    const gps = routeData.gpsPath;
    if (!gps || gps.length === 0) return;

    const lngLat = map.unproject([clientX - rect.left, clientY - rect.top]);

    // Closest GPS vertex by haversine in lng/lat space (good enough for picking).
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

  function handlePointerDown(e: React.PointerEvent, product: ProductProps) {
    // Mouse drags use HTML5 native drag (already wired). Only catch touch + pen here.
    if (e.pointerType === 'mouse') return;
    setDrag({
      phase: 'intent',
      product,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
    });
  }

  function handleDragStart(e: React.DragEvent, product: ProductProps) {
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <>
      <div className="lg:hidden bg-surfaceHighlight border-t border-[var(--color-border)] flex-shrink-0">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider">
            Fuel · drag onto route
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setSearchOpen(o => !o)}
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

        {/* Horizontal product strip — pan-x lets the browser handle the
            scroll itself; pointer-events drag only kicks in when the user
            pulls vertically (toward the map). */}
        <div
          className="flex gap-2 px-3 pb-2 overflow-x-auto overflow-y-hidden"
          style={{
            touchAction: drag?.phase === 'dragging' ? 'none' : 'pan-x',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {visibleProducts.length === 0 ? (
            <div className="text-[11px] text-text-muted py-3 font-display">
              No products match "{query}".
            </div>
          ) : (
            visibleProducts.map((p) => {
              const isDragging = drag?.product.id === p.id && drag.phase === 'dragging';
              return (
                <button
                  key={p.id}
                  type="button"
                  draggable
                  onDragStart={(e) => handleDragStart(e, p)}
                  onPointerDown={(e) => handlePointerDown(e, p)}
                  style={{ background: `${p.color}15`, borderColor: `${p.color}40` }}
                  className={`flex-shrink-0 flex flex-col items-start text-left rounded-lg border px-2 py-1.5 w-[110px] cursor-grab active:cursor-grabbing transition-opacity select-none ${
                    isDragging ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  <div className="text-[8.5px] font-display font-bold uppercase tracking-wider truncate w-full" style={{ color: p.color }}>
                    {p.brand}
                  </div>
                  <div className="text-[11px] font-display font-semibold text-text-primary truncate w-full leading-tight mt-0.5">
                    {p.name}
                  </div>
                  <div className="text-[9.5px] text-text-muted font-display tabular-nums mt-1">
                    {p.carbs}g · {p.calories}kcal
                  </div>
                </button>
              );
            })
          )}
          <div className="flex-shrink-0 w-1" />
        </div>
      </div>

      {/* Floating drag ghost — portaled to body so it's not clipped by parent
          overflow / scroll containers. */}
      {drag?.phase === 'dragging' &&
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
              <div className="text-[8.5px] font-display font-bold uppercase tracking-wider" style={{ color: drag.product.color }}>
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

  void selectedBundleId;
}

interface DragState {
  phase: 'intent' | 'dragging';
  product: ProductProps;
  startX: number;
  startY: number;
  x: number;
  y: number;
}
