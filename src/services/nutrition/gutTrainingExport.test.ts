import { describe, it, expect } from 'vitest';
import { createProgramV2, buildRaceDayPlan, buildSessionPrescription } from './gutTrainingV2';
import { raceDayCues, sessionCues, buildWorkoutTcx, buildFuelCuesGpx } from './gutTrainingExport';

function makeProgram() {
  return createProgramV2({
    // duration is the primary input; lat/lng kept for GPX geo, distance omitted.
    event: { name: 'Comrades Marathon', date: '2026-06-14', durationHours: 8, discipline: 'road-run', terrain: 'hilly', elevationGainM: 1600, lat: -29.7, lng: 30.7 },
    startGPerHour: 60,
    gutHistory: [],
    weeksToEvent: 8,
    targetGPerHour: 85,
  });
}

describe('raceDayCues', () => {
  it('is time-native: first cue at minute 0, minutes increase, no distance', () => {
    const program = makeProgram();
    const cues = raceDayCues(program, buildRaceDayPlan(program));
    expect(cues[0].atMinutes).toBe(0);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].atMinutes).toBeGreaterThan(cues[i - 1].atMinutes);
    }
    // Cues carry no distance; labels are clock times, not km.
    expect(cues.every((c) => c.distanceKm === undefined)).toBe(true);
    expect(cues.every((c) => !/km/i.test(c.label) && !/km/i.test(c.detail))).toBe(true);
  });
});

describe('sessionCues', () => {
  it('places cues on the clock across the run', () => {
    const program = makeProgram();
    const rx = buildSessionPrescription(program, 150);
    const cues = sessionCues(rx);
    expect(cues[0].atMinutes).toBe(0);
    expect(cues[cues.length - 1].atMinutes).toBeGreaterThan(0);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].atMinutes).toBeGreaterThanOrEqual(cues[i - 1].atMinutes);
    }
  });
});

describe('buildWorkoutTcx', () => {
  it('produces a time-stepped TCX workout', () => {
    const program = makeProgram();
    const cues = raceDayCues(program, buildRaceDayPlan(program));
    const tcx = buildWorkoutTcx('Comrades fuel', 'Running', cues);
    expect(tcx).toContain('<TrainingCenterDatabase');
    expect(tcx).toContain('Sport="Running"');
    expect(tcx).toContain('<Duration xsi:type="Time_t">');
    expect(tcx).toContain('<Seconds>');
    // one step per cue
    expect((tcx.match(/<Step /g) ?? []).length).toBe(cues.length);
  });
});

describe('buildFuelCuesGpx', () => {
  it('stamps each waypoint with a time and keeps them as waypoints only', () => {
    const program = makeProgram();
    const cues = raceDayCues(program, buildRaceDayPlan(program));
    const base = new Date('2026-06-14T06:00:00Z').getTime();
    const gpx = buildFuelCuesGpx('Comrades fuel cues', -29.7, 30.7, cues, 'Race day', base);
    expect(gpx).toContain('<wpt ');
    expect(gpx).toContain('<time>');
    expect(gpx).not.toContain('<rte>');
    expect(gpx).not.toContain('<trk>');
    expect((gpx.match(/<wpt /g) ?? []).length).toBe(cues.length);
  });
});
