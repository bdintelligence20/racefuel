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
      // Create a mock file object for the demo
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
        className={`absolute inset-4 border-2 border-dashed transition-all duration-300 z-10 flex flex-col items-center justify-center group
        ${
          isDragging
            ? 'border-neon-blue bg-neon-blue/10 scale-[0.99]'
            : 'border-neon-blue/30 bg-surface/50 backdrop-blur-sm'
        }
      `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isLoading ? (
          <div className="flex flex-col items-center animate-pulse">
            <FileCode className="w-12 h-12 text-neon-orange mb-4" />
            <h3 className="text-xl font-bold text-white tracking-tight">
              PARSING ROUTE DATA...
            </h3>
            <p className="text-text-secondary font-mono text-sm mt-2">
              ANALYZING ELEVATION PROFILE
            </p>
          </div>
        ) : (
          <>
            <div
              className="relative cursor-pointer"
              onClick={() => document.getElementById('gpx-upload')?.click()}
            >
              <div className="absolute inset-0 bg-neon-blue/20 blur-xl rounded-full animate-pulse"></div>
              <div className="relative bg-surfaceHighlight p-6 border border-neon-blue/50 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-12 h-12 text-neon-blue" />
              </div>
            </div>

            <h3 className="mt-6 text-xl font-bold tracking-tight text-white group-hover:text-neon-blue transition-colors">
              DROP GPX / TCX FILE
            </h3>
            <p className="mt-2 text-text-secondary font-mono text-sm">
              OR CLICK TO UPLOAD ROUTE
            </p>

            <input
              type="file"
              id="gpx-upload"
              className="hidden"
              accept=".gpx,.tcx"
              onChange={handleFileInput}
            />

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
              {/* Import from Strava Button */}
              {strava.isConnected && (
                <button
                  onClick={() => setShowStravaModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#FC4C02]/10 border border-[#FC4C02]/50 text-[#FC4C02] font-bold uppercase text-sm tracking-wider hover:bg-[#FC4C02] hover:text-white transition-all duration-300"
                >
                  <Activity className="w-4 h-4" />
                  IMPORT FROM STRAVA
                </button>
              )}

              {/* Demo Route Button */}
              <button
                onClick={loadDemoRoute}
                className="flex items-center gap-2 px-6 py-3 bg-neon-orange/10 border border-neon-orange/50 text-neon-orange font-bold uppercase text-sm tracking-wider hover:bg-neon-orange hover:text-black transition-all duration-300"
              >
                <Play className="w-4 h-4" />
                LOAD DEMO ROUTE
              </button>
            </div>

            <p className="mt-2 text-text-muted font-mono text-xs">
              Col du Galibier • 85km • 1,240m
            </p>
          </>
        )}

        {/* Decorative corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-blue transition-all group-hover:w-8 group-hover:h-8"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-blue transition-all group-hover:w-8 group-hover:h-8"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-blue transition-all group-hover:w-8 group-hover:h-8"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-blue transition-all group-hover:w-8 group-hover:h-8"></div>
      </div>

      {/* Strava Activity List Modal */}
      {showStravaModal && (
        <StravaActivityList onClose={() => setShowStravaModal(false)} />
      )}
    </>
  );
}
