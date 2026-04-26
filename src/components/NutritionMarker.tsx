import { useEffect, useRef, useState } from 'react';
import { ProductProps } from './NutritionCard';
import { NutritionDetailCard } from './NutritionDetailCard';

interface NutritionMarkerProps {
  product: ProductProps;
  distanceKm: number;
  onRemove: () => void;
  style?: React.CSSProperties;
}

export function NutritionMarker({
  product,
  distanceKm,
  onRemove,
  style,
}: NutritionMarkerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`group relative flex flex-col items-center transition-transform duration-200 hover:scale-110 focus:scale-110 focus:outline-none ${open ? 'scale-110' : ''}`}
        aria-label={`${product.brand} ${product.name} at ${distanceKm.toFixed(1)}km. Click to view or delete.`}
      >
        <div className={`w-10 h-10 rounded-full overflow-hidden shadow-lg border-2 ${open ? 'border-red-500' : 'border-white'} bg-surface transition-colors`}>
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
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

      {/* Card — opens on click, closes on outside click / Escape / X */}
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-150">
          <NutritionDetailCard
            product={product}
            distanceKm={distanceKm}
            onClose={() => setOpen(false)}
            onRemove={onRemove}
          />
          <div className="w-2 h-2 bg-surface border-r border-b border-[var(--color-border)] transform rotate-45 absolute bottom-[-5px] left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
}
