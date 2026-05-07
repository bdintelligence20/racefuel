import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, increment, Timestamp } from 'firebase/firestore';
import { firestore } from './config';

/** Upsert per-user instrumentation metadata on every auth state change.
 *  Reads first so createdAt stays pinned to the first login we ever saw —
 *  a serverTimestamp() merge would otherwise overwrite it every session.
 *  Stored at users/{uid}/_meta/data — collection group queryable from the
 *  admin Cloud Functions. Failures are swallowed so a hiccup here never
 *  blocks the auth flow. */
export async function upsertUserMeta(user: User): Promise<void> {
  if (!user.uid || user.uid === 'dev-user') return;
  try {
    const ref = doc(firestore, 'users', user.uid, '_meta', 'data');
    const existing = await getDoc(ref);
    const payload: Record<string, unknown> = {
      email: (user.email ?? '').toLowerCase() || null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      lastLoginAt: serverTimestamp(),
      loginCount: increment(1),
      lastSignInProvider: user.providerData[0]?.providerId ?? null,
    };
    if (!existing.exists()) {
      payload.createdAt = serverTimestamp();
    }
    await setDoc(ref, payload, { merge: true });
  } catch (err) {
    console.warn('[userMeta] upsert failed:', err);
  }
}

interface StravaAthleteLite {
  id?: number;
  firstname?: string;
  lastname?: string;
  username?: string;
  city?: string;
  country?: string;
}

/** Persist Strava connection state at users/{uid}/_meta/strava so the admin
 *  dashboard can surface "Strava-connected users" without needing Strava
 *  tokens (which stay in localStorage). Called on connect + reconnect. */
export async function persistStravaMeta(uid: string, athlete: StravaAthleteLite): Promise<void> {
  if (!uid || uid === 'dev-user') return;
  try {
    const ref = doc(firestore, 'users', uid, '_meta', 'strava');
    const existing = await getDoc(ref);
    const payload: Record<string, unknown> = {
      athleteId: athlete.id ?? null,
      athleteName: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ') || null,
      username: athlete.username ?? null,
      city: athlete.city ?? null,
      country: athlete.country ?? null,
      lastSyncAt: serverTimestamp(),
    };
    if (!existing.exists()) {
      payload.connectedAt = serverTimestamp();
    }
    await setDoc(ref, payload, { merge: true });
  } catch (err) {
    console.warn('[userMeta] strava persist failed:', err);
  }
}

export async function clearStravaMeta(uid: string): Promise<void> {
  if (!uid || uid === 'dev-user') return;
  try {
    const ref = doc(firestore, 'users', uid, '_meta', 'strava');
    await setDoc(ref, { disconnectedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[userMeta] strava clear failed:', err);
  }
}

export type { Timestamp };
