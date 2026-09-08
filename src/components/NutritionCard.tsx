
import { Zap } from 'lucide-react';

export type ProductCategory = 'gel' | 'bar' | 'drink' | 'chew';

export interface ProductProps {
  id: string;
  name: string;
  brand: string;
  calories: number;
  carbs: number;
  sodium: number;
  caffeine: number;
  color: 'orange' | 'blue' | 'white' | 'green' | 'red' | 'yellow';
  priceZAR: number;
  image: string;
  category: ProductCategory;
  /** Servings in the pack the athlete actually buys. 1 for single-serve gels/
   *  bars; higher for drink-mix tubs. Drives the "cost of this run" vs
   *  "total pack cost" split in summary displays. Defaults to 1 when the
   *  feed doesn't provide it. */
  servingsPerPack?: number;
  /** Shopify variant ID of the first variant — used to build createCheckout
   *  lineItems when the athlete buys this product through the cart. */
  variantId?: number;
  /** Whether Fuel Lab stocks this product and can ship it to the athlete's
   *  door as part of the plan. Products the athlete uses but we don't sell
   *  (Maurten, Tailwind, USN, Biogen …) are `false` — fully plannable, and
   *  they still export to the watch as cues, but at checkout they're listed as
   *  "you're supplying these yourself" rather than going in the cart. Absent
   *  is treated as deliverable (every feed product is a Fuel Lab SKU). This is
   *  a per-product flag, not a hardcoded brand assumption: a product flips to
   *  deliverable the day Fuel Lab starts stocking it, with no rework. */
  deliverable?: boolean;
}
export function NutritionCard({
  name,
  brand,
  calories,
  carbs,
  sodium,
  caffeine,
  color,
  priceZAR,
  image,
}: ProductProps) {
  const colorMap: Record<string, { accent: string; hover: string }> = {
    orange: { accent: 'text-[#264C42]', hover: 'hover:bg-[#EEF4F1]' },
    blue: { accent: 'text-[#264C42]', hover: 'hover:bg-[#EEF4F1]' },
    white: { accent: 'text-[#1B2320]', hover: 'hover:bg-[#EEF4F1]' },
    green: { accent: 'text-[#264C42]', hover: 'hover:bg-[#EEF4F1]' },
    red: { accent: 'text-[#9A6208]', hover: 'hover:bg-[#FBF0D9]' },
    yellow: { accent: 'text-[#9A6208]', hover: 'hover:bg-[#FBF0D9]' },
  };

  const colors = colorMap[color] || colorMap.white;

  return (
    <div
      className={`group relative bg-white border-b border-[#EAE5DA] p-3 cursor-pointer lg:cursor-grab lg:active:cursor-grabbing ${colors.hover} transition-colors duration-200`}>

      {/* Drag handle (desktop) / tap hint (mobile) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="lg:hidden text-[9px] font-mono text-[#6B7772]">Tap for details</span>
        <div className="hidden lg:flex gap-0.5 opacity-40">
          <div className="w-1 h-4 bg-text-muted rounded-full"></div>
          <div className="w-1 h-4 bg-text-muted rounded-full"></div>
          <div className="w-1 h-4 bg-text-muted rounded-full"></div>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Product Image */}
          <div className="w-14 h-14 flex-shrink-0 bg-[#EEF4F1] rounded-lg overflow-hidden">
          <img
            src={image}
            alt={`${brand} ${name}`}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23EEF4F1" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236B7772" font-size="12">No img</text></svg>';
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-[#6B7772] uppercase tracking-wider">
            {brand}
          </div>
          <h3 className="text-sm font-sans font-bold text-[#1B2320] leading-tight truncate">{name}</h3>
          <div className={`text-sm font-sans font-extrabold ${colors.accent}`}>
            R{priceZAR.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 border-t border-[#F1EDE4] pt-2 mt-2">
        <div>
          <div className="text-[9px] text-[#6B7772] font-mono uppercase">Carbs</div>
          <div className={`text-xs font-sans font-extrabold ${colors.accent}`}>
            {carbs}g
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#6B7772] font-mono uppercase">Na</div>
          <div className="text-xs font-sans font-extrabold text-[#1D3B33]">
            {sodium}<span className="text-[8px] text-text-muted">mg</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[#6B7772] font-mono uppercase">Caff</div>
          <div className="text-xs font-sans font-extrabold text-[#1D3B33]">
            {caffeine}<span className="text-[8px] text-text-muted">mg</span>
          </div>
        </div>
        <div className="flex items-end justify-end">
          <div className="flex items-center gap-0.5">
            <Zap className="w-3 h-3 text-[#2F5D50]" />
            <span className="text-xs font-sans font-extrabold text-[#1D3B33]">
              {calories}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
