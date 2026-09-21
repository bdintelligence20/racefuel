import { describe, it, expect } from 'vitest';
import { createProgram, recordSession, type GutTrainingProgram } from './gutTraining';

describe('createProgram', () => {
  it('starts at startGPerHour with status active', () => {
    const p = createProgram(40, 90);
    expect(p.currentGPerHour).toBe(40);
    expect(p.startGPerHour).toBe(40);
    expect(p.targetGPerHour).toBe(90);
    expect(p.status).toBe('active');
  });

  it('clamps both bounds to [10, 120]', () => {
    const p = createProgram(0, 500);
    expect(p.startGPerHour).toBe(10);
    expect(p.targetGPerHour).toBe(120);
  });

  it('swaps start/target when target is below start', () => {
    const p = createProgram(90, 40);
    expect(p.startGPerHour).toBe(40);
    expect(p.targetGPerHour).toBe(90);
    expect(p.currentGPerHour).toBe(40);
  });

  it('is immediately completed when start equals target', () => {
    const p = createProgram(60, 60);
    expect(p.status).toBe('completed');
  });
});

describe('recordSession', () => {
  const base: GutTrainingProgram = createProgram(40, 60);

  it('advances when comfort is none and intake met the target', () => {
    const { program, session } = recordSession(base, {
      actualGPerHour: 40,
      durationMinutes: 60,
      gutComfort: 'none',
    });
    expect(session.outcome).toBe('advance');
    expect(session.sessionTargetGPerHour).toBe(40);
    expect(program.currentGPerHour).toBe(45); // +stepGPerHour
    expect(program.status).toBe('active');
  });

  it('advances when comfort is mild and intake was close (>= 90%) to target', () => {
    const { session } = recordSession(base, {
      actualGPerHour: 37, // 92.5% of 40
      durationMinutes: 60,
      gutComfort: 'mild',
    });
    expect(session.outcome).toBe('advance');
  });

  it('holds when comfort is none/mild but intake fell well short of target', () => {
    const { program, session } = recordSession(base, {
      actualGPerHour: 20, // 50% of 40 — under-fueled, not evidence of tolerance
      durationMinutes: 60,
      gutComfort: 'none',
    });
    expect(session.outcome).toBe('hold');
    expect(program.currentGPerHour).toBe(base.currentGPerHour);
  });

  it('holds when comfort is moderate regardless of intake', () => {
    const { program, session } = recordSession(base, {
      actualGPerHour: 40,
      durationMinutes: 60,
      gutComfort: 'moderate',
    });
    expect(session.outcome).toBe('hold');
    expect(program.currentGPerHour).toBe(base.currentGPerHour);
  });

  it('backs off when comfort is severe, floored at startGPerHour', () => {
    const nearStart = createProgram(40, 60); // currentGPerHour === 40 === start
    const { program, session } = recordSession(nearStart, {
      actualGPerHour: 40,
      durationMinutes: 60,
      gutComfort: 'severe',
    });
    expect(session.outcome).toBe('back-off');
    expect(program.currentGPerHour).toBe(40); // can't drop below startGPerHour
  });

  it('backs off from mid-program without going below start', () => {
    const mid = { ...createProgram(40, 60), currentGPerHour: 42 };
    const { program } = recordSession(mid, {
      actualGPerHour: 42,
      durationMinutes: 60,
      gutComfort: 'severe',
    });
    expect(program.currentGPerHour).toBe(40); // 42 - 5 = 37, floored to start (40)
  });

  it('never advances currentGPerHour past targetGPerHour and flips to completed', () => {
    const almostDone = { ...createProgram(40, 60), currentGPerHour: 58 };
    const { program, session } = recordSession(almostDone, {
      actualGPerHour: 58,
      durationMinutes: 60,
      gutComfort: 'none',
    });
    expect(session.outcome).toBe('advance');
    expect(program.currentGPerHour).toBe(60); // capped at target, not 63
    expect(program.status).toBe('completed');
  });

  it('does not mutate the input program', () => {
    const snapshot = { ...base };
    recordSession(base, { actualGPerHour: 40, durationMinutes: 60, gutComfort: 'none' });
    expect(base).toEqual(snapshot);
  });
});
