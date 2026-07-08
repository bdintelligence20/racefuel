import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { firestore } from '../firebase/config';
import { getCurrentUser } from '../firebase/auth';
import type { RouteData } from '../../context/AppContext';

/**
 * Real cross-account plan delivery. A coach shares a plan by writing a doc
 * to the top-level `sharedPlans` collection addressed to the athlete's
 * email; when a user signed in with that email opens the app, the plan is
 * there. Security rules restrict reads to the sending coach and the
 * addressed athlete (matched on the verified auth token email).
 */

export interface SharedPlan {
  id: string;
  coachUid: string;
  coachName: string;
  coachEmail: string;
  athleteEmail: string;
  athleteName: string;
  routeName: string;
  distanceKm: number;
  elevationGain: number;
  estimatedTime: string;
  points: number;
  totalCarbs: number;
  routeDataJson: string;
  createdAt?: Timestamp;
}

/** Firestore caps documents at ~1MB. Long GPX tracks can exceed that, so
 *  the GPS path is thinned to fit — fuel points and stats are untouched,
 *  and a few thousand vertices still draw an accurate route line. */
function fitForFirestore(route: RouteData): string {
  let candidate = route;
  let json = JSON.stringify(candidate);
  while (json.length > 900_000 && candidate.gpsPath && candidate.gpsPath.length > 500) {
    const gps = candidate.gpsPath;
    const thinned = gps.filter((_, i) => i % 2 === 0 || i === gps.length - 1);
    candidate = { ...candidate, gpsPath: thinned, path: candidate.path.filter((_, i) => i % 2 === 0) };
    json = JSON.stringify(candidate);
  }
  return json;
}

export async function sharePlanWithAthlete(input: {
  athleteEmail: string;
  athleteName: string;
  route: RouteData;
}): Promise<void> {
  const user = getCurrentUser();
  if (!user?.email) throw new Error('Not signed in');
  const totalCarbs = input.route.nutritionPoints.reduce((sum, p) => sum + p.product.carbs, 0);
  const ref = doc(collection(firestore, 'sharedPlans'));
  await setDoc(ref, {
    coachUid: user.uid,
    coachName: user.displayName || user.email,
    coachEmail: user.email.toLowerCase(),
    athleteEmail: input.athleteEmail.trim().toLowerCase(),
    athleteName: input.athleteName,
    routeName: input.route.name || 'Unnamed route',
    distanceKm: input.route.distanceKm,
    elevationGain: input.route.elevationGain,
    estimatedTime: input.route.estimatedTime,
    points: input.route.nutritionPoints.length,
    totalCarbs,
    routeDataJson: fitForFirestore(input.route),
    createdAt: serverTimestamp(),
  });
}

/** Plans addressed to the signed-in user, newest first. */
export async function listPlansSharedWithMe(): Promise<SharedPlan[]> {
  const user = getCurrentUser();
  if (!user?.email) return [];
  const q = query(
    collection(firestore, 'sharedPlans'),
    where('athleteEmail', '==', user.email.toLowerCase()),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as SharedPlan))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

export async function deleteSharedPlan(id: string): Promise<void> {
  await deleteDoc(doc(firestore, 'sharedPlans', id));
}
