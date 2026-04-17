import { Pencil, Check, X, Undo2, Bike, Footprints, Loader2, MousePointerClick } from 'lucide-react';
import { DrawingState } from '../hooks/useRouteDrawing';
import { RoutingProfile } from '../services/route/mapboxDirections';

interface RouteDrawingToolbarProps {
  state: DrawingState;
  waypointCount: number;
  totalDistance: number;
  totalDuration: number;
  profile: RoutingProfile;
  isProcessing: boolean;
  error: string | null;
  routeName: string;
  onStart: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onUndo: () => void;
  onProfileChange: (profile: RoutingProfile) => void;
  onRouteNameChange: (name: string) => void;
}

const profileOptions: { value: RoutingProfile; icon: typeof Bike; label: string }[] = [
  { value: 'cycling', icon: Bike, label: 'Cycling' },
  { value: 'walking', icon: Footprints, label: 'Running' },
];

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function RouteDrawingToolbar({
  state,
  waypointCount,
  totalDistance,
  totalDuration,
  profile,
  isProcessing,
  error,
  routeName,
  onStart,
  onFinish,
  onCancel,
  onUndo,
  onProfileChange,
  onRouteNameChange,
}: RouteDrawingToolbarProps) {
  if (state === 'idle' || state === 'complete') {
    return (
      <button
        onClick={onStart}
        className="group relative flex items-center justify-center gap-1.5 bg-warm hover:bg-warm-light text-white px-4 py-2 rounded-lg font-display font-bold uppercase text-[11px] tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(245,160,32,0.25)] hover:shadow-[0_0_20px_rgba(245,160,32,0.4)]"
        aria-label="Draw route on map"
      >
        <Pencil className="w-3.5 h-3.5 transition-transform group-hover:-rotate-12" />
        <span>Draw Route</span>
      </button>
    );
  }

  const canFinish = waypointCount >= 2 && !isProcessing;

  const statusText = isProcessing
    ? 'Snapping to roads…'
    : error
    ? error
    : waypointCount === 0
    ? 'Tap the map to place your first waypoint'
    : waypointCount === 1
    ? 'Keep going — add one more to finish'
    : 'Ready to finish';
  const statusTone = isProcessing
    ? 'text-warm'
    : error
    ? 'text-red-500'
    : waypointCount >= 2
    ? 'text-accent'
    : 'text-text-muted';

  return (
    <div className="bg-white border-t border-[var(--color-border)] shadow-[0_-10px_40px_-10px_rgba(61,33,82,0.15)] animate-in fade-in slide-in-from-bottom-2 duration-200
                    lg:rounded-2xl lg:border lg:w-[320px] lg:shadow-[0_20px_60px_-20px_rgba(61,33,82,0.25)]">
      <div className="p-3 sm:p-4 space-y-3 lg:space-y-3.5 safe-bottom">
        {/* Header — ping + waypoints */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warm opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-warm" />
            </span>
            <span className="text-[10px] font-display font-black uppercase tracking-[0.18em] text-warm">
              Drawing route
            </span>
            <span className="text-[10px] font-display text-text-muted uppercase tracking-wider">
              · {waypointCount} {waypointCount === 1 ? 'point' : 'points'}
            </span>
          </div>

          {/* Distance pill on mobile; full stats appear below on desktop */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <span className="text-[9px] text-text-muted uppercase tracking-widest font-display">Distance</span>
            <span className="text-sm font-display font-black text-warm tabular-nums">
              {formatDistance(totalDistance)}
            </span>
          </div>
        </div>

        {/* Status — inline on mobile to save space */}
        <div className={`flex items-center gap-2 text-[11px] font-display font-medium ${statusTone}`}>
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
          ) : waypointCount >= 2 ? (
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <MousePointerClick className="w-3.5 h-3.5 text-warm flex-shrink-0" />
          )}
          <span className="truncate">{statusText}</span>
        </div>

        {/* Desktop-only: route name + profile + big stats */}
        <div className="hidden lg:block space-y-3.5">
          <input
            type="text"
            value={routeName}
            onChange={(e) => onRouteNameChange(e.target.value)}
            placeholder="Route name"
            className="w-full bg-surfaceHighlight border border-[var(--color-border)] rounded-lg text-text-primary text-[13px] font-display font-semibold px-3 py-2 focus:outline-none focus:border-warm/50 focus:ring-2 focus:ring-warm/10 placeholder:text-text-muted/60 transition-all"
          />

          <div className="flex gap-1 bg-surfaceHighlight/60 rounded-lg p-1">
            {profileOptions.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => onProfileChange(value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-display font-bold transition-all ${
                  profile === value
                    ? 'bg-warm text-white shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-4 px-1">
            <div className="flex-1">
              <div className="text-[9px] text-text-muted uppercase tracking-widest font-display">Distance</div>
              <div className="text-2xl font-display font-black text-warm leading-none mt-1">
                {formatDistance(totalDistance)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-text-muted uppercase tracking-widest font-display">Est. time</div>
              <div className="text-sm font-display font-bold text-text-primary leading-none mt-1">
                {formatDuration(totalDuration)}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-only: compact profile toggle inline with actions */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="flex bg-surfaceHighlight rounded-lg p-1 border border-[var(--color-border)]">
            {profileOptions.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => onProfileChange(value)}
                aria-label={value === 'cycling' ? 'Cycling' : 'Running'}
                className={`w-9 h-9 flex items-center justify-center rounded-md transition-all ${
                  profile === value ? 'bg-warm text-white shadow-sm' : 'text-text-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <button
            onClick={onUndo}
            disabled={waypointCount === 0}
            className="w-11 h-11 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all"
            title="Remove last point"
            aria-label="Remove last waypoint"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            aria-label="Cancel drawing"
            className="w-11 h-11 flex items-center justify-center rounded-lg border border-red-500/20 text-red-500 active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            onClick={onFinish}
            disabled={!canFinish}
            className="flex-1 h-11 rounded-lg bg-warm text-white text-xs font-display font-black uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Finish
          </button>
        </div>

        {/* Desktop-only: full-width action row */}
        <div className="hidden lg:flex gap-2 pt-1">
          <button
            onClick={onUndo}
            disabled={waypointCount === 0}
            className="p-2.5 rounded-lg border border-[var(--color-border)] text-text-muted hover:text-text-primary hover:bg-surfaceHighlight disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Remove last point"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-red-500/20 text-red-500 text-xs font-display font-bold hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
          <button
            onClick={onFinish}
            disabled={!canFinish}
            className="flex-[1.3] py-2.5 rounded-lg bg-warm text-white text-xs font-display font-black uppercase tracking-wider hover:bg-warm-light disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Finish
          </button>
        </div>
      </div>
    </div>
  );
}
