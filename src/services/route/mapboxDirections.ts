const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

export interface DirectionsResult {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: [number, number][]; // [lng, lat]
  };
}

export type RoutingProfile = 'cycling' | 'walking' | 'driving';

// Session-level LRU-ish cache — prevents duplicate API calls for undo/redo of the same segment.
const directionsCache = new Map<string, DirectionsResult>();
const CACHE_MAX = 200;

function cacheKey(waypoints: { lat: number; lng: number }[], profile: RoutingProfile): string {
  return waypoints.map((w) => `${w.lng.toFixed(5)},${w.lat.toFixed(5)}`).join(';') + '|' + profile;
}

export async function getDirections(
  waypoints: { lat: number; lng: number }[],
  profile: RoutingProfile = 'cycling',
  signal?: AbortSignal
): Promise<DirectionsResult> {
  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints required');
  }

  // Mapbox Directions API supports max 25 waypoints per request
  if (waypoints.length > 25) {
    return getDirectionsChunked(waypoints, profile, signal);
  }

  const key = cacheKey(waypoints, profile);
  const cached = directionsCache.get(key);
  if (cached) {
    // Refresh recency
    directionsCache.delete(key);
    directionsCache.set(key, cached);
    return cached;
  }

  const coordinates = waypoints.map((w) => `${w.lng},${w.lat}`).join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?geometries=geojson&overview=full&steps=false&alternatives=false&access_token=${MAPBOX_TOKEN}`;

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Directions API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = data.routes[0];
  const result: DirectionsResult = {
    distance: route.distance,
    duration: route.duration,
    geometry: route.geometry,
  };

  // Cache eviction: drop oldest if over capacity
  if (directionsCache.size >= CACHE_MAX) {
    const oldestKey = directionsCache.keys().next().value;
    if (oldestKey) directionsCache.delete(oldestKey);
  }
  directionsCache.set(key, result);

  return result;
}

async function getDirectionsChunked(
  waypoints: { lat: number; lng: number }[],
  profile: RoutingProfile,
  signal?: AbortSignal
): Promise<DirectionsResult> {
  const chunkSize = 24; // 25 max, but overlap by 1
  const allCoords: [number, number][] = [];
  let totalDistance = 0;
  let totalDuration = 0;

  for (let i = 0; i < waypoints.length - 1; i += chunkSize) {
    const chunk = waypoints.slice(i, Math.min(i + chunkSize + 1, waypoints.length));
    if (chunk.length < 2) break;

    const result = await getDirections(chunk, profile, signal);
    totalDistance += result.distance;
    totalDuration += result.duration;

    // Avoid duplicate points at chunk boundaries
    const startIdx = i === 0 ? 0 : 1;
    allCoords.push(...result.geometry.coordinates.slice(startIdx));
  }

  return {
    distance: totalDistance,
    duration: totalDuration,
    geometry: { coordinates: allCoords },
  };
}

export async function getElevationForCoordinates(
  coordinates: [number, number][]
): Promise<number[]> {
  if (!coordinates || coordinates.length === 0) return [];

  // Sample down to ~90 points (Open-Meteo limit is 100 per request)
  const maxSamples = 90;
  const sampleRate = Math.max(1, Math.floor(coordinates.length / maxSamples));
  const sampledIndices: number[] = [];
  for (let i = 0; i < coordinates.length; i += sampleRate) {
    sampledIndices.push(i);
  }
  if (sampledIndices[sampledIndices.length - 1] !== coordinates.length - 1) {
    sampledIndices.push(coordinates.length - 1);
  }

  const sampled = sampledIndices.map((i) => coordinates[i]);

  // Batch into chunks of 100 (API limit)
  const chunkSize = 100;
  const allElevations: number[] = [];

  for (let c = 0; c < sampled.length; c += chunkSize) {
    const chunk = sampled.slice(c, c + chunkSize);
    const lats = chunk.map(([, lat]) => lat).join(',');
    const lngs = chunk.map(([lng]) => lng).join(',');

    try {
      const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
      if (res.ok) {
        const data = await res.json();
        allElevations.push(...(data.elevation || chunk.map(() => 0)));
      } else {
        allElevations.push(...chunk.map(() => 0));
      }
    } catch {
      allElevations.push(...chunk.map(() => 0));
    }
  }

  // Interpolate elevations for all coordinates
  const elevations: number[] = new Array(coordinates.length);
  let si = 0;
  for (let i = 0; i < coordinates.length; i++) {
    while (si < sampledIndices.length - 1 && sampledIndices[si + 1] <= i) {
      si++;
    }

    if (i === sampledIndices[si]) {
      elevations[i] = allElevations[si];
    } else if (si < sampledIndices.length - 1) {
      const i0 = sampledIndices[si];
      const i1 = sampledIndices[si + 1];
      const t = (i - i0) / (i1 - i0);
      elevations[i] = allElevations[si] * (1 - t) + allElevations[si + 1] * t;
    } else {
      elevations[i] = allElevations[si];
    }
  }

  return elevations;
}
