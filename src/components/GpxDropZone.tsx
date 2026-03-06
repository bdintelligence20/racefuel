import React, { useState } from 'react';
import { Upload, FileCode, Play, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StravaActivityList } from './strava/StravaActivityList';

export function GpxDropZone() {
  const { loadRoute, strava } = useApp();
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
      const mockFile = new File([''], 'Col_du_Galibier.gpx', {
        type: 'application/gpx+xml',
      });
      loadRoute(mockFile);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <>
      <div
        className={`absolute inset-6 rounded-2xl border-2 border-dashed transition-all duration-300 z-10 flex flex-col items-center justify-center group
        ${
          isDragging
            ? 'border-accent bg-accent/5 scale-[0.99]'
            : 'border-white/[0.08] bg-surface/40 backdrop-blur-sm'
        }
      `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
              <FileCode className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-white tracking-tight">
              Parsing route data...
            </h3>
            <p className="text-text-muted font-mono text-xs mt-2">
              Analyzing elevation profile
            </p>
          </div>
        ) : (
          <>
            <div
              className="relative cursor-pointer"
              onClick={() => document.getElementById('gpx-upload')?.click()}
            >
              <div className="absolute inset-0 bg-accent/10 blur-2xl rounded-full"></div>
              <div className="relative w-20 h-20 rounded-2xl bg-surfaceHighlight border border-white/[0.08] flex items-center justify-center group-hover:scale-105 group-hover:border-accent/30 transition-all duration-300">
                <Upload className="w-8 h-8 text-accent" />
              </div>
            </div>

            <h3 className="mt-6 text-lg font-semibold tracking-tight text-white group-hover:text-accent transition-colors">
              Drop a GPX or TCX file
            </h3>
            <p className="mt-1.5 text-text-muted text-sm">
              or click to browse your files
            </p>

            <input
              type="file"
              id="gpx-upload"
              className="hidden"
              accept=".gpx,.tcx"
              onChange={handleFileInput}
            />

            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              {strava.isConnected && (
                <button
                  onClick={() => setShowStravaModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FC4C02]/10 border border-[#FC4C02]/30 text-[#FC4C02] font-semibold text-sm hover:bg-[#FC4C02] hover:text-white transition-all duration-300"
                >
                  <Activity className="w-4 h-4" />
                  Import from Strava
                </button>
              )}

              <button
                onClick={loadDemoRoute}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent font-semibold text-sm hover:bg-accent hover:text-black transition-all duration-300"
              >
                <Play className="w-4 h-4" />
                Try demo route
              </button>
            </div>

            <p className="mt-3 text-text-muted font-mono text-[10px] tracking-wide">
              Col du Galibier &middot; 85km &middot; 1,240m gain
            </p>
          </>
        )}
      </div>

      {showStravaModal && (
        <StravaActivityList onClose={() => setShowStravaModal(false)} />
      )}
    </>
  );
}
