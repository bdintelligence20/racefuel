import { useState, useMemo, useEffect } from 'react';
import { NutritionCard, ProductProps, ProductCategory } from './NutritionCard';
import { Search, ShoppingCart, Droplets, Coffee, Zap, ClipboardList, Plus, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useProducts } from '../data/products';
import { getActiveDurationHours } from '../services/route/timeFormat';
import { CartModal } from './CartModal';
import { ProductDetailModal } from './ProductDetailModal';
import { RaceDayChecklist } from './RaceDayChecklist';
import { CustomProductModal, hydrateCustomProductsFromCloud } from './CustomProductModal';
import { BundlePicker } from './BundlePicker';

type FilterTab = 'all' | ProductCategory;

export function NutritionPanel() {
  const { routeData, addNutritionPoint, lastGeneratedPlan, selectedBundleId } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [customProductOpen, setCustomProductOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Hydrate custom products from Firestore once auth is ready. The hydrate
  // helper writes through to the shared products store, so useProducts() picks
  // up the cloud copies automatically — no local state needed here.
  useEffect(() => {
    hydrateCustomProductsFromCloud();
  }, []);
  const [selectedProduct, setSelectedProduct] = useState<ProductProps | null>(null);
  const [bundlePickerOpen, setBundlePickerOpen] = useState(false);
  const products = useProducts();

  const handleDragStart = (e: React.DragEvent, product: ProductProps) => {
    e.dataTransfer.setData('application/json', JSON.stringify(product));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let result = query
      ? products.filter(p => p.name.toLowerCase().includes(query) || p.brand.toLowerCase().includes(query))
      : products;
    if (activeFilter !== 'all') {
      result = result.filter(p => p.category === activeFilter);
    }
    return result;
  }, [searchQuery, activeFilter, products]);

  // Calculate totals
  const totalCarbs = routeData.nutritionPoints.reduce(
    (sum, p) => sum + p.product.carbs,
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
    <aside className="w-full lg:w-80 bg-white border-l border-[#EAE5DA] flex flex-col h-full z-30">
      <div className="p-4 pb-3 pt-2 lg:pt-4 border-b border-[#EAE5DA]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#6B7772]">Fuel target</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-sans font-extrabold tracking-tight text-[#1D3B33]">{carbsPerHour}g</span>
              <span className="text-xs font-mono uppercase tracking-wider text-[#6B7772]">/ hr</span>
            </div>
            <div className="mt-1 text-xs text-[#6B7772]">Suggested range {targetMin}-{targetMax}g/hr</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBundlePickerOpen(true)}
              className="relative min-h-11 px-2 text-[10px] text-[#264C42] hover:bg-[#EEF4F1] transition-colors flex items-center gap-1 font-mono font-medium rounded-lg"
            >
              <Package className="w-3 h-3" /> Bundles
              {selectedBundleId && (
                <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-accent" title="Bundle selected" />
              )}
            </button>
              <button
              onClick={() => setCustomProductOpen(true)}
              className="min-h-11 px-2 text-[10px] text-[#264C42] hover:bg-[#EEF4F1] transition-colors flex items-center gap-1 font-mono font-medium rounded-lg"
            >
              <Plus className="w-3 h-3" /> Custom
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            aria-label="Search fuel products"
            placeholder="Search fuel products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#EEF4F1] border border-[#DCE9E3] rounded-lg text-[#1B2320] text-sm p-3 pl-9 focus:outline-none focus:border-[#2F5D50] focus:ring-2 focus:ring-[#2F5D50]/20 transition-all placeholder:text-[#6B7772] font-sans"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-3.5" />
        </div>

        <div className="flex gap-1.5 mt-3">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
                className={`flex-1 min-h-11 rounded-lg text-xs font-mono font-medium transition-colors ${
                activeFilter === tab.key
                  ? 'bg-[#2F5D50] text-white'
                  : 'bg-transparent text-[#6B7772] border border-transparent hover:bg-[#EEF4F1] hover:text-[#264C42]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="px-1 pb-1 text-[10px] font-mono uppercase tracking-[0.18em] text-[#6B7772]">Choose fuel</div>
        {filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-[#6B7772] text-sm font-sans">
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
      <div className="p-4 bg-[#EEF4F1] border-t border-[#DCE9E3]">
        {/* Carbs/hr with target zone */}
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs text-[#6B7772] font-mono uppercase tracking-wider">Plan status</span>
          <span className={`text-xs font-mono font-bold uppercase tracking-wider ${carbsPerHour >= targetMin && carbsPerHour <= targetMax ? 'text-[#2C7A50]' : 'text-[#9A6208]'}`}>
            {carbsPerHour >= targetMin && carbsPerHour <= targetMax ? 'Within range' : 'Adjust plan'}
          </span>
        </div>
        <div className="w-full h-2 bg-white rounded-full overflow-hidden relative border border-[#BCD5CB]">
          {/* Target Zone Indicator */}
          <div
            className="absolute top-0 bottom-0 bg-[#BCD5CB] z-0"
            style={{
              left: `${Math.min(100, (targetMin / 120) * 100)}%`,
              right: `${Math.max(0, 100 - (targetMax / 120) * 100)}%`,
            }}
          />
          {/* Progress */}
          <div
            className={`h-full transition-all duration-500 z-10 relative rounded-full ${
              carbsPerHour > targetMax ? 'bg-[#9A6208]' :
              carbsPerHour < targetMin ? 'bg-[#9A6208]' : 'bg-[#2F5D50]'
            }`}
            style={{
              width: `${Math.min(100, (carbsPerHour / 120) * 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[10px] font-mono text-[#6B7772]">
          <span>0g</span>
          <span>{targetMin}g</span>
          <span>{targetMax}g</span>
          <span>120g</span>
        </div>

        {/* Extra metrics when plan exists */}
        {routeData.nutritionPoints.length > 0 && (
          <>
            <button
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              className="mt-3 min-h-11 w-full flex items-center justify-between border-t border-[#DCE9E3] text-left text-xs font-mono uppercase tracking-wider text-[#264C42]"
            >
              <span>Plan details</span>
              <span aria-hidden>{detailsOpen ? '-' : '+'}</span>
            </button>
            {detailsOpen && <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <Droplets className="w-3 h-3 text-[#9A6208] mx-auto mb-0.5" />
                <div className="text-xs font-sans font-extrabold text-[#1D3B33]">{totalSodium}mg</div>
                <div className="text-[9px] text-[#6B7772] font-mono">Sodium</div>
              </div>
              <div className="text-center">
                <Coffee className="w-3 h-3 text-[#5F2B57] mx-auto mb-0.5" />
                <div className="text-xs font-sans font-extrabold text-[#1D3B33]">{totalCaffeine}mg</div>
                <div className="text-[9px] text-[#6B7772] font-mono">Caffeine</div>
              </div>
              <div className="text-center">
                <Zap className="w-3 h-3 text-[#2F5D50] mx-auto mb-0.5" />
                <div className="text-xs font-sans font-extrabold text-[#1D3B33]">
                  {routeData.nutritionPoints.reduce((sum, p) => sum + p.product.calories, 0)}
                </div>
                <div className="text-[9px] text-[#6B7772] font-mono">Calories</div>
              </div>
            </div>}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setCartOpen(true)}
                className="flex-1 min-h-14 rounded-[14px] bg-[#2F5D50] text-white font-sans font-bold uppercase tracking-wider hover:bg-[#264C42] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D50] focus-visible:ring-offset-2 transition-colors flex items-center justify-center gap-2 text-xs"
              >
                <ShoppingCart className="w-4 h-4" />
                Buy Fuel
              </button>
              <button
                onClick={() => setChecklistOpen(true)}
                className="min-h-14 px-3 rounded-[14px] bg-white border border-[#2F5D50] text-[#264C42] font-sans font-bold uppercase tracking-wider hover:bg-[#EEF4F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5D50] focus-visible:ring-offset-2 transition-colors flex items-center justify-center gap-1 text-xs"
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
