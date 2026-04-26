import { useRef, useMemo, useState, useCallback } from 'react';
import { GpxDropZone } from './GpxDropZone';
import { AutoGenerateButton } from './AutoGenerateButton';
import { MapView } from './MapView';
import { Navigation, Trash2, ChevronDown, ChevronUp, Clock, Calendar, Gauge, Activity } from 'lucide-react';
import { EstimatedTimeEditor } from './EstimatedTimeEditor';
import { EffortEditor } from './EffortEditor';
import { DateEditor } from './DateEditor';
import { RouteSportEditor } from './RouteSportEditor';
import { MapLegend } from './MapLegend';
import { useApp } from '../context/AppContext';
import { ProductProps } from './NutritionCard';
import { NutritionMarker } from './NutritionMarker';
import { useRouteDrawing } from '../hooks/useRouteDrawing';

/** Map an elevation value to the elevation chart's Y coordinate. The chart
 *  has 10px top padding and 120px usable height; higher elevation = smaller
 *  Y. Shared between the hover marker and the nutrition-point markers so
 *  they live on the same curve. */
function elevationToY(elev: number, minElev: number, maxElev: number): number {
  const range = maxElev - minElev || 1;
  return 10 + 120 - ((elev - minElev) / range) * 120;
}

function ElevationProfile() {
  const { routeData, routeAnalysis, addNutritionPoint, moveNutritionPoint, removeNutritionPoint } = useApp();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; km: number; elev: number } | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  const { pathD, areaD, elevations, cumulativeKm, totalKm, minElev, maxElev } = useMemo(() => {
    const gpsPath = routeData.gpsPath;
    if (!gpsPath || gpsPath.length === 0) {
      return { pathD: '', areaD: '', elevations: [], cumulativeKm: [], totalKm: 0, minElev: 0, maxElev: 100 };
    }

    // Build matched arrays: per-vertex elevation AND per-vertex cumulative
    // distance. Zipping them lets us anchor the chart's X axis to actual
    // distance instead of vertex index — without that, dense urban GPS
    // sampling skewed the curve and the waypoint markers landed off the
    // line. We carry forward the last seen elevation for any vertex missing
    // one so the indices stay aligned with cumulative distance.
    const verts: Array<{ km: number; elev: number }> = [];
    let acc = 0;
    let lastElev: number | null = null;
    for (let i = 0; i < gpsPath.length; i++) {
      if (i > 0) {
        const a = gpsPath[i - 1];
        const b = gpsPath[i];
        const R = 6371;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLon = ((b.lng - a.lng) * Math.PI) / 180;
        const aTerm =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        acc += R * 2 * Math.atan2(Math.sqrt(aTerm), Math.sqrt(1 - aTerm));
      }
      const e = gpsPath[i].elevation;
      if (e !== undefined) lastElev = e;
      if (lastElev != null) verts.push({ km: acc, elev: lastElev });
    }

    if (verts.length === 0) {
      return { pathD: '', areaD: '', elevations: [], cumulativeKm: [], totalKm: 0, minElev: 0, maxElev: 100 };
    }

    const rawElevs = verts.map((v) => v.elev);
    const km = verts.map((v) => v.km);
    const total = km[km.length - 1] || 1;

    // Smooth elevation data to reduce GPS noise — two-pass moving average
    // for a clean, ripple-free profile regardless of input sampling density.
    const passOne = (window: number, input: number[]): number[] => {
      const out = new Array<number>(input.length);
      for (let i = 0; i < input.length; i++) {
        const start = Math.max(0, i - window);
        const end = Math.min(input.length, i + window + 1);
        let sum = 0;
        for (let j = start; j < end; j++) sum += input[j];
        out[i] = sum / (end - start);
      }
      return out;
    };
    const window1 = Math.max(3, Math.floor(rawElevs.length / 40));
    const window2 = Math.max(2, Math.floor(rawElevs.length / 80));
    const elevs = passOne(window2, passOne(window1, rawElevs));

    const min = Math.min(...elevs);
    const max = Math.max(...elevs);
    const range = max - min || 1;

    const viewW = 1000;
    const viewH = 150;
    const padTop = 10;
    const padBottom = 20;
    const usableH = viewH - padTop - padBottom;

    // Sample uniformly along distance (not vertex index) so the X axis is
    // honest about position. Walk a cursor through `km` to find the elevation
    // at each evenly-spaced km step.
    const numSamples = Math.min(240, elevs.length);
    const points: { x: number; y: number }[] = [];
    let cursor = 0;
    for (let i = 0; i < numSamples; i++) {
      const t = numSamples === 1 ? 0 : i / (numSamples - 1);
      const targetKm = t * total;
      while (cursor < km.length - 1 && km[cursor + 1] < targetKm) cursor++;
      const a = km[cursor];
      const b = km[Math.min(km.length - 1, cursor + 1)];
      const segLen = b - a;
      const interp = segLen > 0 ? (targetKm - a) / segLen : 0;
      const ea = elevs[cursor];
      const eb = elevs[Math.min(elevs.length - 1, cursor + 1)];
      const e = ea + (eb - ea) * Math.max(0, Math.min(1, interp));
      const x = t * viewW;
      const y = padTop + usableH - ((e - min) / range) * usableH;
      points.push({ x, y });
    }

    // Straight polyline — with 240 sample points it reads as a smooth curve
    // and avoids bezier overshoot ripples on flat/similar-elevation neighbours.
    let pathStr = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      pathStr += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
    }

    // Area path (for fill)
    const areaStr = pathStr + ` L ${viewW} ${viewH} L 0 ${viewH} Z`;

    return {
      pathD: pathStr,
      areaD: areaStr,
      elevations: elevs,
      cumulativeKm: km,
      totalKm: total,
      minElev: min,
      maxElev: max,
    };
  }, [routeData.gpsPath]);

  // Look up the smoothed elevation at a target kilometre by binary-searching
  // the vertex-indexed cumulativeKm array and interpolating. Used by both
  // the hover crosshair and the waypoint markers so they ride the same curve.
  const elevAtKm = useCallback((targetKm: number): number => {
    if (cumulativeKm.length === 0 || elevations.length === 0) return 0;
    const clamped = Math.max(0, Math.min(totalKm, targetKm));
    let lo = 0;
    let hi = cumulativeKm.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulativeKm[mid] < clamped) lo = mid + 1;
      else hi = mid;
    }
    if (lo === 0) return elevations[0];
    const a = cumulativeKm[lo - 1];
    const b = cumulativeKm[lo];
    const segLen = b - a;
    const t = segLen > 0 ? (clamped - a) / segLen : 0;
    return elevations[lo - 1] + (elevations[lo] - elevations[lo - 1]) * t;
  }, [cumulativeKm, elevations, totalKm]);

  // Segment colors for gradient
  const segments = routeAnalysis?.segments || [];

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !elevations.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const km = x * routeData.distanceKm;
    // Look up elevation by distance (not vertex index) so the crosshair
    // tracks the visible curve across non-uniformly sampled GPX.
    const elev = elevAtKm(km);
    setHover({ x: x * 1000, km, elev });

    // Handle dragging a nutrition point
    if (draggingPointId) {
      moveNutritionPoint(draggingPointId, km);
    }
  }, [elevations.length, routeData.distanceKm, draggingPointId, moveNutritionPoint, elevAtKm]);

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

  // Compute totals for metrics strip
  const { totalGain, totalLoss } = useMemo(() => {
    if (elevations.length < 2) return { totalGain: 0, totalLoss: 0 };
    let gain = 0, loss = 0;
    for (let i = 1; i < elevations.length; i++) {
      const delta = elevations[i] - elevations[i - 1];
      if (delta > 0) gain += delta; else loss -= delta;
    }
    return { totalGain: Math.round(gain), totalLoss: Math.round(loss) };
  }, [elevations]);

  return (
    <div
      className="w-full h-full relative"
      onDrop={handleElevationDrop}
      onDragOver={handleDragOver}
    >
      {elevations.length > 0 ? (
        <>
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
            {/* Terrain-inspired gradient for elevation fill */}
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5A020" stopOpacity="0.5" />
              <stop offset="40%" stopColor="#E8671A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3D2152" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(pct => (
            <line
              key={pct}
              x1="0" y1={150 * (1 - pct)} x2="1000" y2={150 * (1 - pct)}
              stroke="var(--color-accent)" strokeOpacity="0.06" strokeWidth="1"
            />
          ))}

          {/* Segment coloring */}
          {segments.map((seg, i) => {
            const x1 = (seg.startKm / routeData.distanceKm) * 1000;
            const x2 = (seg.endKm / routeData.distanceKm) * 1000;
            const color = seg.type === 'climb' ? 'rgba(245,160,32,0.12)' :
                         seg.type === 'descent' ? 'rgba(61,33,82,0.06)' : 'transparent';
            return (
              <rect key={i} x={x1} y="0" width={x2 - x1} height="150" fill={color} />
            );
          })}

          {/* Elevation area fill */}
          <path d={areaD} fill="url(#elevGradient)" />

          {/* Elevation line */}
          <path d={pathD} fill="none" stroke="#E8671A" strokeWidth="2.5" />

          {/* Hover crosshair */}
          {hover && (
            <>
              <line
                x1={hover.x} y1="0" x2={hover.x} y2="150"
                stroke="var(--color-accent)" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="4 4"
              />
              <circle cx={hover.x} cy={elevationToY(hover.elev, minElev, maxElev)} r="4" fill="#F5A020" stroke="#3D2152" strokeWidth="2" />
            </>
          )}

        </svg>

        {/* Waypoint pucks — HTML, so they keep their circular aspect even
            though the chart SVG uses preserveAspectRatio="none". X comes from
            cumulative distance (matches the curve's X axis); Y is the curve
            elevation at that distance, mapped through the SVG's 0–150 unit
            space onto a percent of this container. NutritionMarker uses
            -translate-y-full, so its bottom pin lands exactly on the curve. */}
        {routeData.nutritionPoints.map((point) => {
          const safeTotal = routeData.distanceKm || 1;
          const leftPct = (Math.max(0, Math.min(safeTotal, point.distanceKm)) / safeTotal) * 100;
          const cy = elevationToY(elevAtKm(point.distanceKm), minElev, maxElev);
          const topPct = (cy / 150) * 100;
          return (
            <NutritionMarker
              key={`elev-${point.id}`}
              product={point.product}
              distanceKm={point.distanceKm}
              onRemove={() => removeNutritionPoint(point.id)}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            />
          );
        })}

        {/* Y-axis elevation labels (left side) */}
        <div className="absolute left-2 top-8 bottom-8 flex flex-col justify-between pointer-events-none z-10">
          <div className="text-[9px] font-display font-semibold text-text-muted bg-surface/80 px-1.5 py-0.5 rounded tabular-nums">
            {Math.round(maxElev)}m
          </div>
          <div className="text-[9px] font-display font-semibold text-text-muted bg-surface/80 px-1.5 py-0.5 rounded tabular-nums">
            {Math.round(minElev)}m
          </div>
        </div>

        {/* Gain/Loss totals (top-right) */}
        <div className="absolute top-2 right-3 flex items-center gap-2 z-10">
          <div className="flex items-center gap-1 bg-surface border border-warm/20 rounded-md px-2 py-1 shadow-sm">
            <span className="text-[9px] font-display text-text-muted uppercase tracking-wider">Gain</span>
            <span className="text-[11px] font-display font-bold text-warm tabular-nums">+{totalGain}m</span>
          </div>
          <div className="flex items-center gap-1 bg-surface border border-accent/15 rounded-md px-2 py-1 shadow-sm">
            <span className="text-[9px] font-display text-text-muted uppercase tracking-wider">Loss</span>
            <span className="text-[11px] font-display font-bold text-accent tabular-nums">-{totalLoss}m</span>
          </div>
        </div>
        </>
      ) : (
        // Fallback terrain-inspired bar chart when no elevation data
        <div className="w-full h-full p-6 flex items-end gap-1 relative z-0">
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-warm/10 hover:bg-warm/30 transition-colors duration-300"
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
          <div className="bg-surface border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-center shadow-lg">
            <div className="text-xs font-display font-bold text-text-primary">{hover.km.toFixed(1)}km</div>
            <div className="text-[10px] font-display font-semibold text-warm">{Math.round(hover.elev)}m</div>
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
    resetRoute,
    setUserEstimatedTime,
    setPlannedDate,
    setEffortLevel,
    setRouteSport,
    setRouteSurface,
  } = useApp();
  const elevationRef = useRef<HTMLDivElement>(null);
  const drawing = useRouteDrawing();
  const isDrawing = drawing.state === 'placing' || drawing.state === 'routing';
  const [timeEditorOpen, setTimeEditorOpen] = useState(false);
  const [effortEditorOpen, setEffortEditorOpen] = useState(false);
  const [dateEditorOpen, setDateEditorOpen] = useState(false);
  const [sportEditorOpen, setSportEditorOpen] = useState(false);
  const [elevationCollapsed, setElevationCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [routeColorMode, setRouteColorMode] = useState<'distance' | 'elevation'>(() => {
    if (typeof window === 'undefined') return 'distance';
    return (localStorage.getItem('fuelcue_route_color_mode') as 'distance' | 'elevation') || 'distance';
  });
  const setColorMode = (mode: 'distance' | 'elevation') => {
    setRouteColorMode(mode);
    localStorage.setItem('fuelcue_route_color_mode', mode);
  };
  const showElevation = routeData.loaded && !isDrawing;

  return (
    <main className="flex-1 relative flex flex-col bg-background">
      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Center Content (rendered first so overlays stack on top) */}
        <div className="absolute inset-0 z-0">
          <MapView drawing={drawing} colorMode={routeColorMode} />
          {!routeData.loaded && !isDrawing && (
            <GpxDropZone onDrawRoute={drawing.startDrawing} />
          )}
        </div>

        {/* Map UI Overlays — only show when route is loaded */}
        {routeData.loaded && (
          <>
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 pointer-events-auto max-w-[calc(100%-5.5rem)]">
              <button
                onClick={() => setColorMode('distance')}
                aria-pressed={routeColorMode === 'distance'}
                title="Color route by distance"
                className={`bg-surface rounded-xl px-3 py-2 shadow-md border text-left transition-colors ${
                  routeColorMode === 'distance'
                    ? 'border-warm ring-1 ring-warm/30'
                    : 'border-[var(--color-border)] hover:border-warm/40'
                }`}
              >
                <div className="text-[9px] text-text-muted uppercase tracking-widest font-display">Distance</div>
                <div className="text-lg font-display font-bold text-text-primary leading-tight">
                  {routeData.distanceKm.toFixed(1)}<span className="text-xs text-text-muted ml-0.5">km</span>
                </div>
              </button>
              <button
                onClick={() => setColorMode('elevation')}
                aria-pressed={routeColorMode === 'elevation'}
                title="Color route by elevation"
                className={`bg-surface rounded-xl px-3 py-2 shadow-md border text-left transition-colors ${
                  routeColorMode === 'elevation'
                    ? 'border-warm ring-1 ring-warm/30'
                    : 'border-[var(--color-border)] hover:border-warm/40'
                }`}
              >
                <div className="text-[9px] text-text-muted uppercase tracking-widest font-display">Elevation</div>
                <div className="text-lg font-display font-bold text-text-primary leading-tight">
                  {routeData.elevationGain}<span className="text-xs text-text-muted ml-0.5">m</span>
                </div>
              </button>

              {/* Expected time — tap to edit */}
              <div className="relative">
                <button
                  onClick={() => setTimeEditorOpen((v) => !v)}
                  title="Set your expected finish time"
                  className={`bg-surface rounded-xl px-3 py-2 shadow-md border text-left transition-colors ${
                    routeData.userEstimatedTime
                      ? 'border-warm/60 ring-1 ring-warm/30'
                      : 'border-[var(--color-border)] hover:border-warm/40'
                  }`}
                >
                  <div className="text-[9px] text-text-muted uppercase tracking-widest font-display flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Time {routeData.userEstimatedTime ? '· yours' : '· auto'}
                  </div>
                  <div className="text-lg font-display font-bold text-text-primary leading-tight tabular-nums">
                    {(() => {
                      const t = routeData.userEstimatedTime || routeData.estimatedTime || '0:00';
                      const parts = t.split(':');
                      return `${parseInt(parts[0] || '0', 10)}:${(parts[1] || '00').padStart(2, '0')}`;
                    })()}
                  </div>
                </button>
                {timeEditorOpen && (
                  <EstimatedTimeEditor
                    value={routeData.userEstimatedTime || routeData.estimatedTime || '3:00:00'}
                    isUserSet={Boolean(routeData.userEstimatedTime)}
                    onSave={(v) => setUserEstimatedTime(v)}
                    onClear={() => setUserEstimatedTime(undefined)}
                    onClose={() => setTimeEditorOpen(false)}
                  />
                )}
              </div>

              {/* Planned date — custom calendar popover, same pattern as Time
                  and Effort chips. Native <input type="date"> proved too
                  unreliable across Safari/iOS; a controlled popover we render
                  ourselves works everywhere. */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDateEditorOpen((v) => !v)}
                  title="Set the date you'll do this route — used to pull the right weather forecast"
                  className={`bg-surface rounded-xl px-3 py-2 shadow-md border text-left transition-colors ${
                    routeData.plannedDate
                      ? 'border-warm/60 ring-1 ring-warm/30'
                      : 'border-[var(--color-border)] hover:border-warm/40'
                  }`}
                >
                  <div className="text-[9px] text-text-muted uppercase tracking-widest font-display flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    Date
                  </div>
                  <div className="text-lg font-display font-bold text-text-primary leading-tight tabular-nums">
                    {routeData.plannedDate
                      ? new Date(routeData.plannedDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : 'Pick'}
                  </div>
                </button>
                {dateEditorOpen && (
                  <DateEditor
                    value={routeData.plannedDate}
                    onSave={(iso) => {
                      setPlannedDate(iso);
                      setDateEditorOpen(false);
                    }}
                    onClose={() => setDateEditorOpen(false)}
                  />
                )}
              </div>

              {/* Effort level — 1–10 perceived effort, overrides inferred intensity */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setEffortEditorOpen((o) => !o)}
                  className={`bg-surface rounded-xl px-3 py-2 shadow-md border transition-colors ${
                    routeData.effortLevel != null
                      ? 'border-warm/60 ring-1 ring-warm/30'
                      : 'border-[var(--color-border)] hover:border-warm/40'
                  }`}
                  title="Set perceived effort for this run — 5/10 for training, 8/10 for race"
                >
                  <div className="text-[9px] text-text-muted uppercase tracking-widest font-display flex items-center gap-1">
                    <Gauge className="w-2.5 h-2.5" />
                    Effort
                  </div>
                  <div className="text-lg font-display font-bold text-text-primary leading-tight tabular-nums">
                    {routeData.effortLevel != null ? `${routeData.effortLevel}/10` : 'Auto'}
                  </div>
                </button>
                {effortEditorOpen && (
                  <EffortEditor
                    value={routeData.effortLevel}
                    onSave={(v) => {
                      setEffortLevel(v);
                      setEffortEditorOpen(false);
                    }}
                    onClose={() => setEffortEditorOpen(false)}
                  />
                )}
              </div>

              {/* Route sport / surface — drives the unified time estimator.
                  Mountain/hike routes look very different in pace from a road
                  run; this chip is what makes a 176km UTMB import sensible. */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSportEditorOpen((o) => !o)}
                  className={`bg-surface rounded-xl px-3 py-2 shadow-md border transition-colors ${
                    routeData.routeSport || routeData.routeSurface
                      ? 'border-warm/60 ring-1 ring-warm/30'
                      : 'border-[var(--color-border)] hover:border-warm/40'
                  }`}
                  title="Sport and surface for this route — drives the time estimate"
                >
                  <div className="text-[9px] text-text-muted uppercase tracking-widest font-display flex items-center gap-1">
                    <Activity className="w-2.5 h-2.5" />
                    Sport
                  </div>
                  <div className="text-lg font-display font-bold text-text-primary leading-tight">
                    {routeData.routeSport
                      ? routeData.routeSport.charAt(0).toUpperCase() + routeData.routeSport.slice(1)
                      : 'Auto'}
                    {routeData.routeSurface && (
                      <span className="text-xs text-text-muted ml-1">/ {routeData.routeSurface}</span>
                    )}
                  </div>
                </button>
                {sportEditorOpen && (
                  <RouteSportEditor
                    sport={routeData.routeSport}
                    surface={routeData.routeSurface}
                    onSaveSport={(s) => setRouteSport(s)}
                    onSaveSurface={(s) => setRouteSurface(s)}
                    onClose={() => setSportEditorOpen(false)}
                  />
                )}
              </div>
            </div>

            <div className="absolute top-3 right-3 z-10 flex gap-2 pointer-events-auto">
              <button
                onClick={resetRoute}
                className="h-10 flex items-center gap-1.5 px-3 rounded-xl border border-red-500/20 bg-surface hover:bg-red-500/10 hover:border-red-500/40 transition-colors group shadow-md"
                title="Clear route"
              >
                <Trash2 className="w-4 h-4 text-red-400/70 group-hover:text-red-400" />
                <span className="text-xs font-display font-medium text-red-400/70 group-hover:text-red-400 hidden sm:inline">Clear</span>
              </button>
            </div>

            <div className="absolute bottom-6 right-4 z-10 pointer-events-auto">
              <AutoGenerateButton onClick={autoGeneratePlan} />
            </div>

            <MapLegend
              colorMode={routeColorMode}
              hasNutritionPoints={routeData.nutritionPoints.length > 0}
            />
          </>
        )}

        {/* Compass — always visible */}
        {!routeData.loaded && (
          <div className="absolute top-3 right-3 z-10 pointer-events-auto">
            <div className="w-10 h-10 rounded-xl border border-[var(--color-border)] bg-surface flex items-center justify-center shadow-md">
              <Navigation className="w-4 h-4 text-warm transform -rotate-45" />
            </div>
          </div>
        )}
      </div>

      {/* Elevation Profile Panel — only show when route loaded + not drawing */}
      <div
        ref={elevationRef}
        className={`bg-surface relative group border-t border-[var(--color-border)] transition-[height] duration-200 ${
          showElevation
            ? (elevationCollapsed ? 'h-9' : 'h-32 sm:h-40 lg:h-48')
            : 'h-0 overflow-hidden border-t-0'
        }`}
      >
        <div className="absolute top-1.5 left-3 bg-surface text-warm text-[9px] font-display font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider z-20 border border-warm/20 shadow-sm">
          Elevation
        </div>

        {/* Collapse toggle */}
        {showElevation && (
          <button
            onClick={() => setElevationCollapsed(v => !v)}
            aria-label={elevationCollapsed ? 'Expand elevation profile' : 'Collapse elevation profile'}
            className="absolute top-1.5 right-3 z-20 w-7 h-7 flex items-center justify-center rounded-md bg-surface border border-[var(--color-border)] shadow-sm text-text-muted hover:text-text-primary hover:bg-surfaceHighlight transition-colors"
          >
            {elevationCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* When collapsed on mobile, show just the label + a compact stat */}
        {showElevation && elevationCollapsed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-display text-text-muted tabular-nums">
              {routeData.distanceKm.toFixed(1)}km · {routeData.elevationGain}m gain · {routeData.estimatedTime}
            </span>
          </div>
        )}

        {/* Expanded elevation content — hidden when collapsed */}
        {showElevation && !elevationCollapsed && (
          <>
            <ElevationProfile />

            <div className="absolute bottom-2 left-6 right-6 flex justify-between text-[10px] font-display font-medium text-text-muted">
              <span>0km</span>
              <span>{(routeData.distanceKm * 0.25).toFixed(0)}km</span>
              <span>{(routeData.distanceKm * 0.5).toFixed(0)}km</span>
              <span>{(routeData.distanceKm * 0.75).toFixed(0)}km</span>
              <span>{routeData.distanceKm.toFixed(0)}km</span>
            </div>

            <div className="absolute inset-0 bg-warm/5 border-2 border-dashed border-warm/20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center rounded-lg m-1">
              <span className="text-warm font-display text-[10px] font-semibold bg-surface/90 px-2.5 py-1 rounded-md">
                Drop to add
              </span>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
