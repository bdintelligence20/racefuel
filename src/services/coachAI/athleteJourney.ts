/**
 * Athlete journey — the deterministic synthesis layer under the AI coach.
 *
 * The app already captures the raw signals of an athlete's nutrition life in
 * Firestore: post-run feedback (bonk, gut issues, planned vs actual carbs),
 * per-product ratings (rating / gut comfort / taste), gut-training sessions
 * (target vs actual g/h, advance / hold / back-off), and saved plans. None of
 * it is joined up. This module reads those signals and distils them into one
 * compact, typed summary — the "journey" — that both renders directly and
 * feeds the recommender (coachRecommender.ts).
 *
 * `computeJourney` is pure (inputs → summary) so it unit-tests cleanly;
 * `buildAthleteJourney` fetches then calls it, failing closed to an empty
 * journey (dev has no Firestore backend). See the dev fixture at the bottom.
 */
import type { UserProfile } from '../../context/AppContext';
import {
  getAllFeedback,
  getAllRatings,
  getAllGutTrainingV2Sessions,
  getAllPlans,
  type FirestoreFeedback,
  type FirestoreRating,
  type FirestoreGutTrainingSession,
  type FirestorePlan,
} from '../firebase/firestore';
import { products } from '../../data/products';

export interface JourneySignalCounts {
  runs: number;
  ratings: number;
  gutSessions: number;
  plans: number;
}

export interface RunPattern {
  count: number;
  /** Mean overall feel, 1 (terrible) – 5 (great). Null with no runs. */
  avgOverallFeel: number | null;
  /** Mean bonk level, 1 (none) – 5 (severe). Null with no runs. */
  avgBonkLevel: number | null;
  /** Fraction of runs with any gut issue (mild+). 0–1. */
  gutIssueRate: number;
  /** Fraction of runs the athlete bonked meaningfully (bonkLevel ≥ 4). 0–1. */
  bonkRate: number;
  /** Mean actual/planned carb ratio where both were logged. Null otherwise. */
  carbAdherence: number | null;
  /** Bonks (bonkLevel ≥ 4) among the three most recent runs. */
  recentBonks: number;
}

export interface CarbToleranceInsight {
  /** The athlete's current per-hour carb intent: explicit override, else null
   *  (the tier engine decides per-race). */
  currentTargetGPerHour: number | null;
  gutTolerance: 'beginner' | 'trained' | 'elite' | null;
  /** Most recent gut-training session target, g/h. Null with no sessions. */
  latestSessionTargetGPerHour: number | null;
  /** Recent session outcomes, newest first. */
  progression: Array<'advance' | 'hold' | 'back-off'>;
  /** Consecutive most-recent sessions that did not back off (a readiness-to-
   *  advance signal). */
  cleanStreak: number;
}

export interface ProductVerdict {
  productId: string;
  label: string;
  n: number;
  avgRating: number;
  avgGutComfort: number;
  avgTaste: number;
}

export interface AthleteJourney {
  signals: JourneySignalCounts;
  /** True once there's enough logged to say anything useful. Below this the
   *  coach shows an onboarding empty state rather than thin guesses. */
  hasEnoughData: boolean;
  runs: RunPattern;
  carb: CarbToleranceInsight;
  products: { liked: ProductVerdict[]; disliked: ProductVerdict[] };
  profile: { weightKg: number; sweatRate: string; sport: string };
  generatedAt: string;
}

function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function round1(n: number | null): number | null {
  return n === null ? null : Math.round(n * 10) / 10;
}

function productLabel(productId: string): string {
  const p = products.find((x) => x.id === productId);
  if (!p) return productId;
  return `${p.brand} ${p.name}`.trim();
}

export interface JourneyInputs {
  profile: UserProfile;
  feedback: FirestoreFeedback[];
  ratings: FirestoreRating[];
  sessions: FirestoreGutTrainingSession[];
  plans: FirestorePlan[];
}

/** Pure: raw signals in, journey summary out. No I/O, no clock beyond the
 *  stamp — pass a fixed `now` in tests. */
export function computeJourney(inputs: JourneyInputs, now: Date = new Date()): AthleteJourney {
  const { profile, feedback, ratings, sessions, plans } = inputs;

  // ── Runs ──
  const feels = feedback.map((f) => f.overallFeel).filter((n): n is number => typeof n === 'number');
  const bonks = feedback.map((f) => f.bonkLevel).filter((n): n is number => typeof n === 'number');
  const withGutIssue = feedback.filter((f) => f.gutIssues && f.gutIssues !== 'none').length;
  const bonked = feedback.filter((f) => typeof f.bonkLevel === 'number' && f.bonkLevel >= 4).length;
  const adherences = feedback
    .filter((f) => typeof f.actualCarbs === 'number' && f.plannedCarbs > 0)
    .map((f) => (f.actualCarbs as number) / f.plannedCarbs);
  // feedback comes back newest-first (ordered by createdAt desc).
  const recentBonks = feedback.slice(0, 3).filter((f) => typeof f.bonkLevel === 'number' && f.bonkLevel >= 4).length;

  const runs: RunPattern = {
    count: feedback.length,
    avgOverallFeel: round1(mean(feels)),
    avgBonkLevel: round1(mean(bonks)),
    gutIssueRate: feedback.length ? withGutIssue / feedback.length : 0,
    bonkRate: feedback.length ? bonked / feedback.length : 0,
    carbAdherence: round1(mean(adherences)),
    recentBonks,
  };

  // ── Gut-training progression (sessions newest-first) ──
  const progression = sessions.map((s) => s.outcome);
  let cleanStreak = 0;
  for (const outcome of progression) {
    if (outcome === 'back-off') break;
    cleanStreak += 1;
  }
  const carb: CarbToleranceInsight = {
    currentTargetGPerHour: profile.carbTargetGPerHour ?? null,
    gutTolerance: profile.gutTolerance ?? null,
    latestSessionTargetGPerHour: sessions[0]?.sessionTargetGPerHour ?? null,
    progression: progression.slice(0, 6),
    cleanStreak,
  };

  // ── Product verdicts ──
  const byProduct = new Map<string, FirestoreRating[]>();
  for (const r of ratings) {
    if (!r.productId) continue;
    const arr = byProduct.get(r.productId) ?? [];
    arr.push(r);
    byProduct.set(r.productId, arr);
  }
  const verdicts: ProductVerdict[] = [...byProduct.entries()].map(([productId, rs]) => ({
    productId,
    label: productLabel(productId),
    n: rs.length,
    avgRating: round1(mean(rs.map((r) => r.rating)) ?? 0) as number,
    avgGutComfort: round1(mean(rs.map((r) => r.gutComfort)) ?? 0) as number,
    avgTaste: round1(mean(rs.map((r) => r.taste)) ?? 0) as number,
  }));
  // Liked: highly rated and gut-friendly. Disliked: low rating or a gut-comfort
  // red flag. Both sorted to lead with the strongest signal.
  const liked = verdicts
    .filter((v) => v.avgRating >= 4 && v.avgGutComfort >= 3.5)
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 5);
  const disliked = verdicts
    .filter((v) => v.avgRating <= 2.5 || v.avgGutComfort <= 2)
    .sort((a, b) => a.avgGutComfort - b.avgGutComfort)
    .slice(0, 5);

  const hasEnoughData = feedback.length >= 1 || sessions.length >= 2 || ratings.length >= 3;

  return {
    signals: {
      runs: feedback.length,
      ratings: ratings.length,
      gutSessions: sessions.length,
      plans: plans.length,
    },
    hasEnoughData,
    runs,
    carb,
    products: { liked, disliked },
    profile: {
      weightKg: profile.weight,
      sweatRate: profile.sweatRate,
      sport: profile.sport ?? 'running',
    },
    generatedAt: now.toISOString(),
  };
}

/**
 * Fetch the athlete's signals from Firestore and build their journey. Every
 * read fails closed to empty (dev has no backend, and a partial outage should
 * degrade, not throw). In dev, an all-empty result falls back to a sample
 * journey so the coach UI is exercisable on localhost — same spirit as the
 * gut-training beta surfacing itself in dev.
 */
export async function buildAthleteJourney(profile: UserProfile): Promise<AthleteJourney> {
  const [feedback, ratings, sessions, plans] = await Promise.all([
    getAllFeedback().catch(() => [] as FirestoreFeedback[]),
    getAllRatings().catch(() => [] as FirestoreRating[]),
    getAllGutTrainingV2Sessions().catch(() => [] as FirestoreGutTrainingSession[]),
    getAllPlans().catch(() => [] as FirestorePlan[]),
  ]);

  const journey = computeJourney({ profile, feedback, ratings, sessions, plans });

  if (!journey.hasEnoughData && import.meta.env.DEV) {
    return devSampleJourney(profile);
  }
  return journey;
}

/** A realistic sample so the coach renders on localhost without a backend.
 *  DEV only — never reached in a production build. */
export function devSampleJourney(profile: UserProfile): AthleteJourney {
  const now = new Date().toISOString();
  return {
    signals: { runs: 5, ratings: 7, gutSessions: 4, plans: 6 },
    hasEnoughData: true,
    runs: {
      count: 5,
      avgOverallFeel: 3.4,
      avgBonkLevel: 3.2,
      gutIssueRate: 0.2,
      bonkRate: 0.4,
      carbAdherence: 0.82,
      recentBonks: 2,
    },
    carb: {
      currentTargetGPerHour: profile.carbTargetGPerHour ?? 60,
      gutTolerance: profile.gutTolerance ?? 'trained',
      latestSessionTargetGPerHour: 80,
      progression: ['hold', 'hold', 'advance', 'advance'],
      cleanStreak: 4,
    },
    products: {
      liked: [
        { productId: 'sample-chew', label: 'Skratch Labs Energy Chews', n: 3, avgRating: 4.7, avgGutComfort: 4.5, avgTaste: 4.6 },
        { productId: 'sample-gel-1', label: '226ers High Fructose Gel', n: 2, avgRating: 4.2, avgGutComfort: 4.0, avgTaste: 3.8 },
      ],
      disliked: [
        { productId: 'sample-gel-2', label: 'PVM Octane Gel', n: 2, avgRating: 2.0, avgGutComfort: 1.5, avgTaste: 2.5 },
      ],
    },
    profile: {
      weightKg: profile.weight,
      sweatRate: profile.sweatRate,
      sport: profile.sport ?? 'running',
    },
    generatedAt: now,
  };
}
