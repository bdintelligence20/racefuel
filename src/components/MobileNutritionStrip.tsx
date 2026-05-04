import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { type ProductProps } from './NutritionCard';
import { useApp } from '../context/AppContext';
import { useProducts } from '../data/products';
import { loadCustomProducts } from './CustomProductModal';

/**
 * Mobile-only quick-access nutrition strip rendered just above the elevation
 * profile. The desktop sidebar (NutritionPanel) keeps full search + filters;
 * this is the bare minimum for placing a fuel point without leaving the map.
 *
 * Drag mechanics:
 *  - Desktop (mouse): pointer events fall back to native HTML5 drag via the
 *    same `application/json` dataTransfer payload the elevation profile
 *    already accepts in MapCanvas.handleElevationDrop. No separate path.
 *  - Mobile (touch): HTML5 dragstart never fires on touch, so we roll our
 *    own. `pointerdown` on a card starts intent-detection: if the finger
 *    moves >6px vertically before any meaningful horizontal motion, we lock
 *    into drag mode, capture the pointer, and render a portal-mounted ghost
 *    that follows the finger. On `pointerup`, if the finger is inside the
 *    elevation profile rect, we compute distanceKm from the x position and
 *    call addNutritionPoint. Horizontal swipes still scroll the strip
 *    naturally because we only intercept once vertical intent is clear.
 */

interface Props {
  /** Ref to the elevation profile container — used to hit-test pointer-up
   *  position and convert x → km. */
  elevationRef: RefObject<HTMLDivElement | null>;
  routeKm: number;
}

const VERTICAL_DRAG_THRESHOLD = 8; // px before we lock into drag mode

export function MobileNutritionStrip({ elevationRef, routeKm }: Props) {
  const { addNutritionPoint, selectedBundleId } = useApp();
  const products = useProducts();
  const [customProducts, setCustomProducts] = useState<ProductProps[]>(loadCustomProducts);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [drag, setDrag] = useState<DragState | null>(null);

  // Strip ref so we can ignore drag-arm events that originate over a scrolling
  // gesture inside the strip itself.
  const stripRef = useRef<HTMLDivElement>(null);

  // Don't bother loading custom products from cloud here; the main
  // NutritionPanel hydrates them when it mounts. We just snapshot localStorage
  // so the strip shows them too.
  useEffect(() => {
    setCustomProducts(loadCustomProducts());
  }, []);

  const allProducts = useMemo(
    () => [...customProducts, ...products],
    [products, customProducts]
  );

  // Keep the strip short — show a curated set unless the user opens search.
  const visibleProducts = useMemo(() => {
    if (query.trim()) {
      const q = query.toLowerCase();
      return allProducts
        .filter(p => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
        .slice(0, 30);
    }
    // No query: show first 18 products. The bundle/most-recent ordering is a
    // future improvement; for now the user can search if they want something
    // specific, or open the full Fuel tab.
    return allProducts.slice(0, 18);
  }, [allProducts, query]);

  /* -------------------- pointer-events drag -------------------- */

  // Document-level pointermove + pointerup once a drag starts. We attach to
  // window so a fast-moving finger doesn't escape the card.
  useEffect(() => {
    if (!drag) return;

    function onMove(e: PointerEvent) {
      if (!drag) return;
      if (drag.phase === 'intent') {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        // Vertical intent → lock into drag. Horizontal → cancel and let the
        // strip's native horizontal scroll take over.
        if (Math.abs(dy) > VERTICAL_DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
          setDrag(d => (d ? { ...d, phase: 'dragging', x: e.clientX, y: e.clientY } : d));
        } else if (Math.abs(dx) > VERTICAL_DRAG_THRESHOLD) {
          setDrag(null);
        }
        return;
      }
      // dragging: update ghost position
      setDrag(d => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    }

    function onUp(e: PointerEvent) {
      if (!drag || drag.phase !== 'dragging') {
        setDrag(null);
        return;
      }
      const elev = elevationRef.current;
      if (elev) {
        const rect = elev.getBoundingClientRect();
        const inside =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        if (inside) {
          const x = e.clientX - rect.left;
          const pct = Math.max(0, Math.min(1, x / rect.width));
          const distanceKm = pct * routeKm;
          addNutritionPoint(drag.product, distanceKm);
        }
      }
      setDrag(null);
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
  }, [drag, addNutritionPoint, elevationRef, routeKm]);

  function handlePointerDown(e: React.PointerEvent, product: ProductProps) {
    // Only handle touch + pen here. Mouse drags fall through to the native
    // HTML5 drag listeners on the same card, which the elevation already
    // accepts via handleElevationDrop in MapCanvas.
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

  // Native HTML5 drag for mouse — same payload format the existing elevation
  // drop handler expects. We don't reuse this code for touch because mobile
  // browsers don't fire dragstart.
  function handleDragStart(e: React.DragEvent, product: ProductProps) {
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <>
      <div
        ref={stripRef}
        className="lg:hidden bg-surfaceHighlight border-t border-[var(--color-border)] flex-shrink-0"
        style={{ touchAction: drag?.phase === 'dragging' ? 'none' : 'pan-x' }}
      >
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <span className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider">
            Fuel · drag onto elevation
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

        {/* Optional search input */}
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

        {/* Horizontal product strip */}
        <div className="flex gap-2 px-3 pb-2 overflow-x-auto no-scrollbar">
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
                  className={`flex-shrink-0 flex flex-col items-start text-left rounded-lg border px-2 py-1.5 min-w-[96px] max-w-[120px] cursor-grab active:cursor-grabbing transition-opacity ${
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
          {/* Spacer so the last card doesn't kiss the right edge */}
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
            style={{
              left: drag.x - 60,
              top: drag.y - 30,
              willChange: 'transform',
            }}
          >
            <div
              style={{ background: `${drag.product.color}30`, borderColor: drag.product.color }}
              className="rounded-lg border-2 px-2.5 py-1.5 shadow-lg backdrop-blur-sm bg-surface/95"
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
  // selectedBundleId reserved for a follow-up that orders the strip by what's
  // already in the active bundle. Touch reference so the linter doesn't flag.
  void selectedBundleId;
}

interface DragIntent {
  phase: 'intent';
  product: ProductProps;
  startX: number;
  startY: number;
  x: number;
  y: number;
}
interface DragActive {
  phase: 'dragging';
  product: ProductProps;
  startX: number;
  startY: number;
  x: number;
  y: number;
}
type DragState = DragIntent | DragActive;
