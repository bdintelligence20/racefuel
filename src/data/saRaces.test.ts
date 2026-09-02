import { describe, it, expect } from 'vitest';
import { SA_RACES, nextOccurrence, upcomingRaces, searchRaces } from './saRaces';

describe('nextOccurrence', () => {
  const comrades = SA_RACES.find((r) => r.id === 'comrades')!;

  it('returns this year when the race month is still ahead', () => {
    const d = nextOccurrence(comrades, new Date('2026-01-01'));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
  });

  it('rolls to next year when the race month has passed', () => {
    const d = nextOccurrence(comrades, new Date('2026-07-01'));
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(5);
  });

  it('counts a race happening today as the next occurrence (not next year)', () => {
    const d = nextOccurrence(comrades, new Date('2026-06-08T09:00:00'));
    expect(d.getFullYear()).toBe(2026);
  });
});

describe('upcomingRaces', () => {
  it('returns every race within the coming year, soonest first', () => {
    const from = new Date('2026-01-01');
    const list = upcomingRaces(365, from);
    expect(list.length).toBe(SA_RACES.length); // annual events all recur within a year
    for (let i = 1; i < list.length; i++) {
      expect(list[i].date.getTime()).toBeGreaterThanOrEqual(list[i - 1].date.getTime());
    }
    const cutoff = new Date(from.getTime() + 365 * 86_400_000);
    expect(list.every((r) => r.date <= cutoff)).toBe(true);
  });
});

describe('searchRaces', () => {
  it('finds a race by name', () => {
    const results = searchRaces('comrades', undefined, new Date('2026-01-01'));
    expect(results.some((r) => r.id === 'comrades')).toBe(true);
  });

  it('filters by discipline', () => {
    const results = searchRaces('', 'gravel', new Date('2026-01-01'));
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.discipline === 'gravel')).toBe(true);
  });

  it('covers all five disciplines in the catalog', () => {
    const disciplines = new Set(SA_RACES.map((r) => r.discipline));
    expect(disciplines).toEqual(new Set(['road-run', 'trail-run', 'road-cycle', 'mtb', 'gravel']));
  });
});
