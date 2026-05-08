import { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

type ColorMode = 'distance' | 'elevation';

interface Props {
  colorMode: ColorMode;
  hasNutritionPoints: boolean;
}

/** Compact legend explaining what the route colours and markers mean. Starts
 *  collapsed as a floating "i" button so it doesn't crowd the map — tap to
 *  expand. On mobile the (i) sits at the top-right of the map so the popup
 *  panel can grow downward without being clipped above by the map area's
 *  overflow:hidden. Desktop keeps it at bottom-left where there's room. */
export function MapLegend({ colorMode, hasNutritionPoints }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Tap-anywhere-outside closes the panel — the X is small and easy to miss
  // on mobile, especially when the panel sits over the CONFIG chips.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open]);

  return (
    <div className="absolute top-3 right-3 lg:top-auto lg:right-auto lg:bottom-20 lg:left-3 z-10 pointer-events-auto">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-full bg-surface border border-[var(--color-border)] shadow-md text-text-muted hover:text-text-primary hover:border-warm/50 flex items-center justify-center transition-colors"
          aria-label="Show map legend"
          title="Map legend"
        >
          <Info className="w-4 h-4" />
        </button>
      ) : (
        <div
          ref={panelRef}
          className="bg-surface border border-[var(--color-border)] rounded-xl shadow-xl p-3 w-56 max-w-[72vw]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">Legend</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-8 h-8 -m-1 rounded-full hover:bg-surfaceHighlight text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
              aria-label="Hide legend"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Route colour */}
          <div className="mb-3">
            <div className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider mb-1">
              {colorMode === 'elevation' ? 'Route · Elevation' : 'Route · Distance'}
            </div>
            <div
              className="h-1.5 rounded-full w-full"
              style={{
                background:
                  colorMode === 'elevation'
                    ? 'linear-gradient(to right, #3D2152, #8A4B62, #C77633, #F5A020)'
                    : 'linear-gradient(to right, #F5A020, #E8671A, #3D2152)',
              }}
            />
            <div className="flex justify-between text-[9px] text-text-muted font-display mt-0.5">
              {colorMode === 'elevation' ? (
                <>
                  <span>Low</span>
                  <span>High</span>
                </>
              ) : (
                <>
                  <span>Start</span>
                  <span>Finish</span>
                </>
              )}
            </div>
          </div>

          {/* Fuel markers */}
          {hasNutritionPoints && (
            <div className="mb-3">
              <div className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider mb-1">Fuel points</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <Swatch color="#F5A020" label="Gel / bar" />
                <Swatch color="#3D2152" label="Drink / mix" />
                <Swatch color="#E8671A" label="Chew" />
                <Swatch color="#C94A1A" label="Caffeinated" />
              </div>
              <p className="text-[9px] text-text-muted mt-1 italic">Marker colour follows the brand's accent.</p>
            </div>
          )}

          {/* Terrain */}
          <div>
            <div className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider mb-1">Terrain hints</div>
            <ul className="text-[10px] text-text-secondary space-y-0.5 leading-tight">
              <li>Fuel placed ~5 min before climbs</li>
              <li>Shifted out of long descents</li>
              <li>Min 12 min gap between points</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-text-secondary">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
