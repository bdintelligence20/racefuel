// Strava data transformation utilities

import { StravaActivitySummary, StravaStream } from './stravaTypes';
import { RouteData, GpsPoint } from '../../context/AppContext';

/**
 * Decode a Google-encoded polyline string to an array of [lat, lng] pairs
 * Based on the algorithm at: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;

    // Decode latitude
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Convert GPS coordinates to SVG path coordinates
 * Normalizes to a viewbox-friendly coordinate system
 */
export function gpsToSvgPath(
  gpsPoints: [number, number][],
  width = 1000,
  height = 100
): { x: number; y: number }[] {
  if (gpsPoints.length === 0) return [];

  // Find bounding box
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lat, lng] of gpsPoints) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  // Scale to fit, maintaining aspect ratio
  const scale = Math.min(width / lngRange, height / latRange);

  // Convert points
  return gpsPoints.map(([lat, lng]) => ({
    x: (lng - minLng) * scale,
    y: height - (lat - minLat) * scale, // Flip Y axis
  }));
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format distance in meters to km string
 */
export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format date to locale string
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Transform a Strava activity and its streams into our RouteData format
 */
export function transformActivityToRoute(
  activity: StravaActivitySummary,
  streams?: StravaStream[]
): Omit<RouteData, 'nutritionPoints'> {
  // Get GPS path from streams or decode from polyline
  let svgPath: { x: number; y: number }[] = [];
  let gpsPath: GpsPoint[] = [];
  let rawGpsPoints: [number, number][] = [];

  if (streams) {
    const latlngStream = streams.find((s) => s.type === 'latlng');
    const altitudeStream = streams.find((s) => s.type === 'altitude');

    if (latlngStream && Array.isArray(latlngStream.data)) {
      rawGpsPoints = latlngStream.data as [number, number][];
      svgPath = gpsToSvgPath(rawGpsPoints);

      // Build gpsPath with optional elevation data
      const altitudes = altitudeStream?.data as number[] | undefined;
      gpsPath = rawGpsPoints.map(([lat, lng], i) => ({
        lat,
        lng,
        elevation: altitudes?.[i],
      }));
    }
  }

  // Fallback to decoding the summary polyline
  if (svgPath.length === 0 && activity.map?.summary_polyline) {
    rawGpsPoints = decodePolyline(activity.map.summary_polyline);
    svgPath = gpsToSvgPath(rawGpsPoints);
    gpsPath = rawGpsPoints.map(([lat, lng]) => ({ lat, lng }));
  }

  // Generate a simple path if we still have nothing
  if (svgPath.length === 0) {
    svgPath = Array.from({ length: 100 }, (_, i) => ({
      x: i * 10,
      y: 50 + Math.sin(i * 0.2) * 30,
    }));
  }

  return {
    loaded: true,
    name: activity.name,
    distanceKm: activity.distance / 1000,
    elevationGain: activity.total_elevation_gain,
    estimatedTime: formatDuration(activity.moving_time),
    path: svgPath,
    gpsPath: gpsPath.length > 0 ? gpsPath : undefined,
  };
}

/**
 * Create elevation profile data from altitude stream
 */
export function createElevationProfile(
  altitudeStream: StravaStream,
  distanceStream: StravaStream
): { distance: number; elevation: number }[] {
  const altitudes = altitudeStream.data as number[];
  const distances = distanceStream.data as number[];

  if (altitudes.length !== distances.length) {
    return [];
  }

  return altitudes.map((elevation, i) => ({
    distance: distances[i] / 1000, // Convert to km
    elevation,
  }));
}
