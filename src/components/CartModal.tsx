import { useMemo } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import { useApp, NutritionPoint } from '../context/AppContext';
import { ProductProps } from './NutritionCard';

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
  const { routeData, removeNutritionPoint, addNutritionPoint } = useApp();

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

  const totalCost = cartItems.reduce(
    (sum, item) => sum + item.product.priceZAR * item.quantity,
    0
  );

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
          {cartItems.length === 0 ? (
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
            </div>
          )}
        </div>

        {/* Summary */}
        {cartItems.length > 0 && (
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

            {/* Total */}
            <div className="flex items-center justify-between py-3 border-t border-[var(--color-border)]">
              <span className="text-sm text-text-secondary uppercase">Total</span>
              <span className="text-2xl font-display font-bold text-accent-light">
                R{totalCost.toFixed(2)}
              </span>
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
