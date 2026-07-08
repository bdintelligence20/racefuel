import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';
import { getPreference, setPreference, deletePreference } from '../../persistence/db';
import type { RouteData, UserProfile } from '../../context/AppContext';

/**
 * Coach mode store — the second user type (coaches & nutritionists) as a
 * parallel primary journey alongside the athlete flow.
 *
 * Local-first, same pattern as the rest of the app: the roster, per-athlete
 * plan summaries, and private notes live in localStorage; full plan snapshots
 * (RouteData JSON, which can be large) live in IndexedDB via Dexie. The
 * genuinely cross-account piece — a shared plan landing in the athlete's own
 * signed-in app — is real and lives in services/coach/sharedPlans.ts backed
 * by the `sharedPlans` Firestore collection.
 */

export type UserMode = 'athlete' | 'coach';
export type PlanStatus = 'not-started' | 'draft' | 'shared' | 'completed';

/** Compact, display-ready summary of an athlete's saved plan snapshot.
 *  Kept on the roster record so the dashboard renders without touching
 *  IndexedDB; the full RouteData snapshot is stored separately. */
export interface AthletePlanSummary {
  routeName: string;
  distanceKm: number;
  points: number;
  totalCarbs: number;
  carbsPerHour: number;
  /** Plan score 0–100 when validation ran, else undefined. */
  score?: number;
  updatedISO: string;
}

export interface CoachAthlete {
  id: string;
  name: string;
  email: string;
  eventName?: string;
  /** ISO date (YYYY-MM-DD) of the athlete's upcoming event. */
  eventDate?: string;
  /** Body weight — loaded into the planner when the coach builds for them. */
  weightKg?: number;
  planStatus: PlanStatus;
  planSummary?: AthletePlanSummary;
  /** When the plan was last delivered to the athlete's account. */
  sharedAtISO?: string;
  /** ISO timestamp of the last time the coach touched this athlete. */
  lastActivityISO?: string;
}

/** A private coach note about an athlete. Only the coach ever sees these. */
export interface CoachNote {
  id: string;
  athleteId: string;
  text: string;
  atISO: string;
}

interface CoachState {
  mode: UserMode;
  athletes: CoachAthlete[];
  activeAthleteId: string | null;
  notes: CoachNote[];
}

const MODE_KEY = 'fuelcue_user_mode';
const ATHLETES_KEY = 'fuelcue_coach_athletes';
const NOTES_KEY = 'fuelcue_coach_notes';
const LEGACY_MESSAGES_KEY = 'fuelcue_coach_messages';
const ACTIVE_KEY = 'fuelcue_coach_active_athlete';
const SELF_PROFILE_KEY = 'fuelcue_coach_self_profile';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** One-time migration: the earlier build stored a faux two-way message thread.
 *  Coach-authored entries carry over as private notes; the rest is dropped. */
function readNotes(): CoachNote[] {
  const existing = read<CoachNote[] | null>(NOTES_KEY, null);
  if (existing) return existing;
  const legacy = read<Array<{ id: string; athleteId: string; from: string; text: string; atISO: string }>>(LEGACY_MESSAGES_KEY, []);
  const migrated = legacy
    .filter((m) => m.from === 'coach')
    .map((m) => ({ id: m.id, athleteId: m.athleteId, text: m.text, atISO: m.atISO }));
  try { localStorage.removeItem(LEGACY_MESSAGES_KEY); } catch { /* fine */ }
  return migrated;
}

let _state: CoachState = {
  mode: (typeof localStorage !== 'undefined' && (localStorage.getItem(MODE_KEY) as UserMode)) || 'athlete',
  athletes: read<CoachAthlete[]>(ATHLETES_KEY, []),
  activeAthleteId: (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_KEY)) || null,
  notes: typeof localStorage !== 'undefined' ? readNotes() : [],
};

const _listeners = new Set<() => void>();
function notify() { _listeners.forEach((fn) => fn()); }
function persist() {
  try {
    localStorage.setItem(MODE_KEY, _state.mode);
    localStorage.setItem(ATHLETES_KEY, JSON.stringify(_state.athletes));
    localStorage.setItem(NOTES_KEY, JSON.stringify(_state.notes));
    if (_state.activeAthleteId) localStorage.setItem(ACTIVE_KEY, _state.activeAthleteId);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* storage full / disabled — in-memory still works for the session */ }
}
function set(next: Partial<CoachState>) {
  _state = { ..._state, ...next };
  persist();
  notify();
}

function nowISO(): string {
  // App runtime (browser) — Date is available here.
  return new Date().toISOString();
}

// ── actions ───────────────────────────────────────────────
export function setUserMode(mode: UserMode) { set({ mode }); }

export function addAthlete(input: { name: string; email: string; eventName?: string; eventDate?: string; weightKg?: number }): CoachAthlete {
  const athlete: CoachAthlete = {
    id: `ath-${nanoid(8)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    eventName: input.eventName?.trim() || undefined,
    eventDate: input.eventDate || undefined,
    weightKg: input.weightKg,
    planStatus: 'not-started',
    lastActivityISO: nowISO(),
  };
  set({ athletes: [..._state.athletes, athlete] });
  return athlete;
}

export function updateAthlete(id: string, patch: Partial<CoachAthlete>) {
  set({ athletes: _state.athletes.map((a) => (a.id === id ? { ...a, ...patch, lastActivityISO: nowISO() } : a)) });
}

export function removeAthlete(id: string) {
  set({
    athletes: _state.athletes.filter((a) => a.id !== id),
    notes: _state.notes.filter((n) => n.athleteId !== id),
    activeAthleteId: _state.activeAthleteId === id ? null : _state.activeAthleteId,
  });
  void deletePreference(snapshotKey(id)).catch(() => { /* nothing saved yet */ });
}

export function setActiveAthlete(id: string | null) { set({ activeAthleteId: id }); }

export function setPlanStatus(id: string, status: PlanStatus) { updateAthlete(id, { planStatus: status }); }

export function addNote(athleteId: string, text: string) {
  const t = text.trim();
  if (!t) return;
  const note: CoachNote = { id: `note-${nanoid(8)}`, athleteId, text: t, atISO: nowISO() };
  set({ notes: [..._state.notes, note] });
}

export function removeNote(id: string) {
  set({ notes: _state.notes.filter((n) => n.id !== id) });
}

// ── plan snapshots (IndexedDB — RouteData JSON is too big for localStorage) ──

function snapshotKey(athleteId: string): string {
  return `coach_plan_${athleteId}`;
}
const SELF_PLAN_KEY = 'coach_self_plan';

export async function saveAthleteSnapshot(athleteId: string, route: RouteData): Promise<void> {
  await setPreference(snapshotKey(athleteId), JSON.stringify(route));
}

export async function loadAthleteSnapshot(athleteId: string): Promise<RouteData | null> {
  const raw = await getPreference(snapshotKey(athleteId));
  if (!raw) return null;
  try { return JSON.parse(raw) as RouteData; } catch { return null; }
}

/** Stash / restore the coach's own in-progress plan around athlete sessions. */
export async function stashSelfPlan(route: RouteData): Promise<void> {
  await setPreference(SELF_PLAN_KEY, JSON.stringify(route));
}

export async function popSelfPlan(): Promise<RouteData | null> {
  const raw = await getPreference(SELF_PLAN_KEY);
  await deletePreference(SELF_PLAN_KEY).catch(() => { /* fine */ });
  if (!raw) return null;
  try { return JSON.parse(raw) as RouteData; } catch { return null; }
}

/** Stash / restore the coach's own profile around athlete sessions, so
 *  loading an athlete's weight into the planner never overwrites the
 *  coach's own settings for good. localStorage — profiles are tiny. */
export function stashSelfProfile(profile: UserProfile): void {
  try { localStorage.setItem(SELF_PROFILE_KEY, JSON.stringify(profile)); } catch { /* fine */ }
}

export function popSelfProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(SELF_PROFILE_KEY);
    localStorage.removeItem(SELF_PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function hasSelfStash(): boolean {
  try { return localStorage.getItem(SELF_PROFILE_KEY) !== null; } catch { return false; }
}

// ── hook ──────────────────────────────────────────────────
export function useCoachStore() {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick((n) => n + 1);
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);
  return {
    mode: _state.mode,
    athletes: _state.athletes,
    activeAthleteId: _state.activeAthleteId,
    activeAthlete: _state.athletes.find((a) => a.id === _state.activeAthleteId) ?? null,
    notes: _state.notes,
    setUserMode,
    addAthlete,
    updateAthlete,
    removeAthlete,
    setActiveAthlete,
    setPlanStatus,
    addNote,
    removeNote,
  };
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  'not-started': 'No plan yet',
  draft: 'Draft',
  shared: 'Shared',
  completed: 'Completed',
};
