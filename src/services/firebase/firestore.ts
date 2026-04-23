import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from './config';
import { getCurrentUser } from './auth';

function getUserId(): string {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user.uid;
}

function userDoc(path: string) {
  return doc(firestore, 'users', getUserId(), ...path.split('/'));
}

function userCollection(path: string) {
  return collection(firestore, 'users', getUserId(), path);
}

// ── User Profile ──

export interface FirestoreProfile {
  weight: number;
  height: number;
  sweatRate: 'light' | 'moderate' | 'heavy';
  ftp: number;
  onboardingComplete: boolean;
  sport?: 'running' | 'cycling';
  gutTolerance?: 'beginner' | 'trained' | 'elite';
  sweatSodiumBucket?: 'low' | 'medium' | 'high' | 'unknown';
  heatAcclimatised?: boolean;
  earlySeasonHeat?: boolean;
  carbTargetGPerHour?: number;
  preferredBrands?: string[];
  updatedAt?: Timestamp;
}

export async function saveProfile(profile: Omit<FirestoreProfile, 'updatedAt'>): Promise<void> {
  await setDoc(userDoc('profile/data'), {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadProfile(): Promise<FirestoreProfile | null> {
  const snap = await getDoc(userDoc('profile/data'));
  return snap.exists() ? (snap.data() as FirestoreProfile) : null;
}

// ── User Preferences (UI state that should survive across devices) ──

export interface FirestorePreferences {
  /** ID of the currently active bundle, or null if none. */
  selectedBundleId?: string | null;
  /** Per-bundle flavour selections: { [bundleId]: { [productId]: flavour } } */
  kitFlavours?: Record<string, Record<string, string>>;
  updatedAt?: Timestamp;
}

export async function savePreferences(prefs: Omit<FirestorePreferences, 'updatedAt'>): Promise<void> {
  await setDoc(userDoc('preferences/data'), {
    ...prefs,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadPreferences(): Promise<FirestorePreferences | null> {
  const snap = await getDoc(userDoc('preferences/data'));
  return snap.exists() ? (snap.data() as FirestorePreferences) : null;
}

// ── Saved Plans ──

export interface FirestorePlan {
  id?: string;
  name: string;
  routeName: string;
  distanceKm: number;
  elevationGain: number;
  estimatedTime: string;
  source?: string;
  routeDataJson: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export async function savePlan(plan: Omit<FirestorePlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = doc(userCollection('plans'));
  await setDoc(ref, {
    ...plan,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePlan(planId: string, data: Partial<FirestorePlan>): Promise<void> {
  await updateDoc(userDoc(`plans/${planId}`), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlan(planId: string): Promise<void> {
  await deleteDoc(userDoc(`plans/${planId}`));
}

export async function getAllPlans(): Promise<(FirestorePlan & { id: string })[]> {
  const q = query(userCollection('plans'), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FirestorePlan & { id: string }));
}

export async function getPlan(planId: string): Promise<FirestorePlan | null> {
  const snap = await getDoc(userDoc(`plans/${planId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } as FirestorePlan : null;
}

// ── Auto-save (single doc per user) ──

export async function autoSave(routeDataJson: string, meta: { routeName: string; distanceKm: number; elevationGain: number; estimatedTime: string; source?: string }): Promise<void> {
  await setDoc(userDoc('autosave/current'), {
    ...meta,
    routeDataJson,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadAutoSave(): Promise<{ routeDataJson: string } | null> {
  const snap = await getDoc(userDoc('autosave/current'));
  return snap.exists() ? (snap.data() as { routeDataJson: string }) : null;
}

export async function clearAutoSave(): Promise<void> {
  try {
    await deleteDoc(userDoc('autosave/current'));
  } catch {
    // doc may not exist
  }
}

// ── Product Ratings ──

export interface FirestoreRating {
  id?: string;
  productId: string;
  planId?: string;
  rating: number;
  gutComfort: number;
  taste: number;
  notes?: string;
  createdAt?: Timestamp;
}

export async function addRating(rating: Omit<FirestoreRating, 'id' | 'createdAt'>): Promise<string> {
  const ref = doc(userCollection('ratings'));
  await setDoc(ref, { ...rating, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getProductRatings(productId: string): Promise<(FirestoreRating & { id: string })[]> {
  const q = query(userCollection('ratings'), where('productId', '==', productId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreRating & { id: string }));
}

export async function deleteRating(ratingId: string): Promise<void> {
  await deleteDoc(userDoc(`ratings/${ratingId}`));
}

// ── Plan Feedback ──

export interface FirestoreFeedback {
  id?: string;
  planId?: string;
  routeName: string;
  date: Timestamp;
  overallFeel: number;
  bonkLevel: number;
  executionQuality: number;
  gutIssues: 'none' | 'mild' | 'moderate' | 'severe';
  notes?: string;
  plannedCarbs: number;
  plannedSodium: number;
  plannedCaffeine: number;
  actualCarbs?: number;
  createdAt?: Timestamp;
}

export async function addFeedback(fb: Omit<FirestoreFeedback, 'id' | 'createdAt'>): Promise<string> {
  const ref = doc(userCollection('feedback'));
  await setDoc(ref, { ...fb, createdAt: serverTimestamp() });
  return ref.id;
}

export async function getAllFeedback(): Promise<(FirestoreFeedback & { id: string })[]> {
  const q = query(userCollection('feedback'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreFeedback & { id: string }));
}

export async function deleteFeedback(feedbackId: string): Promise<void> {
  await deleteDoc(userDoc(`feedback/${feedbackId}`));
}

// ── Custom products (user-created products not in the main feed) ──

export interface FirestoreCustomProduct {
  id: string; // same id used in NutritionPoint — set by the caller
  brand: string;
  name: string;
  carbs: number;
  calories: number;
  sodium: number;
  caffeine: number;
  priceZAR: number;
  category: 'gel' | 'drink' | 'bar' | 'chew';
  color: string;
  image: string;
  servingsPerPack?: number;
  createdAt?: Timestamp;
}

export async function addCustomProduct(product: Omit<FirestoreCustomProduct, 'createdAt'>): Promise<void> {
  await setDoc(userDoc(`customProducts/${product.id}`), {
    ...product,
    createdAt: serverTimestamp(),
  });
}

export async function listCustomProducts(): Promise<FirestoreCustomProduct[]> {
  const q = query(userCollection('customProducts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as FirestoreCustomProduct);
}

export async function deleteCustomProduct(productId: string): Promise<void> {
  try {
    await deleteDoc(userDoc(`customProducts/${productId}`));
  } catch {
    // doc may not exist
  }
}

// ── Last generated plan snapshot (strategy modal state, cross-device) ──

export interface FirestoreLastPlan {
  planJson: string;
  updatedAt?: Timestamp;
}

export async function saveLastPlan(planJson: string): Promise<void> {
  await setDoc(userDoc('state/lastPlan'), {
    planJson,
    updatedAt: serverTimestamp(),
  });
}

export async function loadLastPlan(): Promise<string | null> {
  const snap = await getDoc(userDoc('state/lastPlan'));
  return snap.exists() ? (snap.data() as FirestoreLastPlan).planJson : null;
}

export async function clearLastPlan(): Promise<void> {
  try {
    await deleteDoc(userDoc('state/lastPlan'));
  } catch {
    // doc may not exist
  }
}

// ── Preferences ──

export async function setPreference(key: string, value: string): Promise<void> {
  await setDoc(userDoc(`preferences/${key}`), { value, updatedAt: serverTimestamp() });
}

export async function getPreference(key: string): Promise<string | null> {
  const snap = await getDoc(userDoc(`preferences/${key}`));
  return snap.exists() ? (snap.data() as { value: string }).value : null;
}
