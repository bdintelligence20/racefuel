import { useState } from 'react';
import { Pencil, Check, X, Undo2, Bike, Footprints, Loader2 } from 'lucide-react';
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
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-surface border border-[var(--color-border)] text-warm hover:bg-warm hover:text-white shadow-lg active:scale-95 transition-all text-sm font-display font-bold"
      >
        <Pencil className="w-4 h-4" />
        Draw Route
      </button>
    );
  }

  return (
    <div className="bg-surface border border-[var(--color-border)] rounded-2xl p-4 shadow-2xl space-y-3 min-w-[300px]">
      {/* Route Name */}
      <input
        type="text"
        value={routeName}
        onChange={(e) => onRouteNameChange(e.target.value)}
        placeholder="Route name"
        className="w-full bg-surfaceHighlight border border-[var(--color-border)] rounded-lg text-text-primary text-xs px-2.5 py-1.5 focus:outline-none focus:border-warm/40 placeholder:text-text-muted"
      />

      {/* Profile Selector */}
      <div className="flex gap-1">
        {profileOptions.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => onProfileChange(value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              profile === value
                ? 'bg-warm/20 text-warm border border-warm/30'
                : 'text-text-muted hover:text-text-secondary border border-[var(--color-border)]'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div>
          <div className="text-[9px] text-text-muted uppercase">Points</div>
          <div className="text-sm font-display font-bold text-text-primary">{waypointCount}</div>
        </div>
        <div>
          <div className="text-[9px] text-text-muted uppercase">Distance</div>
          <div className="text-sm font-display font-bold text-warm">{formatDistance(totalDistance)}</div>
        </div>
        <div>
          <div className="text-[9px] text-text-muted uppercase">Est. Time</div>
          <div className="text-sm font-display font-bold text-text-primary">{formatDuration(totalDuration)}</div>
        </div>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-[10px] text-warm">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Calculating route...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-[10px] text-red-400 bg-red-400/10 px-2 py-1.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Instructions */}
      <p className="text-[10px] text-text-muted">
        Click on the map to place waypoints. Route will snap to roads.
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onUndo}
          disabled={waypointCount === 0}
          className="p-2 rounded-lg border border-[var(--color-border)] text-text-muted hover:text-text-primary hover:bg-surfaceHighlight disabled:opacity-30 transition-colors"
          title="Remove last point"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          onClick={onFinish}
          disabled={waypointCount < 2 || isProcessing}
          className="flex-1 py-2 rounded-lg bg-warm text-black text-xs font-bold uppercase tracking-wider hover:bg-warm-light disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Finish
        </button>
      </div>
    </div>
  );
}
