import { useState, useMemo } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { createPortal } from 'react-dom';
import { X, Search, MapPin } from 'lucide-react';
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

  // All hooks must be before early return!
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

  // Early return after all hooks
  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[80dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-lg font-bold text-text-primary">Add Nutrition</h2>
              <div className="text-xs text-text-muted font-display">
                @ {distanceKm.toFixed(1)}km
                {elevation !== null && ` · ${Math.round(elevation)}m elevation`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-[var(--color-border)] space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-sm font-display p-3 pl-10 focus:outline-none focus:border-accent transition-colors placeholder:text-text-muted"
              autoFocus
            />
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-3.5" />
          </div>

          <div className="flex gap-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-accent/20 text-accent border border-accent/50 rounded-md'
                    : 'bg-surfaceHighlight text-text-secondary border border-transparent rounded-md hover:bg-accent/[0.08]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className="flex gap-3 p-3 bg-surfaceHighlight border border-[var(--color-border)] rounded-lg hover:border-accent/50 hover:bg-surfaceHighlight transition-colors text-left group"
                >
                  {/* Product Image */}
                  <div className="w-12 h-12 flex-shrink-0 bg-accent/[0.08] rounded overflow-hidden">
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] text-text-muted uppercase tracking-wider">
                      {product.brand}
                    </div>
                    <div className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                      {product.name}
                    </div>
                    <div className="flex gap-2 mt-1 text-[10px] font-display">
                      <span className="text-warm">{product.carbs}g</span>
                      <span className="text-text-muted">R{product.priceZAR}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-[var(--color-border)] bg-surfaceHighlight text-center">
          <span className="text-[10px] text-text-muted">
            Click a product to add it at {distanceKm.toFixed(1)}km
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
