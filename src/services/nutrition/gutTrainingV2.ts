/**
 * Gut Training v2 — beta.
 *
 * v1 (`gutTraining.ts`) is a standalone start→target g/h program: pick two
 * numbers, log ad-hoc sessions, the target advances/holds/backs-off. v2
 * wraps that same engine — `createProgram`/`recordSession` are reused
 * as-is, not duplicated — with the parts the v1 panel didn't have: a goal
 * event that derives the race-day target, a weeks-to-event schedule with a
 * realism check, a weekly session prescription (intake breakdown), a
 * race-day fuel plan, and behind-plan/rough-session alerts.
 *
 * Pure functions only — no React, no Firebase, no Dexie — same as v1, and
 * for the same reason: fully unit-testable in isolation
 * (see gutTrainingV2.test.ts).
 */

import {
  createProgram,
  recordSession,
  type GutTrainingProgram,
  type GutTrainingSession,
  type GutTrainingSessionInput,
  type GutComfort,
} from './gutTraining';
import { gutCeilingFor, type GutTolerance } from './carbCalculator';
import type { Sport } from './hydrationCalculator';

export type { GutTrainingSession, GutComfort };

/* ------------------------------- types ------------------------------- */

export interface GoalEvent {
  name: string;
  /** ISO date string (yyyy-mm-dd). */
  date: string;
  distanceKm: number;
}

export type GutHistoryTag = 'bloating-gels' | 'cramps' | 'nausea' | 'all-fine';

export const GUT_HISTORY_TAGS: { value: GutHistoryTag; label: string }[] = [
  { value: 'bloating-gels', label: 'Bloating on gels' },
  { value: 'cramps', label: 'Cramps' },
  { value: 'nausea', label: 'Nausea' },
  { value: 'all-fine', label: 'All fine' },
];

/** The design's 3-button gut-response scale (Clean / Mild / Rough). Stored
 *  as the existing 4-value `GutComfort` underneath so the v1 engine and the
 *  shared FeedbackModal language keep working unchanged — 'moderate'
 *  collapses into 'rough' going the other direction, since v2's UI doesn't
 *  distinguish moderate from severe. */
export type GutResponseV2 = 'clean' | 'mild' | 'rough';

export function toGutComfort(response: GutResponseV2): GutComfort {
  if (response === 'clean') return 'none';
  if (response === 'mild') return 'mild';
  return 'severe';
}

export function fromGutComfort(comfort: GutComfort): GutResponseV2 {
  if (comfort === 'none') return 'clean';
  if (comfort === 'mild') return 'mild';
  return 'rough'; // moderate + severe both read as "Rough" in the v2 3-button UI
}

export interface GutTrainingV2Program extends GutTrainingProgram {
  event: GoalEvent;
  gutHistory: GutHistoryTag[];
  weeksToEvent: number;
  /** Which week of the plan the *next* session is for. Sessions can exceed
   *  weekNumber (an athlete logging an extra session in one week) or fall
   *  behind it (a skipped week) — it's a plan pointer, not a session count. */
  weekNumber: number;
  optedInAt: string;
}

/* --------------------------- 1 · goal event --------------------------- */

/** Same speed assumptions AppContext already uses to size route ETAs
 *  (running 11 km/h, cycling 28 km/h) — reused here so the derived target
 *  lines up with how the rest of the app estimates effort duration. */
const REF_SPEED_KM_H: Record<Sport, number> = { running: 11, cycling: 28 };

/** Derives a race-day carb target from the event's distance, using the same
 *  60/90/120 g/h ceiling tiers `gutCeilingFor` already defines elsewhere in
 *  the app (and the "60–90 g/h is the sweet spot for efforts over two
 *  hours" guidance already surfaced in ActionBar's tooltip) — an estimated
 *  duration under 2h stays at the beginner ceiling, 2–10h sits at the
 *  trained ceiling most events land on, and only very long ultras (10h+)
 *  reach for the elite ceiling. A simplification for beta, not a
 *  physiology model — flagged here so it's easy to revisit. */
export function deriveTargetGPerHour(distanceKm: number, sport: Sport = 'running'): number {
  const hours = distanceKm / REF_SPEED_KM_H[sport];
  const tier: GutTolerance = hours <= 2 ? 'beginner' : hours <= 10 ? 'trained' : 'elite';
  return gutCeilingFor(tier);
}

/* ------------------------- 2 · current tolerance ----------------------- */

export type RealismLevel = 'comfortable' | 'tight' | 'aggressive';

export interface RealismCheck {
  level: RealismLevel;
  /** g/h the plan needs to add per week to reach target on time. */
  requiredWeeklyStepGPerHour: number;
  note: string;
}

/** Checks whether closing startGPerHour → targetGPerHour in weeksToEvent is
 *  realistic against the per-session step the engine actually applies
 *  (`stepGPerHour`, default 5 — one step per week, matching the design's
 *  one-session-a-week cadence). */
export function buildRealismNote(
  startGPerHour: number,
  targetGPerHour: number,
  weeksToEvent: number,
  stepGPerHour: number,
): RealismCheck {
  const span = Math.max(0, targetGPerHour - startGPerHour);
  const requiredWeeklyStepGPerHour = weeksToEvent > 0 ? span / weeksToEvent : Infinity;

  if (weeksToEvent <= 0 || requiredWeeklyStepGPerHour > stepGPerHour * 1.6) {
    return {
      level: 'aggressive',
      requiredWeeklyStepGPerHour,
      note: `That's an aggressive ramp for ${Math.max(0, weeksToEvent)} weeks — a longer runway or a lower target would be safer.`,
    };
  }
  if (requiredWeeklyStepGPerHour > stepGPerHour) {
    return {
      level: 'tight',
      requiredWeeklyStepGPerHour,
      note: `It's tight, but doable in ${weeksToEvent} weeks if most sessions advance cleanly.`,
    };
  }
  return {
    level: 'comfortable',
    requiredWeeklyStepGPerHour,
    note: `You have room. Closing ${startGPerHour} to ${targetGPerHour} in ${weeksToEvent} weeks is realistic.`,
  };
}

export interface CreateProgramV2Input {
  event: GoalEvent;
  startGPerHour: number;
  gutHistory: GutHistoryTag[];
  weeksToEvent: number;
  sport?: Sport;
}

/** Starts a new v2 program. Builds on top of v1's `createProgram` (same
 *  clamping, same start/target-swap safety) rather than re-implementing it. */
export function createProgramV2(input: CreateProgramV2Input): GutTrainingV2Program {
  const targetGPerHour = deriveTargetGPerHour(input.event.distanceKm, input.sport ?? 'running');
  const base = createProgram(input.startGPerHour, targetGPerHour);
  return {
    ...base,
    event: input.event,
    gutHistory: input.gutHistory,
    weeksToEvent: input.weeksToEvent,
    weekNumber: 1,
    optedInAt: new Date().toISOString(),
  };
}

/* ------------------------ 3 · weekly prescription ----------------------- */

export interface SessionIntakeItem {
  timeLabel: string; // 'Start', ':20', ':40', ...
  label: string; // '500ml mix', 'gel', 'chews'
  grams: number;
}

export interface SessionPrescription {
  weekNumber: number;
  durationMinutes: number;
  targetGPerHour: number;
  items: SessionIntakeItem[];
  totalGrams: number;
}

/** Splits a session's target g/h into a start-of-session mix plus a
 *  repeating gel/chews cadence (~:20 / :40 past each hour) — proportions
 *  (53% mix, 26% gel, 24% chews per repeating hour) approximate a typical
 *  liquid-then-solid fuelling pattern; the last item absorbs the rounding
 *  remainder so the breakdown always sums to exactly `totalGrams`. A
 *  reasonable default for beta, not tied to real product SKUs yet — see
 *  the module docstring. */
export function buildSessionPrescription(
  program: GutTrainingV2Program,
  durationMinutes: number,
): SessionPrescription {
  const target = program.currentGPerHour;
  const hours = durationMinutes / 60;
  const totalGrams = Math.round(target * hours);

  const items: SessionIntakeItem[] = [
    { timeLabel: 'Start', label: '500ml mix', grams: Math.round(target * 0.53) },
  ];
  const cycles = Math.max(1, Math.round(hours));
  for (let i = 0; i < cycles; i++) {
    items.push({ timeLabel: ':20', label: 'gel', grams: Math.round(target * 0.26) });
    items.push({ timeLabel: ':40', label: 'chews', grams: Math.round(target * 0.24) });
  }

  // Reconcile rounding drift onto the last item so the breakdown always
  // adds up to totalGrams exactly.
  const runningSum = items.reduce((sum, item) => sum + item.grams, 0);
  items[items.length - 1].grams += totalGrams - runningSum;

  return { weekNumber: program.weekNumber, durationMinutes, targetGPerHour: target, items, totalGrams };
}

/* --------------------------- weekly loop step --------------------------- */

/** Logs a session against a v2 program. Thin wrapper over v1's
 *  `recordSession` — same advance/hold/back-off logic — that also advances
 *  the plan's week pointer. */
export function recordSessionV2(
  program: GutTrainingV2Program,
  input: GutTrainingSessionInput,
): { program: GutTrainingV2Program; session: GutTrainingSession } {
  const { program: updatedBase, session } = recordSession(program, input);
  return {
    program: { ...program, ...updatedBase, weekNumber: program.weekNumber + 1 },
    session,
  };
}

/* ------------------------------ 6 · milestone --------------------------- */

export interface MilestoneStats {
  gPerHour: number;
  weeksElapsed: number;
  sessionsCount: number;
  /** 0–100, rounded. */
  cleanPercent: number;
}

export function computeMilestoneStats(program: GutTrainingV2Program, sessions: GutTrainingSession[]): MilestoneStats {
  const clean = sessions.filter((s) => s.gutComfort === 'none').length;
  return {
    gPerHour: program.currentGPerHour,
    weeksElapsed: Math.max(0, program.weekNumber - 1),
    sessionsCount: sessions.length,
    cleanPercent: sessions.length > 0 ? Math.round((clean / sessions.length) * 100) : 100,
  };
}

/* ------------------------------ 7 · race day ----------------------------- */

export interface RaceDaySegment {
  fromKm: number;
  toKm: number;
  grams: number;
}

export interface RaceDayPlan {
  event: GoalEvent;
  targetGPerHour: number;
  segments: RaceDaySegment[];
  totalGrams: number;
}

/** Splits the course into ~20–25km segments and tapers the fuelling rate
 *  through the back half (100% of target through the first 60% of the
 *  course, linearly down to 75% by the finish) — GI capacity and appetite
 *  typically drop late in an ultra, so the plan front-loads intake rather
 *  than holding a flat rate to the line. A reasonable default for beta —
 *  not a clinical taper protocol. */
export function buildRaceDayPlan(program: GutTrainingV2Program, sport: Sport = 'running'): RaceDayPlan {
  const { distanceKm } = program.event;
  const target = program.currentGPerHour;
  const refSpeed = REF_SPEED_KM_H[sport];

  const segmentCount = Math.max(3, Math.min(6, Math.round(distanceKm / 22)));
  const segmentKm = distanceKm / segmentCount;

  const segments: RaceDaySegment[] = [];
  let cursorKm = 0;
  for (let i = 0; i < segmentCount; i++) {
    const fromKm = Math.round(cursorKm);
    cursorKm += segmentKm;
    const toKm = i === segmentCount - 1 ? Math.round(distanceKm) : Math.round(cursorKm);
    const segHours = (toKm - fromKm) / refSpeed;
    const progress = i / Math.max(1, segmentCount - 1);
    const multiplier = progress <= 0.6 ? 1 : 1 - 0.25 * ((progress - 0.6) / 0.4);
    segments.push({ fromKm, toKm, grams: Math.round(segHours * target * multiplier) });
  }

  return {
    event: program.event,
    targetGPerHour: target,
    segments,
    totalGrams: segments.reduce((sum, s) => sum + s.grams, 0),
  };
}

/* ------------------------------- 8 · alerts ------------------------------ */

export type AlertTone = 'amber' | 'brick';

export interface GutTrainingAlert {
  type: 'behind-plan' | 'rough-sessions';
  tone: AlertTone;
  title: string;
  message: string;
}

/** Behind-plan (amber) fires off the most recent session falling well short
 *  of what it was prescribed. Rough-sessions (brick) fires when 2 of the
 *  last 3 logged sessions came back rough/backed-off — the "needs a
 *  decision" case, since one rough session is normal but a pattern isn't. */
export function getActiveAlerts(program: GutTrainingV2Program, sessions: GutTrainingSession[]): GutTrainingAlert[] {
  const alerts: GutTrainingAlert[] = [];
  if (program.status !== 'active' || sessions.length === 0) return alerts;

  const [latest, ...rest] = sessions; // sessions are stored newest-first
  if (latest.actualGPerHour < latest.sessionTargetGPerHour * 0.85) {
    alerts.push({
      type: 'behind-plan',
      tone: 'amber',
      title: 'Behind plan',
      message: `${latest.actualGPerHour} g/hr against a target of ${latest.sessionTargetGPerHour}. Take the next gel early.`,
    });
  }

  const recent = [latest, ...rest].slice(0, 3);
  const roughCount = recent.filter((s) => s.outcome === 'back-off' || s.gutComfort === 'severe').length;
  if (roughCount >= 2) {
    alerts.push({
      type: 'rough-sessions',
      tone: 'brick',
      title: 'Two rough sessions',
      message: `Holding at ${program.currentGPerHour} g/hr this week instead of stepping up.`,
    });
  }

  return alerts;
}
