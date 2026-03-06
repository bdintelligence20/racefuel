import React, { useRef, useMemo, useState, useCallback } from 'react';
import { GpxDropZone } from './GpxDropZone';
import { AutoGenerateButton } from './AutoGenerateButton';
import { MapView } from './MapView';
import { Navigation, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ProductProps } from './NutritionCard';
import { NutritionMarker } from './NutritionMarker';

function ElevationProfile() {
  const { routeData, routeAnalysis, addNutritionPoint, moveNutritionPoint } = useApp();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; km: number; elev: number } | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  const { pathD, areaD, elevations, minElev, maxElev } = useMemo(() => {
    const gpsPath = routeData.gpsPath;
    if (!gpsPath || gpsPath.length === 0) {
      return { pathD: '', areaD: '', elevations: [], minElev: 0, maxElev: 100 };
    }

    const elevs = gpsPath
      .filter(p => p.elevation !== undefined)
      .map(p => p.elevation as number);

    if (elevs.length === 0) {
      return { pathD: '', areaD: '', elevations: [], minElev: 0, maxElev: 100 };
    }

    const min = Math.min(...elevs);
    const max = Math.max(...elevs);
    const range = max - min || 1;

    const viewW = 1000;
    const viewH = 150;
    const padTop = 10;
    const padBottom = 20;
    const usableH = viewH - padTop - padBottom;

    // Sample to ~200 points for smooth curve
    const numSamples = Math.min(200, elevs.length);
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < numSamples; i++) {
      const idx = Math.floor((i / (numSamples - 1)) * (elevs.length - 1));
      const x = (i / (numSamples - 1)) * viewW;
      const y = padTop + usableH - ((elevs[idx] - min) / range) * usableH;
      points.push({ x, y });
    }

    // Build SVG path with smooth bezier curves
    let pathStr = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      pathStr += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
    }

    // Area path (for fill)
    const areaStr = pathStr + ` L ${viewW} ${viewH} L 0 ${viewH} Z`;

    return {
      pathD: pathStr,
      areaD: areaStr,
      elevations: elevs,
      minElev: min,
      maxElev: max,
    };
  }, [routeData.gpsPath]);

  // Segment colors for gradient
  const segments = routeAnalysis?.segments || [];

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !elevations.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const km = x * routeData.distanceKm;
    const idx = Math.floor(x * (elevations.length - 1));
    const elev = elevations[Math.min(idx, elevations.length - 1)] || 0;
    setHover({ x: x * 1000, km, elev });

    // Handle dragging a nutrition point
    if (draggingPointId) {
      moveNutritionPoint(draggingPointId, km);
    }
  }, [elevations, routeData.distanceKm, draggingPointId, moveNutritionPoint]);

  const handleMouseLeave = useCallback(() => {
    setHover(null);
    setDraggingPointId(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    setDraggingPointId(null);
  }, []);

  const handleElevationDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    try {
      const productData = JSON.parse(
        e.dataTransfer.getData('application/json')
      ) as ProductProps;
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
    <div
      className="w-full h-full relative"
      onDrop={handleElevationDrop}
      onDragOver={handleDragOver}
    >
      {elevations.length > 0 ? (
        <svg
          ref={svgRef}
          viewBox="0 0 1000 150"
          preserveAspectRatio="none"
          className={`w-full h-full ${draggingPointId ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
        >
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(pct => (
            <line
              key={pct}
              x1="0" y1={150 * (1 - pct)} x2="1000" y2={150 * (1 - pct)}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1"
            />
          ))}

          {/* Segment coloring */}
          {segments.map((seg, i) => {
            const x1 = (seg.startKm / routeData.distanceKm) * 1000;
            const x2 = (seg.endKm / routeData.distanceKm) * 1000;
            const color = seg.type === 'climb' ? 'rgba(245,158,11,0.08)' :
                         seg.type === 'descent' ? 'rgba(16,185,129,0.05)' : 'transparent';
            return (
              <rect key={i} x={x1} y="0" width={x2 - x1} height="150" fill={color} />
            );
          })}

          {/* Elevation area fill */}
          <path d={areaD} fill="url(#elevGradient)" />

          {/* Elevation line */}
          <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="2" />

          {/* Hover crosshair */}
          {hover && (
            <>
              <line
                x1={hover.x} y1="0" x2={hover.x} y2="150"
                stroke="rgba(255,255,255,0.3)" strokeWidth="1" strokeDasharray="4 4"
              />
              <circle cx={hover.x} cy={10 + 120 - ((hover.elev - minElev) / (maxElev - minElev || 1)) * 120} r="4" fill="#fff" stroke="#10b981" strokeWidth="2" />
            </>
          )}

          {/* Nutrition point markers (draggable) */}
          {routeData.nutritionPoints.map((point) => {
            const x = (point.distanceKm / routeData.distanceKm) * 1000;
            const isDragging = draggingPointId === point.id;
            const colorMap: Record<string, string> = {
              orange: '#10b981', blue: '#f59e0b', white: '#ffffff',
              green: '#34d399', red: '#ef4444', yellow: '#eab308',
            };
            const markerColor = colorMap[point.product.color] || '#10b981';
            return (
              <g key={`seg-${point.id}`}>
                <line
                  x1={x} y1="0" x2={x} y2="150"
                  stroke={isDragging ? markerColor : 'rgba(16,185,129,0.3)'}
                  strokeWidth={isDragging ? 2 : 1}
                />
                {/* Draggable handle */}
                <circle
                  cx={x} cy="12" r={isDragging ? 8 : 6}
                  fill={markerColor}
                  stroke={isDragging ? '#fff' : 'rgba(0,0,0,0.5)'}
                  strokeWidth={isDragging ? 2 : 1}
                  className="cursor-grab active:cursor-grabbing"
                  style={{ filter: isDragging ? 'drop-shadow(0 0 4px rgba(16,185,129,0.5))' : undefined }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingPointId(point.id);
                  }}
                />
                {/* Label on marker */}
                <text
                  x={x} y="30"
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.6)"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                  pointerEvents="none"
                >
                  {point.product.carbs}g
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        // Fallback bar chart when no elevation data
        <div className="w-full h-full p-6 flex items-end gap-1 relative z-0">
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              className="flex-1 bg-white/10 hover:bg-warm transition-colors duration-300"
              style={{ height: `${20 + Math.random() * 60}%` }}
            />
          ))}
        </div>
      )}

      {/* Hover tooltip */}
      {hover && (
        <div
          className="absolute top-2 pointer-events-none z-20"
          style={{ left: `${(hover.x / 1000) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div className="bg-surface/95 backdrop-blur-md border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-center shadow-lg">
            <div className="text-xs font-mono font-bold text-white">{hover.km.toFixed(1)}km</div>
            <div className="text-[10px] font-mono text-accent">{Math.round(hover.elev)}m</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MapCanvas() {
  const {
    routeData,
    autoGeneratePlan,
    removeNutritionPoint,
    resetRoute
  } = useApp();
  const elevationRef = useRef<HTMLDivElement>(null);

  return (
    <main className="flex-1 relative flex flex-col bg-background bg-grid-pattern bg-[length:40px_40px]">
      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Map UI Overlays */}
        <div className="absolute top-5 left-5 z-10 flex gap-2">
          <div className="bg-surface/80 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[9px] text-text-muted uppercase tracking-widest mb-0.5">
              Distance
            </div>
            <div className="text-xl font-mono font-bold text-white">
              {routeData.loaded ? routeData.distanceKm.toFixed(1) : '0.0'}
              <span className="text-xs text-text-muted ml-1">km</span>
            </div>
          </div>
          <div className="bg-surface/80 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="text-[9px] text-text-muted uppercase tracking-widest mb-0.5">
              Elevation
            </div>
            <div className="text-xl font-mono font-bold text-white">
              {routeData.loaded ? routeData.elevationGain : '0'}
              <span className="text-xs text-text-muted ml-1">m</span>
            </div>
          </div>
        </div>

        {/* Compass / Orientation */}
        <div className="absolute top-5 right-5 z-10 flex gap-2">
          {routeData.loaded && (
            <button
              onClick={resetRoute}
              className="w-10 h-10 rounded-xl border border-white/[0.06] bg-surface/80 backdrop-blur-md flex items-center justify-center hover:bg-surface hover:border-accent/30 transition-colors group"
              title="Load different route"
            >
              <RotateCcw className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl border border-white/[0.06] bg-surface/60 backdrop-blur-md flex items-center justify-center">
            <Navigation className="w-4 h-4 text-accent transform -rotate-45" />
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
        className="h-48 bg-surface border-t border-white/[0.06] relative group"
      >
        <div className="absolute top-2 left-3 bg-accent/10 text-accent text-[9px] font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider z-10 border border-accent/20">
          Elevation
        </div>

        {/* SVG Elevation Profile */}
        <ElevationProfile />

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
              }}
            />
          );
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

        {/* Drop Hint */}
        <div className="absolute inset-0 bg-accent/5 border-2 border-dashed border-accent/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center rounded-lg m-1">
          <span className="text-accent font-mono text-[10px] bg-black/80 px-2.5 py-1 rounded-md">
            Drop to add
          </span>
        </div>
      </div>
    </main>
  );
}
