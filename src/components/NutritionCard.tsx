
import { Zap } from 'lucide-react';

export type ProductCategory = 'gel' | 'bar' | 'drink' | 'chew';

export interface ProductProps {
  id: string;
  name: string;
  brand: string;
  calories: number;
  carbs: number;
  sodium: number;
  caffeine: number;
  color: 'orange' | 'blue' | 'white' | 'green' | 'red' | 'yellow';
  priceZAR: number;
  image: string;
  category: ProductCategory;
}
export function NutritionCard({
  name,
  brand,
  calories,
  carbs,
  sodium,
  caffeine,
  color,
  priceZAR,
  image,
}: ProductProps) {
  const colorMap: Record<string, { border: string; accent: string; hover: string }> = {
    orange: { border: 'border-warm', accent: 'text-warm', hover: 'hover:bg-warm/[0.06]' },
    blue: { border: 'border-accent', accent: 'text-accent', hover: 'hover:bg-accent/[0.06]' },
    white: { border: 'border-text-muted', accent: 'text-text-primary', hover: 'hover:bg-accent/[0.04]' },
    green: { border: 'border-warm-muted', accent: 'text-warm-muted', hover: 'hover:bg-warm-muted/[0.06]' },
    red: { border: 'border-terrain-rust', accent: 'text-terrain-rust', hover: 'hover:bg-terrain-rust/[0.06]' },
    yellow: { border: 'border-golden', accent: 'text-golden', hover: 'hover:bg-golden/[0.06]' },
  };

  const colors = colorMap[color] || colorMap.white;

  return (
    <div
      className={`group relative bg-surface rounded-xl border border-[var(--color-border)] p-3 cursor-pointer lg:cursor-grab lg:active:cursor-grabbing hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ${colors.hover}`}>

      {/* Drag handle (desktop) / tap hint (mobile) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="lg:hidden text-[9px] font-display text-text-muted">Tap for details</span>
        <div className="hidden lg:flex gap-0.5 opacity-40">
          <div className="w-1 h-4 bg-text-muted rounded-full"></div>
          <div className="w-1 h-4 bg-text-muted rounded-full"></div>
          <div className="w-1 h-4 bg-text-muted rounded-full"></div>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Product Image */}
        <div className="w-14 h-14 flex-shrink-0 bg-surfaceHighlight rounded-lg overflow-hidden">
          <img
            src={image}
            alt={`${brand} ${name}`}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23FFF5E8" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23A0929E" font-size="12">No img</text></svg>';
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-display text-text-muted uppercase tracking-wider">
            {brand}
          </div>
          <h3 className="text-sm font-display font-bold text-text-primary leading-tight truncate">{name}</h3>
          <div className={`text-sm font-display font-bold ${colors.accent}`}>
            R{priceZAR.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 border-t border-[var(--color-border)] pt-2 mt-2">
        <div>
          <div className="text-[9px] text-text-secondary font-display uppercase">Carbs</div>
          <div className={`text-xs font-display font-bold ${colors.accent}`}>
            {carbs}g
          </div>
        </div>
        <div>
          <div className="text-[9px] text-text-secondary font-display uppercase">Na</div>
          <div className="text-xs font-display font-bold text-text-primary">
            {sodium}<span className="text-[8px] text-text-muted">mg</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-text-secondary font-display uppercase">Caff</div>
          <div className="text-xs font-display font-bold text-text-primary">
            {caffeine}<span className="text-[8px] text-text-muted">mg</span>
          </div>
        </div>
        <div className="flex items-end justify-end">
          <div className="flex items-center gap-0.5">
            <Zap className="w-3 h-3 text-warm" />
            <span className="text-xs font-display font-bold text-text-primary">
              {calories}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
