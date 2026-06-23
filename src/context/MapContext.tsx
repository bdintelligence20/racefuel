import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type * as mapboxgl from 'mapbox-gl';

interface MapContextValue {
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map | null) => void;
  /** Distance (km) the user is currently pointing at on the elevation profile,
   *  or null when not hovering. Shared so the map can highlight the matching
   *  spot on the route — the brief's "two views of the same data should always
   *  be connected: hover one, see it reflected on the other". */
  hoverKm: number | null;
  setHoverKm: (km: number | null) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const MapContext = createContext<MapContextValue>({ map: null, setMap: noop, hoverKm: null, setHoverKm: noop });

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<mapboxgl.Map | null>(null);
  const [hoverKm, setHoverKmState] = useState<number | null>(null);
  const setMap = useCallback((m: mapboxgl.Map | null) => setMapState(m), []);
  const setHoverKm = useCallback((km: number | null) => setHoverKmState(km), []);
  const value = useMemo(
    () => ({ map, setMap, hoverKm, setHoverKm }),
    [map, setMap, hoverKm, setHoverKm],
  );
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMap(): mapboxgl.Map | null {
  return useContext(MapContext).map;
}

export function useMapRegistration(): (map: mapboxgl.Map | null) => void {
  return useContext(MapContext).setMap;
}

/** Shared elevation↔map hover link. ElevationProfile writes the hovered km;
 *  MapView reads it to drop a highlight marker on the route. */
export function useRouteHover(): { hoverKm: number | null; setHoverKm: (km: number | null) => void } {
  const { hoverKm, setHoverKm } = useContext(MapContext);
  return { hoverKm, setHoverKm };
}
