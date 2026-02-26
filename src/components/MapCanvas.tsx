import React, { useRef, useMemo } from 'react';
import { GpxDropZone } from './GpxDropZone';
import { AutoGenerateButton } from './AutoGenerateButton';
import { MapView } from './MapView';
import { Navigation, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductProps } from './NutritionCard';
import { NutritionMarker } from './NutritionMarker';

function ElevationChart() {
  const { routeData } = useApp();

  // Sample elevation data into bars
  const elevationBars = useMemo(() => {
    const numBars = 40;
    const gpsPath = routeData.gpsPath;

    // If we have real elevation data
    if (gpsPath && gpsPath.length > 0 && gpsPath.some((p) => p.elevation !== undefined)) {
      const elevations = gpsPath
        .filter((p) => p.elevation !== undefined)
        .map((p) => p.elevation as number);

      if (elevations.length === 0) {
        return Array.from({ length: numBars }, () => 30 + Math.random() * 40);
      }

      const minElev = Math.min(...elevations);
      const maxElev = Math.max(...elevations);
      const range = maxElev - minElev || 1;

      // Sample into bars
      const bars: number[] = [];
      for (let i = 0; i < numBars; i++) {
        const idx = Math.floor((i / numBars) * elevations.length);
        const normalized = ((elevations[idx] - minElev) / range) * 60 + 20; // 20-80%
        bars.push(normalized);
      }
      return bars;
    }

    // Fallback to random bars
    return Array.from({ length: numBars }, () => 20 + Math.random() * 60);
  }, [routeData.gpsPath]);

  return (
    <div className="w-full h-full p-6 flex items-end gap-1 relative z-0">
      {elevationBars.map((height, i) => (
        <div
          key={i}
          className="flex-1 bg-white/10 hover:bg-neon-blue transition-colors duration-300"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export function MapCanvas() {
  const {
    routeData,
    autoGeneratePlan,
    addNutritionPoint,
    removeNutritionPoint,
    resetRoute
  } = useApp();
  const elevationRef = useRef<HTMLDivElement>(null);
  const handleElevationDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!elevationRef.current) return;
    try {
      const productData = JSON.parse(
        e.dataTransfer.getData('application/json')
      ) as ProductProps;
      const rect = elevationRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const distanceKm = percentage * routeData.distanceKm;
      addNutritionPoint(productData, distanceKm);
    } catch (err) {
      console.error('Invalid drop data', err);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  return (
    <main className="flex-1 relative flex flex-col bg-background bg-grid-pattern bg-[length:40px_40px]">
      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map UI Overlays */}
        <div className="absolute top-6 left-6 z-10 flex gap-4">
          <div className="bg-surface/90 backdrop-blur border border-white/10 p-3 shadow-lg">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
              Distance
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {routeData.loaded ? routeData.distanceKm.toFixed(2) : '0.00'}{' '}
              <span className="text-sm text-text-secondary">km</span>
            </div>
          </div>
          <div className="bg-surface/90 backdrop-blur border border-white/10 p-3 shadow-lg">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
              Elevation
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {routeData.loaded ? routeData.elevationGain : '0'}{' '}
              <span className="text-sm text-text-secondary">m</span>
            </div>
          </div>
        </div>

        {/* Compass / Orientation */}
        <div className="absolute top-6 right-6 z-10 flex gap-2">
          {routeData.loaded && (
            <button
              onClick={resetRoute}
              className="w-12 h-12 rounded-full border border-white/10 bg-surface/80 backdrop-blur flex items-center justify-center hover:bg-surface hover:border-neon-orange/50 transition-colors group"
              title="Load different route"
            >
              <RotateCcw className="w-5 h-5 text-text-muted group-hover:text-neon-orange transition-colors" />
            </button>
          )}
          <div className="w-12 h-12 rounded-full border border-white/10 bg-surface/50 backdrop-blur flex items-center justify-center">
            <Navigation className="w-5 h-5 text-neon-orange transform -rotate-45" />
          </div>
        </div>

        {/* Center Content */}
        <div className="absolute inset-0">
          {routeData.loaded ? <MapView /> : <GpxDropZone />}
        </div>

        {/* Floating Action Button */}
        {routeData.loaded && (
          <div className="absolute bottom-8 right-8 z-20">
            <AutoGenerateButton onClick={autoGeneratePlan} />
          </div>
        )}
      </div>

      {/* Elevation Profile Panel */}
      <div
        ref={elevationRef}
        className="h-48 bg-surface border-t border-white/10 relative group"
        onDrop={handleElevationDrop}
        onDragOver={handleDragOver}>

        <div className="absolute top-0 left-0 bg-neon-orange text-black text-[10px] font-bold px-2 py-1 uppercase tracking-wider z-10">
          Elevation Profile
        </div>

        {/* Elevation Profile Chart */}
        <ElevationChart />

        {/* Nutrition Markers on Elevation Profile */}
        {routeData.loaded &&
        routeData.nutritionPoints.map((point) => {
          const left = `${point.distanceKm / routeData.distanceKm * 100}%`;
          return (
            <NutritionMarker
              key={`elev-${point.id}`}
              product={point.product}
              distanceKm={point.distanceKm}
              onRemove={() => removeNutritionPoint(point.id)}
              style={{
                left,
                top: '40%'
              }} />);


        })}

        {/* X-Axis Labels */}
        <div className="absolute bottom-2 left-6 right-6 flex justify-between text-[10px] font-mono text-text-muted">
          <span>0km</span>
          <span>
            {routeData.loaded ? (routeData.distanceKm * 0.25).toFixed(0) : '20'}
            km
          </span>
          <span>
            {routeData.loaded ? (routeData.distanceKm * 0.5).toFixed(0) : '40'}
            km
          </span>
          <span>
            {routeData.loaded ? (routeData.distanceKm * 0.75).toFixed(0) : '60'}
            km
          </span>
          <span>
            {routeData.loaded ? routeData.distanceKm.toFixed(0) : '80'}km
          </span>
        </div>

        {/* Grid Lines */}
        <div
          className="absolute inset-0 pointer-events-none border-b border-white/5"
          style={{
            bottom: '25%'
          }}>
        </div>
        <div
          className="absolute inset-0 pointer-events-none border-b border-white/5"
          style={{
            bottom: '50%'
          }}>
        </div>
        <div
          className="absolute inset-0 pointer-events-none border-b border-white/5"
          style={{
            bottom: '75%'
          }}>
        </div>

        {/* Drop Hint */}
        <div className="absolute inset-0 bg-neon-blue/5 border-2 border-dashed border-neon-blue/30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center">
          <span className="text-neon-blue font-mono text-xs bg-black/80 px-2 py-1">
            DROP TO ADD
          </span>
        </div>
      </div>
    </main>);

}