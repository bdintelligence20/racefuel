import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';

/**
 * Coach mode store — the brief's second user type (coaches & nutritionists)
 * as a parallel primary journey alongside the athlete flow.
 *
 * SCOPE NOTE (honest): this is the single-device, local-first spine. It fully
 * implements the coach-facing experience — a role toggle, an athlete roster
 * with status, add-by-email, build-for-athlete context, and per-athlete notes/
 * messages — persisted to localStorage following the same pattern the rest of
 * the app uses before its Firestore mirror. The genuinely cross-account pieces
 * (email invites that land in another user's inbox, a shared plan appearing in
 * a *different* athlete's signed-in app, real-time two-way messaging) require a
 * Firestore schema + security rules + a Cloud Function for invites. Those are
 * deliberately left as the backend integration step rather than faked, because
 * a stubbed "shared!" that doesn't actually deliver would be dishonest. The
 * data model here is shaped to back onto Firestore with no UI rework.
 */

export type UserMode = 'athlete' | 'coach';
export type PlanStatus = 'not-started' | 'draft' | 'shared' | 'completed';

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
  /** ISO timestamp of the last time the coach touched this athlete. */
  lastActivityISO?: string;
}

export interface CoachMessage {
  id: string;
  athleteId: string;
  from: 'coach' | 'athlete';
  text: string;
  atISO: string;
}

interface CoachState {
  mode: UserMode;
  athletes: CoachAthlete[];
  activeAthleteId: string | null;
  messages: CoachMessage[];
}

const MODE_KEY = 'fuelcue_user_mode';
const ATHLETES_KEY = 'fuelcue_coach_athletes';
const MESSAGES_KEY = 'fuelcue_coach_messages';
const ACTIVE_KEY = 'fuelcue_coach_active_athlete';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

let _state: CoachState = {
  mode: (typeof localStorage !== 'undefined' && (localStorage.getItem(MODE_KEY) as UserMode)) || 'athlete',
  athletes: read<CoachAthlete[]>(ATHLETES_KEY, []),
  activeAthleteId: (typeof localStorage !== 'undefined' && localStorage.getItem(ACTIVE_KEY)) || null,
  messages: read<CoachMessage[]>(MESSAGES_KEY, []),
};

const _listeners = new Set<() => void>();
function notify() { _listeners.forEach((fn) => fn()); }
function persist() {
  try {
    localStorage.setItem(MODE_KEY, _state.mode);
    localStorage.setItem(ATHLETES_KEY, JSON.stringify(_state.athletes));
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(_state.messages));
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
    email: input.email.trim(),
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
    messages: _state.messages.filter((m) => m.athleteId !== id),
    activeAthleteId: _state.activeAthleteId === id ? null : _state.activeAthleteId,
  });
}

export function setActiveAthlete(id: string | null) { set({ activeAthleteId: id }); }

export function setPlanStatus(id: string, status: PlanStatus) { updateAthlete(id, { planStatus: status }); }

export function addMessage(athleteId: string, from: 'coach' | 'athlete', text: string) {
  const t = text.trim();
  if (!t) return;
  const msg: CoachMessage = { id: `msg-${nanoid(8)}`, athleteId, from, text: t, atISO: nowISO() };
  set({ messages: [..._state.messages, msg] });
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
    messages: _state.messages,
    setUserMode,
    addAthlete,
    updateAthlete,
    removeAthlete,
    setActiveAthlete,
    setPlanStatus,
    addMessage,
  };
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  'not-started': 'Not started',
  draft: 'Draft',
  shared: 'Shared',
  completed: 'Completed',
};
