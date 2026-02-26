import React from 'react';
import { X, Zap, Droplets, Coffee, Flame, Plus } from 'lucide-react';
import { ProductProps } from './NutritionCard';

interface ProductDetailModalProps {
  product: ProductProps | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToRoute?: (product: ProductProps) => void;
}

export function ProductDetailModal({ product, isOpen, onClose, onAddToRoute }: ProductDetailModalProps) {
  if (!isOpen || !product) return null;

  const categoryLabels: Record<string, string> = {
    gel: 'Energy Gel',
    drink: 'Drink Mix',
    bar: 'Energy Bar',
    chew: 'Energy Chews',
  };

  const handleAddToRoute = () => {
    if (onAddToRoute && product) {
      onAddToRoute(product);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface border border-white/10 w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surfaceHighlight">
          <div>
            <div className="text-[10px] text-neon-orange uppercase tracking-wider font-bold">
              {categoryLabels[product.category] || product.category}
            </div>
            <h2 className="text-lg font-bold text-white">{product.brand}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Image */}
        <div className="bg-white/5 p-8 flex items-center justify-center">
          <img
            src={product.image}
            alt={`${product.brand} ${product.name}`}
            className="max-h-48 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23333" width="100" height="100"/><text fill="%23666" x="50" y="50" text-anchor="middle" dy=".3em" font-size="12">No Image</text></svg>';
            }}
          />
        </div>

        {/* Product Info */}
        <div className="p-6 space-y-6">
          {/* Name & Price */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">{product.name}</h3>
              <p className="text-sm text-text-secondary">{product.brand}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-neon-green">
                R{product.priceZAR.toFixed(2)}
              </div>
              <div className="text-[10px] text-text-muted uppercase">per unit</div>
            </div>
          </div>

          {/* Nutrition Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-neon-orange" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">Calories</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {product.calories}
                <span className="text-xs text-text-muted ml-1">kcal</span>
              </div>
            </div>

            <div className="bg-black/30 border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-neon-blue" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">Carbs</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {product.carbs}
                <span className="text-xs text-text-muted ml-1">g</span>
              </div>
            </div>

            <div className="bg-black/30 border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">Sodium</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {product.sodium}
                <span className="text-xs text-text-muted ml-1">mg</span>
              </div>
            </div>

            <div className="bg-black/30 border border-white/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Coffee className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">Caffeine</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {product.caffeine}
                <span className="text-xs text-text-muted ml-1">mg</span>
              </div>
            </div>
          </div>

          {/* Efficiency Stats */}
          <div className="bg-surfaceHighlight border border-white/10 p-4">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">
              Efficiency Metrics
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-mono font-bold text-white">
                  {(product.carbs / (product.priceZAR / 10)).toFixed(1)}
                </div>
                <div className="text-[9px] text-text-secondary uppercase">g/R10</div>
              </div>
              <div>
                <div className="text-lg font-mono font-bold text-white">
                  {(product.calories / product.carbs).toFixed(1)}
                </div>
                <div className="text-[9px] text-text-secondary uppercase">cal/g carb</div>
              </div>
              <div>
                <div className="text-lg font-mono font-bold text-white">
                  {product.caffeine > 0 ? (product.caffeine / product.carbs).toFixed(1) : '-'}
                </div>
                <div className="text-[9px] text-text-secondary uppercase">mg caf/g</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 border-t border-white/10 bg-surfaceHighlight">
          <button
            onClick={handleAddToRoute}
            className="w-full py-4 bg-neon-orange text-black text-sm font-bold uppercase tracking-wider hover:bg-neon-orange/90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add to Route Plan
          </button>
          <p className="text-[10px] text-text-muted text-center mt-2">
            Or drag this product onto the map to place at a specific point
          </p>
        </div>
      </div>
    </div>
  );
}
