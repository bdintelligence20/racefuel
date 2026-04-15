import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useApp } from '../context/AppContext';
import { ProductProps } from './NutritionCard';
import { ProductPickerModal } from './ProductPickerModal';
import { RouteDrawingToolbar } from './RouteDrawingToolbar';
import { useRouteDrawing } from '../hooks/useRouteDrawing';
import { toast } from 'sonner';

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

console.log('Mapbox token loaded:', MAPBOX_TOKEN ? 'Yes (length: ' + MAPBOX_TOKEN.length + ')' : 'NO TOKEN');

export function MapView() {
  const { routeData, addNutritionPoint, removeNutritionPoint, loadSavedRoute } = useApp();
  const drawing = useRouteDrawing();
  const drawingMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Get GPS path - only use real data, no mock
  const gpsPath = useMemo(() => {
    if (routeData.gpsPath && routeData.gpsPath.length > 0) {
      return routeData.gpsPath;
    }
    return null;
  }, [routeData.gpsPath]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) {
      console.log('No map container');
      return;
    }

    if (map.current) {
      console.log('Map already initialized');
      return;
    }

    if (!MAPBOX_TOKEN) {
      console.error('No Mapbox token!');
      setMapError('Mapbox token not configured');
      return;
    }

    console.log('Initializing Mapbox map...');
    console.log('Container dimensions:', mapContainer.current.offsetWidth, 'x', mapContainer.current.offsetHeight);

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: getMapStyle(),
        center: [18.4241, -33.9249], // Cape Town
        zoom: 10,
        attributionControl: false,
      });

      map.current.on('load', () => {
        console.log('Map loaded successfully!');
        setMapReady(true);
      });

      map.current.on('error', (e) => {
        console.error('Map error:', e);
        setMapError('Map failed to load: ' + (e.error?.message || 'Unknown error'));
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    } catch (err) {
      console.error('Failed to create map:', err);
      setMapError('Failed to create map: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }

    return () => {
      console.log('Cleaning up map');
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
    if (!map.current || !mapReady) {
      console.log('Map not ready for route, mapReady:', mapReady);
      return;
    }

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
      } catch (e) {
        console.log('Error removing layers:', e);
      }

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
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0, '#F5A020',
            0.5, '#E8671A',
            1, '#3D2152',
          ],
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

      console.log('Route added successfully');
    };

    // Wait for style to be loaded
    if (map.current.isStyleLoaded()) {
      addRoute();
    } else {
      map.current.once('style.load', addRoute);
    }

  }, [mapReady, gpsPath, styleVersion]);

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

  // Add nutrition markers
  useEffect(() => {
    if (!map.current || !mapReady || !gpsPath || gpsPath.length === 0) return;

    // Remove only nutrition markers (keep start/end which are first 2)
    markersRef.current.slice(2).forEach((m) => m.remove());
    markersRef.current = markersRef.current.slice(0, 2);

    routeData.nutritionPoints.forEach((point) => {
      const progress = Math.min(point.distanceKm / routeData.distanceKm, 1);
      const idx = Math.floor(progress * (gpsPath.length - 1));
      const gps = gpsPath[idx];

      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer;';
      el.innerHTML = `
        <div style="width:36px;height:36px;border-radius:50%;border:2px solid #3D2152;overflow:hidden;background:white;display:flex;align-items:center;justify-content:center;">
          ${point.product.image
            ? `<img src="${point.product.image}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
               <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:bold;">${point.product.carbs}g</div>`
            : `<div style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-size:10px;font-weight:bold;">${point.product.carbs}g</div>`
          }
        </div>
      `;
      el.onclick = (e) => {
        e.stopPropagation();
        removeNutritionPoint(point.id);
      };

      if (map.current) {
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([gps.lng, gps.lat])
          .addTo(map.current);
        markersRef.current.push(marker);
      }
    });
  }, [mapReady, gpsPath, routeData.nutritionPoints, routeData.distanceKm, removeNutritionPoint]);

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
      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#F5A020', 'line-width': 4, 'line-dasharray': [2, 2] },
      });
    }
  }, [mapReady, drawing.routeLine]);

  // Drawing mode: render waypoint markers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    // Clean up old markers
    drawingMarkersRef.current.forEach((m) => m.remove());
    drawingMarkersRef.current = [];

    if (drawing.state === 'idle' || drawing.state === 'complete') return;

    drawing.waypoints.forEach((wp, i) => {
      const el = document.createElement('div');
      el.style.cssText = `width:24px;height:24px;background:${i === 0 ? '#3D2152' : '#F5A020'};border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:bold;color:black;`;
      el.textContent = String(i + 1);

      if (map.current) {
        const marker = new mapboxgl.Marker({ element: el, draggable: false })
          .setLngLat([wp.lng, wp.lat])
          .addTo(map.current);
        drawingMarkersRef.current.push(marker);
      }
    });
  }, [mapReady, drawing.waypoints, drawing.state]);

  // Clean up drawing layers when drawing ends
  useEffect(() => {
    if (drawing.state !== 'idle' && drawing.state !== 'complete') return;
    if (!map.current) return;

    try {
      if (map.current.getLayer('drawing-route-line')) map.current.removeLayer('drawing-route-line');
      if (map.current.getSource('drawing-route')) map.current.removeSource('drawing-route');
    } catch { /* layer may not exist */ }

    drawingMarkersRef.current.forEach((m) => m.remove());
    drawingMarkersRef.current = [];
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

      {/* Route Drawing Toolbar — hidden when GpxDropZone is showing (it has its own Draw button) */}
      <div className={`absolute bottom-4 left-4 z-30 ${!routeData.loaded && drawing.state === 'idle' ? 'hidden' : ''}`}>
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
