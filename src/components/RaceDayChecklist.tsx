import { useState, useMemo, useEffect } from 'react';
import { X, Check, Package, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { useApp, NutritionPoint } from '../context/AppContext';
import { ProductProps } from './NutritionCard';

interface ChecklistProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PackingItem {
  product: ProductProps;
  quantity: number;
  points: NutritionPoint[];
  checked: boolean;
}

const CHECKLIST_STORAGE_KEY = 'fuelcue_checklist';

function loadCheckedState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveCheckedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

// Suggest placement based on product category
function suggestPlacement(product: ProductProps, index: number, total: number): string {
  const position = index / Math.max(1, total - 1);

  if (product.category === 'drink') return 'Bottle cage / bottle';
  if (product.category === 'bar') return position < 0.5 ? 'Jersey pocket (center)' : 'Top tube bag';
  if (product.category === 'chew') return 'Jersey pocket (right)';

  // Gels
  if (position < 0.3) return 'Jersey pocket (left)';
  if (position < 0.6) return 'Jersey pocket (center)';
  return 'Top tube bag / bento box';
}

export function RaceDayChecklist({ isOpen, onClose }: ChecklistProps) {
  const { routeData } = useApp();
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>(loadCheckedState);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Group by product
  const packingItems = useMemo<PackingItem[]>(() => {
    const grouped = new Map<string, PackingItem>();

    routeData.nutritionPoints.forEach((point) => {
      const key = point.product.id;
      if (grouped.has(key)) {
        const item = grouped.get(key)!;
        item.quantity++;
        item.points.push(point);
      } else {
        grouped.set(key, {
          product: point.product,
          quantity: 1,
          points: [point],
          checked: checkedState[key] || false,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => {
      const categoryOrder: Record<string, number> = { gel: 0, drink: 1, bar: 2, chew: 3 };
      return (categoryOrder[a.product.category] || 4) - (categoryOrder[b.product.category] || 4);
    });
  }, [routeData.nutritionPoints, checkedState]);

  // Save checked state whenever it changes
  useEffect(() => {
    saveCheckedState(checkedState);
  }, [checkedState]);

  const toggleItem = (productId: string) => {
    setCheckedState(prev => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const toggleGroup = (category: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const checkedCount = packingItems.filter(item => checkedState[item.product.id]).length;
  const totalItems = packingItems.length;
  const progressPct = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  const totalCost = packingItems.reduce((sum, item) => sum + item.product.priceZAR * item.quantity, 0);

  // Group items by category
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, PackingItem[]> = {};
    for (const item of packingItems) {
      const cat = item.product.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [packingItems]);

  const categoryLabels: Record<string, string> = {
    gel: 'Gels',
    drink: 'Drinks',
    bar: 'Bars',
    chew: 'Chews',
    other: 'Other',
  };

  const handlePrint = () => {
    window.print();
  };

  const clearAll = () => {
    setCheckedState({});
  };

  const checkAll = () => {
    const newState: Record<string, boolean> = {};
    packingItems.forEach(item => {
      newState[item.product.id] = true;
    });
    setCheckedState(newState);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-white/[0.06] rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-lg font-bold text-white">Race Day Checklist</h2>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">
                {routeData.name || 'No route loaded'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-white"
              title="Print checklist"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 py-3 border-b border-white/[0.06] bg-black/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary uppercase tracking-wider">
              Packing Progress
            </span>
            <span className="text-xs font-mono text-white">
              {checkedCount}/{totalItems} packed
            </span>
          </div>
          <div className="w-full h-2 bg-black rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                progressPct === 100 ? 'bg-accent-light' : 'bg-accent'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Checklist Items */}
        <div className="flex-1 overflow-y-auto">
          {totalItems === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">No items in your plan</p>
              <p className="text-xs text-text-secondary mt-1">
                Generate a nutrition plan first
              </p>
            </div>
          ) : (
            Object.entries(groupedByCategory).map(([category, items]) => {
              const isExpanded = expandedGroups[category] !== false; // default expanded
              const groupChecked = items.every(item => checkedState[item.product.id]);

              return (
                <div key={category} className="border-b border-white/[0.04]">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleGroup(category)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-surfaceHighlight/50 hover:bg-surfaceHighlight transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${groupChecked ? 'bg-accent-light' : 'bg-text-muted'}`} />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {categoryLabels[category] || category}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        ({items.length} {items.length === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </button>

                  {/* Items */}
                  {isExpanded && (
                    <div className="divide-y divide-white/[0.04]">
                      {items.map((item, idx) => {
                        const isChecked = checkedState[item.product.id] || false;
                        const placement = suggestPlacement(item.product, idx, items.length);

                        return (
                          <div
                            key={item.product.id}
                            onClick={() => toggleItem(item.product.id)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${
                              isChecked ? 'bg-accent-light/5' : 'hover:bg-white/5'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              isChecked
                                ? 'bg-accent-light border-accent-light'
                                : 'border-white/20 hover:border-white/40'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 text-black" />}
                            </div>

                            {/* Product Image */}
                            <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded overflow-hidden">
                              <img
                                src={item.product.image}
                                alt={item.product.name}
                                className={`w-full h-full object-contain transition-opacity ${
                                  isChecked ? 'opacity-40' : ''
                                }`}
                              />
                            </div>

                            {/* Product Info */}
                            <div className={`flex-1 min-w-0 ${isChecked ? 'opacity-50' : ''}`}>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${isChecked ? 'text-text-muted line-through' : 'text-white'}`}>
                                  {item.product.name}
                                </span>
                                <span className="text-xs font-mono text-accent">
                                  x{item.quantity}
                                </span>
                              </div>
                              <div className="text-[10px] text-text-muted">
                                {item.product.brand} &middot; {placement}
                              </div>
                            </div>

                            {/* Price */}
                            <div className={`text-sm font-mono font-bold ${isChecked ? 'text-text-muted' : 'text-accent-light'}`}>
                              R{(item.product.priceZAR * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {totalItems > 0 && (
          <div className="p-4 border-t border-white/[0.06] bg-surfaceHighlight">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                <button
                  onClick={checkAll}
                  className="text-[10px] font-mono text-warm hover:text-white transition-colors uppercase"
                >
                  Check All
                </button>
                <span className="text-text-muted">|</span>
                <button
                  onClick={clearAll}
                  className="text-[10px] font-mono text-text-muted hover:text-white transition-colors uppercase"
                >
                  Clear All
                </button>
              </div>
              <span className="text-lg font-mono font-bold text-accent-light">
                R{totalCost.toFixed(2)}
              </span>
            </div>
            {progressPct === 100 && (
              <div className="text-center py-2 bg-accent-light/10 border border-accent-light/20 text-accent-light text-xs font-bold uppercase tracking-wider">
                All packed! Ready to race.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
