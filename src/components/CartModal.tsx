import { useMemo, useState } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, ShoppingCart, Trash2, Minus, Plus, Search, PackagePlus } from 'lucide-react';
import { useApp, NutritionPoint } from '../context/AppContext';
import { ProductProps } from './NutritionCard';
import { calculatePlanCost } from '../services/nutrition/costCalculator';
import { useProducts } from '../data/products';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CartItem {
  product: ProductProps;
  quantity: number;
  points: NutritionPoint[];
}

export function CartModal({ isOpen, onClose }: CartModalProps) {
  const {
    routeData,
    removeNutritionPoint,
    addNutritionPoint,
    cartExtras,
    addCartExtra,
    setCartExtraQuantity,
    removeCartExtra,
  } = useApp();
  const products = useProducts();
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [extrasQuery, setExtrasQuery] = useState('');

  // Group nutrition points by product - must be before early return!
  const cartItems: CartItem[] = useMemo(() => {
    const grouped = new Map<string, CartItem>();

    routeData.nutritionPoints.forEach((point) => {
      const key = point.product.id;
      if (grouped.has(key)) {
        const item = grouped.get(key);
        if (item) {
          item.quantity++;
          item.points.push(point);
        }
      } else {
        grouped.set(key, {
          product: point.product,
          quantity: 1,
          points: [point],
        });
      }
    });

    return Array.from(grouped.values());
  }, [routeData.nutritionPoints]);

  // Two totals: runCost = per-serving equivalent of what gets consumed on the
  // run, totalCost = full-pack price (what the athlete actually pays at
  // checkout). The difference is the tub-pricing inflation feedback flagged.
  const cost = useMemo(() => calculatePlanCost(routeData.nutritionPoints), [routeData.nutritionPoints]);
  const runCost = cost.runCostZAR;
  // Backups are extras the athlete adds at checkout — not on the route, not
  // in the planning algorithm. Cost adds onto the buy total only.
  const extrasCost = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return cartExtras.reduce((sum, e) => {
      const p = byId.get(e.productId);
      if (!p) return sum;
      return sum + (p.priceZAR ?? 0) * e.quantity;
    }, 0);
  }, [cartExtras, products]);
  const totalCost = cost.totalCostZAR + extrasCost;
  const hasPackInflation = cost.totalCostZAR > runCost + 1;

  const extrasResolved = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return cartExtras
      .map((e) => ({ product: byId.get(e.productId), quantity: e.quantity }))
      .filter((e): e is { product: ProductProps; quantity: number } => Boolean(e.product));
  }, [cartExtras, products]);

  const extrasSuggestions = useMemo(() => {
    const q = extrasQuery.trim().toLowerCase();
    const filtered = q
      ? products.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q))
      : products;
    // Keep only items not already in the route OR extras, capped to 8 to
    // keep the dropdown light.
    const onRoute = new Set(routeData.nutritionPoints.map((n) => n.product.id));
    const inExtras = new Set(cartExtras.map((e) => e.productId));
    return filtered.filter((p) => !onRoute.has(p.id) && !inExtras.has(p.id)).slice(0, 8);
  }, [extrasQuery, products, routeData.nutritionPoints, cartExtras]);

  const totalCarbs = cartItems.reduce(
    (sum, item) => sum + item.product.carbs * item.quantity,
    0
  );

  const totalCalories = cartItems.reduce(
    (sum, item) => sum + item.product.calories * item.quantity,
    0
  );

  const removeOne = (item: CartItem) => {
    if (item.points.length > 0) {
      removeNutritionPoint(item.points[item.points.length - 1].id);
    }
  };

  const removeAll = (item: CartItem) => {
    item.points.forEach((point) => removeNutritionPoint(point.id));
  };

  const addOne = (item: CartItem) => {
    // Place the new point next to the last one so it stays grouped visually.
    // Clamp to the route so we don't overshoot on a route that's nearly full.
    const basePoint = item.points[item.points.length - 1];
    const nextKm = Math.min(routeData.distanceKm, (basePoint?.distanceKm ?? 0) + 0.1);
    addNutritionPoint(item.product, nextKm);
  };

  // Early return after all hooks
  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text-primary">Nutrition Kit</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Route Info */}
        {routeData.loaded && (
          <div className="px-4 py-3 bg-surfaceHighlight border-b border-[var(--color-border)]">
            <div className="text-xs text-text-muted uppercase tracking-wider">
              Kit for route
            </div>
            <div className="text-sm font-bold text-text-primary">
              {routeData.name} ({routeData.distanceKm.toFixed(1)}km)
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {cartItems.length === 0 && extrasResolved.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">Your nutrition kit is empty</p>
              <p className="text-xs text-text-secondary mt-1">
                Drag products onto the route to add them
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex gap-3 p-3 bg-surfaceHighlight border border-[var(--color-border)] rounded-lg"
                >
                  {/* Product Image */}
                  <div className="w-14 h-14 flex-shrink-0 bg-surfaceHighlight rounded overflow-hidden">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-text-muted uppercase">
                      {item.product.brand}
                    </div>
                    <div className="text-sm font-bold text-text-primary truncate">
                      {item.product.name}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {item.product.carbs}g carbs &middot; {item.product.calories} cal
                    </div>
                  </div>

                  {/* Quantity & Price */}
                  <div className="flex flex-col items-end justify-between">
                    <div className="text-sm font-display font-bold text-accent-light">
                      R{(item.product.priceZAR * item.quantity).toFixed(2)}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeOne(item)}
                        className="p-1 hover:bg-accent/[0.08] text-text-muted hover:text-text-primary transition-colors"
                        title="Remove one"
                        aria-label="Remove one"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-display text-text-primary">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => addOne(item)}
                        className="p-1 hover:bg-accent/[0.08] text-text-muted hover:text-accent transition-colors"
                        title="Add one"
                        aria-label="Add one"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeAll(item)}
                        className="p-1 hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                        title="Remove all"
                        aria-label="Remove all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Backups (extras not on the route) */}
              {extrasResolved.length > 0 && (
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Backups (not on the route)</div>
                  <div className="space-y-2">
                    {extrasResolved.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="flex gap-3 p-3 bg-surfaceHighlight border border-dashed border-[var(--color-border)] rounded-lg"
                      >
                        <div className="w-12 h-12 flex-shrink-0 bg-surfaceHighlight rounded overflow-hidden">
                          <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] text-text-muted uppercase">{product.brand}</div>
                          <div className="text-sm font-bold text-text-primary truncate">{product.name}</div>
                          <div className="text-xs text-text-secondary">{product.carbs}g · {product.calories} cal</div>
                        </div>
                        <div className="flex flex-col items-end justify-between">
                          <div className="text-sm font-display font-bold text-accent-light">
                            R{((product.priceZAR ?? 0) * quantity).toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setCartExtraQuantity(product.id, quantity - 1)}
                              className="p-1 hover:bg-accent/[0.08] text-text-muted hover:text-text-primary transition-colors"
                              aria-label="Remove one"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-display text-text-primary">{quantity}</span>
                            <button
                              onClick={() => addCartExtra(product.id, 1)}
                              className="p-1 hover:bg-accent/[0.08] text-text-muted hover:text-accent transition-colors"
                              aria-label="Add one"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeCartExtra(product.id)}
                              className="p-1 hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                              aria-label="Remove backup"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add backups search */}
              <div className="pt-2 border-t border-[var(--color-border)]">
                {!extrasOpen ? (
                  <button
                    type="button"
                    onClick={() => setExtrasOpen(true)}
                    className="w-full py-2.5 rounded-lg border border-dashed border-[var(--color-border)] text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent/[0.04] transition-colors flex items-center justify-center gap-2 text-xs font-display font-semibold uppercase tracking-wider"
                  >
                    <PackagePlus className="w-3.5 h-3.5" /> Add backups
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search products to add as a backup..."
                        value={extrasQuery}
                        onChange={(e) => setExtrasQuery(e.target.value)}
                        className="w-full bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-xs p-2 pl-7 focus:outline-none focus:border-accent/40 transition-colors placeholder:text-text-muted font-display"
                      />
                      <Search className="w-3 h-3 text-text-muted absolute left-2 top-2.5" />
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-1 bg-surfaceHighlight rounded-lg p-1">
                      {extrasSuggestions.length === 0 ? (
                        <div className="text-[11px] text-text-muted text-center py-3">No matches</div>
                      ) : (
                        extrasSuggestions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              addCartExtra(p.id, 1);
                              setExtrasQuery('');
                            }}
                            className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-accent/[0.08] text-left transition-colors"
                          >
                            <img src={p.image} alt={p.name} className="w-7 h-7 object-contain flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-text-muted uppercase">{p.brand}</div>
                              <div className="text-xs font-display font-semibold text-text-primary truncate">{p.name}</div>
                            </div>
                            <div className="text-xs text-text-secondary tabular-nums flex-shrink-0">R{(p.priceZAR ?? 0).toFixed(0)}</div>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExtrasOpen(false)}
                      className="w-full py-1.5 text-[10px] text-text-muted hover:text-text-primary uppercase tracking-wider font-display"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {(cartItems.length > 0 || extrasResolved.length > 0) && (
          <div className="p-4 border-t border-[var(--color-border)] bg-surfaceHighlight space-y-3">
            {/* Nutrition Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-surfaceHighlight rounded">
                <div className="text-[10px] text-text-muted uppercase">Items</div>
                <div className="text-lg font-display font-bold text-text-primary">
                  {routeData.nutritionPoints.length}
                </div>
              </div>
              <div className="p-2 bg-surfaceHighlight rounded">
                <div className="text-[10px] text-text-muted uppercase">Total Carbs</div>
                <div className="text-lg font-display font-bold text-accent">
                  {totalCarbs}g
                </div>
              </div>
              <div className="p-2 bg-surfaceHighlight rounded">
                <div className="text-[10px] text-text-muted uppercase">Calories</div>
                <div className="text-lg font-display font-bold text-text-primary">
                  {totalCalories}
                </div>
              </div>
            </div>

            {/* Totals — split into "what gets used on the run" vs "what you buy" */}
            <div className="py-3 border-t border-[var(--color-border)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Cost of this run</span>
                <span className="text-lg font-display font-bold text-warm tabular-nums">R{runCost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted uppercase tracking-wider">Total to buy {hasPackInflation && <span className="text-text-muted/70 lowercase">(full packs)</span>}</span>
                <span className="text-lg font-display font-bold text-accent-light tabular-nums">R{totalCost.toFixed(2)}</span>
              </div>
              {hasPackInflation && (
                <p className="text-[10px] text-text-muted italic pt-1">
                  Sports-drink tubs are sold by the pack — the "cost of this run" is the per-serving equivalent of what you'll actually consume.
                </p>
              )}
            </div>

            {/* Checkout Button */}
            <button
              className="w-full py-4 bg-accent text-white text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-accent-light transition-colors flex items-center justify-center gap-2"
              onClick={() => alert('Checkout coming soon!')}
            >
              <ShoppingCart className="w-4 h-4" />
              Checkout - R{totalCost.toFixed(2)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
