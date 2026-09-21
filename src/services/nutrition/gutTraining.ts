/**
 * Gut training engine — beta.
 *
 * `carbCalculator.ts` treats gut tolerance as a static ceiling
 * (`gutCeilingFor`: beginner 60 / trained 90 / elite 120 g/h) and its own
 * rationale text says the way past that ceiling is "gradual gut training".
 * This module is that program: an athlete picks a starting and target g/h,
 * and after each practice session logs what they actually took in and how
 * their gut handled it. The next session's target advances, holds, or backs
 * off in response — never a straight-line ramp regardless of tolerance.
 *
 * Pure functions only — no React, no Firebase, no Dexie — so the
 * progression rules are fully unit-testable in isolation (see
 * gutTraining.test.ts).
 */

/** Reuses the exact GI-comfort scale already used for post-run feedback
 *  (see PlanFeedback.gutIssues in persistence/db.ts and FeedbackModal.tsx)
 *  so the same four buttons and language show up in both places. */
export type GutComfort = 'none' | 'mild' | 'moderate' | 'severe';

export type SessionOutcome = 'advance' | 'hold' | 'back-off';

export type GutTrainingStatus = 'active' | 'completed' | 'paused';

export interface GutTrainingProgram {
  startGPerHour: number;
  targetGPerHour: number;
  /** The g/h prescribed for the *next* session. */
  currentGPerHour: number;
  /** How much currentGPerHour moves per advance/back-off. */
  stepGPerHour: number;
  status: GutTrainingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GutTrainingSessionInput {
  actualGPerHour: number;
  durationMinutes: number;
  gutComfort: GutComfort;
  notes?: string;
}

export interface GutTrainingSession extends GutTrainingSessionInput {
  id?: number | string;
  /** What was prescribed going into this session — captured at log time so
   *  the history reads correctly even as the program's current target moves. */
  sessionTargetGPerHour: number;
  outcome: SessionOutcome;
  createdAt: string;
}

const MIN_G_PER_HOUR = 10;
const MAX_G_PER_HOUR = 120;
const DEFAULT_STEP_G_PER_HOUR = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Starts a new program. Both bounds are clamped to [10, 120] g/h — the same
 *  safety range `calculateCarbTarget` uses for `userOverrideGPerHour`. If the
 *  target is below the start, they're swapped rather than producing a
 *  program that's already "complete". */
export function createProgram(startGPerHour: number, targetGPerHour: number): GutTrainingProgram {
  let start = clamp(Math.round(startGPerHour), MIN_G_PER_HOUR, MAX_G_PER_HOUR);
  let target = clamp(Math.round(targetGPerHour), MIN_G_PER_HOUR, MAX_G_PER_HOUR);
  if (target < start) [start, target] = [target, start];

  const now = new Date().toISOString();
  return {
    startGPerHour: start,
    targetGPerHour: target,
    currentGPerHour: start,
    stepGPerHour: DEFAULT_STEP_G_PER_HOUR,
    status: start === target ? 'completed' : 'active',
    createdAt: now,
    updatedAt: now,
  };
}

function decideOutcome(sessionTarget: number, input: GutTrainingSessionInput): SessionOutcome {
  if (input.gutComfort === 'severe') return 'back-off';
  if (input.gutComfort === 'moderate') return 'hold';
  // 'none' or 'mild' — only counts as a clean pass if they actually got
  // close to what was prescribed. Comfortably under-fueling isn't evidence
  // the gut can handle more.
  if (input.actualGPerHour >= sessionTarget * 0.9) return 'advance';
  return 'hold';
}

/** Logs one training session against an active program and returns the
 *  updated program plus the recorded session (with its computed outcome).
 *  Does not mutate the input program. */
export function recordSession(
  program: GutTrainingProgram,
  input: GutTrainingSessionInput,
): { program: GutTrainingProgram; session: GutTrainingSession } {
  const sessionTargetGPerHour = program.currentGPerHour;
  const outcome = decideOutcome(sessionTargetGPerHour, input);

  let nextGPerHour = program.currentGPerHour;
  if (outcome === 'advance') {
    nextGPerHour = Math.min(program.currentGPerHour + program.stepGPerHour, program.targetGPerHour);
  } else if (outcome === 'back-off') {
    nextGPerHour = Math.max(program.currentGPerHour - program.stepGPerHour, program.startGPerHour);
  }

  const status: GutTrainingStatus = nextGPerHour >= program.targetGPerHour ? 'completed' : 'active';

  const updatedProgram: GutTrainingProgram = {
    ...program,
    currentGPerHour: nextGPerHour,
    status,
    updatedAt: new Date().toISOString(),
  };

  const session: GutTrainingSession = {
    ...input,
    sessionTargetGPerHour,
    outcome,
    createdAt: new Date().toISOString(),
  };

  return { program: updatedProgram, session };
}
