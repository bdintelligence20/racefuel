import { useState, useCallback } from 'react';
import { getDirections, getElevationForCoordinates, RoutingProfile } from '../services/route/mapboxDirections';
import { GpsPoint, RouteData } from '../context/AppContext';

export type DrawingState = 'idle' | 'placing' | 'routing' | 'complete';

interface RouteSegment {
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

export function useRouteDrawing() {
  const [state, setState] = useState<DrawingState>('idle');
  const [waypoints, setWaypoints] = useState<GpsPoint[]>([]);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [profile, setProfile] = useState<RoutingProfile>('cycling');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [routeName, setRouteName] = useState('Custom Route');

  const startDrawing = useCallback(() => {
    setState('placing');
    setWaypoints([]);
    setRouteSegments([]);
    setTotalDistance(0);
    setTotalDuration(0);
    setError(null);
  }, []);

  const addWaypoint = useCallback(async (point: GpsPoint) => {
    const newWaypoints = [...waypoints, point];
    setWaypoints(newWaypoints);

    if (newWaypoints.length >= 2) {
      setIsProcessing(true);
      setError(null);
      try {
        // Get directions between last two waypoints
        const from = newWaypoints[newWaypoints.length - 2];
        const to = newWaypoints[newWaypoints.length - 1];
        const result = await getDirections([from, to], profile);

        const newSegment: RouteSegment = {
          coordinates: result.geometry.coordinates,
          distance: result.distance,
          duration: result.duration,
        };

        setRouteSegments((prev) => [...prev, newSegment]);
        setTotalDistance((prev) => prev + result.distance);
        setTotalDuration((prev) => prev + result.duration);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get route');
      } finally {
        setIsProcessing(false);
      }
    }
  }, [waypoints, profile]);

  const removeLastWaypoint = useCallback(() => {
    if (waypoints.length === 0) return;

    setWaypoints((prev) => prev.slice(0, -1));

    if (routeSegments.length > 0) {
      const removed = routeSegments[routeSegments.length - 1];
      setRouteSegments((prev) => prev.slice(0, -1));
      setTotalDistance((prev) => prev - removed.distance);
      setTotalDuration((prev) => prev - removed.duration);
    }
  }, [waypoints, routeSegments]);

  const finishDrawing = useCallback(async (): Promise<RouteData | null> => {
    if (waypoints.length < 2 || routeSegments.length === 0) return null;

    setState('routing');
    setIsProcessing(true);

    try {
      // Combine all segments into one path
      const allCoordinates: [number, number][] = [];
      for (let i = 0; i < routeSegments.length; i++) {
        const startIdx = i === 0 ? 0 : 1; // Avoid duplicate points
        allCoordinates.push(...routeSegments[i].coordinates.slice(startIdx));
      }

      // Get elevation data via Open-Meteo (single batch request)
      const elevations = await getElevationForCoordinates(allCoordinates);

      // Build GPS path with elevation
      const gpsPath: GpsPoint[] = allCoordinates.map(([lng, lat], i) => ({
        lat,
        lng,
        elevation: elevations[i],
      }));

      // Calculate elevation gain
      let elevationGain = 0;
      for (let i = 1; i < gpsPath.length; i++) {
        const prev = gpsPath[i - 1].elevation;
        const curr = gpsPath[i].elevation;
        if (prev !== undefined && curr !== undefined && curr > prev) {
          elevationGain += curr - prev;
        }
      }

      // Build path for elevation profile
      const distanceKm = totalDistance / 1000;
      const path = gpsPath.map((p, i) => ({
        x: (i / (gpsPath.length - 1)) * distanceKm * 1000,
        y: p.elevation || 0,
      }));

      // Estimate time string
      const hours = Math.floor(totalDuration / 3600);
      const minutes = Math.floor((totalDuration % 3600) / 60);
      const seconds = Math.floor(totalDuration % 60);
      const estimatedTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      const routeData: RouteData = {
        loaded: true,
        name: routeName || 'Custom Route',
        distanceKm,
        elevationGain: Math.round(elevationGain),
        estimatedTime,
        path,
        gpsPath,
        nutritionPoints: [],
        source: 'gpx', // Use 'gpx' to maintain compatibility
      };

      setState('complete');
      setIsProcessing(false);
      return routeData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize route');
      setState('placing');
      setIsProcessing(false);
      return null;
    }
  }, [waypoints, routeSegments, totalDistance, totalDuration, routeName]);

  const cancelDrawing = useCallback(() => {
    setState('idle');
    setWaypoints([]);
    setRouteSegments([]);
    setTotalDistance(0);
    setTotalDuration(0);
    setError(null);
  }, []);

  // Get the full route line for display
  const routeLine = routeSegments.flatMap((seg, i) => {
    const startIdx = i === 0 ? 0 : 1;
    return seg.coordinates.slice(startIdx);
  });

  return {
    state,
    waypoints,
    routeLine,
    totalDistance,
    totalDuration,
    profile,
    error,
    isProcessing,
    routeName,
    setProfile,
    setRouteName,
    startDrawing,
    addWaypoint,
    removeLastWaypoint,
    finishDrawing,
    cancelDrawing,
  };
}
