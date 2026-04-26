import { describe, expect, it } from 'vitest';
import { estimateRouteTime } from './timeEstimator';

describe('estimateRouteTime', () => {
  it('28 km road run lands in a believable 2:00–3:30 window (was 51 min on the old flat 25 km/h)', () => {
    const { hours } = estimateRouteTime({
      distanceKm: 28,
      elevationGainM: 200,
      sport: 'run',
      surface: 'road',
    });
    expect(hours).toBeGreaterThan(2);
    expect(hours).toBeLessThan(3.5);
  });

  it('176 km mountain ultra blows past 20 hours (was 6:53 on the old flat 25 km/h)', () => {
    const { hours } = estimateRouteTime({
      distanceKm: 176,
      elevationGainM: 10000,
      sport: 'run',
      surface: 'mountain',
    });
    // UTMB winners do it in ~20h, mid-packers ~30h, cutoff is 46.5h. The
    // unweighted mountain pace + Naismith puts a casual runner at 50-60h
    // which is plausible for someone who'd be cut off — fine, just not 6:53.
    expect(hours).toBeGreaterThan(20);
    expect(hours).toBeLessThan(70);
  });

  it('10 km road run is roughly 45–80 min', () => {
    const { hours } = estimateRouteTime({
      distanceKm: 10,
      elevationGainM: 50,
      sport: 'run',
      surface: 'road',
    });
    expect(hours * 60).toBeGreaterThan(45);
    expect(hours * 60).toBeLessThan(80);
  });

  it('switching sport=hike on a mountain route pushes time higher than sport=run', () => {
    const input = {
      distanceKm: 50,
      elevationGainM: 2500,
      surface: 'mountain' as const,
    };
    const runHours = estimateRouteTime({ ...input, sport: 'run' }).hours;
    const hikeHours = estimateRouteTime({ ...input, sport: 'hike' }).hours;
    expect(hikeHours).toBeGreaterThan(runHours);
  });

  it('higher elevation gain on the same distance increases time (naismith floor)', () => {
    const flat = estimateRouteTime({ distanceKm: 30, elevationGainM: 0, sport: 'run' }).hours;
    const hilly = estimateRouteTime({ distanceKm: 30, elevationGainM: 1500, sport: 'run' }).hours;
    expect(hilly).toBeGreaterThan(flat);
  });

  it('effortLevel 1 (easy day) is slower than effortLevel 9 (race) on the same route', () => {
    const easy = estimateRouteTime({ distanceKm: 20, elevationGainM: 0, sport: 'run', effortLevel: 1 }).hours;
    const race = estimateRouteTime({ distanceKm: 20, elevationGainM: 0, sport: 'run', effortLevel: 9 }).hours;
    expect(easy).toBeGreaterThan(race);
  });

  it('zero distance returns zero hours without throwing', () => {
    const { hours } = estimateRouteTime({ distanceKm: 0, elevationGainM: 0 });
    expect(hours).toBe(0);
  });

  it('cycling with high distance produces sensible hours (no Tobler explosion)', () => {
    const { hours } = estimateRouteTime({
      distanceKm: 100,
      elevationGainM: 1500,
      sport: 'cycle',
      surface: 'road',
    });
    expect(hours).toBeGreaterThan(2.5);
    expect(hours).toBeLessThan(7);
  });
});
