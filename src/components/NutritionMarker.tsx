import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProductProps } from './NutritionCard';
import { NutritionDetailCard } from './NutritionDetailCard';

interface NutritionMarkerProps {
  product: ProductProps;
  distanceKm: number;
  onRemove: () => void;
  style?: React.CSSProperties;
  /** When provided, the marker becomes draggable along the elevation chart.
   *  Long-press (touch) or mouse-down + drag (desktop) starts a drag — the
   *  parent's onDragStart handler should set its own draggingPointId so its
   *  pointermove handler can move the point. */
  onDragStart?: () => void;
}

const LONG_PRESS_MS = 220;
const PRESS_CANCEL_PX = 6;

export function NutritionMarker({
  product,
  distanceKm,
  onRemove,
  style,
  onDragStart,
}: NutritionMarkerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const pressRef = useRef<{
    startX: number;
    startY: number;
    pointerType: string;
    timer: ReturnType<typeof setTimeout> | null;
    fired: boolean;
  } | null>(null);

  // Close on outside click or Escape. Pointer-down checks both the marker
  // root and the portaled card, since the card is no longer a DOM descendant.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inMarker = rootRef.current?.contains(target);
      const inCard = (target as HTMLElement)?.closest?.('[data-nutrition-popup]');
      if (!inMarker && !inCard) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Track the marker's viewport position so the portaled popup stays anchored
  // through scroll, resize, and elevation-panel collapse/expand transitions.
  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({ left: rect.left + rect.width / 2, top: rect.top });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  function onPressStart(e: React.PointerEvent) {
    if (!onDragStart) return;
    pressRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
      fired: false,
      timer:
        e.pointerType === 'mouse'
          ? null
          : setTimeout(() => {
              const p = pressRef.current;
              if (!p) return;
              p.fired = true;
              try { (navigator as any).vibrate?.(15); } catch { /* ignore */ }
              onDragStart();
            }, LONG_PRESS_MS),
    };
  }
  function onPressMove(e: React.PointerEvent) {
    const p = pressRef.current;
    if (!p) return;
    const dx = Math.abs(e.clientX - p.startX);
    const dy = Math.abs(e.clientY - p.startY);
    if (dx > PRESS_CANCEL_PX || dy > PRESS_CANCEL_PX) {
      if (p.pointerType === 'mouse' && !p.fired) {
        // Mouse moved past the slop — treat as drag start, suppress click.
        p.fired = true;
        onDragStart?.();
      }
      // Touch: cancel the long-press if moved too far before timer fires.
      // Don't bail mid-drag — `fired` already initiated the elevation handler.
      if (!p.fired && p.timer) clearTimeout(p.timer);
    }
  }
  function onPressEnd() {
    const p = pressRef.current;
    if (p?.timer) clearTimeout(p.timer);
    pressRef.current = null;
  }

  return (
    <div
      ref={rootRef}
      // Center the puck on its (left, top) anchor — the elevation chart
      // passes the curve point as that anchor, so the image circle sits
      // directly ON the line. No stem, no extra pin dot.
      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30"
      style={style}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          // Suppress the click that follows a successful drag-start so the
          // detail card doesn't pop while the user is moving the marker.
          if (pressRef.current?.fired) {
            e.stopPropagation();
            return;
          }
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={onPressStart}
        onPointerMove={onPressMove}
        onPointerUp={onPressEnd}
        onPointerCancel={onPressEnd}
        // Suppress the browser's native HTML5 drag (the inner <img> is
        // draggable by default and would pre-empt our pointer-based drag,
        // shipping the image to the elevation drop zone instead).
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        style={{ touchAction: onDragStart ? 'none' : undefined }}
        className={`group relative flex flex-col items-center transition-transform duration-200 hover:scale-110 focus:scale-110 focus:outline-none ${open ? 'scale-110' : ''}`}
        aria-label={`${product.brand} ${product.name} at ${distanceKm.toFixed(1)}km. ${onDragStart ? 'Hold to drag along the route, or tap' : 'Click'} to view or delete.`}
      >
        <div className={`w-10 h-10 rounded-full overflow-hidden shadow-lg border-2 ${open ? 'border-red-500' : 'border-white'} bg-surface transition-colors`}>
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              draggable={false}
              className="w-full h-full object-contain bg-white"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${product.image ? 'hidden' : ''}`}>
            {product.name.charAt(0)}
          </div>
        </div>

        {/* Distance label — sits just below the puck. */}
        <div className="absolute top-full mt-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-display text-white whitespace-nowrap">
          {distanceKm.toFixed(1)}km
        </div>
      </button>

      {/* Card — portaled to <body> with fixed positioning so it floats over
          the entire page instead of being clipped by the elevation panel's
          overflow-x-hidden + bounded height. Anchor follows the marker on
          scroll/resize via useLayoutEffect above. */}
      {open && anchor && createPortal(
        <div
          data-nutrition-popup
          className="fixed z-[60] -translate-x-1/2 -translate-y-full pointer-events-auto animate-in fade-in slide-in-from-bottom-1 duration-150"
          style={{ left: anchor.left, top: anchor.top - 8 }}
        >
          <NutritionDetailCard
            product={product}
            distanceKm={distanceKm}
            onClose={() => setOpen(false)}
            onRemove={onRemove}
          />
          <div className="w-2 h-2 bg-surface border-r border-b border-[var(--color-border)] transform rotate-45 absolute bottom-[-5px] left-1/2 -translate-x-1/2" />
        </div>,
        document.body,
      )}
    </div>
  );
}
