import { useEffect, useRef, useState } from 'react';
import { ProductProps } from './NutritionCard';
import { Trash2, X } from 'lucide-react';

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

  const colorMap: Record<string, string> = {
    orange: 'bg-accent border-accent',
    blue: 'bg-warm border-warm',
    white: 'bg-white border-white',
    green: 'bg-accent-light border-accent-light',
    red: 'bg-red-500 border-red-500',
    yellow: 'bg-yellow-500 border-yellow-500',
  };

  const stemColor = colorMap[product.color]?.split(' ')[0] || 'bg-accent';

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
      className="absolute transform -translate-x-1/2 -translate-y-full z-30"
      style={style}
    >
      {/* Pin — clickable */}
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
        <div className={`w-0.5 h-4 ${stemColor}`} />
        <div className="w-2 h-2 bg-white rounded-full border-2 border-black" />

        {/* Distance label */}
        <div className="absolute top-full mt-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-display text-white whitespace-nowrap">
          {distanceKm.toFixed(1)}km
        </div>
      </button>

      {/* Card — opens on click, closes on outside click / Escape / X */}
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[180px] animate-in fade-in slide-in-from-bottom-1 duration-150">
          <div className="bg-surface border border-[var(--color-border)] p-3 shadow-xl rounded-lg">
            <div className="flex justify-between items-start gap-2 mb-1">
              <span className="text-[10px] font-display text-text-muted uppercase tracking-wider">
                {product.brand}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
                className="text-text-muted hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-sm font-display font-bold text-text-primary mb-1.5 leading-tight">
              {product.name}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-display mb-2">
              <span className="text-accent font-semibold">{product.carbs}g CHO</span>
              <span className="text-text-secondary">@ {distanceKm.toFixed(1)}km</span>
              {product.priceZAR ? (
                <span className="text-warm">R{product.priceZAR.toFixed(2)}</span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
                setOpen(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white text-xs font-display font-bold uppercase tracking-wider transition-all active:scale-[0.97]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Point
            </button>
          </div>
          {/* Arrow */}
          <div className="w-2 h-2 bg-surface border-r border-b border-[var(--color-border)] transform rotate-45 absolute bottom-[-5px] left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
}
