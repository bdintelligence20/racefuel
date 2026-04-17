import { useState, useMemo } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { createPortal } from 'react-dom';
import { X, Search, MapPin, Zap } from 'lucide-react';
import { ProductProps, ProductCategory } from './NutritionCard';
import { useProducts, searchProducts } from '../data/products';

interface ProductPickerModalProps {
  isOpen: boolean;
  distanceKm: number;
  elevation: number | null;
  onClose: () => void;
  onSelectProduct: (product: ProductProps) => void;
}

type FilterTab = 'all' | ProductCategory;

export function ProductPickerModal({
  isOpen,
  distanceKm,
  elevation,
  onClose,
  onSelectProduct,
}: ProductPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const products = useProducts();

  const filteredProducts = useMemo(() => {
    let result = searchQuery ? searchProducts(searchQuery) : products;
    if (activeFilter !== 'all') {
      result = result.filter((p) => p.category === activeFilter);
    }
    return result;
  }, [searchQuery, activeFilter, products]);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gel', label: 'Gels' },
    { key: 'drink', label: 'Drinks' },
    { key: 'bar', label: 'Bars' },
    { key: 'chew', label: 'Chews' },
  ];

  const handleSelect = (product: ProductProps) => {
    onSelectProduct(product);
    onClose();
    setSearchQuery('');
    setActiveFilter('all');
  };

  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — bottom sheet on mobile, centered card on desktop */}
      <div className="relative bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[80dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:fade-in sm:zoom-in-95 duration-200">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-display font-bold text-text-primary leading-tight">
                Add Fuel
              </h2>
              <div className="text-xs text-text-muted font-display truncate">
                {distanceKm.toFixed(1)}km
                {elevation !== null && ` · ${Math.round(elevation)}m`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-accent/[0.08] active:bg-accent/[0.12] transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-surfaceHighlight border border-[var(--color-border)] rounded-xl text-text-primary text-sm font-display focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all placeholder:text-text-muted"
            />
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Filter tabs — horizontal scroll on mobile if needed */}
        <div className="px-4 py-3 flex gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-shrink-0 h-9 px-4 text-xs font-display font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeFilter === tab.key
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-surfaceHighlight text-text-secondary border border-[var(--color-border)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Product list — SINGLE column on mobile (not grid-cols-2) */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm font-display">
              No products match your search
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className="w-full flex items-center gap-3 p-3 bg-surfaceHighlight border border-[var(--color-border)] rounded-xl hover:border-accent/40 hover:bg-accent/[0.03] active:scale-[0.99] transition-all text-left"
                >
                  {/* Product image */}
                  <div className="w-14 h-14 flex-shrink-0 bg-surface rounded-lg overflow-hidden border border-[var(--color-border)]">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted text-xs font-display">
                        {product.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-display text-text-muted uppercase tracking-wider truncate">
                      {product.brand}
                    </div>
                    <div className="text-sm font-display font-bold text-text-primary truncate leading-tight">
                      {product.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-display font-bold text-warm">
                        <Zap className="w-3 h-3" />
                        {product.carbs}g
                      </span>
                      <span className="text-[11px] font-display text-text-muted">·</span>
                      <span className="text-[11px] font-display text-text-muted tabular-nums">
                        R{product.priceZAR}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
