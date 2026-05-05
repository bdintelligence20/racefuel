import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { type ProductCategory, type ProductProps } from './NutritionCard';
import { useApp } from '../context/AppContext';
import { useMap } from '../context/MapContext';
import { useProducts } from '../data/products';
import { loadCustomProducts } from './CustomProductModal';
import { ProductDetailModal } from './ProductDetailModal';
import useEmblaCarousel from 'embla-carousel-react';

/**
 * Mobile fuel strip — Embla carousel + long-press-to-drag.
 *
 * Embla handles the horizontal swipe / momentum perfectly. For drag-onto-map
 * we layer a long-press timer on top: touch and hold a card for ~280ms and
 * the carousel pauses while a floating ghost follows the finger; release
 * over the route on the map to drop a fuel point at the closest GPS vertex.
 * Quick swipes don't trigger the timer so Embla's scroll is uninterrupted.
 *
 * Category filter chips at the top let users narrow the catalogue to gels,
 * drinks, bars, or chews.
 */

const LONG_PRESS_MS = 280;
const PRESS_CANCEL_PX = 8;

type CategoryFilter = 'all' | ProductCategory;

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All',
  gel: 'Gels',
  drink: 'Drinks',
  bar: 'Bars',
  chew: 'Chews',
};

export function MobileNutritionStrip() {
  const { addNutritionPoint, routeData } = useApp();
  const map = useMap();
  const products = useProducts();
  const [customProducts, setCustomProducts] = useState<ProductProps[]>(loadCustomProducts);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [detailProduct, setDetailProduct] = useState<ProductProps | null>(null);

  const [drag, setDrag] = useState<{ product: ProductProps; x: number; y: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const pressRef = useRef<{
    product: ProductProps;
    pointerId: number;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  // When the long-press timer fires (drag mode begins) we set this so the
  // synthetic click that follows pointerup doesn't also open the detail
  // modal. Using a ref instead of `pressRef.firedLongPress` because Embla
  // can capture the pointer mid-gesture, and the card's pointerup handler
  // may not run before its onClick fires.
  const suppressNextClickRef = useRef(false);

  // Embla in free-scroll mode. `watchDrag: !drag` disables Embla's drag
  // handler the moment we enter long-press drag mode, so the carousel
  // doesn't keep scrolling under the floating ghost.
  // `containScroll: 'keepSnaps'` ensures every slide is reachable — the
  // previous `trimSnaps` value combined with viewport padding meant the
  // last few products couldn't be scrolled fully into view.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'x',
    dragFree: true,
    containScroll: 'keepSnaps',
    watchDrag: drag === null,
  });

  // Tell Embla to recalculate when our drag state flips so its internal
  // "is dragging" flag matches the current watchDrag option.
  useEffect(() => {
    emblaApi?.reInit();
  }, [drag, emblaApi]);

  useEffect(() => {
    setCustomProducts(loadCustomProducts());
  }, []);

  const allProducts = useMemo(() => [...customProducts, ...products], [products, customProducts]);

  const visibleProducts = useMemo(() => {
    let pool = allProducts;
    if (filter !== 'all') pool = pool.filter((p) => p.category === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
      );
    }
    return pool;
  }, [allProducts, filter, query]);

  /* ──────────────── long-press detection ──────────────── */

  function cancelPress() {
    const p = pressRef.current;
    if (p?.timer) clearTimeout(p.timer);
    pressRef.current = null;
  }

  function onCardPointerDown(e: React.PointerEvent, product: ProductProps) {
    cancelPress();
    pressRef.current = {
      product,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      // Touch: long-press triggers drag-to-map. Mouse: no long-press —
      // drag is triggered by mouse *movement* (see pointermove below).
      // This way, a quick mousedown+mouseup with no movement stays a
      // plain click, so the detail modal opens on desktop too.
      timer:
        e.pointerType === 'mouse'
          ? null
          : setTimeout(() => {
              const p = pressRef.current;
              if (!p) return;
              suppressNextClickRef.current = true;
              setDrag({ product: p.product, x: p.startX, y: p.startY });
              try { (navigator as any).vibrate?.(15); } catch {}
            }, LONG_PRESS_MS),
    };
  }

  function onCardPointerMove(e: React.PointerEvent) {
    const p = pressRef.current;
    if (!p) return;
    if (
      Math.abs(e.clientX - p.startX) > PRESS_CANCEL_PX ||
      Math.abs(e.clientY - p.startY) > PRESS_CANCEL_PX
    ) {
      if (e.pointerType === 'mouse') {
        // Mouse moved past the slop — user is dragging, not clicking.
        // Enter drag mode now and suppress the click that follows mouseup.
        suppressNextClickRef.current = true;
        setDrag({ product: p.product, x: e.clientX, y: e.clientY });
        pressRef.current = null;
      } else {
        // Touch: assume the user is swiping the carousel. Cancel the
        // long-press AND suppress the synthetic click so a swipe can't
        // accidentally open the modal mid-scroll.
        cancelPress();
        suppressNextClickRef.current = true;
      }
    }
  }

  // Tap-to-open uses native onClick. Browsers already debounce click on
  // touch (no click fires for swipes), and the suppression ref above
  // handles the long-press→drag case.
  function onCardClick(product: ProductProps) {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    setDetailProduct(product);
  }

  /* ──────────────── window-level drag handlers (only when active) ──────────────── */

  useEffect(() => {
    if (!drag) return;

    function onMove(e: PointerEvent) {
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

  return (
    <>
      <div className="lg:hidden bg-surfaceHighlight border-t border-[var(--color-border)] flex-shrink-0">
        {/* Header row */}
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
          <div className="px-3 pb-1.5">
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

        {/* Category filter chips */}
        <div className="flex gap-1.5 px-3 pb-1.5 overflow-x-auto no-scrollbar">
          {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={`flex-shrink-0 h-6 px-2.5 rounded-full text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? 'bg-accent text-white border border-accent'
                    : 'bg-surface text-text-muted border border-[var(--color-border)] hover:text-text-primary'
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            );
          })}
        </div>

        {/* Embla viewport — drag is disabled in real-time when our long-press
            kicks in, so the carousel won't keep moving under the ghost.
            Padding lives on the inner flex container (px-3) — when it was
            on the viewport, Embla's scroll calc included the padding and
            the last few cards couldn't scroll fully into view. */}
        <div className="overflow-hidden pb-2" ref={emblaRef}>
          <div className="flex gap-2 px-3">
            {visibleProducts.length === 0 ? (
              <div className="text-[11px] text-text-muted py-3 font-display">
                No products match.
              </div>
            ) : (
              visibleProducts.map((p) => {
                const isDragging = drag?.product.id === p.id;
                return (
                  <div
                    key={p.id}
                    onPointerDown={(e) => onCardPointerDown(e, p)}
                    onPointerMove={onCardPointerMove}
                    onPointerCancel={cancelPress}
                    onPointerUp={cancelPress}
                    onClick={() => onCardClick(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDetailProduct(p);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${p.brand} ${p.name} — tap for details, hold and drag onto route to add`}
                    style={{
                      // Solid surface bg + colored top-bar (below) for brand
                      // identity. Previous approach (translucent brand-color
                      // tint + brand-color text) was illegible whenever the
                      // brand color was pale (yellow / mint).
                      borderColor: `${p.color}40`,
                      flex: '0 0 124px',
                      WebkitTapHighlightColor: 'transparent',
                      WebkitTouchCallout: 'none',
                    }}
                    className={`relative flex flex-col items-start text-left rounded-lg border bg-surface overflow-hidden px-2.5 pt-2.5 pb-2 cursor-grab active:cursor-grabbing select-none transition-opacity ${
                      isDragging ? 'opacity-30' : 'opacity-100'
                    }`}
                  >
                    {/* Brand-color accent bar across the top — gives every
                        card a visible brand identity without compromising
                        text contrast. */}
                    <span
                      aria-hidden
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ background: p.color }}
                    />
                    <div className="text-[8.5px] font-display font-bold uppercase tracking-wider truncate w-full text-text-muted">
                      {p.brand}
                    </div>
                    <div className="text-[11.5px] font-display font-semibold text-text-primary leading-tight mt-0.5 line-clamp-2 min-h-[28px] w-full">
                      {p.name}
                    </div>
                    <div className="mt-1 flex items-baseline gap-1 w-full">
                      <span className="text-[13px] font-display font-bold text-text-primary tabular-nums">{p.carbs}</span>
                      <span className="text-[9px] text-text-muted font-display uppercase tracking-wider">g carbs</span>
                    </div>
                    <div className="text-[9px] text-text-muted font-display tabular-nums">
                      {p.calories} kcal · R{p.priceZAR.toFixed(0)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Product detail modal — opened by a quick tap on a card. The
          onAddToRoute callback drops the product at the route midpoint as
          a starter; users can drag the marker afterwards. */}
      <ProductDetailModal
        product={detailProduct}
        isOpen={detailProduct !== null}
        onClose={() => setDetailProduct(null)}
        onAddToRoute={(product) => {
          if (routeData.loaded) {
            addNutritionPoint(product, routeData.distanceKm / 2);
          }
        }}
      />

      {/* Floating drag ghost */}
      {drag &&
        createPortal(
          <div
            aria-hidden
            className="fixed z-[200] pointer-events-none"
            style={{ left: drag.x - 60, top: drag.y - 30, willChange: 'transform' }}
          >
            <div
              style={{ borderColor: drag.product.color }}
              className="relative rounded-lg border-2 px-2.5 py-1.5 shadow-xl bg-surface overflow-hidden"
            >
              <span
                aria-hidden
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: drag.product.color }}
              />
              <div className="text-[8.5px] font-display font-bold uppercase tracking-wider text-text-muted mt-0.5">
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
