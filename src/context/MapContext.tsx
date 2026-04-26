import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type * as mapboxgl from 'mapbox-gl';

interface MapContextValue {
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map | null) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
const MapContext = createContext<MapContextValue>({ map: null, setMap: noop });

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<mapboxgl.Map | null>(null);
  const setMap = useCallback((m: mapboxgl.Map | null) => setMapState(m), []);
  return <MapContext.Provider value={{ map, setMap }}>{children}</MapContext.Provider>;
}

export function useMap(): mapboxgl.Map | null {
  return useContext(MapContext).map;
}

export function useMapRegistration(): (map: mapboxgl.Map | null) => void {
  return useContext(MapContext).setMap;
}
