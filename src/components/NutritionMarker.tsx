import React from 'react';
import { ProductProps } from './NutritionCard';
import { X } from 'lucide-react';

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
  const colorMap: Record<string, string> = {
    orange: 'bg-accent border-accent',
    blue: 'bg-warm border-warm',
    white: 'bg-white border-white',
    green: 'bg-accent-light border-accent-light',
    red: 'bg-red-500 border-red-500',
    yellow: 'bg-yellow-500 border-yellow-500',
  };

  const stemColor = colorMap[product.color]?.split(' ')[0] || 'bg-accent';

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-full group z-30 cursor-grab active:cursor-grabbing"
      style={style}
    >
      {/* Pin Body */}
      <div className="relative flex flex-col items-center transition-transform duration-200 group-hover:scale-110">
        {/* Product Image Circle */}
        <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg border-2 border-white bg-surface">
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
        <div className={`w-0.5 h-4 ${stemColor}`}></div>
        <div className="w-2 h-2 bg-white rounded-full border-2 border-black"></div>

        {/* Distance Label - Always Visible */}
        <div className="absolute top-full mt-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] font-mono text-white whitespace-nowrap">
          {distanceKm.toFixed(1)}km
        </div>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto min-w-[160px]">
        <div className="bg-surfaceHighlight border border-white/[0.08] p-3 shadow-xl rounded-lg">
          <div className="flex justify-between items-start gap-2 mb-1">
            <span className="text-[10px] font-mono text-text-muted uppercase">
              {product.brand}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-text-muted hover:text-red-500 pointer-events-auto"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-xs font-bold text-white mb-2 leading-tight">
            {product.name}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-mono">
            <span className="text-accent">{product.carbs}g CHO</span>
            <span className="text-text-secondary">@ {distanceKm.toFixed(1)}km</span>
          </div>
          {product.priceZAR && (
            <div className="mt-1 text-[10px] font-mono text-accent-light">
              R{product.priceZAR.toFixed(2)}
            </div>
          )}
        </div>
        {/* Arrow */}
        <div className="w-2 h-2 bg-surfaceHighlight border-r border-b border-white/[0.08] transform rotate-45 absolute bottom-[-5px] left-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  );
}