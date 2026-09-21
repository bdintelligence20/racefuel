import { useState } from 'react';
import { Upload, Play, Activity, Pencil, TrendingUp, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StravaActivityList } from './strava/StravaActivityList';
import { TrailBackdrop } from './TrailBackdrop';
import { requestOpenGutTraining } from '../services/gutTrainingOpen';
import { requestOpenCoach } from '../services/coachOpen';
import { useGutTrainingAccess } from '../hooks/useGutTrainingAccess';
import { toast } from 'sonner';

export function GpxDropZone({ onDrawRoute }: { onDrawRoute?: () => void }) {
  const { loadRoute, strava, connectStrava } = useApp();
  const showGutTraining = useGutTrainingAccess();
  // Dev-gated for now so the in-progress coach doesn't ship to prod athletes.
  // Flip to an entitlement (like gut training) when ready to release.
  const showCoach = import.meta.env.DEV;
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStravaModal, setShowStravaModal] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setIsLoading(true);
    setTimeout(() => {
      loadRoute(file);
      setIsLoading(false);
    }, 1500);
  };

  const loadDemoRoute = () => {
    setIsLoading(true);
    setTimeout(() => {
      // Empty file → the parser falls through to AppContext's synthetic demo
      // route (a Cape Town loop), which takes its display name from this file.
      const mockFile = new File([''], 'Cape Town Loop.gpx', {
        type: 'application/gpx+xml',
      });
      loadRoute(mockFile);
      setIsLoading(false);
    }, 1500);
  };

  const handleDrawRoute = () => {
    if (onDrawRoute) {
      onDrawRoute();
      toast.info('Click the map to place waypoints — route will snap to roads.');
    }
  };

  return (
    <>
      {/* Full-surface, single-column guided start — white base, one friendly
          headline, one primary action. Covers the map area so a brand-new
          athlete sees a calm "here's how to begin", not a dashboard. */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center bg-background p-6 overflow-y-auto"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Same horizon as the plan surface, so the very first screen reads as
            the same product rather than a blank white form. */}
        <TrailBackdrop className="pointer-events-none absolute inset-0 h-full w-full" />
        <div className="relative w-full max-w-md">
          {isLoading ? (
            <div className="flex flex-col items-center text-center py-12">
              <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
              <h3 className="text-base font-display font-bold text-text-primary">Reading your route…</h3>
              <p className="text-text-muted font-display text-sm mt-1">Mapping the climbs and working out your fuel</p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-display font-black text-text-primary leading-tight tracking-tight text-center text-balance">
                Let's build your <span className="text-accent">fuel plan</span>.
              </h1>
              <p className="text-sm text-text-secondary text-center mt-2.5 mb-7 max-w-sm mx-auto leading-relaxed">
                Bring your route and we'll tell you exactly what to eat, and when.
              </p>

              {/* Upload / drag-drop */}
              <button
                onClick={() => document.getElementById('gpx-upload')?.click()}
                className={`w-full flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 transition-colors active:scale-[0.99] ${
                  isDragging ? 'border-accent bg-accent/[0.05]' : 'border-[var(--color-border)] hover:border-accent/40'
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-accent" />
                </div>
                <div className="text-sm font-display font-bold text-text-primary">Upload a GPX or TCX</div>
                <div className="text-xs text-text-muted font-display">
                  Drag it here, or <span className="lg:hidden">tap</span><span className="hidden lg:inline">click</span> to choose
                </div>
              </button>

              <input type="file" id="gpx-upload" className="hidden" accept=".gpx,.tcx" onChange={handleFileInput} />

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-[10px] font-display uppercase tracking-wider text-text-muted">or</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={loadDemoRoute}
                  className="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-accent text-white font-display font-bold text-sm active:scale-[0.99] transition-all"
                >
                  <Play className="w-4 h-4" /> Try a demo route
                </button>
                <button
                  onClick={() => (strava.isConnected ? setShowStravaModal(true) : connectStrava())}
                  disabled={strava.isLoading}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] text-text-primary font-display font-semibold text-sm hover:border-accent/40 active:scale-[0.99] transition-all disabled:opacity-60"
                >
                  <Activity className="w-4 h-4 text-[#FC4C02]" />
                  {strava.isLoading ? 'Connecting…' : strava.isConnected ? 'Import from Strava' : 'Connect Strava'}
                </button>
                {onDrawRoute && (
                  <button
                    onClick={handleDrawRoute}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 text-text-muted hover:text-text-primary font-display font-semibold text-[13px] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Or draw it on the map
                  </button>
                )}
              </div>

              {/* The parallel journeys — coaching and gut training — given
                  large, distinct entries on the first screen. Each opens its
                  shell-level flow via a signal bus. */}
              {(showCoach || showGutTraining) && (
                <div className="mt-7 pt-6 border-t border-[var(--color-border)] space-y-2.5">
                  {showCoach && (
                    <JourneyCard
                      icon={Sparkles}
                      title="Your coach"
                      badge="Beta"
                      description="Personal fuelling recommendations from your history"
                      onClick={() => requestOpenCoach()}
                    />
                  )}
                  {showGutTraining && (
                    <JourneyCard
                      icon={TrendingUp}
                      title="Train your gut"
                      badge="Beta"
                      description="A multi-week plan to build carb tolerance for race day"
                      onClick={() => requestOpenGutTraining()}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showStravaModal && (
        <StravaActivityList onClose={() => setShowStravaModal(false)} />
      )}
    </>
  );
}

/** A large, distinct entry for a parallel journey (coaching, gut training) on
 *  the route-entry screen. */
function JourneyCard({
  icon: Icon,
  title,
  badge,
  description,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3.5 rounded-2xl border border-accent/25 bg-accent/[0.04] p-4 text-left hover:bg-accent/[0.07] hover:border-accent/40 active:scale-[0.99] transition-all"
    >
      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 group-hover:bg-accent/[0.14] transition-colors">
        <Icon className="w-6 h-6 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-display font-bold text-text-primary">{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-display font-bold uppercase tracking-wider">{badge}</span>
          )}
        </div>
        <p className="text-[12px] text-text-muted leading-snug mt-0.5">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-text-muted flex-shrink-0 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}
