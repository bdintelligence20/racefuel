import { Truck, Home } from 'lucide-react';

/**
 * The delivery indicator the brief makes a hard requirement: at a glance the
 * athlete must see which parts of their plan arrive at their door and which
 * they supply themselves. Shown in the product picker AND on every placed
 * product, so it has to read the same everywhere — that's why it's one
 * component, not an inline span per surface.
 *
 *  - Deliverable → small truck in the warm/brand colour.
 *  - Bring your own → muted "Bring your own" with a house icon.
 *
 * Pass the already-resolved boolean (see `isDeliverable` in data/products) so
 * the badge and the cart can never disagree about a product.
 */
export function DeliveryBadge({
  deliverable,
  variant = 'tag',
  className = '',
}: {
  deliverable: boolean;
  /** `tag` = labelled pill (pickers, cart). `dot` = icon-only (dense rows, markers). */
  variant?: 'tag' | 'dot';
  className?: string;
}) {
  if (variant === 'dot') {
    return deliverable ? (
      <span
        title="Deliverable — ships with your order"
        className={`inline-flex items-center justify-center text-warm ${className}`}
      >
        <Truck className="w-3 h-3" />
      </span>
    ) : (
      <span
        title="Bring your own — Fuel Lab doesn't stock this"
        className={`inline-flex items-center justify-center text-text-muted ${className}`}
      >
        <Home className="w-3 h-3" />
      </span>
    );
  }

  return deliverable ? (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-wider bg-warm/10 text-warm ${className}`}
    >
      <Truck className="w-2.5 h-2.5" />
      Deliverable
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-wider bg-text-muted/10 text-text-muted ${className}`}
    >
      <Home className="w-2.5 h-2.5" />
      Bring your own
    </span>
  );
}
