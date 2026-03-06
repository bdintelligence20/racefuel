import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useApp } from '../context/AppContext';
import { ProductProps } from './NutritionCard';
import { ProductPickerModal } from './ProductPickerModal';

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
  const { routeData, addNutritionPoint, removeNutritionPoint } = useApp();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Get GPS path - use real data or generate mock
  const gpsPath = useMemo(() => {
    console.log('Computing gpsPath, routeData.gpsPath:', routeData.gpsPath?.length || 0, 'points');

    if (routeData.gpsPath && routeData.gpsPath.length > 0) {
      console.log('Using real GPS path');
      return routeData.gpsPath;
    }

    // Generate mock GPS coordinates for Cape Town, South Africa
    console.log('Generating mock GPS path');
    const baseLat = -33.9249;
    const baseLng = 18.4241;
    const points: { lat: number; lng: number; elevation?: number }[] = [];
    const numPoints = 100;

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const lat = baseLat + t * 0.3 + Math.sin(t * Math.PI * 4) * 0.02;
      const lng = baseLng + t * 0.5 + Math.sin(t * Math.PI * 3) * 0.03;
      const elevation = 100 + Math.sin(t * Math.PI * 6) * 200 + t * 300;
      points.push({ lat, lng, elevation });
    }
    return points;
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
        style: 'mapbox://styles/mapbox/dark-v11',
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

  // Add route to map when ready
  useEffect(() => {
    if (!map.current || !mapReady) {
      console.log('Map not ready for route, mapReady:', mapReady);
      return;
    }

    if (!gpsPath || gpsPath.length === 0) {
      console.log('No GPS path to display');
      return;
    }

    const addRoute = () => {
      if (!map.current) return;

      console.log('Adding route to map with', gpsPath.length, 'points');

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
          'line-color': '#f59e0b',
          'line-width': 10,
          'line-opacity': 0.4,
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
            0, '#f59e0b',
            0.5, '#ffffff',
            1, '#10b981',
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
      startEl.style.cssText = 'width:16px;height:16px;background:#34d399;border-radius:50%;border:2px solid black;';
      const startMarker = new mapboxgl.Marker({ element: startEl })
        .setLngLat(coordinates[0])
        .addTo(map.current);
      markersRef.current.push(startMarker);

      // Add end marker
      const endEl = document.createElement('div');
      endEl.style.cssText = 'width:16px;height:16px;background:#10b981;border-radius:50%;border:2px solid black;';
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

  }, [mapReady, gpsPath]);

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
        <div style="width:32px;height:32px;background:white;border-radius:50%;border:2px solid #10b981;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;">
          ${point.product.carbs}g
        </div>
      `;
      el.onclick = (e) => {
        e.stopPropagation();
        removeNutritionPoint(point.id);
      };

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([gps.lng, gps.lat])
        .addTo(map.current!);
      markersRef.current.push(marker);
    });
  }, [mapReady, gpsPath, routeData.nutritionPoints, routeData.distanceKm, removeNutritionPoint]);

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
          <div className="bg-surface/95 backdrop-blur border border-white/20 px-3 py-2 shadow-xl">
            <div className="text-lg font-mono font-bold text-white">
              {hoverInfo.distanceKm.toFixed(1)}
              <span className="text-xs text-text-muted ml-1">km</span>
            </div>
            {hoverInfo.elevation !== null && (
              <div className="text-sm font-mono text-accent">
                {Math.round(hoverInfo.elevation)}
                <span className="text-xs text-text-muted ml-1">m elev</span>
              </div>
            )}
            <div className="text-[9px] text-text-muted mt-1">
              Click to add nutrition
            </div>
          </div>
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
