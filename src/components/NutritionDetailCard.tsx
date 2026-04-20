import { Trash2, X } from 'lucide-react';
import { ProductProps } from './NutritionCard';

interface NutritionDetailCardProps {
  product: ProductProps;
  distanceKm: number;
  onClose: () => void;
  onRemove: () => void;
  /**
   * Tailwind size class for the card. Defaults to `min-w-[180px]` which works
   * for both the elevation-profile popover and the map popover.
   */
  sizeClassName?: string;
}

/**
 * Shared detail card for nutrition points. Used by:
 * - Elevation profile marker (click-to-open)
 * - Map marker (click-to-open, via a React popover)
 *
 * Keep this presentational — the parent owns the open/close state.
 */
export function NutritionDetailCard({
  product,
  distanceKm,
  onClose,
  onRemove,
  sizeClassName = 'min-w-[180px]',
}: NutritionDetailCardProps) {
  return (
    <div className={sizeClassName}>
      <div className="bg-surface border border-[var(--color-border)] p-3 shadow-xl rounded-lg">
        <div className="flex justify-between items-start gap-2 mb-1">
          <span className="text-[10px] font-display text-text-muted uppercase tracking-wider">
            {product.brand}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
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
            onClose();
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white text-xs font-display font-bold uppercase tracking-wider transition-all active:scale-[0.97]"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Point
        </button>
      </div>
    </div>
  );
}
