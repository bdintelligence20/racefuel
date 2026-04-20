import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useApp } from '../context/AppContext';
import { ProductProps } from './NutritionCard';
import { ProductPickerModal } from './ProductPickerModal';
import { RouteDrawingToolbar } from './RouteDrawingToolbar';
import { NutritionDetailCard } from './NutritionDetailCard';
import type { useRouteDrawing } from '../hooks/useRouteDrawing';
import { toast } from 'sonner';

type DrawingApi = ReturnType<typeof useRouteDrawing>;

function getMapStyle(): string {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/outdoors-v12';
}

interface HoverInfo {
  x: number;
  y: number;
  distanceKm: number;
  elevation: number | null;
}

interface ClickInfo {
  distanceKm: number;
  elevation: number | null;
}

// Set the access token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
mapboxgl.accessToken = MAPBOX_TOKEN;

export type RouteColorMode = 'distance' | 'elevation';

export function MapView({ drawing, colorMode = 'distance' }: { drawing: DrawingApi; colorMode?: RouteColorMode }) {
  const { routeData, addNutritionPoint, removeNutritionPoint, moveNutritionPoint, loadSavedRoute } = useApp();
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  // Selected nutrition marker — opens a detail popover (click-to-inspect, not click-to-delete).
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  // Screen coords of the selected marker so the React popover can anchor to it.
  const [selectedMarkerScreen, setSelectedMarkerScreen] = useState<{ x: number; y: number } | null>(null);

  // Get GPS path - only use real data, no mock
  const gpsPath = useMemo(() => {
    if (routeData.gpsPath && routeData.gpsPath.length > 0) {
      return routeData.gpsPath;
    }
    return null;
  }, [routeData.gpsPath]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return;

    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured');
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: getMapStyle(),
        center: [18.4241, -33.9249], // Cape Town
        zoom: 10,
        attributionControl: false,
      });

      map.current.on('load', () => {
        setMapReady(true);
      });

      map.current.on('error', (e) => {
        setMapError('Map failed to load: ' + (e.error?.message || 'Unknown error'));
      });

      // Keep zoom controls on the left edge so they don't collide with our
      // floating Auto Generate FAB (bottom-right).
      map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-left');

    } catch (err) {
      setMapError('Failed to create map: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Switch map style when theme changes — setStyle wipes all layers,
  // so we bump a counter to force route re-rendering
  const [styleVersion, setStyleVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (map.current) {
        map.current.setStyle(getMapStyle());
        map.current.once('style.load', () => setStyleVersion(v => v + 1));
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Add route to map when ready
  useEffect(() => {
    if (!map.current || !mapReady) return;

    // Clean up existing route layers and markers
    const cleanupRoute = () => {
      if (!map.current) return;
      try {
        if (map.current.getLayer('route-hover-area')) map.current.removeLayer('route-hover-area');
        if (map.current.getLayer('route-line')) map.current.removeLayer('route-line');
        if (map.current.getLayer('route-glow')) map.current.removeLayer('route-glow');
        if (map.current.getSource('route')) map.current.removeSource('route');
      } catch { /* layers may not exist */ }
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };

    if (!gpsPath || gpsPath.length === 0) {
      cleanupRoute();
      return;
    }

    const addRoute = () => {
      if (!map.current) return;

      const coordinates = gpsPath.map((p) => [p.lng, p.lat] as [number, number]);

      // Remove existing source and layers
      try {
        if (map.current.getLayer('route-hover-area')) {
          map.current.removeLayer('route-hover-area');
        }
        if (map.current.getLayer('route-line')) {
          map.current.removeLayer('route-line');
        }
        if (map.current.getLayer('route-glow')) {
          map.current.removeLayer('route-glow');
        }
        if (map.current.getSource('route')) {
          map.current.removeSource('route');
        }
      } catch { /* layers may not exist */ }

      // Add route source
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
        lineMetrics: true,
      });

      // Add glow layer
      map.current.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#F5A020',
          'line-width': 10,
          'line-opacity': 0.3,
          'line-blur': 6,
        },
      });

      // Build the line-gradient stops based on colorMode.
      // - distance: fixed 3-stop plum→orange→plum (time-like feel)
      // - elevation: per-sample color mapped from normalized elevation (low=plum, high=amber)
      const buildGradient = (): mapboxgl.Expression => {
        if (colorMode === 'elevation') {
          const elevs = gpsPath
            .map((p) => p.elevation)
            .filter((e): e is number => typeof e === 'number');
          if (elevs.length >= 2) {
            const minE = Math.min(...elevs);
            const maxE = Math.max(...elevs);
            const rng = Math.max(1, maxE - minE);
            const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
            const colorAt = (t: number): string => {
              // 0 (low) = plum #3D2152 → 1 (high) = amber #F5A020
              const lo = [0x3d, 0x21, 0x52];
              const hi = [0xf5, 0xa0, 0x20];
              const c = [lerp(lo[0], hi[0], t), lerp(lo[1], hi[1], t), lerp(lo[2], hi[2], t)];
              return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
            };
            // Sample ~20 stops along the route to keep the expression compact.
            const sampleCount = Math.min(20, gpsPath.length);
            const stops: (number | string)[] = [];
            for (let i = 0; i < sampleCount; i++) {
              const frac = i / (sampleCount - 1);
              const idx = Math.floor(frac * (gpsPath.length - 1));
              const e = gpsPath[idx].elevation ?? minE;
              const t = (e - minE) / rng;
              stops.push(frac, colorAt(t));
            }
            return ['interpolate', ['linear'], ['line-progress'], ...stops] as mapboxgl.Expression;
          }
        }
        // Default: distance mode.
        return [
          'interpolate', ['linear'], ['line-progress'],
          0, '#F5A020',
          0.5, '#E8671A',
          1, '#3D2152',
        ] as mapboxgl.Expression;
      };

      // Add main route line with gradient
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': 4,
          'line-gradient': buildGradient(),
        },
      });

      // Add invisible wider line for easier hover detection
      map.current.addLayer({
        id: 'route-hover-area',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': 20,
          'line-opacity': 0,
        },
      });

      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds();
      coordinates.forEach((coord) => bounds.extend(coord));
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 13 });

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Add start marker
      const startEl = document.createElement('div');
      startEl.style.cssText = 'width:16px;height:16px;background:#F5A020;border-radius:50%;border:2px solid #3D2152;';
      const startMarker = new mapboxgl.Marker({ element: startEl })
        .setLngLat(coordinates[0])
        .addTo(map.current);
      markersRef.current.push(startMarker);

      // Add end marker
      const endEl = document.createElement('div');
      endEl.style.cssText = 'width:16px;height:16px;background:#3D2152;border-radius:50%;border:2px solid #F5A020;';
      const endMarker = new mapboxgl.Marker({ element: endEl })
        .setLngLat(coordinates[coordinates.length - 1])
        .addTo(map.current);
      markersRef.current.push(endMarker);

      // Change cursor on hover
      map.current.on('mouseenter', 'route-hover-area', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'crosshair';
        }
      });

      map.current.on('mouseleave', 'route-hover-area', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
        setHoverInfo(null);
      });

    };

    // Wait for style to be loaded
    if (map.current.isStyleLoaded()) {
      addRoute();
    } else {
      map.current.once('style.load', addRoute);
    }

  }, [mapReady, gpsPath, styleVersion, colorMode]);

  // Handle mousemove for hover info
  useEffect(() => {
    if (!map.current || !mapReady || !gpsPath || gpsPath.length === 0) return;

    const handleMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (!map.current || !gpsPath) return;

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['route-hover-area'],
      });

      if (features.length === 0) {
        setHoverInfo(null);
        return;
      }

      // Find closest point on route
      let closestIdx = 0;
      let closestDist = Infinity;
      const point = e.lngLat;

      gpsPath.forEach((p, i) => {
        const dist = Math.hypot(p.lng - point.lng, p.lat - point.lat);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });

      const distanceKm = (closestIdx / (gpsPath.length - 1)) * routeData.distanceKm;
      const elevation = gpsPath[closestIdx]?.elevation ?? null;

      setHoverInfo({
        x: e.point.x,
        y: e.point.y,
        distanceKm,
        elevation,
      });
    };

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (!map.current || !gpsPath) return;

      // Find closest point on route
      let closestIdx = 0;
      let closestDist = Infinity;
      const point = e.lngLat;

      gpsPath.forEach((p, i) => {
        const dist = Math.hypot(p.lng - point.lng, p.lat - point.lat);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });

      const distanceKm = (closestIdx / (gpsPath.length - 1)) * routeData.distanceKm;
      const elevation = gpsPath[closestIdx]?.elevation ?? null;

      setClickInfo({ distanceKm, elevation });
      setShowProductPicker(true);
      setHoverInfo(null);
    };

    map.current.on('mousemove', 'route-hover-area', handleMouseMove);
    map.current.on('click', 'route-hover-area', handleClick);

    return () => {
      if (map.current) {
        map.current.off('mousemove', 'route-hover-area', handleMouseMove);
        map.current.off('click', 'route-hover-area', handleClick);
      }
    };
  }, [mapReady, gpsPath, routeData.distanceKm]);

  // Add nutrition markers — click to inspect, drag to move.
  useEffect(() => {
    if (!map.current || !mapReady || !gpsPath || gpsPath.length === 0) return;

    // Remove only nutrition markers (keep start/end which are first 2)
    markersRef.current.slice(2).forEach((m) => m.remove());
    markersRef.current = markersRef.current.slice(0, 2);

    // Find the route index closest to a given lngLat — used when a marker is dragged.
    const closestRouteIndex = (lng: number, lat: number): number => {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < gpsPath.length; i++) {
        const p = gpsPath[i];
        const d = (p.lng - lng) ** 2 + (p.lat - lat) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    routeData.nutritionPoints.forEach((point) => {
      const progress = Math.min(point.distanceKm / routeData.distanceKm, 1);
      const idx = Math.floor(progress * (gpsPath.length - 1));
      const gps = gpsPath[idx];

      const el = document.createElement('div');
      el.style.cssText = 'cursor:grab;touch-action:none;';
      el.innerHTML = `
        <div style="width:36px;height:36px;border-radius:50%;border:2px solid #3D2152;overflow:hidden;background:white;display:flex;align-items:center;justify-content:center;">
          ${point.product.image
            ? `<img src="${point.product.image}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
               <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:bold;">${point.product.carbs}g</div>`
            : `<div style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:bold;">${point.product.carbs}g</div>`
          }
        </div>
      `;

      if (!map.current) return;
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([gps.lng, gps.lat])
        .addTo(map.current);
      markersRef.current.push(marker);

      // Differentiate click-to-inspect from drag: track whether the pointer actually moved.
      let dragMoved = false;
      marker.on('dragstart', () => {
        dragMoved = false;
        el.style.cursor = 'grabbing';
      });
      marker.on('drag', () => {
        dragMoved = true;
      });
      marker.on('dragend', () => {
        el.style.cursor = 'grab';
        if (!dragMoved) return;
        const { lng, lat } = marker.getLngLat();
        const snappedIdx = closestRouteIndex(lng, lat);
        const snapped = gpsPath[snappedIdx];
        marker.setLngLat([snapped.lng, snapped.lat]); // snap visual to route
        const newKm = (snappedIdx / (gpsPath.length - 1)) * routeData.distanceKm;
        moveNutritionPoint(point.id, newKm);
        // Don't open the detail card right after a drag.
        setSelectedMarkerId(null);
        setSelectedMarkerScreen(null);
      });

      // Click opens the detail popover (only when not a drag).
      el.addEventListener('click', (e) => {
        if (dragMoved) return;
        e.stopPropagation();
        setSelectedMarkerId(point.id);
      });
    });
  }, [mapReady, gpsPath, routeData.nutritionPoints, routeData.distanceKm, moveNutritionPoint]);

  // Keep the selected-marker popover anchored to its screen position as the map moves/zooms.
  useEffect(() => {
    if (!map.current || !selectedMarkerId) {
      setSelectedMarkerScreen(null);
      return;
    }
    const point = routeData.nutritionPoints.find((p) => p.id === selectedMarkerId);
    if (!point || !gpsPath) return;

    const progress = Math.min(point.distanceKm / routeData.distanceKm, 1);
    const idx = Math.floor(progress * (gpsPath.length - 1));
    const gps = gpsPath[idx];

    const update = () => {
      if (!map.current) return;
      const screen = map.current.project([gps.lng, gps.lat]);
      setSelectedMarkerScreen({ x: screen.x, y: screen.y });
    };
    update();
    map.current.on('move', update);
    return () => {
      if (map.current) map.current.off('move', update);
    };
  }, [selectedMarkerId, routeData.nutritionPoints, routeData.distanceKm, gpsPath]);

  // Close the popover on outside click / Escape.
  useEffect(() => {
    if (!selectedMarkerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMarkerId(null);
    };
    const onMapClick = () => setSelectedMarkerId(null);
    document.addEventListener('keydown', onKey);
    map.current?.on('click', onMapClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      map.current?.off('click', onMapClick);
    };
  }, [selectedMarkerId]);

  // Drawing mode: handle map clicks
  const drawingState = drawing.state;
  const drawingAddWaypoint = drawing.addWaypoint;
  useEffect(() => {
    if (!map.current || !mapReady) return;
    if (drawingState !== 'placing') return;

    const handleDrawClick = (e: mapboxgl.MapMouseEvent) => {
      drawingAddWaypoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };

    map.current.on('click', handleDrawClick);
    map.current.getCanvas().style.cursor = 'crosshair';

    return () => {
      if (map.current) {
        map.current.off('click', handleDrawClick);
        map.current.getCanvas().style.cursor = '';
      }
    };
  }, [mapReady, drawingState, drawingAddWaypoint]);

  // Drawing mode: render route line
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const sourceId = 'drawing-route';
    const layerId = 'drawing-route-line';

    if (drawing.routeLine.length < 2) {
      // Clean up if no route
      try {
        if (map.current.getLayer(layerId)) map.current.removeLayer(layerId);
        if (map.current.getLayer(layerId + '-glow')) map.current.removeLayer(layerId + '-glow');
        if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      } catch { /* layer may not exist */ }
      return;
    }

    const geojson: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: drawing.routeLine },
    };

    if (map.current.getSource(sourceId)) {
      (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
    } else {
      map.current.addSource(sourceId, { type: 'geojson', data: geojson });
      // Soft glow underlay
      map.current.addLayer({
        id: layerId + '-glow',
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#F5A020', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 4 },
      });
      // Main line
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#F5A020', 'line-width': 4 },
      });
    }
  }, [mapReady, drawing.routeLine]);

  // Drawing mode: show a single "start" marker at the first waypoint
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const first = drawing.waypoints[0];
    const active = drawing.state === 'placing' || drawing.state === 'routing';

    if (!active || !first) {
      if (startMarkerRef.current) {
        startMarkerRef.current.remove();
        startMarkerRef.current = null;
      }
      return;
    }

    if (!startMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: relative;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      const halo = document.createElement('span');
      halo.style.cssText = `
        position: absolute;
        inset: -8px;
        border-radius: 9999px;
        background: #3D2152;
        opacity: 0.25;
        filter: blur(6px);
      `;
      const dot = document.createElement('span');
      dot.style.cssText = `
        position: relative;
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: #3D2152;
        box-shadow: 0 0 0 4px #FFF9F0, 0 0 0 5px rgba(61,33,82,0.3), 0 2px 10px rgba(61,33,82,0.35);
      `;
      const label = document.createElement('span');
      label.textContent = 'START';
      label.style.cssText = `
        position: absolute;
        left: 50%;
        top: -22px;
        transform: translateX(-50%);
        font-family: Montserrat, system-ui, sans-serif;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.15em;
        color: #3D2152;
        background: #FFF9F0;
        padding: 2px 6px;
        border-radius: 4px;
        box-shadow: 0 1px 6px rgba(61,33,82,0.15);
        white-space: nowrap;
      `;
      el.appendChild(halo);
      el.appendChild(dot);
      el.appendChild(label);
      startMarkerRef.current = new mapboxgl.Marker({ element: el, draggable: false })
        .setLngLat([first.lng, first.lat])
        .addTo(map.current);
    } else {
      startMarkerRef.current.setLngLat([first.lng, first.lat]);
    }
  }, [mapReady, drawing.state, drawing.waypoints]);

  // Clean up drawing layers when drawing ends
  useEffect(() => {
    if (drawing.state !== 'idle' && drawing.state !== 'complete') return;
    if (!map.current) return;

    try {
      if (map.current.getLayer('drawing-route-line')) map.current.removeLayer('drawing-route-line');
      if (map.current.getLayer('drawing-route-line-glow')) map.current.removeLayer('drawing-route-line-glow');
      if (map.current.getSource('drawing-route')) map.current.removeSource('drawing-route');
    } catch { /* layer may not exist */ }

    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
  }, [drawing.state]);

  const handleFinishDrawing = useCallback(async () => {
    const route = await drawing.finishDrawing();
    if (route) {
      loadSavedRoute(route);
      drawing.cancelDrawing();
      toast.success(`Route created — ${route.distanceKm.toFixed(1)}km, ${route.elevationGain}m gain. Save it from the sidebar.`);
    }
  }, [drawing, loadSavedRoute]);

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!map.current || !gpsPath || gpsPath.length === 0) return;

    try {
      const productData = JSON.parse(e.dataTransfer.getData('application/json')) as ProductProps;
      const rect = mapContainer.current?.getBoundingClientRect();
      if (!rect) return;

      const point = map.current.unproject([e.clientX - rect.left, e.clientY - rect.top]);

      // Find closest point on route
      let closestIdx = 0;
      let closestDist = Infinity;
      gpsPath.forEach((p, i) => {
        const dist = Math.hypot(p.lng - point.lng, p.lat - point.lat);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });

      const distanceKm = (closestIdx / (gpsPath.length - 1)) * routeData.distanceKm;
      addNutritionPoint(productData, distanceKm);
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Handle product selection from picker modal
  const handleProductSelect = (product: ProductProps) => {
    if (clickInfo) {
      addNutritionPoint(product, clickInfo.distanceKm);
    }
    setShowProductPicker(false);
    setClickInfo(null);
  };

  // Show error state
  if (mapError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-surface">
        <div className="text-center p-6 bg-red-900/20 border border-red-500/50 rounded">
          <p className="text-red-400 mb-2">Map Error</p>
          <p className="text-xs text-red-300">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-surface" style={{ width: '100%', height: '100%', zIndex: 0 }}>
      {/* Map container - always rendered */}
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      />

      {/* Loading overlay */}
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-surface/50">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-warm border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-text-muted text-sm">Loading map...</p>
          </div>
        </div>
      )}

      {/* Selected nutrition marker — detail popover anchored to marker screen position */}
      {selectedMarkerId && selectedMarkerScreen && (() => {
        const point = routeData.nutritionPoints.find((p) => p.id === selectedMarkerId);
        if (!point) return null;
        return (
          <div
            className="absolute z-30 pointer-events-auto -translate-x-1/2"
            style={{
              left: selectedMarkerScreen.x,
              top: selectedMarkerScreen.y - 56,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <NutritionDetailCard
              product={point.product}
              distanceKm={point.distanceKm}
              onClose={() => setSelectedMarkerId(null)}
              onRemove={() => removeNutritionPoint(point.id)}
            />
          </div>
        );
      })()}

      {/* Hover Info Tooltip */}
      {hoverInfo && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: hoverInfo.x + 15,
            top: hoverInfo.y - 40,
          }}
        >
          <div className="bg-surface/95 backdrop-blur border border-[var(--color-border)] rounded-lg px-3 py-2 shadow-xl">
            <div className="text-lg font-display font-bold text-text-primary">
              {hoverInfo.distanceKm.toFixed(1)}
              <span className="text-xs text-text-muted ml-1">km</span>
            </div>
            {hoverInfo.elevation !== null && (
              <div className="text-sm font-display font-semibold text-warm">
                {Math.round(hoverInfo.elevation)}
                <span className="text-xs text-text-muted ml-1">m elev</span>
              </div>
            )}
            <div className="text-[9px] text-text-muted font-display mt-1">
              Click to add nutrition
            </div>
          </div>
        </div>
      )}

      {/* Route Drawing — floating Draw Route button (idle) bottom-left; active drawing becomes a full-width bottom action bar on mobile */}
      {!routeData.loaded && drawing.state === 'idle' ? null : (drawing.state === 'placing' || drawing.state === 'routing') ? (
        <div className="absolute bottom-0 left-0 right-0 z-30 lg:bottom-6 lg:left-20 lg:right-auto">
          <RouteDrawingToolbar
            state={drawing.state}
            waypointCount={drawing.waypoints.length}
            totalDistance={drawing.totalDistance}
            totalDuration={drawing.totalDuration}
            profile={drawing.profile}
            isProcessing={drawing.isProcessing}
            error={drawing.error}
            routeName={drawing.routeName}
            onStart={drawing.startDrawing}
            onFinish={handleFinishDrawing}
            onCancel={drawing.cancelDrawing}
            onUndo={drawing.removeLastWaypoint}
            onProfileChange={drawing.setProfile}
            onRouteNameChange={drawing.setRouteName}
          />
        </div>
      ) : (
        <div className="absolute bottom-6 left-20 z-30">
          <RouteDrawingToolbar
            state={drawing.state}
            waypointCount={drawing.waypoints.length}
            totalDistance={drawing.totalDistance}
            totalDuration={drawing.totalDuration}
            profile={drawing.profile}
            isProcessing={drawing.isProcessing}
            error={drawing.error}
            routeName={drawing.routeName}
            onStart={drawing.startDrawing}
            onFinish={handleFinishDrawing}
            onCancel={drawing.cancelDrawing}
            onUndo={drawing.removeLastWaypoint}
            onProfileChange={drawing.setProfile}
            onRouteNameChange={drawing.setRouteName}
          />
        </div>
      )}

      {/* Product Picker Modal */}
      <ProductPickerModal
        isOpen={showProductPicker}
        distanceKm={clickInfo?.distanceKm ?? 0}
        elevation={clickInfo?.elevation ?? null}
        onClose={() => {
          setShowProductPicker(false);
          setClickInfo(null);
        }}
        onSelectProduct={handleProductSelect}
      />
    </div>
  );
}
