import { useState, useCallback, useRef, useEffect } from 'react';
import { getDirections, getElevationForCoordinates, RoutingProfile } from '../services/route/mapboxDirections';
import { GpsPoint, RouteData } from '../context/AppContext';
import { estimateRouteTime, formatHoursAsHms } from '../services/route/timeEstimator';

export type DrawingState = 'idle' | 'placing' | 'routing' | 'complete';

interface RouteSegment {
  id: string;
  coordinates: [number, number][];
  distance: number;
  duration: number;
  pending: boolean; // true while snapped geometry is still being fetched
}

// Haversine distance in meters
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Rough speed estimate for pending duration (m/s)
function estimateSpeed(profile: RoutingProfile): number {
  if (profile === 'cycling') return 6; // ~22 km/h
  if (profile === 'driving') return 14; // ~50 km/h
  return 3; // walking/running ~10 km/h
}

export function useRouteDrawing() {
  const [state, setState] = useState<DrawingState>('idle');
  const [waypoints, setWaypoints] = useState<GpsPoint[]>([]);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [profile, setProfile] = useState<RoutingProfile>('walking');
  const [error, setError] = useState<string | null>(null);
  const [routeName, setRouteName] = useState('Custom Route');

  // In-flight snap requests, keyed by segment id, so we can abort on undo/cancel
  const inFlight = useRef<Map<string, AbortController>>(new Map());
  // Track active session to ignore late responses after cancel
  const sessionRef = useRef(0);
  // Always-current snapshot of segments — lets finishDrawing read post-await state safely
  const segmentsRef = useRef<RouteSegment[]>([]);
  useEffect(() => {
    segmentsRef.current = routeSegments;
  }, [routeSegments]);

  const totalDistance = routeSegments.reduce((sum, s) => sum + s.distance, 0);
  const totalDuration = routeSegments.reduce((sum, s) => sum + s.duration, 0);
  const isProcessing = routeSegments.some((s) => s.pending);

  const startDrawing = useCallback(() => {
    sessionRef.current++;
    inFlight.current.forEach((c) => c.abort());
    inFlight.current.clear();
    setState('placing');
    setWaypoints([]);
    setRouteSegments([]);
    setError(null);
  }, []);

  const snapSegment = useCallback(
    async (segmentId: string, from: GpsPoint, to: GpsPoint, currentProfile: RoutingProfile, session: number) => {
      const controller = new AbortController();
      inFlight.current.set(segmentId, controller);
      try {
        const result = await getDirections([from, to], currentProfile, controller.signal);

        if (session !== sessionRef.current) return; // stale (cancel/restart happened)

        setRouteSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId
              ? { ...s, coordinates: result.geometry.coordinates, distance: result.distance, duration: result.duration, pending: false }
              : s
          )
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') return; // user cancelled or undid
        if (session !== sessionRef.current) return;
        // Keep the straight-line fallback so the user isn't stranded
        setRouteSegments((prev) => prev.map((s) => (s.id === segmentId ? { ...s, pending: false } : s)));
        setError(err instanceof Error ? err.message : 'Failed to snap to roads');
      } finally {
        inFlight.current.delete(segmentId);
      }
    },
    []
  );

  const addWaypoint = useCallback(
    (point: GpsPoint) => {
      setError(null);
      setWaypoints((prev) => {
        const next = [...prev, point];
        const from = prev[prev.length - 1];
        if (!from) return next;

        // Immediately append a pending straight-line segment (instant feedback)
        const segmentId = `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const straightDistance = haversineMeters(from, point);
        const straightDuration = straightDistance / estimateSpeed(profile);
        const straightSegment: RouteSegment = {
          id: segmentId,
          coordinates: [[from.lng, from.lat], [point.lng, point.lat]],
          distance: straightDistance,
          duration: straightDuration,
          pending: true,
        };
        setRouteSegments((segs) => [...segs, straightSegment]);

        // Kick off snap in background
        const session = sessionRef.current;
        snapSegment(segmentId, from, point, profile, session);

        return next;
      });
    },
    [profile, snapSegment]
  );

  const removeLastWaypoint = useCallback(() => {
    setWaypoints((prev) => {
      if (prev.length === 0) return prev;

      const lastSegment = routeSegments[routeSegments.length - 1];
      if (lastSegment) {
        // Abort its in-flight snap if still pending
        const c = inFlight.current.get(lastSegment.id);
        if (c) {
          c.abort();
          inFlight.current.delete(lastSegment.id);
        }
        setRouteSegments((segs) => segs.slice(0, -1));
      }

      return prev.slice(0, -1);
    });
  }, [routeSegments]);

  const finishDrawing = useCallback(async (): Promise<RouteData | null> => {
    if (waypoints.length < 2 || routeSegments.length === 0) return null;

    setState('routing');

    // Wait for any in-flight snap requests to settle, so we get snapped geometry where possible
    if (inFlight.current.size > 0) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (inFlight.current.size === 0) resolve();
          else setTimeout(check, 60);
        };
        check();
      });
    }

    try {
      // Always read the current segment state via the ref so post-await closures don't see stale data.
      const segs = segmentsRef.current;
      if (segs.length === 0) {
        setState('placing');
        return null;
      }

      const allCoordinates: [number, number][] = [];
      for (let i = 0; i < segs.length; i++) {
        const coords = segs[i]?.coordinates;
        if (!coords || coords.length === 0) continue;
        const startIdx = i === 0 ? 0 : 1;
        allCoordinates.push(...coords.slice(startIdx));
      }

      if (allCoordinates.length === 0) {
        setState('placing');
        setError('Route is empty — try placing more waypoints');
        return null;
      }

      const elevations = await getElevationForCoordinates(allCoordinates);

      const gpsPath: GpsPoint[] = allCoordinates.map(([lng, lat], i) => ({
        lat,
        lng,
        elevation: elevations[i],
      }));

      let elevationGain = 0;
      for (let i = 1; i < gpsPath.length; i++) {
        const prev = gpsPath[i - 1].elevation;
        const curr = gpsPath[i].elevation;
        if (prev !== undefined && curr !== undefined && curr > prev) {
          elevationGain += curr - prev;
        }
      }

      const finalDistance = segs.reduce((sum, s) => sum + s.distance, 0);
      const distanceKm = finalDistance / 1000;
      const path = gpsPath.map((p, i) => ({
        x: (i / Math.max(1, gpsPath.length - 1)) * distanceKm * 1000,
        y: p.elevation || 0,
      }));

      // Mapbox's segment durations are tuned for vehicles/pedestrians on a
      // road network — they don't reflect athlete pace, fatigue, or climb
      // cost. Discard them and re-estimate via the unified estimator using
      // the elevation profile we just fetched, so a drawn 10 km loop matches
      // what the same route would get on GPX import.
      const cumulativeDistancesKm: number[] = [0];
      for (let i = 1; i < gpsPath.length; i++) {
        const prev = gpsPath[i - 1];
        const curr = gpsPath[i];
        const dKm = haversineMeters(prev, curr) / 1000;
        cumulativeDistancesKm.push(cumulativeDistancesKm[i - 1] + dKm);
      }
      const elevationsM = gpsPath.map((p) => p.elevation ?? 0);
      const sport = profile === 'cycling' ? 'cycle' : 'run';
      const { hours: estimatedHours } = estimateRouteTime({
        distanceKm,
        elevationGainM: elevationGain,
        sport,
        surface: 'road',
        cumulativeDistancesKm,
        elevationsM,
      });
      const estimatedTime = formatHoursAsHms(estimatedHours);

      const routeData: RouteData = {
        loaded: true,
        name: routeName || 'Custom Route',
        distanceKm,
        elevationGain: Math.round(elevationGain),
        estimatedTime,
        path,
        gpsPath,
        nutritionPoints: [],
        source: 'gpx',
      };

      setState('complete');
      return routeData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize route');
      setState('placing');
      return null;
    }
  }, [waypoints, routeSegments, routeName, profile]);

  const cancelDrawing = useCallback(() => {
    sessionRef.current++;
    inFlight.current.forEach((c) => c.abort());
    inFlight.current.clear();
    setState('idle');
    setWaypoints([]);
    setRouteSegments([]);
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
