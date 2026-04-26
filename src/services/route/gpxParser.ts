import { GpsPoint } from '../../context/AppContext';
import { estimateRouteTime, formatHoursAsHms } from './timeEstimator';

export interface ParsedRoute {
  name: string;
  distanceKm: number;
  elevationGain: number;
  estimatedTime: string;
  path: { x: number; y: number }[];
  gpsPath: GpsPoint[];
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parseGpx(xmlText: string, fileName?: string): ParsedRoute {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');

  const parserError = xml.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid GPX file: XML parse error');
  }

  // Try track points first, then route points
  const trackPoints = xml.querySelectorAll('trkpt');
  const routePoints = xml.querySelectorAll('rtept');
  const points = trackPoints.length > 0 ? trackPoints : routePoints;

  if (points.length === 0) {
    throw new Error('No GPS data found in file');
  }

  // Try to get route name from metadata
  const nameEl = xml.querySelector('trk > name') || xml.querySelector('metadata > name');
  const routeName = nameEl?.textContent || fileName?.replace('.gpx', '').replace(/_/g, ' ') || 'Imported Route';

  const gpsPath: GpsPoint[] = [];
  const cumulativeDistancesKm: number[] = [];
  const elevationsM: number[] = [];
  let totalDistance = 0;
  let totalElevationGain = 0;
  let prevLat: number | null = null;
  let prevLng: number | null = null;
  let prevEle: number | null = null;

  points.forEach((point) => {
    const lat = parseFloat(point.getAttribute('lat') || '0');
    const lng = parseFloat(point.getAttribute('lon') || '0');
    const eleNode = point.querySelector('ele');
    const elevation = eleNode ? parseFloat(eleNode.textContent || '0') : undefined;

    gpsPath.push({ lat, lng, elevation });

    if (prevLat !== null && prevLng !== null) {
      totalDistance += haversineDistance(prevLat, prevLng, lat, lng);
    }
    cumulativeDistancesKm.push(totalDistance);
    elevationsM.push(elevation ?? prevEle ?? 0);

    if (elevation !== undefined && prevEle !== null && elevation > prevEle) {
      totalElevationGain += elevation - prevEle;
    }

    prevLat = lat;
    prevLng = lng;
    if (elevation !== undefined) prevEle = elevation;
  });

  // Sport/surface unknown at GPX-import time — default to road run. The
  // estimator uses Tobler over the per-sample slope when elevations exist,
  // otherwise falls back to flat pace + Naismith. Either way the climb floor
  // alone fixes the "176 km mountain ultra in 6:53" ultra bug.
  const { hours } = estimateRouteTime({
    distanceKm: totalDistance,
    elevationGainM: totalElevationGain,
    sport: 'run',
    surface: 'road',
    cumulativeDistancesKm,
    elevationsM,
  });
  const estimatedTime = formatHoursAsHms(hours);

  const path = gpsPath.map((p, i) => ({
    x: (i / (gpsPath.length - 1)) * 1000,
    y: p.elevation || 0,
  }));

  return {
    name: routeName,
    distanceKm: Math.round(totalDistance * 10) / 10,
    elevationGain: Math.round(totalElevationGain),
    estimatedTime,
    path,
    gpsPath,
  };
}
