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

  return (
    <div className="bg-white border border-[var(--color-border)] rounded-2xl p-4 shadow-[0_20px_60px_-20px_rgba(61,33,82,0.25)] space-y-3.5 w-[320px] animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warm opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-warm" />
          </span>
          <span className="text-[10px] font-display font-black uppercase tracking-[0.18em] text-warm">
            Drawing
          </span>
        </div>
        <span className="text-[10px] font-display text-text-muted uppercase tracking-wider">
          {waypointCount} {waypointCount === 1 ? 'point' : 'points'}
        </span>
      </div>

      {/* Route Name */}
      <input
        type="text"
        value={routeName}
        onChange={(e) => onRouteNameChange(e.target.value)}
        placeholder="Route name"
        className="w-full bg-surfaceHighlight border border-[var(--color-border)] rounded-lg text-text-primary text-[13px] font-display font-semibold px-3 py-2 focus:outline-none focus:border-warm/50 focus:ring-2 focus:ring-warm/10 placeholder:text-text-muted/60 transition-all"
      />

      {/* Profile Selector */}
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

      {/* Stats — prominent distance, secondary time */}
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

      {/* Status strip */}
      {isProcessing ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-warm/10 border border-warm/20 text-[11px] font-display font-semibold text-warm">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Snapping to roads…</span>
        </div>
      ) : error ? (
        <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg font-display">
          {error}
        </div>
      ) : waypointCount === 0 ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] text-[11px] font-display text-text-muted">
          <MousePointerClick className="w-3.5 h-3.5 text-warm" />
          <span>Tap the map to place your first waypoint</span>
        </div>
      ) : waypointCount === 1 ? (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] text-[11px] font-display text-text-muted">
          <MousePointerClick className="w-3.5 h-3.5 text-warm" />
          <span>Keep going — add one more to finish</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/20 text-[11px] font-display text-accent font-semibold">
          <Check className="w-3.5 h-3.5" />
          <span>Ready to finish whenever you want</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
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
  );
}
