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
  planFuelServings,
  type GutTrainingV2Program,
  type GutTrainingSession,
  type FuelKitItem,
} from './gutTrainingV2';

// Time-native event — duration is the primary input; distance never appears.
const longEvent = { name: 'Comrades Marathon', date: '2026-06-14', durationHours: 8 };

describe('deriveTargetGPerHour (duration-driven)', () => {
  it('gives short efforts the beginner ceiling', () => {
    expect(deriveTargetGPerHour(1.4)).toBe(60); // ≤2h
  });

  it('gives a Comrades-length day the trained ceiling', () => {
    expect(deriveTargetGPerHour(8.2)).toBe(90); // 2–10h
  });

  it('gives very long ultras the elite ceiling', () => {
    expect(deriveTargetGPerHour(14.5)).toBe(120); // >10h
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

describe('suggestCarbTarget (time + effort driven)', () => {
  it('routes through the engine and lands in the 60–90 band for a long day', () => {
    const s = suggestCarbTarget({ durationHours: 8, effortLevel: 6 });
    expect(s.targetGPerHour).toBeGreaterThanOrEqual(60);
    expect(s.targetGPerHour).toBeLessThanOrEqual(90);
    expect(s.durationHours).toBe(8);
    expect(s.intensityPercent).toBeGreaterThan(0);
    expect(s.intensityPercent).toBeLessThanOrEqual(1);
    expect(s.rationale.length).toBeGreaterThan(0);
  });

  it('suggests less for a short race than a long one', () => {
    const short = suggestCarbTarget({ durationHours: 1.4 });
    const long = suggestCarbTarget({ durationHours: 8, effortLevel: 6 });
    expect(short.targetGPerHour).toBeLessThan(long.targetGPerHour);
  });

  it('respects a beginner gut ceiling', () => {
    const s = suggestCarbTarget({ durationHours: 8, gutTolerance: 'beginner' });
    expect(s.targetGPerHour).toBeLessThanOrEqual(60);
  });

  it('higher effort pushes the target up within the same duration', () => {
    const easy = suggestCarbTarget({ durationHours: 8, effortLevel: 3 });
    const hard = suggestCarbTarget({ durationHours: 8, effortLevel: 9 });
    expect(hard.targetGPerHour).toBeGreaterThanOrEqual(easy.targetGPerHour);
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
        event: longEvent,
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
  it('derives the target from the event duration and starts week 1', () => {
    const p = createProgramV2({
      event: longEvent,
      startGPerHour: 60,
      gutHistory: ['bloating-gels'],
      weeksToEvent: 8,
    });
    expect(p.startGPerHour).toBe(60);
    expect(p.targetGPerHour).toBe(90); // 8h → trained ceiling
    expect(p.currentGPerHour).toBe(60);
    expect(p.weekNumber).toBe(1);
    expect(p.event.name).toBe('Comrades Marathon');
    expect(p.event.durationHours).toBe(8);
    expect(p.status).toBe('active');
  });
});

describe('buildSessionPrescription', () => {
  it('breaks the session target down into items that sum to the total', () => {
    const program = createProgramV2({
      event: longEvent,
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
      event: longEvent,
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
        event: longEvent,
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

describe('buildRaceDayPlan (time-native)', () => {
  it('splits the race duration into elapsed-time segments whose grams sum to the total', () => {
    const program = createProgramV2({
      event: longEvent, // 8h
      startGPerHour: 90,
      gutHistory: [],
      weeksToEvent: 8,
    });
    const plan = buildRaceDayPlan(program);
    expect(plan.segments.length).toBeGreaterThanOrEqual(3);
    expect(plan.durationMinutes).toBe(480);
    expect(plan.segments[0].fromMinutes).toBe(0);
    expect(plan.segments[plan.segments.length - 1].toMinutes).toBe(480);
    const sum = plan.segments.reduce((s, seg) => s + seg.grams, 0);
    expect(sum).toBe(plan.totalGrams);
    // No km anywhere on the plan.
    expect(Object.keys(plan.segments[0])).toEqual(['fromMinutes', 'toMinutes', 'grams']);
    // Later segments taper below the flat rate as GI capacity/appetite drop.
    expect(plan.segments[plan.segments.length - 1].grams).toBeLessThan(plan.segments[0].grams);
  });
});

describe('getActiveAlerts', () => {
  const program: GutTrainingV2Program = createProgramV2({
    event: longEvent,
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
