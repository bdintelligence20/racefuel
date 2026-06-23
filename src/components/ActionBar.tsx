import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Download, Undo2, Redo2, Info, Share2, Zap, Trash2, ShoppingCart, MoreHorizontal, Watch, X, ArrowRight } from 'lucide-react';
import { ExportModal } from './export/ExportModal';
import { FlyoverExportModal } from './export/FlyoverExportModal';
import { ScorePopover } from './ScorePopover';
import { CartModal } from './CartModal';
import { InfoTip } from './ui/InfoTip';
import { getActiveDurationHours } from '../services/route/timeFormat';

export function ActionBar() {
  const { routeData, planValidation, canUndo, canRedo, undo, redo, autoGeneratePlan, resetRoute } = useApp();
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!routeData.loaded) return null;

  const hasPlan = routeData.nutritionPoints.length > 0;

  // Mobile shows ONE momentum action, not a 7-button toolkit. The label is the
  // next step in the journey: build the plan, then send it to the watch. Buy,
  // share, undo/redo, clear all live in the overflow sheet — present, but out
  // of the way (the brief's "everything else one tap away").
  const primary = hasPlan
    ? { label: 'Export to watch', icon: <Watch className="w-5 h-5" />, onClick: () => setExportOpen(true) }
    : { label: 'Build my plan', icon: <Zap className="w-5 h-5 fill-current" />, onClick: autoGeneratePlan };

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

        {/* Stats row — explicit two-group layout so the four route stats
            stay tight on the left and Score anchors on the right.
            (`ml-auto` alone wasn't enough on wide laptops — without an
            explicit left group, the stats inherited extra space from the
            parent column and fanned out across the full row.)
            Mobile keeps `overflow-x-auto` for narrow viewports. */}
        {hasPlan && (
        <div className="flex items-start gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-start gap-x-5 sm:gap-x-6 lg:gap-x-8 flex-shrink-0">
            {[
              { label: routeData.distanceKm.toFixed(1) + 'km', value: routeData.nutritionPoints.length + ' pts', color: 'text-text-primary', hint: 'Route distance · number of fuel points placed', tip: false },
              { label: 'Carbs/hr', value: carbsPerHour + 'g', color: carbsPerHour >= 60 && carbsPerHour <= 90 ? 'text-accent' : carbsPerHour > 90 ? 'text-terrain-rust' : 'text-warm', hint: 'How many grams of carbohydrate the plan gives you each hour. For efforts over two hours, 60–90 g/h is the sweet spot.', tip: true },
              { label: 'Total', value: totalCarbs + 'g', color: 'text-warm', hint: 'Total grams of carbs across every fuel point in the plan.', tip: false },
            ].map((stat) => (
              <div key={stat.label} className="flex-shrink-0" title={stat.hint}>
                <div className="text-[9px] text-text-muted uppercase tracking-wider font-display flex items-center gap-1">
                  {stat.label}
                  {stat.tip && <InfoTip label={stat.label} text={stat.hint} />}
                </div>
                <div className={`text-sm font-display font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {planValidation && (
            <div className="relative flex-shrink-0 ml-auto">
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
        )}

        {/* MOBILE actions — one primary momentum button + an overflow sheet.
            Replaces the old 7-icon strip that made the screen feel like a
            toolkit. */}
        <div className="sm:hidden flex items-center gap-2">
          <button
            onClick={primary.onClick}
            className="flex-1 h-12 rounded-xl bg-accent text-white font-display font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(61,33,82,0.15)]"
          >
            {primary.icon}
            {primary.label}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="More actions"
            className="w-12 h-12 flex-shrink-0 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-secondary flex items-center justify-center active:scale-95 transition-all"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop actions row (sm+).
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
        <div className="hidden sm:flex sm:w-auto sm:items-stretch sm:gap-2">
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
            mobileLabel="Buy Fuel"
            desktopLabel="Buy Fuel"
            icon={<ShoppingCart className="w-[18px] h-[18px]" />}
            onClick={() => setCartOpen(true)}
            disabled={routeData.nutritionPoints.length === 0}
            tone="warm-outline"
            title="Buy the fuel for this plan"
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

      {/* Mobile overflow sheet — the rest of the toolkit, one tap away. */}
      {menuOpen && (
        <div className="sm:hidden fixed inset-0 z-[55] flex items-end" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full bg-surface border-t border-[var(--color-border)] rounded-t-2xl p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-1 pb-2"><div className="w-10 h-1 rounded-full bg-[var(--color-border)]" /></div>
            <div className="grid grid-cols-3 gap-2">
              {hasPlan && <SheetItem icon={<ShoppingCart className="w-5 h-5" />} label="Buy fuel" onClick={() => { setMenuOpen(false); setCartOpen(true); }} />}
              {hasPlan && <SheetItem icon={<Share2 className="w-5 h-5" />} label="Share" onClick={() => { setMenuOpen(false); setShareOpen(true); }} />}
              {hasPlan && <SheetItem icon={<Download className="w-5 h-5" />} label="Export" onClick={() => { setMenuOpen(false); setExportOpen(true); }} />}
              <SheetItem icon={<Undo2 className="w-5 h-5" />} label="Undo" disabled={!canUndo} onClick={() => undo()} />
              <SheetItem icon={<Redo2 className="w-5 h-5" />} label="Redo" disabled={!canRedo} onClick={() => redo()} />
              <SheetItem icon={<Trash2 className="w-5 h-5" />} label="Clear route" tone="danger" onClick={() => { setMenuOpen(false); resetRoute(); }} />
            </div>
            <button onClick={() => setMenuOpen(false)} className="w-full mt-2 py-3 text-text-muted hover:text-text-primary font-display text-sm flex items-center justify-center gap-1.5">
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>
      )}

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        onBuyProducts={() => { setExportOpen(false); setCartOpen(true); }}
      />
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
function SheetItem({ icon, label, onClick, disabled, tone }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; tone?: 'danger' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${tone === 'danger' ? 'text-red-400' : 'text-text-primary'}`}
    >
      {icon}
      <span className="text-[10px] font-display font-semibold uppercase tracking-wider">{label}</span>
    </button>
  );
}

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
