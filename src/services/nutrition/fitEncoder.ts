/**
 * FIT encoders for watch export, built on the official Garmin FIT SDK
 * (@garmin/fitsdk). Two shapes:
 *
 *   Workout  a sequence of timed steps — the watch beeps at each fuel cue on
 *            the clock. Works with or without a route, so it is the default
 *            for time-based gut-training runs.
 *   Course   the route track plus a Food / Sports-drink course point at each
 *            fuel stop — the watch navigates the route and prompts by
 *            location. Used when a real route (polyline) exists.
 *
 * Verified by a decode round-trip (Decoder.checkIntegrity) before shipping.
 * Enum fields take their profile string names; dates take JS Date; positions
 * are converted to semicircles here (the profile stores them raw).
 */
// The SDK ships no first-party types; treat its surface as loose.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- no bundled type declarations
import { Encoder, Profile } from '@garmin/fitsdk';

const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;
const toSemicircles = (deg: number): number => Math.round(deg * SEMICIRCLES_PER_DEGREE);

export type FitSport = 'running' | 'cycling' | 'generic';

/** Garmin course-point type for a fuel/hydration stop. */
export type FuelPointType = 'energyGel' | 'sportsDrink' | 'food' | 'water' | 'generic';

export interface FitWorkoutCue {
  /** Minutes from the start of the effort when this cue fires. */
  atMinutes: number;
  /** What to take, e.g. "Gel 25g". */
  label: string;
}

export interface FitTrackPoint {
  lat: number;
  lng: number;
  /** Cumulative distance from the start, metres. */
  distanceM: number;
  altitudeM?: number;
  /** Elapsed seconds from the start, for the record timestamp. */
  elapsedS?: number;
}

export interface FitCoursePoint {
  lat: number;
  lng: number;
  distanceM: number;
  type: FuelPointType;
  name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A workout of timed steps: the device beeps at each fuel cue on the clock. */
export function encodeWorkoutFit(name: string, sport: FitSport, cues: FitWorkoutCue[]): Uint8Array {
  const sorted = [...cues].sort((a, b) => a.atMinutes - b.atMinutes);
  const enc: any = new Encoder();

  enc.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: 'workout', manufacturer: 'development', product: 0, serialNumber: 0, timeCreated: new Date(),
  });
  enc.writeMesg({
    mesgNum: Profile.MesgNum.WORKOUT,
    sport, subSport: 'generic', wktName: name.slice(0, 60), numValidSteps: Math.max(1, sorted.length),
  });

  sorted.forEach((cue, i) => {
    const next = sorted[i + 1];
    const step: Record<string, unknown> = {
      mesgNum: Profile.MesgNum.WORKOUT_STEP,
      messageIndex: i,
      wktStepName: cue.label.slice(0, 60),
      targetType: 'open',
      targetValue: 0,
      intensity: 'active',
      notes: cue.label.slice(0, 100),
    };
    if (next) {
      step.durationType = 'time';
      // FIT time durations are milliseconds. Floor at 30s so a step is valid.
      step.durationValue = Math.max(30_000, Math.round((next.atMinutes - cue.atMinutes) * 60_000));
    } else {
      step.durationType = 'open';
    }
    enc.writeMesg(step);
  });

  return enc.close();
}

/** A course: the route track plus a course point at each fuel stop. */
export function encodeCourseFit(
  name: string,
  sport: FitSport,
  track: FitTrackPoint[],
  points: FitCoursePoint[],
): Uint8Array {
  const enc: any = new Encoder();
  const start = new Date();
  const last = track[track.length - 1];
  const totalS = last?.elapsedS ?? Math.max(1, track.length);

  enc.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: 'course', manufacturer: 'development', product: 0, serialNumber: 0, timeCreated: start,
  });
  enc.writeMesg({ mesgNum: Profile.MesgNum.COURSE, name: name.slice(0, 60), sport });

  if (track.length > 0) {
    enc.writeMesg({
      mesgNum: Profile.MesgNum.LAP,
      timestamp: new Date(start.getTime() + totalS * 1000),
      startTime: start,
      startPositionLat: toSemicircles(track[0].lat),
      startPositionLong: toSemicircles(track[0].lng),
      endPositionLat: toSemicircles(last.lat),
      endPositionLong: toSemicircles(last.lng),
      totalElapsedTime: totalS,
      totalTimerTime: totalS,
      totalDistance: last.distanceM,
    });
    enc.writeMesg({ mesgNum: Profile.MesgNum.EVENT, timestamp: start, event: 'timer', eventType: 'start' });
    track.forEach((p) => {
      const rec: Record<string, unknown> = {
        mesgNum: Profile.MesgNum.RECORD,
        timestamp: new Date(start.getTime() + (p.elapsedS ?? 0) * 1000),
        positionLat: toSemicircles(p.lat),
        positionLong: toSemicircles(p.lng),
        distance: p.distanceM,
      };
      if (p.altitudeM != null) rec.altitude = p.altitudeM;
      enc.writeMesg(rec);
    });
    enc.writeMesg({
      mesgNum: Profile.MesgNum.EVENT,
      timestamp: new Date(start.getTime() + totalS * 1000),
      event: 'timer', eventType: 'stopAll',
    });
  }

  points.forEach((cp, i) => {
    enc.writeMesg({
      mesgNum: Profile.MesgNum.COURSE_POINT,
      messageIndex: i,
      timestamp: new Date(start.getTime() + i * 1000),
      positionLat: toSemicircles(cp.lat),
      positionLong: toSemicircles(cp.lng),
      distance: cp.distanceM,
      type: cp.type,
      name: cp.name.slice(0, 60),
    });
  });

  return enc.close();
}
