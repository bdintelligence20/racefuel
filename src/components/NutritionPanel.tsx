import { useState, useMemo, useEffect } from 'react';
import { NutritionCard, ProductProps, ProductCategory } from './NutritionCard';
import { Search, ShoppingCart, Droplets, Coffee, Zap, ClipboardList, Plus, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useProducts } from '../data/products';
import { calculatePlanCost } from '../services/nutrition/costCalculator';
import { getActiveDurationHours } from '../services/route/timeFormat';
import { CartModal } from './CartModal';
import { ProductDetailModal } from './ProductDetailModal';
import { RaceDayChecklist } from './RaceDayChecklist';
import { CustomProductModal, loadCustomProducts, hydrateCustomProductsFromCloud } from './CustomProductModal';
import { BundlePicker } from './BundlePicker';

type FilterTab = 'all' | ProductCategory;

export function NutritionPanel() {
  const { routeData, addNutritionPoint, lastGeneratedPlan, selectedBundleId } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [customProductOpen, setCustomProductOpen] = useState(false);
  const [customProducts, setCustomProducts] = useState<ProductProps[]>(loadCustomProducts);

  // Hydrate custom products from Firestore once auth is ready. Falls through
  // silently for signed-out users — local cache still works.
  useEffect(() => {
    hydrateCustomProductsFromCloud().then((cloud) => {
      if (cloud) setCustomProducts(cloud);
    });
  }, []);
  const [selectedProduct, setSelectedProduct] = useState<ProductProps | null>(null);
  const [bundlePickerOpen, setBundlePickerOpen] = useState(false);
  const products = useProducts();

  const handleDragStart = (e: React.DragEvent, product: ProductProps) => {
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const allProducts = useMemo(() => [...products, ...customProducts], [products, customProducts]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let result = query
      ? allProducts.filter(p => p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query))
      : allProducts;
    if (activeFilter !== 'all') {
      result = result.filter(p => p.category === activeFilter);
    }
    return result;
  }, [searchQuery, activeFilter, allProducts]);

  // Calculate totals
  const totalCarbs = routeData.nutritionPoints.reduce(
    (sum, p) => sum + p.product.carbs,
    0
  );
  // "Cost of this run" = per-serving equivalent of what's actually consumed.
  // We surface "to buy" alongside whenever buying full packs costs noticeably
  // more, so a R1357 tub doesn't masquerade as the price of a 23km run.
  const planCost = useMemo(() => calculatePlanCost(routeData.nutritionPoints), [routeData.nutritionPoints]);
  const runCost = planCost.runCostZAR;
  const totalToBuy = planCost.totalCostZAR;
  const hasPackInflation = totalToBuy > runCost + 1;
  const totalSodium = routeData.nutritionPoints.reduce(
    (sum, p) => sum + p.product.sodium,
    0
  );
  const totalCaffeine = routeData.nutritionPoints.reduce(
    (sum, p) => sum + p.product.caffeine,
    0
  );

  // Hourly figures track whichever duration is currently authoritative —
  // the user override if they set one, otherwise the auto-estimate. Without
  // this, editing time in the sidebar leaves carbs/hr frozen.
  const hours = getActiveDurationHours(routeData, 3.25);
  const carbsPerHour = hours > 0 ? Math.round(totalCarbs / hours) : 0;

  // Get carb target from plan generator if available
  const carbTarget = lastGeneratedPlan?.carbTarget;
  const targetMin = carbTarget?.min ?? 60;
  const targetMax = carbTarget?.max ?? 90;

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gel', label: 'Gels' },
    { key: 'drink', label: 'Drinks' },
    { key: 'bar', label: 'Bars' },
    { key: 'chew', label: 'Chews' },
  ];

  return (
    <aside className="w-full lg:w-80 bg-surface border-l border-[var(--color-border)] flex flex-col h-full z-30">
      <div className="p-4 pb-3 pt-2 lg:pt-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-display font-semibold text-text-muted uppercase tracking-wider">
            Nutrition
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBundlePickerOpen(true)}
              className="relative text-[10px] text-warm hover:text-warm-muted transition-colors flex items-center gap-1 font-display font-medium"
            >
              <Package className="w-3 h-3" /> Bundles
              {selectedBundleId && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-accent" title="Bundle selected" />
              )}
            </button>
            <button
              onClick={() => setCustomProductOpen(true)}
              className="text-[10px] text-accent hover:text-accent-light transition-colors flex items-center gap-1 font-display font-medium"
            >
              <Plus className="w-3 h-3" /> Custom
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surfaceHighlight border border-[var(--color-border)] rounded-xl text-text-primary text-sm p-3 pl-9 focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-text-muted font-display"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-3.5" />
        </div>

        <div className="flex gap-1.5 mt-3">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 py-2 rounded-lg text-xs font-display font-medium transition-colors ${
                activeFilter === tab.key
                  ? 'bg-accent text-white'
                  : 'bg-transparent text-text-muted border border-transparent hover:bg-surfaceHighlight hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm font-display">
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
      <div className="p-4 bg-surfaceHighlight border-t border-[var(--color-border)]">
        {/* Carbs/hr with target zone */}
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs text-text-secondary font-display uppercase tracking-wider">
            Hourly Target
          </span>
          <span className="text-lg font-display font-bold text-text-primary">
            {carbsPerHour}g{' '}
            <span className="text-xs text-text-muted">CHO/hr</span>
          </span>
        </div>
        <div className="w-full h-2 bg-surfaceHighlight rounded-full overflow-hidden relative border border-[var(--color-border)]">
          {/* Target Zone Indicator */}
          <div
            className="absolute top-0 bottom-0 bg-accent/10 z-0"
            style={{
              left: `${Math.min(100, (targetMin / 120) * 100)}%`,
              right: `${Math.max(0, 100 - (targetMax / 120) * 100)}%`,
            }}
          />
          {/* Progress */}
          <div
            className={`h-full transition-all duration-500 z-10 relative rounded-full ${
              carbsPerHour > targetMax ? 'bg-terrain-rust' :
              carbsPerHour < targetMin ? 'bg-warm' : 'bg-accent'
            }`}
            style={{
              width: `${Math.min(100, (carbsPerHour / 120) * 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-display text-text-muted">
          <span>0g</span>
          <span>{targetMin}g</span>
          <span>{targetMax}g</span>
          <span>120g</span>
        </div>

        {/* Extra metrics when plan exists */}
        {routeData.nutritionPoints.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="text-center">
                <Droplets className="w-3 h-3 text-terrain-orange mx-auto mb-0.5" />
                <div className="text-xs font-display font-bold text-text-primary">{totalSodium}mg</div>
                <div className="text-[9px] text-text-muted font-display">Sodium</div>
              </div>
              <div className="text-center">
                <Coffee className="w-3 h-3 text-warm mx-auto mb-0.5" />
                <div className="text-xs font-display font-bold text-text-primary">{totalCaffeine}mg</div>
                <div className="text-[9px] text-text-muted font-display">Caffeine</div>
              </div>
              <div className="text-center">
                <Zap className="w-3 h-3 text-warm mx-auto mb-0.5" />
                <div className="text-xs font-display font-bold text-text-primary">
                  {routeData.nutritionPoints.reduce((sum, p) => sum + p.product.calories, 0)}
                </div>
                <div className="text-[9px] text-text-muted font-display">Calories</div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary font-display uppercase tracking-wider">
                  Cost for this run ({routeData.nutritionPoints.length} items)
                </span>
                <span className="text-lg font-display font-bold text-warm">
                  R{runCost.toFixed(2)}
                </span>
              </div>
              {hasPackInflation && (
                <div className="flex justify-between items-center text-[11px] text-text-muted font-display">
                  <span className="uppercase tracking-wider">Total to buy (full packs)</span>
                  <span className="font-bold tabular-nums">R{totalToBuy.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setCartOpen(true)}
                className="flex-1 py-2.5 rounded-lg bg-accent text-white font-display font-bold uppercase tracking-wider hover:bg-accent-light transition-colors flex items-center justify-center gap-2 text-xs"
              >
                <ShoppingCart className="w-4 h-4" />
                View Kit
              </button>
              <button
                onClick={() => setChecklistOpen(true)}
                className="py-2.5 px-3 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] text-text-primary font-display font-bold uppercase tracking-wider hover:bg-accent/[0.06] transition-colors flex items-center justify-center gap-1 text-xs"
                title="Race Day Checklist"
              >
                <ClipboardList className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cart Modal */}
      <CartModal isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Race Day Checklist */}
      <RaceDayChecklist isOpen={checklistOpen} onClose={() => setChecklistOpen(false)} />

      {/* Custom Product Modal */}
      <CustomProductModal
        isOpen={customProductOpen}
        onClose={() => setCustomProductOpen(false)}
        onAdd={(product) => setCustomProducts(prev => [...prev, product])}
      />

      {/* Bundle Picker */}
      <BundlePicker isOpen={bundlePickerOpen} onClose={() => setBundlePickerOpen(false)} />

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
