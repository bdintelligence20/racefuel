import { GpsPoint } from '../../context/AppContext';

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
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor(((hours - h) * 60 - m) * 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function parseTcx(xmlText: string, fileName?: string): ParsedRoute {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid TCX file format');
  }

  // Get activity name
  const idNode = doc.querySelector('Activity > Id');
  const notesNode = doc.querySelector('Activity > Notes');
  let name = notesNode?.textContent?.trim() || idNode?.textContent?.trim() || '';
  if (!name && fileName) {
    name = fileName.replace(/\.tcx$/i, '');
  }
  if (!name) name = 'TCX Route';

  // Get all trackpoints
  const trackpoints = doc.querySelectorAll('Trackpoint');
  const gpsPath: GpsPoint[] = [];

  trackpoints.forEach((tp) => {
    const posNode = tp.querySelector('Position');
    if (!posNode) return;

    const lat = parseFloat(posNode.querySelector('LatitudeDegrees')?.textContent || '');
    const lng = parseFloat(posNode.querySelector('LongitudeDegrees')?.textContent || '');

    if (isNaN(lat) || isNaN(lng)) return;

    const elevNode = tp.querySelector('AltitudeMeters');
    const elevation = elevNode ? parseFloat(elevNode.textContent || '') : undefined;

    gpsPath.push({
      lat,
      lng,
      elevation: isNaN(elevation as number) ? undefined : elevation,
    });
  });

  if (gpsPath.length === 0) {
    throw new Error('No trackpoints found in TCX file');
  }

  // Calculate distance
  let totalDistance = 0;
  for (let i = 1; i < gpsPath.length; i++) {
    totalDistance += haversineDistance(
      gpsPath[i - 1].lat,
      gpsPath[i - 1].lng,
      gpsPath[i].lat,
      gpsPath[i].lng
    );
  }

  // Calculate elevation gain
  let elevationGain = 0;
  for (let i = 1; i < gpsPath.length; i++) {
    const prev = gpsPath[i - 1].elevation;
    const curr = gpsPath[i].elevation;
    if (prev !== undefined && curr !== undefined && curr > prev) {
      elevationGain += curr - prev;
    }
  }

  // Try to get total time from laps
  let totalTimeSeconds = 0;
  const laps = doc.querySelectorAll('Lap');
  laps.forEach((lap) => {
    const timeNode = lap.querySelector('TotalTimeSeconds');
    if (timeNode) {
      totalTimeSeconds += parseFloat(timeNode.textContent || '0');
    }
  });

  // Estimate time if not available
  const hours = totalTimeSeconds > 0
    ? totalTimeSeconds / 3600
    : totalDistance / 25; // assume 25 km/h

  // Create path for elevation chart
  const path = gpsPath.map((p, i) => ({
    x: (i / Math.max(1, gpsPath.length - 1)) * 1000,
    y: p.elevation || 0,
  }));

  return {
    name,
    distanceKm: Math.round(totalDistance * 10) / 10,
    elevationGain: Math.round(elevationGain),
    estimatedTime: formatTime(hours),
    path,
    gpsPath,
  };
}
