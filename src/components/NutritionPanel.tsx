import React, { useState, useMemo } from 'react';
import { NutritionCard, ProductProps, ProductCategory } from './NutritionCard';
import { Search, ShoppingCart, Droplets, Coffee, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { products, searchProducts } from '../data/products';
import { CartModal } from './CartModal';
import { ProductDetailModal } from './ProductDetailModal';

type FilterTab = 'all' | ProductCategory;

export function NutritionPanel() {
  const { routeData, addNutritionPoint, lastGeneratedPlan } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductProps | null>(null);

  const handleDragStart = (e: React.DragEvent, product: ProductProps) => {
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredProducts = useMemo(() => {
    let result = searchQuery ? searchProducts(searchQuery) : products;
    if (activeFilter !== 'all') {
      result = result.filter(p => p.category === activeFilter);
    }
    return result;
  }, [searchQuery, activeFilter]);

  // Calculate totals
  const totalCarbs = routeData.nutritionPoints.reduce(
    (sum, p) => sum + p.product.carbs,
    0
  );
  const totalCost = routeData.nutritionPoints.reduce(
    (sum, p) => sum + (p.product.priceZAR || 0),
    0
  );
  const totalSodium = routeData.nutritionPoints.reduce(
    (sum, p) => sum + p.product.sodium,
    0
  );
  const totalCaffeine = routeData.nutritionPoints.reduce(
    (sum, p) => sum + p.product.caffeine,
    0
  );

  // Estimate hourly based on route time
  const timeStr = routeData.estimatedTime || '3:15:00';
  const timeParts = timeStr.split(':').map(Number);
  const hours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600 || 3.25;
  const carbsPerHour = Math.round(totalCarbs / hours);

  // Get carb target from plan generator if available
  const carbTarget = lastGeneratedPlan?.carbTarget;
  const targetMin = carbTarget?.min ?? 60;
  const targetMax = carbTarget?.max ?? 90;

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gel', label: 'Gels' },
    { key: 'drink', label: 'Drinks' },
    { key: 'bar', label: 'Bars' },
  ];

  return (
    <aside className="w-80 bg-surface border-l border-white/10 flex flex-col h-full z-30 shadow-xl">
      <div className="p-6 border-b border-white/10 bg-surfaceHighlight/20">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
          Nutrition Plan
        </h2>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="SEARCH PRODUCTS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/50 border border-white/10 text-white text-xs font-mono p-3 pl-9 focus:outline-none focus:border-neon-orange transition-colors placeholder:text-text-muted"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-4">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-colors ${
                activeFilter === tab.key
                  ? 'bg-white/5 text-white border border-white/10'
                  : 'bg-transparent text-text-secondary border border-transparent hover:bg-white/5 hover:border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            No products found
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              draggable
              onDragStart={(e) => handleDragStart(e, product)}
              onClick={() => setSelectedProduct(product)}
              className="cursor-grab active:cursor-grabbing"
            >
              <NutritionCard {...product} />
            </div>
          ))
        )}
      </div>

      {/* Summary Footer */}
      <div className="p-4 bg-surfaceHighlight border-t border-white/10">
        {/* Carbs/hr with target zone */}
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs text-text-secondary uppercase">
            Hourly Target
          </span>
          <span className="text-lg font-mono font-bold text-white">
            {carbsPerHour}g{' '}
            <span className="text-xs text-text-muted">CHO/hr</span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-black rounded-full overflow-hidden relative">
          {/* Target Zone Indicator */}
          <div
            className="absolute top-0 bottom-0 bg-white/5 z-0"
            style={{
              left: `${Math.min(100, (targetMin / 120) * 100)}%`,
              right: `${Math.max(0, 100 - (targetMax / 120) * 100)}%`,
            }}
          />
          {/* Progress */}
          <div
            className={`h-full transition-all duration-500 z-10 relative ${
              carbsPerHour > targetMax ? 'bg-red-500' :
              carbsPerHour < targetMin ? 'bg-neon-blue' : 'bg-neon-green'
            }`}
            style={{
              width: `${Math.min(100, (carbsPerHour / 120) * 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-mono text-text-muted">
          <span>0g</span>
          <span>{targetMin}g</span>
          <span>{targetMax}g</span>
          <span>120g</span>
        </div>

        {/* Extra metrics when plan exists */}
        {routeData.nutritionPoints.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10">
              <div className="text-center">
                <Droplets className="w-3 h-3 text-cyan-400 mx-auto mb-0.5" />
                <div className="text-xs font-mono font-bold text-white">{totalSodium}mg</div>
                <div className="text-[9px] text-text-muted">Sodium</div>
              </div>
              <div className="text-center">
                <Coffee className="w-3 h-3 text-amber-400 mx-auto mb-0.5" />
                <div className="text-xs font-mono font-bold text-white">{totalCaffeine}mg</div>
                <div className="text-[9px] text-text-muted">Caffeine</div>
              </div>
              <div className="text-center">
                <Zap className="w-3 h-3 text-neon-orange mx-auto mb-0.5" />
                <div className="text-xs font-mono font-bold text-white">
                  {routeData.nutritionPoints.reduce((sum, p) => sum + p.product.calories, 0)}
                </div>
                <div className="text-[9px] text-text-muted">Calories</div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
              <span className="text-xs text-text-secondary uppercase">
                Total ({routeData.nutritionPoints.length} items)
              </span>
              <span className="text-lg font-mono font-bold text-neon-green">
                R{totalCost.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => setCartOpen(true)}
              className="w-full mt-3 py-2 bg-neon-orange text-black font-bold uppercase tracking-wider hover:bg-neon-orange/90 transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              View Kit
            </button>
          </>
        )}
      </div>

      {/* Cart Modal */}
      <CartModal isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        onAddToRoute={(product) => {
          if (routeData.loaded) {
            addNutritionPoint(product, routeData.distanceKm / 2);
          }
        }}
      />
    </aside>
  );
}
