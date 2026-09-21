/**
 * Coach recommender — turns an AthleteJourney (athleteJourney.ts) into a short
 * list of concrete, explained recommendations.
 *
 * It reuses the app's existing AI path exactly: Firebase AI Logic (App Check–
 * gated, no Gemini key in the browser), Gemini 2.5 Flash, structured JSON via a
 * responseSchema — the same setup as geminiPlanner.ts. The model only ever sees
 * the athlete's own distilled numbers plus the evidence base; the carb / sodium
 * / hydration math stays deterministic and is never delegated to it.
 *
 * Fallback: any failure (disabled, network, bad JSON, empty) drops to a
 * deterministic rules recommender so the coach always returns something useful,
 * never an error — same philosophy as the planner's fallback to the algorithm.
 */
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';
import { nanoid } from 'nanoid';
import { app } from '../firebase/config';
import { isGeminiEnabled } from '../nutrition/geminiPlanner';
import type { UserProfile } from '../../context/AppContext';
import type { AthleteJourney } from './athleteJourney';

const MODEL = 'gemini-2.5-flash';

export type CoachCategory = 'carbs' | 'hydration' | 'products' | 'gut-training' | 'execution';

export interface CoachRecommendation {
  id: string;
  category: CoachCategory;
  /** Short imperative headline. */
  title: string;
  /** The recommendation itself, in the athlete's terms. */
  detail: string;
  /** Grounded in the athlete's own numbers plus the evidence base. */
  why: string;
  confidence: 'low' | 'medium' | 'high';
  /** Optional concrete next step the UI can turn into a button. */
  action?: string;
}

export interface CoachResult {
  /** One-line read of where the athlete is right now. */
  headline: string;
  recommendations: CoachRecommendation[];
  source: 'ai' | 'rules';
  generatedAt: string;
}

/** Whether the coach is shown to athletes at all. On by default; set
 *  VITE_AI_COACH_ENABLED="false" to hide the entry entirely (config kill
 *  switch, no code change). Unlike isCoachAIEnabled this does NOT require the
 *  AI path — the coach still works via the deterministic rules fallback, so a
 *  disabled or unreachable model must not hide the feature. */
export function isCoachEnabled(): boolean {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return env?.VITE_AI_COACH_ENABLED !== 'false';
}

/** Whether the AI (LLM) path is used. Falls back to rules when false. Honours
 *  the coach kill switch above and the planner's own Gemini switch. */
export function isCoachAIEnabled(): boolean {
  return isCoachEnabled() && isGeminiEnabled();
}

const VALID_CATEGORIES: CoachCategory[] = ['carbs', 'hydration', 'products', 'gut-training', 'execution'];
const VALID_CONFIDENCE = ['low', 'medium', 'high'] as const;

const COACH_SCHEMA = Schema.object({
  properties: {
    headline: Schema.string(),
    recommendations: Schema.array({
      items: Schema.object({
        properties: {
          category: Schema.string(),
          title: Schema.string(),
          detail: Schema.string(),
          why: Schema.string(),
          confidence: Schema.string(),
          action: Schema.string(),
        },
      }),
    }),
  },
});

interface RawRec {
  category?: string;
  title?: string;
  detail?: string;
  why?: string;
  confidence?: string;
  action?: string;
}
interface RawOutput {
  headline?: string;
  recommendations?: RawRec[];
}

// The evidence the "why" must stay anchored to. Kept terse — the model only
// needs the handles, and the deterministic engine already owns the numbers.
const EVIDENCE = [
  'Jeukendrup 2014: multiple-transportable carbs (glucose+fructose) allow up to ~90 g/h; single-source caps near 60 g/h.',
  'ACSM 2016: 30–60 g/h for 1–2.5 h, up to 90 g/h beyond ~2.5 h at higher intensity.',
  'Costa 2017/2025: repeated gut training (progressive carb exposure) measurably reduces GI distress and raises tolerable intake.',
  'Hearris 2022: gut tolerance is trainable and largely independent of body mass; progress it gradually.',
].join('\n');

function buildPrompt(journey: AthleteJourney, profile: UserProfile): string {
  return [
    'You are FuelCue, an endurance-nutrition coach speaking directly to ONE athlete.',
    'Read this athlete\'s distilled history and give 2 to 4 specific, encouraging recommendations to improve their race-day fuelling.',
    '',
    'Hard rules:',
    '- Ground every "why" in THIS athlete\'s own numbers below, plus the evidence base. Cite the number you are reacting to.',
    '- Be concrete: name a target change (e.g. 60 -> 75 g/h), a product swap, or an execution habit.',
    '- Stay inside the evidence. Never exceed ~90 g/h unless gut tolerance is elite. Advise gradual change, not leaps.',
    '- No medical claims, no diagnosis. If a signal is thin, say so and lower confidence.',
    '- Write plainly. Do not use em dashes; use commas or periods.',
    '- category must be one of: carbs, hydration, products, gut-training, execution.',
    '- confidence must be one of: low, medium, high.',
    '',
    'Evidence base:',
    EVIDENCE,
    '',
    'Athlete profile:',
    `weight ${profile.weight}kg, sport ${profile.sport ?? 'running'}, sweat ${profile.sweatRate}, gut tolerance ${profile.gutTolerance ?? 'unspecified'}.`,
    '',
    'Athlete journey (their logged history):',
    JSON.stringify(journey, null, 2),
    '',
    'Return JSON only, matching the schema: a one-line headline reading where they are, and the recommendations.',
  ].join('\n');
}

function coerceCategory(c?: string): CoachCategory {
  const v = (c ?? '').toLowerCase().trim() as CoachCategory;
  return VALID_CATEGORIES.includes(v) ? v : 'execution';
}
function coerceConfidence(c?: string): CoachRecommendation['confidence'] {
  const v = (c ?? '').toLowerCase().trim();
  return (VALID_CONFIDENCE as readonly string[]).includes(v) ? (v as CoachRecommendation['confidence']) : 'medium';
}

/**
 * The athlete's recommendations. Tries the AI path when enabled and there's
 * enough data; otherwise (or on any failure) returns the deterministic rules
 * result. Never throws.
 */
export async function getCoachRecommendations(journey: AthleteJourney, profile: UserProfile): Promise<CoachResult> {
  if (!journey.hasEnoughData || !isCoachAIEnabled()) {
    return deriveRecommendations(journey);
  }

  let raw: string;
  try {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    const model = getGenerativeModel(ai, {
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: COACH_SCHEMA,
        temperature: 0.6,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ thinkingConfig: { thinkingBudget: 0 } } as any),
      },
    });
    const result = await model.generateContent(buildPrompt(journey, profile));
    raw = result.response.text();
  } catch (err) {
    console.warn('[FuelCue coach] AI call failed, using rules:', err);
    return deriveRecommendations(journey);
  }

  let parsed: RawOutput;
  try {
    parsed = JSON.parse(raw) as RawOutput;
  } catch (err) {
    console.warn('[FuelCue coach] response was not JSON, using rules:', err);
    return deriveRecommendations(journey);
  }

  const recommendations: CoachRecommendation[] = (parsed.recommendations ?? [])
    .filter((r) => r && r.title && r.detail)
    .slice(0, 4)
    .map((r) => ({
      id: nanoid(8),
      category: coerceCategory(r.category),
      title: (r.title as string).trim(),
      detail: (r.detail as string).trim(),
      why: (r.why ?? '').trim(),
      confidence: coerceConfidence(r.confidence),
      action: r.action?.trim() || undefined,
    }));

  if (recommendations.length === 0) {
    return deriveRecommendations(journey);
  }

  return {
    headline: parsed.headline?.trim() || deriveHeadline(journey),
    recommendations,
    source: 'ai',
    generatedAt: new Date().toISOString(),
  };
}

// ── Deterministic fallback ──

function deriveHeadline(j: AthleteJourney): string {
  if (j.runs.count === 0 && j.signals.gutSessions > 0) {
    return `${j.signals.gutSessions} gut sessions logged and building tolerance.`;
  }
  if (j.runs.recentBonks >= 2) return 'Fading late in recent runs, likely under-fuelling.';
  if (j.runs.gutIssueRate >= 0.4) return 'Gut is the limiter right now, not the carb target.';
  if ((j.runs.avgOverallFeel ?? 0) >= 4) return 'Fuelling is landing well. Small gains from here.';
  return 'Enough history to start tuning your fuelling.';
}

/** Rules recommender — every branch is anchored to a real number in the
 *  journey so the "why" is honest even without the model. */
export function deriveRecommendations(journey: AthleteJourney): CoachResult {
  const recs: CoachRecommendation[] = [];
  const r = journey.runs;
  const c = journey.carb;

  // Under-fuelling: bonking late without a gut red flag → push carbs.
  if (r.recentBonks >= 2 && r.gutIssueRate < 0.3) {
    const from = c.currentTargetGPerHour ?? 60;
    const to = Math.min(90, from + 15);
    recs.push({
      id: nanoid(8),
      category: 'carbs',
      title: `Raise carbs toward ${to} g/h`,
      detail: `You bonked in ${r.recentBonks} of your last 3 runs with little to no gut trouble. Step your race target from about ${from} to ${to} g/h.`,
      why: `Late fade with a settled gut points to too few carbs, not tolerance. Jeukendrup 2014 supports up to ~90 g/h with mixed glucose+fructose sources.`,
      confidence: 'high',
      action: `Set carb target to ${to} g/h`,
    });
  }

  // Gut is the limiter → train it rather than push intake.
  if (r.gutIssueRate >= 0.4) {
    recs.push({
      id: nanoid(8),
      category: 'gut-training',
      title: 'Train the gut before adding carbs',
      detail: `You reported gut issues on ${Math.round(r.gutIssueRate * 100)}% of logged runs. Hold your race target and add one gut-training session a week.`,
      why: `Costa 2017/2025 shows progressive carb exposure lowers GI distress and lifts tolerable intake. Push volume only once comfort holds.`,
      confidence: 'high',
      action: 'Open gut training',
    });
  }

  // Ready to advance the gut ceiling.
  if (c.cleanStreak >= 3 && r.gutIssueRate < 0.3) {
    const next = (c.latestSessionTargetGPerHour ?? 60) + 10;
    recs.push({
      id: nanoid(8),
      category: 'gut-training',
      title: `Advance to ${next} g/h in training`,
      detail: `You've held ${c.cleanStreak} sessions clean at ${c.latestSessionTargetGPerHour ?? 'your current target'} g/h. Step the next session up by ~10 g/h.`,
      why: `Hearris 2022: tolerance is trainable and progresses in small steps. A clean streak is the signal to nudge the ceiling.`,
      confidence: 'medium',
    });
  }

  // Execution: logging carbs well below plan.
  if (r.carbAdherence !== null && r.carbAdherence < 0.8) {
    recs.push({
      id: nanoid(8),
      category: 'execution',
      title: 'Close the gap to your plan',
      detail: `On average you took in about ${Math.round(r.carbAdherence * 100)}% of your planned carbs. Set a fuelling reminder every 20–25 minutes.`,
      why: `The plan already targets the right intake; the miss is execution. Regular cues keep intake on the curve rather than back-loaded.`,
      confidence: 'medium',
    });
  }

  // Product swap: a disliked / gut-unfriendly product is in rotation.
  if (journey.products.disliked.length > 0) {
    const bad = journey.products.disliked[0];
    const good = journey.products.liked[0];
    recs.push({
      id: nanoid(8),
      category: 'products',
      title: `Drop ${bad.label}`,
      detail: good
        ? `You rate ${bad.label} low (gut comfort ${bad.avgGutComfort}/5). Lean on ${good.label}, which you rate ${good.avgRating}/5.`
        : `You rate ${bad.label} low (gut comfort ${bad.avgGutComfort}/5). Trial a different format on your next long run.`,
      why: `Race day is no place to fight a fuel you dislike. Low taste or gut scores predict skipped intake and under-fuelling.`,
      confidence: bad.n >= 2 ? 'medium' : 'low',
    });
  }

  // Positive reinforcement when things are going well and nothing fired.
  if (recs.length === 0) {
    recs.push({
      id: nanoid(8),
      category: 'execution',
      title: 'Keep logging to unlock sharper advice',
      detail: 'Your fuelling looks steady. Log a few more runs and product ratings and the coach will spot finer patterns.',
      why: 'Recommendations get specific once there are enough runs to separate signal from a one-off.',
      confidence: 'low',
    });
  }

  return {
    headline: deriveHeadline(journey),
    recommendations: recs.slice(0, 4),
    source: 'rules',
    generatedAt: new Date().toISOString(),
  };
}
