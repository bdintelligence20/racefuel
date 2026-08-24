import { describe, it, expect } from 'vitest';
import {
  deriveTargetGPerHour,
  buildRealismNote,
  createProgramV2,
  buildSessionPrescription,
  recordSessionV2,
  computeMilestoneStats,
  buildRaceDayPlan,
  getActiveAlerts,
  toGutComfort,
  fromGutComfort,
  suggestCarbTarget,
  estimateRaceDurationHours,
  estimateRaceIntensity,
  planFuelServings,
  type GutTrainingV2Program,
  type GutTrainingSession,
  type FuelKitItem,
} from './gutTrainingV2';

describe('deriveTargetGPerHour', () => {
  it('gives short efforts the beginner ceiling', () => {
    expect(deriveTargetGPerHour(15, 'running')).toBe(60); // ~1.4h
  });

  it('gives a Comrades-length ultra the trained ceiling', () => {
    expect(deriveTargetGPerHour(90, 'running')).toBe(90); // 90/11 ≈ 8.2h
  });

  it('gives very long ultras the elite ceiling', () => {
    expect(deriveTargetGPerHour(160, 'running')).toBe(120); // 160/11 ≈ 14.5h
  });

  it('accounts for cycling being faster than running', () => {
    // 90km at 28km/h ≈ 3.2h — well inside the trained tier, same as running's Comrades case.
    expect(deriveTargetGPerHour(90, 'cycling')).toBe(90);
  });
});

describe('buildRealismNote', () => {
  it('is comfortable when the required weekly step is within the engine step', () => {
    const r = buildRealismNote(60, 90, 8, 5); // needs 3.75 g/h/week, step is 5
    expect(r.level).toBe('comfortable');
    expect(r.note).toContain('realistic');
  });

  it('is tight when the required step exceeds the engine step but not by much', () => {
    const r = buildRealismNote(60, 90, 5, 5); // needs 6 g/h/week vs step 5 (1.2x)
    expect(r.level).toBe('tight');
  });

  it('is aggressive when the required step far exceeds the engine step', () => {
    const r = buildRealismNote(60, 120, 4, 5); // needs 15 g/h/week vs step 5 (3x)
    expect(r.level).toBe('aggressive');
  });

  it('is aggressive when there are zero or negative weeks to the event', () => {
    const r = buildRealismNote(60, 90, 0, 5);
    expect(r.level).toBe('aggressive');
  });
});

describe('estimateRaceDurationHours', () => {
  it('is shorter for cycling than running over the same distance', () => {
    const run = estimateRaceDurationHours(90, 'road-run');
    const ride = estimateRaceDurationHours(90, 'road-cycle');
    expect(ride).toBeLessThan(run);
  });

  it('adds time for climbing', () => {
    const flat = estimateRaceDurationHours(42, 'trail-run', 0);
    const climby = estimateRaceDurationHours(42, 'trail-run', 2600);
    expect(climby).toBeGreaterThan(flat);
  });
});

describe('estimateRaceIntensity', () => {
  it('sits lower for longer efforts and higher on mountainous terrain', () => {
    expect(estimateRaceIntensity(1, 'flat')).toBeGreaterThan(estimateRaceIntensity(8, 'flat'));
    expect(estimateRaceIntensity(8, 'mountainous')).toBeGreaterThan(estimateRaceIntensity(8, 'flat'));
  });

  it('never exceeds the 0.85 cap', () => {
    expect(estimateRaceIntensity(0.5, 'mountainous')).toBeLessThanOrEqual(0.85);
  });
});

describe('suggestCarbTarget', () => {
  it('routes through the engine and lands in the 60–90 band for a long ultra', () => {
    const s = suggestCarbTarget({ distanceKm: 90, discipline: 'road-run', elevationGainM: 1600, terrain: 'hilly' });
    expect(s.targetGPerHour).toBeGreaterThanOrEqual(60);
    expect(s.targetGPerHour).toBeLessThanOrEqual(90);
    expect(s.durationHours).toBeGreaterThan(3);
    expect(s.intensityPercent).toBeGreaterThan(0);
    expect(s.intensityPercent).toBeLessThanOrEqual(0.85);
    expect(s.rationale.length).toBeGreaterThan(0);
  });

  it('suggests less for a short race than a long one', () => {
    const short = suggestCarbTarget({ distanceKm: 15, discipline: 'road-run' });
    const long = suggestCarbTarget({ distanceKm: 90, discipline: 'road-run', elevationGainM: 1600, terrain: 'hilly' });
    expect(short.targetGPerHour).toBeLessThan(long.targetGPerHour);
  });

  it('respects a beginner gut ceiling', () => {
    const s = suggestCarbTarget({ distanceKm: 90, discipline: 'road-run', gutTolerance: 'beginner' });
    expect(s.targetGPerHour).toBeLessThanOrEqual(60);
  });
});

describe('planFuelServings', () => {
  const drink: FuelKitItem = { productId: 'd', brand: '32Gi', name: 'Endure', category: 'drink', carbs: 36 };
  const gel: FuelKitItem = { productId: 'g', brand: '32Gi', name: 'Race Gel', category: 'gel', carbs: 25 };
  const chew: FuelKitItem = { productId: 'c', brand: 'GU', name: 'Chews', category: 'chew', carbs: 24 };

  it('uses the drink as the hourly base and fills the rest with solids', () => {
    const { servings, totalGrams } = planFuelServings(90, 3, [drink, gel]);
    const d = servings.find((s) => s.item.productId === 'd');
    const g = servings.find((s) => s.item.productId === 'g');
    expect(d?.count).toBe(3); // one drink per hour over 3 hours
    expect(g && g.count).toBeGreaterThan(0);
    expect(totalGrams).toBeGreaterThan(0);
  });

  it('returns whole servings only', () => {
    const { servings } = planFuelServings(85, 2.5, [drink, gel, chew]);
    for (const s of servings) expect(Number.isInteger(s.count)).toBe(true);
  });

  it('still plans something when the kit is solids only', () => {
    const { servings, totalGrams } = planFuelServings(60, 2, [gel]);
    expect(servings.length).toBeGreaterThan(0);
    expect(totalGrams).toBeGreaterThan(0);
  });

  it('feeds the session prescription real product labels when a kit is set', () => {
    const program: GutTrainingV2Program = {
      ...createProgramV2({
        event: { name: 'Comrades', date: '2026-06-14', distanceKm: 90 },
        startGPerHour: 60, gutHistory: [], weeksToEvent: 8, targetGPerHour: 85,
      }),
      currentGPerHour: 80,
      fuelKit: [drink, gel],
    };
    const rx = buildSessionPrescription(program, 150);
    expect(rx.items.some((i) => i.label.includes('32Gi'))).toBe(true);
    expect(rx.items.every((i) => i.timeLabel.startsWith('x'))).toBe(true);
  });
});

describe('createProgramV2', () => {
  it('derives the target from the event and starts week 1', () => {
    const p = createProgramV2({
      event: { name: 'Comrades Marathon', date: '2026-06-14', distanceKm: 90 },
      startGPerHour: 60,
      gutHistory: ['bloating-gels'],
      weeksToEvent: 8,
    });
    expect(p.startGPerHour).toBe(60);
    expect(p.targetGPerHour).toBe(90);
    expect(p.currentGPerHour).toBe(60);
    expect(p.weekNumber).toBe(1);
    expect(p.event.name).toBe('Comrades Marathon');
    expect(p.status).toBe('active');
  });
});

describe('buildSessionPrescription', () => {
  it('breaks the session target down into items that sum to the total', () => {
    const program = createProgramV2({
      event: { name: 'Comrades Marathon', date: '2026-06-14', distanceKm: 90 },
      startGPerHour: 85,
      gutHistory: [],
      weeksToEvent: 8,
    });
    const rx = buildSessionPrescription(program, 150); // 2.5h
    const sum = rx.items.reduce((s, i) => s + i.grams, 0);
    expect(sum).toBe(rx.totalGrams);
    expect(rx.totalGrams).toBe(Math.round(85 * 2.5));
    expect(rx.items[0].label).toBe('500ml mix');
  });
});

describe('recordSessionV2', () => {
  it('advances the week pointer and reuses v1 advance/hold/back-off logic', () => {
    const program = createProgramV2({
      event: { name: 'Comrades Marathon', date: '2026-06-14', distanceKm: 90 },
      startGPerHour: 60,
      gutHistory: [],
      weeksToEvent: 8,
    });
    const { program: updated, session } = recordSessionV2(program, {
      actualGPerHour: 60,
      durationMinutes: 150,
      gutComfort: toGutComfort('clean'),
    });
    expect(session.outcome).toBe('advance');
    expect(updated.weekNumber).toBe(2);
    expect(updated.currentGPerHour).toBeGreaterThan(program.currentGPerHour);
  });
});

describe('gut response mapping', () => {
  it('round-trips clean/mild, and collapses moderate into rough', () => {
    expect(toGutComfort('clean')).toBe('none');
    expect(toGutComfort('mild')).toBe('mild');
    expect(toGutComfort('rough')).toBe('severe');
    expect(fromGutComfort('none')).toBe('clean');
    expect(fromGutComfort('mild')).toBe('mild');
    expect(fromGutComfort('severe')).toBe('rough');
    expect(fromGutComfort('moderate')).toBe('rough');
  });
});

describe('computeMilestoneStats', () => {
  it('summarises weeks elapsed, session count, and clean rate', () => {
    const program: GutTrainingV2Program = {
      ...createProgramV2({
        event: { name: 'Comrades Marathon', date: '2026-06-14', distanceKm: 90 },
        startGPerHour: 60,
        gutHistory: [],
        weeksToEvent: 8,
      }),
      weekNumber: 9,
      currentGPerHour: 90,
    };
    const sessions: GutTrainingSession[] = [
      { sessionTargetGPerHour: 60, actualGPerHour: 60, durationMinutes: 90, gutComfort: 'none', outcome: 'advance', createdAt: '2026-01-01' },
      { sessionTargetGPerHour: 65, actualGPerHour: 40, durationMinutes: 90, gutComfort: 'none', outcome: 'hold', createdAt: '2026-01-08' },
    ];
    const stats = computeMilestoneStats(program, sessions);
    expect(stats.weeksElapsed).toBe(8);
    expect(stats.sessionsCount).toBe(2);
    expect(stats.gPerHour).toBe(90);
    expect(stats.cleanPercent).toBe(100); // both sessions logged gutComfort 'none'
  });
});

describe('buildRaceDayPlan', () => {
  it('splits the course into segments whose grams sum to the total', () => {
    const program = createProgramV2({
      event: { name: 'Comrades Marathon', date: '2026-06-14', distanceKm: 90 },
      startGPerHour: 90,
      gutHistory: [],
      weeksToEvent: 8,
    });
    const plan = buildRaceDayPlan(program);
    expect(plan.segments.length).toBeGreaterThanOrEqual(3);
    expect(plan.segments[0].fromKm).toBe(0);
    expect(plan.segments[plan.segments.length - 1].toKm).toBe(90);
    const sum = plan.segments.reduce((s, seg) => s + seg.grams, 0);
    expect(sum).toBe(plan.totalGrams);
    // Later segments taper below the flat rate as GI capacity/appetite drop.
    expect(plan.segments[plan.segments.length - 1].grams).toBeLessThan(plan.segments[0].grams);
  });
});

describe('getActiveAlerts', () => {
  const program: GutTrainingV2Program = createProgramV2({
    event: { name: 'Comrades Marathon', date: '2026-06-14', distanceKm: 90 },
    startGPerHour: 60,
    gutHistory: [],
    weeksToEvent: 8,
  });

  it('raises a behind-plan alert when the latest session fell well short', () => {
    const sessions: GutTrainingSession[] = [
      { sessionTargetGPerHour: 90, actualGPerHour: 62, durationMinutes: 90, gutComfort: 'none', outcome: 'hold', createdAt: '2026-01-08' },
    ];
    const alerts = getActiveAlerts(program, sessions);
    expect(alerts.some((a) => a.type === 'behind-plan')).toBe(true);
  });

  it('raises a rough-sessions alert when 2 of the last 3 came back rough', () => {
    const sessions: GutTrainingSession[] = [
      { sessionTargetGPerHour: 80, actualGPerHour: 80, durationMinutes: 90, gutComfort: 'severe', outcome: 'back-off', createdAt: '2026-01-15' },
      { sessionTargetGPerHour: 80, actualGPerHour: 80, durationMinutes: 90, gutComfort: 'none', outcome: 'advance', createdAt: '2026-01-08' },
      { sessionTargetGPerHour: 75, actualGPerHour: 75, durationMinutes: 90, gutComfort: 'severe', outcome: 'back-off', createdAt: '2026-01-01' },
    ];
    const alerts = getActiveAlerts(program, sessions);
    expect(alerts.some((a) => a.type === 'rough-sessions')).toBe(true);
  });

  it('raises nothing for a clean, on-plan session', () => {
    const sessions: GutTrainingSession[] = [
      { sessionTargetGPerHour: 60, actualGPerHour: 60, durationMinutes: 90, gutComfort: 'none', outcome: 'advance', createdAt: '2026-01-08' },
    ];
    expect(getActiveAlerts(program, sessions)).toEqual([]);
  });
});
