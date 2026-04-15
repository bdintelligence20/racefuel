import { GpsPoint } from '../../context/AppContext';

export interface RouteSegment {
  startKm: number;
  endKm: number;
  startIndex: number;
  endIndex: number;
  type: 'climb' | 'descent' | 'flat' | 'rolling';
  avgGradient: number;
  elevationChange: number;
  distanceKm: number;
  difficulty: number; // 1-10
}

export interface RouteAnalysis {
  segments: RouteSegment[];
  totalClimbingKm: number;
  totalDescentKm: number;
  totalFlatKm: number;
  maxGradient: number;
  avgDifficulty: number;
  estimatedTimeHours: number;
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

function classifySegment(avgGradient: number): RouteSegment['type'] {
  const absGrad = Math.abs(avgGradient);
  if (absGrad < 1.5) return 'flat';
  if (avgGradient >= 1.5) return 'climb';
  if (avgGradient <= -1.5) return 'descent';
  return 'rolling';
}

function calcDifficulty(gradient: number, distanceKm: number): number {
  const absGrad = Math.abs(gradient);
  // Climbing difficulty based on gradient and length
  const gradScore = Math.min(absGrad / 15, 1) * 7; // 15% = max difficulty from gradient
  const lengthScore = Math.min(distanceKm / 10, 1) * 3; // 10km climb = max length difficulty
  return Math.min(10, Math.round((gradScore + lengthScore) * 10) / 10);
}

export function analyzeRoute(
  gpsPath: GpsPoint[],
  distanceKm: number,
  avgSpeedKmh = 25
): RouteAnalysis {
  if (!gpsPath || gpsPath.length < 2) {
    return {
      segments: [],
      totalClimbingKm: 0,
      totalDescentKm: 0,
      totalFlatKm: 0,
      maxGradient: 0,
      avgDifficulty: 1,
      estimatedTimeHours: distanceKm / avgSpeedKmh,
    };
  }

  // Calculate cumulative distances
  const cumulativeDistances: number[] = [0];
  for (let i = 1; i < gpsPath.length; i++) {
    const d = haversineDistance(
      gpsPath[i - 1].lat, gpsPath[i - 1].lng,
      gpsPath[i].lat, gpsPath[i].lng
    );
    cumulativeDistances.push(cumulativeDistances[i - 1] + d);
  }

  // Segment the route into ~1km chunks and classify
  const segmentLengthKm = 1;
  const rawSegments: RouteSegment[] = [];
  let segStart = 0;

  for (let i = 1; i < gpsPath.length; i++) {
    const segDist = cumulativeDistances[i] - cumulativeDistances[segStart];
    if (segDist >= segmentLengthKm || i === gpsPath.length - 1) {
      const startElev = gpsPath[segStart].elevation ?? 0;
      const endElev = gpsPath[i].elevation ?? 0;
      const elevChange = endElev - startElev;
      const horizontalDist = segDist * 1000; // meters
      const gradient = horizontalDist > 0 ? (elevChange / horizontalDist) * 100 : 0;

      rawSegments.push({
        startKm: cumulativeDistances[segStart],
        endKm: cumulativeDistances[i],
        startIndex: segStart,
        endIndex: i,
        type: classifySegment(gradient),
        avgGradient: Math.round(gradient * 10) / 10,
        elevationChange: Math.round(elevChange),
        distanceKm: Math.round(segDist * 100) / 100,
        difficulty: calcDifficulty(gradient, segDist),
      });

      segStart = i;
    }
  }

  // Merge adjacent segments of same type
  const segments: RouteSegment[] = [];
  for (const seg of rawSegments) {
    const prev = segments[segments.length - 1];
    if (prev && prev.type === seg.type) {
      prev.endKm = seg.endKm;
      prev.endIndex = seg.endIndex;
      prev.distanceKm = Math.round((prev.distanceKm + seg.distanceKm) * 100) / 100;
      prev.elevationChange += seg.elevationChange;
      const totalDist = prev.distanceKm * 1000;
      prev.avgGradient = totalDist > 0
        ? Math.round((prev.elevationChange / totalDist) * 100 * 10) / 10
        : 0;
      prev.difficulty = calcDifficulty(prev.avgGradient, prev.distanceKm);
    } else {
      segments.push({ ...seg });
    }
  }

  const totalClimbingKm = segments.filter(s => s.type === 'climb').reduce((sum, s) => sum + s.distanceKm, 0);
  const totalDescentKm = segments.filter(s => s.type === 'descent').reduce((sum, s) => sum + s.distanceKm, 0);
  const totalFlatKm = segments.filter(s => s.type === 'flat' || s.type === 'rolling').reduce((sum, s) => sum + s.distanceKm, 0);
  const maxGradient = Math.max(...segments.map(s => Math.abs(s.avgGradient)), 0);
  const avgDifficulty = segments.length > 0
    ? Math.round((segments.reduce((sum, s) => sum + s.difficulty * s.distanceKm, 0) / distanceKm) * 10) / 10
    : 1;

  // Estimate time accounting for climbing
  const baseTimeHours = distanceKm / avgSpeedKmh;
  const climbPenalty = totalClimbingKm * 0.05; // Add ~3 min per km of climbing
  const estimatedTimeHours = baseTimeHours + climbPenalty;

  return {
    segments,
    totalClimbingKm: Math.round(totalClimbingKm * 10) / 10,
    totalDescentKm: Math.round(totalDescentKm * 10) / 10,
    totalFlatKm: Math.round(totalFlatKm * 10) / 10,
    maxGradient: Math.round(maxGradient * 10) / 10,
    avgDifficulty,
    estimatedTimeHours: Math.round(estimatedTimeHours * 100) / 100,
  };
}
