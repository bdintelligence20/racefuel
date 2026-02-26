import React from 'react';
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
    orange: { border: 'border-neon-orange', accent: 'text-neon-orange', hover: 'hover:bg-neon-orange/10' },
    blue: { border: 'border-neon-blue', accent: 'text-neon-blue', hover: 'hover:bg-neon-blue/10' },
    white: { border: 'border-white', accent: 'text-white', hover: 'hover:bg-white/10' },
    green: { border: 'border-neon-green', accent: 'text-neon-green', hover: 'hover:bg-neon-green/10' },
    red: { border: 'border-red-500', accent: 'text-red-500', hover: 'hover:bg-red-500/10' },
    yellow: { border: 'border-yellow-500', accent: 'text-yellow-500', hover: 'hover:bg-yellow-500/10' },
  };

  const colors = colorMap[color] || colorMap.white;

  return (
    <div
      className={`group relative bg-surfaceHighlight border-l-4 ${colors.border} p-3 cursor-grab active:cursor-grabbing hover:-translate-y-1 transition-all duration-200 ${colors.hover}`}>

      {/* Drag Handle Pattern */}
      <div className="absolute top-2 right-2 flex gap-0.5 opacity-20 group-hover:opacity-50">
        <div className="w-1 h-4 bg-white"></div>
        <div className="w-1 h-4 bg-white"></div>
        <div className="w-1 h-4 bg-white"></div>
      </div>

      <div className="flex gap-3">
        {/* Product Image */}
        <div className="w-14 h-14 flex-shrink-0 bg-white/5 rounded overflow-hidden">
          <img
            src={image}
            alt={`${brand} ${name}`}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="12">No img</text></svg>';
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            {brand}
          </div>
          <h3 className="text-sm font-bold text-white leading-tight truncate">{name}</h3>
          <div className={`text-sm font-mono font-bold ${colors.accent}`}>
            R{priceZAR.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 border-t border-white/10 pt-2 mt-2">
        <div>
          <div className="text-[9px] text-text-secondary uppercase">Carbs</div>
          <div className={`text-xs font-mono font-bold ${colors.accent}`}>
            {carbs}g
          </div>
        </div>
        <div>
          <div className="text-[9px] text-text-secondary uppercase">Na</div>
          <div className="text-xs font-mono font-bold text-white">
            {sodium}<span className="text-[8px] text-text-muted">mg</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-text-secondary uppercase">Caff</div>
          <div className="text-xs font-mono font-bold text-white">
            {caffeine}<span className="text-[8px] text-text-muted">mg</span>
          </div>
        </div>
        <div className="flex items-end justify-end">
          <div className="flex items-center gap-0.5">
            <Zap className="w-3 h-3 text-text-muted" />
            <span className="text-xs font-mono font-bold text-white">
              {calories}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}