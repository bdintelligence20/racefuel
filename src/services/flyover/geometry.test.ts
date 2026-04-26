import { describe, it, expect } from 'vitest';
import {
  haversineKm,
  buildCumDist,
  sampleAt,
  bearingDeg,
  lerpAngle,
  normalizeAzimuth,
  computeForwardBearing,
  destinationPoint,
} from './geometry';

describe('haversineKm', () => {
  it('returns ~0 for identical points', () => {
    const p = { lat: -33.9249, lng: 18.4241 };
    expect(haversineKm(p, p)).toBeCloseTo(0, 6);
  });

  it('returns ~111km for 1° latitude apart at the equator', () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 1, lng: 0 };
    expect(haversineKm(a, b)).toBeCloseTo(111.19, 1);
  });

  it('is symmetric', () => {
    const a = { lat: 51.5, lng: -0.13 };   // London
    const b = { lat: 48.86, lng: 2.35 };   // Paris
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe('buildCumDist', () => {
  it('starts at 0 and is non-decreasing', () => {
    const path = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 1, lng: 1 },
      { lat: 1, lng: 0 },
    ];
    const { cumDistKm, totalDistKm } = buildCumDist(path);
    expect(cumDistKm[0]).toBe(0);
    for (let i = 1; i < cumDistKm.length; i++) {
      expect(cumDistKm[i]).toBeGreaterThanOrEqual(cumDistKm[i - 1]);
    }
    expect(totalDistKm).toBe(cumDistKm[cumDistKm.length - 1]);
  });

  it('returns total 0 for a single-point path', () => {
    const { cumDistKm, totalDistKm } = buildCumDist([{ lat: 10, lng: 10 }]);
    expect(cumDistKm).toEqual([0]);
    expect(totalDistKm).toBe(0);
  });
});

describe('sampleAt', () => {
  const path = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 0, lng: 2 },
  ];
  const { cumDistKm, totalDistKm } = buildCumDist(path);

  it('clamps to start when targetKm <= 0', () => {
    expect(sampleAt(path, cumDistKm, -10)).toEqual({ lng: 0, lat: 0, index: 0 });
    expect(sampleAt(path, cumDistKm, 0)).toEqual({ lng: 0, lat: 0, index: 0 });
  });

  it('clamps to end when targetKm >= total', () => {
    const out = sampleAt(path, cumDistKm, totalDistKm + 100);
    expect(out.lng).toBeCloseTo(2, 6);
    expect(out.lat).toBeCloseTo(0, 6);
    expect(out.index).toBe(path.length - 1);
  });

  it('interpolates between vertices', () => {
    // At exactly half the total distance, on this equator-aligned path, lng should be ~1.
    const out = sampleAt(path, cumDistKm, totalDistKm / 2);
    expect(out.lng).toBeCloseTo(1, 4);
    expect(out.lat).toBeCloseTo(0, 6);
  });
});

describe('bearingDeg', () => {
  it('is 0 for due north', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 5);
  });
  it('is 90 for due east', () => {
    expect(bearingDeg({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 5);
  });
  it('is 180 for due south', () => {
    expect(bearingDeg({ lat: 1, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(180, 5);
  });
  it('is 270 for due west', () => {
    expect(bearingDeg({ lat: 0, lng: 1 }, { lat: 0, lng: 0 })).toBeCloseTo(270, 5);
  });
  it('always returns [0, 360)', () => {
    const cases = [
      [{ lat: 0, lng: 0 }, { lat: -1, lng: -1 }],
      [{ lat: 45, lng: 45 }, { lat: -45, lng: -135 }],
    ] as const;
    for (const [a, b] of cases) {
      const v = bearingDeg(a, b);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });
});

describe('lerpAngle', () => {
  it('returns from when t=0', () => {
    expect(lerpAngle(123, 45, 0)).toBeCloseTo(123, 6);
  });
  it('returns to when t=1', () => {
    expect(lerpAngle(123, 45, 1)).toBeCloseTo(45, 6);
  });
  it('takes the short way around (350° → 10° passes through 0°)', () => {
    const half = lerpAngle(350, 10, 0.5);
    // Short-arc midpoint is 0° (i.e. 360°), not 180°. Either representation is valid.
    const distFromZero = Math.min(Math.abs(half - 0), Math.abs(half - 360));
    expect(distFromZero).toBeLessThan(0.01);
  });
  it('always returns [0, 360)', () => {
    for (let i = 0; i < 50; i++) {
      const from = Math.random() * 720 - 360;
      const to = Math.random() * 720 - 360;
      const t = Math.random();
      const v = lerpAngle(from, to, t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });
});

describe('computeForwardBearing', () => {
  it('returns ~90° for a path heading due east', () => {
    const path = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
      { lat: 0, lng: 2 },
      { lat: 0, lng: 3 },
    ];
    const { cumDistKm, totalDistKm } = buildCumDist(path);
    const b = computeForwardBearing(path, cumDistKm, totalDistKm, 0, 50, 6, null);
    expect(b).toBeCloseTo(90, 1);
  });

  it('averages out per-sample noise (zigzag still resolves to overall direction)', () => {
    // Path zigzags east+north, but overall heading is east-north-east.
    const path = [];
    for (let i = 0; i <= 10; i++) {
      path.push({ lat: i * 0.01 + (i % 2) * 0.005, lng: i * 0.02 });
    }
    const { cumDistKm, totalDistKm } = buildCumDist(path);
    const b = computeForwardBearing(path, cumDistKm, totalDistKm, 0, totalDistKm, 6, null);
    // Pure east is 90°; pure north is 0°. Roughly east-north-east → somewhere near 60°.
    expect(b).toBeGreaterThan(40);
    expect(b).toBeLessThan(80);
  });

  it('returns fallback at the very end of the route', () => {
    const path = [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }];
    const { cumDistKm, totalDistKm } = buildCumDist(path);
    expect(computeForwardBearing(path, cumDistKm, totalDistKm, totalDistKm, 0.5, 6, 123)).toBe(123);
    expect(computeForwardBearing(path, cumDistKm, totalDistKm, totalDistKm, 0.5, 6, null)).toBe(0);
  });

  it('always returns [0, 360)', () => {
    const path = [];
    for (let i = 0; i < 20; i++) {
      path.push({ lat: Math.random() * 0.5, lng: Math.random() * 0.5 });
    }
    const { cumDistKm, totalDistKm } = buildCumDist(path);
    for (let s = 0; s < 10; s++) {
      const fromKm = Math.random() * totalDistKm;
      const v = computeForwardBearing(path, cumDistKm, totalDistKm, fromKm, 1, 6, null);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });
});

describe('destinationPoint', () => {
  it('moves ~1° east when projecting 111km east at the equator', () => {
    const out = destinationPoint(0, 0, 111.19, 90);
    expect(out.lat).toBeCloseTo(0, 4);
    expect(out.lng).toBeCloseTo(1, 2);
  });
  it('moves ~1° north when projecting 111km north', () => {
    const out = destinationPoint(0, 0, 111.19, 0);
    expect(out.lat).toBeCloseTo(1, 2);
    expect(out.lng).toBeCloseTo(0, 4);
  });
  it('haversine round-trip: project then haversine ~= original distance', () => {
    const start = { lat: -33.9249, lng: 18.4241 };
    const out = destinationPoint(start.lng, start.lat, 0.3, 47);
    const back = haversineKm(start, out);
    expect(back).toBeCloseTo(0.3, 3);
  });
});

describe('normalizeAzimuth', () => {
  // Regression: Mapbox sky-atmosphere-sun rejects values outside [0, 360]. The flyover
  // sets sun azimuth = bearing + 90, which can exceed 360 for any bearing > 270.
  it('wraps values above 360', () => {
    expect(normalizeAzimuth(361)).toBeCloseTo(1, 6);
    expect(normalizeAzimuth(443.56)).toBeCloseTo(83.56, 2);
    expect(normalizeAzimuth(720)).toBeCloseTo(0, 6);
  });
  it('wraps negative values', () => {
    expect(normalizeAzimuth(-1)).toBeCloseTo(359, 6);
    expect(normalizeAzimuth(-90)).toBeCloseTo(270, 6);
  });
  it('passes through values already in range', () => {
    expect(normalizeAzimuth(0)).toBe(0);
    expect(normalizeAzimuth(180)).toBe(180);
    expect(normalizeAzimuth(359.999)).toBeCloseTo(359.999, 3);
  });
  it('always returns [0, 360)', () => {
    for (let i = 0; i < 100; i++) {
      const v = normalizeAzimuth(Math.random() * 2000 - 1000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });
});
