import { useState } from 'react';
import { Upload, FileCode, Play, Activity, Pencil } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StravaActivityList } from './strava/StravaActivityList';

export function GpxDropZone() {
  const { loadRoute, strava } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showStravaModal, setShowStravaModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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
      const mockFile = new File([''], 'Col_du_Galibier.gpx', {
        type: 'application/gpx+xml',
      });
      loadRoute(mockFile);
      setIsLoading(false);
    }, 1500);
  };

  if (dismissed) return null;

  return (
    <>
      <div
        className="absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-8"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Card container */}
        <div className={`w-full max-w-sm bg-surface rounded-2xl shadow-xl border transition-all duration-300 ${
          isDragging ? 'border-warm scale-[0.98]' : 'border-[var(--color-border)]'
        }`}>
          <div className="p-6 sm:p-8">
            {isLoading ? (
              <div className="flex flex-col items-center py-4 animate-pulse">
                <div className="w-14 h-14 rounded-2xl bg-warm/10 flex items-center justify-center mb-4">
                  <FileCode className="w-7 h-7 text-warm" />
                </div>
                <h3 className="text-base font-display font-semibold text-text-primary">
                  Parsing route data...
                </h3>
                <p className="text-text-muted font-display text-sm mt-1">
                  Analyzing elevation profile
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                {/* Upload button */}
                <button
                  onClick={() => document.getElementById('gpx-upload')?.click()}
                  className={`w-full flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                    isDragging
                      ? 'border-warm bg-warm/5'
                      : 'border-[var(--color-border)] hover:border-warm/40 hover:bg-warm/[0.03]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-warm/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-warm" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-display font-semibold text-text-primary">
                      Upload GPX or TCX
                    </div>
                    <div className="text-xs text-text-muted font-display mt-0.5">
                      <span className="lg:hidden">Tap</span>
                      <span className="hidden lg:inline">Click</span>
                      {' '}to select a route file
                    </div>
                  </div>
                </button>

                <input
                  type="file"
                  id="gpx-upload"
                  className="hidden"
                  accept=".gpx,.tcx"
                  onChange={handleFileInput}
                />

                {/* Divider */}
                <div className="flex items-center gap-3 w-full my-4">
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                  <span className="text-xs text-text-muted font-display">or</span>
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2 w-full">
                  {strava.isConnected && (
                    <button
                      onClick={() => setShowStravaModal(true)}
                      className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-[#FC4C02] text-white font-display font-semibold text-sm active:scale-[0.98] transition-all"
                    >
                      <Activity className="w-4 h-4" />
                      Import from Strava
                    </button>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setDismissed(true)}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-warm text-white font-display font-semibold text-sm active:scale-[0.98] transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                      Draw Route
                    </button>

                    <button
                      onClick={loadDemoRoute}
                      className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-accent text-white font-display font-semibold text-sm active:scale-[0.98] transition-all"
                    >
                      <Play className="w-4 h-4" />
                      Try Demo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showStravaModal && (
        <StravaActivityList onClose={() => setShowStravaModal(false)} />
      )}
    </>
  );
}
