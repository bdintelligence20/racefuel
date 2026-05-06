import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Download, Undo2, Redo2, Info, Share2, Zap, Trash2, ShoppingCart } from 'lucide-react';
import { ExportModal } from './export/ExportModal';
import { FlyoverExportModal } from './export/FlyoverExportModal';
import { ScorePopover } from './ScorePopover';
import { CartModal } from './CartModal';
import { calculatePlanCost } from '../services/nutrition/costCalculator';
import { getActiveDurationHours } from '../services/route/timeFormat';

export function ActionBar() {
  const { routeData, planValidation, canUndo, canRedo, undo, redo, autoGeneratePlan, resetRoute } = useApp();
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const cost = useMemo(() => calculatePlanCost(routeData.nutritionPoints), [routeData.nutritionPoints]);

  if (!routeData.loaded) return null;

  // Footer shows per-serving "cost of this run" — matches the athlete's
  // mental model of what they actually used. When buying full packs costs
  // noticeably more (e.g. a 1kg drink tub for one scoop), show the "to buy"
  // sub so the headline number isn't accused of being the full-tub price.
  const runCost = cost.runCostZAR;
  const totalToBuy = cost.totalCostZAR;
  const hasPackInflation = totalToBuy > runCost + 1;

  const totalCarbs = routeData.nutritionPoints.reduce((sum, point) => {
    return sum + point.product.carbs;
  }, 0);

  const hours = getActiveDurationHours(routeData, 3);
  const carbsPerHour = hours > 0 ? Math.round(totalCarbs / hours) : 0;

  return (
    <>
      <div className="bg-surface border-t border-[var(--color-border)] px-2 sm:px-4 py-3 lg:px-5 lg:py-3 flex flex-col gap-2 safe-bottom">
        {/* Warning pills used to live here, but they duplicated the content of
            the Score popover and ate scarce mobile vertical real estate. The
            Score (i) popover is now the single home for plan warnings. */}

        {/* Stats row. Equal-width grid columns so the 4 stats + Score lay out
            in a clean rhythm regardless of viewport width. The previous
            `justify-between` distributed leftover space between cells, which
            on a wide laptop produced huge gaps between "85.4km / 7 pts" and
            the other cells. items-start so the Run Cost cell's subValue
            ("+R… buy") doesn't push neighbours off-center. */}
        <div className={`grid items-start gap-3 sm:gap-4 ${planValidation ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {[
            { label: routeData.distanceKm.toFixed(1) + 'km', value: routeData.nutritionPoints.length + ' pts', color: 'text-text-primary', hint: 'Route distance · number of fuel points placed' },
            { label: 'Carbs/hr', value: carbsPerHour + 'g', color: carbsPerHour >= 60 && carbsPerHour <= 90 ? 'text-accent' : carbsPerHour > 90 ? 'text-terrain-rust' : 'text-warm', hint: 'Grams of carbohydrate per hour. Evidence target: 60–90 g/h for efforts over 2 hours.' },
            { label: 'Total', value: totalCarbs + 'g', color: 'text-warm', hint: 'Total grams of carbs across all placements.' },
            {
              label: 'Run cost',
              value: 'R' + runCost.toFixed(0),
              color: 'text-accent',
              hint: hasPackInflation
                ? `Cost of the servings used on this run. To buy in full packs: R${totalToBuy.toFixed(0)}.`
                : 'Per-serving equivalent of what the plan consumes.',
              subValue: hasPackInflation ? `+R${(totalToBuy - runCost).toFixed(0)} buy` : undefined,
            },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0" title={stat.hint}>
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display truncate">{stat.label}</div>
              <div className={`text-sm font-display font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
              {'subValue' in stat && stat.subValue && (
                <div className="text-[9px] text-text-muted font-display tabular-nums">{stat.subValue}</div>
              )}
            </div>
          ))}

          {planValidation && (
            <div className="relative min-w-0">
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display flex items-center gap-1">
                Score
                <button
                  type="button"
                  onClick={() => setScoreOpen((v) => !v)}
                  aria-label="Show score breakdown"
                  className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setScoreOpen((v) => !v)}
                className={`text-sm font-display font-bold ${planValidation.score >= 80 ? 'text-accent' : planValidation.score >= 50 ? 'text-warm' : 'text-terrain-rust'} cursor-pointer`}
              >
                {planValidation.score}
              </button>
              {scoreOpen && <ScorePopover validation={planValidation} onClose={() => setScoreOpen(false)} />}
            </div>
          )}
        </div>

        {/* Actions row.
            Mobile (< sm): all 7 buttons live directly in one flex container
            so they form a single connected strip — outer rounded border,
            divide-x between cells, each button takes 1/7 via `flex-1`.
            (Earlier we used `display:contents` group divs but Tailwind's
            divide selector is DOM-based, so dividers wouldn't render
            between groups — flattening fixes that.)
            Desktop (sm+): same row, but borders/dividers/flex-1 are
            disabled and the second group is pushed right via `sm:ml-auto`
            on the first View Kit button — preserving the old left/right
            split layout without needing wrapper divs. */}
        <div className="flex w-full rounded-xl overflow-hidden border border-[var(--color-border)] divide-x divide-[var(--color-border)] sm:w-auto sm:rounded-none sm:border-0 sm:divide-x-0 sm:items-stretch sm:gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
          <ActionButton
            mobileLabel="Undo"
            desktopLabel="Undo"
            icon={<Undo2 className="w-[18px] h-[18px]" />}
            onClick={undo}
            disabled={!canUndo}
            tone="neutral"
            title="Undo"
          />
          <ActionButton
            mobileLabel="Redo"
            desktopLabel="Redo"
            icon={<Redo2 className="w-[18px] h-[18px]" />}
            onClick={redo}
            disabled={!canRedo}
            tone="neutral"
            title="Redo"
          />
          <ActionButton
            mobileLabel="Clear"
            desktopLabel="Clear"
            icon={<Trash2 className="w-[18px] h-[18px]" />}
            onClick={resetRoute}
            tone="danger"
            mobileOnly
            title="Clear route"
          />
          <ActionButton
            mobileLabel="Auto"
            desktopLabel="Auto"
            icon={<Zap className="w-[18px] h-[18px] fill-current" />}
            onClick={autoGeneratePlan}
            tone="warm-filled"
            mobileOnly
            title="Auto-generate a science-backed nutrition plan for this route"
          />
          <ActionButton
            mobileLabel="Kit"
            desktopLabel="View Kit"
            icon={<ShoppingCart className="w-[18px] h-[18px]" />}
            onClick={() => setCartOpen(true)}
            disabled={routeData.nutritionPoints.length === 0}
            tone="warm-outline"
            title="View the shopping kit needed for this plan"
            extraClassName="sm:ml-auto"
          />
          <ActionButton
            mobileLabel="Share"
            desktopLabel="Share"
            icon={<Share2 className="w-[18px] h-[18px]" />}
            onClick={() => setShareOpen(true)}
            disabled={routeData.nutritionPoints.length === 0}
            tone="warm-outline"
            title="Make a shareable cinematic flyover video of your route + fuel points"
          />
          <ActionButton
            mobileLabel="Export"
            desktopLabel="Export"
            icon={<Download className="w-[18px] h-[18px]" />}
            onClick={() => setExportOpen(true)}
            disabled={routeData.nutritionPoints.length === 0}
            tone="primary"
            title="Export this plan as GPX, PDF, CSV, image…"
          />
        </div>
      </div>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />
      <FlyoverExportModal isOpen={shareOpen} onClose={() => setShareOpen(false)} />
      <CartModal isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

/* ───────────────────── ActionButton ─────────────────────
   Two layouts:
     - Mobile (< sm): vertical stack — icon on top, tiny label below. Each
       cell is a fixed 56px wide (54px on really tight viewports), giving
       3 icon-stacks on the left + 3 on the right enough room on a 360–
       430px-wide phone without truncation.
     - Desktop (sm+): horizontal — icon then inline label, padded.

   The 'mobileOnly' flag hides the cell on lg+ (used for Auto and Clear,
   which have desktop equivalents elsewhere on the map). */
type ButtonTone = 'neutral' | 'danger' | 'primary' | 'warm-filled' | 'warm-outline';

// On mobile the buttons live inside a single bordered strip, so we suppress
// their per-button border (border-0). On sm+ they're individual chips again
// and re-acquire their colored borders.
const TONE_CLASSES: Record<ButtonTone, { bg: string; mobileText: string; desktopText: string }> = {
  neutral: {
    bg: 'bg-surfaceHighlight border-0 sm:border sm:border-[var(--color-border)] hover:bg-accent/[0.08]',
    mobileText: 'text-text-primary',
    desktopText: 'text-text-primary',
  },
  danger: {
    bg: 'bg-surfaceHighlight border-0 sm:border sm:border-red-500/20 hover:bg-red-500/10 sm:hover:border-red-500/40',
    mobileText: 'text-red-400',
    desktopText: 'text-red-400/80 hover:text-red-400',
  },
  primary: {
    bg: 'bg-accent hover:bg-accent-light',
    mobileText: 'text-white',
    desktopText: 'text-white',
  },
  'warm-filled': {
    bg: 'bg-warm hover:bg-warm-light sm:shadow-[0_0_12px_rgba(245,160,32,0.25)]',
    mobileText: 'text-white',
    desktopText: 'text-white',
  },
  'warm-outline': {
    bg: 'bg-surfaceHighlight border-0 sm:border sm:border-warm/30 sm:hover:border-warm hover:bg-warm/[0.08]',
    mobileText: 'text-warm',
    desktopText: 'text-warm',
  },
};

function ActionButton({
  mobileLabel,
  desktopLabel,
  icon,
  onClick,
  disabled,
  tone,
  mobileOnly,
  title,
  extraClassName,
}: {
  mobileLabel: string;
  desktopLabel: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: ButtonTone;
  mobileOnly?: boolean;
  title?: string;
  extraClassName?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        ${mobileOnly ? 'lg:hidden' : ''}
        ${extraClassName ?? ''}
        flex flex-col sm:flex-row items-center justify-center
        gap-0.5 sm:gap-2
        w-full sm:w-auto h-12 sm:h-10
        sm:px-4
        rounded-none sm:rounded-xl
        ${t.bg}
        ${t.desktopText}
        font-display font-bold uppercase
        active:scale-95 transition-all
        disabled:opacity-30 disabled:cursor-not-allowed
        sm:flex-shrink-0
      `}
    >
      <span className={tone === 'primary' || tone === 'warm-filled' ? 'text-white' : t.mobileText}>
        {icon}
      </span>
      {/* Mobile label — small, fits under the icon */}
      <span className={`text-[9px] sm:hidden tracking-wider ${tone === 'primary' || tone === 'warm-filled' ? 'text-white' : t.mobileText}`}>
        {mobileLabel}
      </span>
      {/* Desktop label — inline, larger */}
      <span className="hidden sm:inline text-xs tracking-wider">
        {desktopLabel}
      </span>
    </button>
  );
}
