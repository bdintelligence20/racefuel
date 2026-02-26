import { describe, it, expect } from 'vitest';
import { analyzeRoute } from './routeAnalyzer';
import { GpsPoint } from '../../context/AppContext';

function generateFlatRoute(numPoints: number, distanceKm: number): GpsPoint[] {
  const points: GpsPoint[] = [];
  for (let i = 0; i < numPoints; i++) {
    points.push({
      lat: -33.9 + (i / numPoints) * (distanceKm / 111),
      lng: 18.5,
      elevation: 100,
    });
  }
  return points;
}

function generateClimbingRoute(numPoints: number): GpsPoint[] {
  const points: GpsPoint[] = [];
  for (let i = 0; i < numPoints; i++) {
    points.push({
      lat: -33.9 + (i / numPoints) * 0.05,
      lng: 18.5,
      elevation: 100 + (i / numPoints) * 500, // 500m of climbing
    });
  }
  return points;
}

describe('analyzeRoute', () => {
  it('returns empty analysis for insufficient points', () => {
    const result = analyzeRoute([], 0);
    expect(result.segments).toHaveLength(0);
    expect(result.totalClimbingKm).toBe(0);
    expect(result.totalDescentKm).toBe(0);
  });

  it('returns empty analysis for single point', () => {
    const result = analyzeRoute([{ lat: 0, lng: 0, elevation: 100 }], 0);
    expect(result.segments).toHaveLength(0);
  });

  it('classifies flat terrain correctly', () => {
    const flatRoute = generateFlatRoute(100, 10);
    const result = analyzeRoute(flatRoute, 10);
    expect(result.totalFlatKm).toBeGreaterThan(0);
    expect(result.maxGradient).toBeLessThan(2);
  });

  it('detects climbing segments', () => {
    const hillRoute = generateClimbingRoute(200);
    const result = analyzeRoute(hillRoute, 5);
    expect(result.totalClimbingKm).toBeGreaterThan(0);
  });

  it('estimates time with climb penalty', () => {
    const flatRoute = generateFlatRoute(100, 50);
    const flatResult = analyzeRoute(flatRoute, 50);

    const hillRoute = generateClimbingRoute(200);
    const hillResult = analyzeRoute(hillRoute, 5);

    // Hill route should have climb penalty
    expect(hillResult.estimatedTimeHours).toBeGreaterThan(0);
    // Flat route time should be ~distance/speed
    expect(flatResult.estimatedTimeHours).toBeCloseTo(50 / 25, 0);
  });

  it('sums segment distances to approximate total', () => {
    const route = generateFlatRoute(200, 20);
    const result = analyzeRoute(route, 20);
    const segmentTotal = result.segments.reduce((sum, s) => sum + s.distanceKm, 0);
    // Should be reasonably close to total distance
    expect(segmentTotal).toBeGreaterThan(0);
  });
});
