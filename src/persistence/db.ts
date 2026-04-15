import Dexie, { type EntityTable } from 'dexie';

export interface SavedPlan {
  id?: number;
  name: string;
  routeName: string;
  distanceKm: number;
  elevationGain: number;
  estimatedTime: string;
  source?: string;
  routeDataJson: string;  // Serialized RouteData
  createdAt: Date;
  updatedAt: Date;
}

export interface SavedPreference {
  key: string;
  value: string;
}

export interface ProductRating {
  id?: number;
  productId: string;
  planId?: number;
  rating: number;        // 1-5 stars
  gutComfort: number;    // 1-5
  taste: number;         // 1-5
  notes?: string;
  createdAt: Date;
}

export interface PlanFeedback {
  id?: number;
  planId?: number;
  routeName: string;
  date: Date;
  overallFeel: number;           // 1-5
  bonkLevel: number;             // 0=none, 1=mild, 2=severe
  executionQuality: number;      // 1-5
  gutIssues: 'none' | 'mild' | 'moderate' | 'severe';
  notes?: string;
  plannedCarbs: number;
  plannedSodium: number;
  plannedCaffeine: number;
  actualCarbs?: number;
  createdAt: Date;
}

class FuelCueDB extends Dexie {
  plans!: EntityTable<SavedPlan, 'id'>;
  preferences!: EntityTable<SavedPreference, 'key'>;
  productRatings!: EntityTable<ProductRating, 'id'>;
  feedback!: EntityTable<PlanFeedback, 'id'>;

  constructor() {
    super('racefuel');

    this.version(1).stores({
      plans: '++id, name, routeName, distanceKm, createdAt, updatedAt',
      preferences: 'key',
    });

    this.version(2).stores({
      plans: '++id, name, routeName, distanceKm, createdAt, updatedAt',
      preferences: 'key',
      productRatings: '++id, productId, planId, rating, createdAt',
      feedback: '++id, planId, routeName, date, createdAt',
    });
  }
}

export const db = new FuelCueDB();

// Plan operations
export async function savePlan(plan: Omit<SavedPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const id = await db.plans.add({
    ...plan,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id as number;
}

export async function saveOrUpdatePlan(plan: Omit<SavedPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  // Find existing plan with same route name (excluding autosaves)
  const existing = await db.plans
    .where('routeName')
    .equals(plan.routeName)
    .filter(p => !p.name.startsWith('Auto-save:'))
    .first();

  if (existing?.id) {
    await updatePlan(existing.id, {
      name: plan.name,
      routeDataJson: plan.routeDataJson,
      distanceKm: plan.distanceKm,
      elevationGain: plan.elevationGain,
      estimatedTime: plan.estimatedTime,
      source: plan.source,
    });
    return existing.id;
  }

  return savePlan(plan);
}

export async function updatePlan(id: number, plan: Partial<SavedPlan>): Promise<void> {
  await db.plans.update(id, { ...plan, updatedAt: new Date() });
}

export async function deletePlan(id: number): Promise<void> {
  await db.plans.delete(id);
}

export async function getAllPlans(): Promise<SavedPlan[]> {
  return db.plans.orderBy('updatedAt').reverse().toArray();
}

export async function getPlan(id: number): Promise<SavedPlan | undefined> {
  return db.plans.get(id);
}

// Auto-save: save/update the "current" plan
const AUTOSAVE_KEY = 'autosave_plan_id';

export async function autoSavePlan(routeDataJson: string, routeName: string, distanceKm: number, elevationGain: number, estimatedTime: string, source?: string): Promise<void> {
  const existingIdStr = await getPreference(AUTOSAVE_KEY);
  const existingId = existingIdStr ? parseInt(existingIdStr) : null;

  if (existingId) {
    const existing = await db.plans.get(existingId);
    if (existing) {
      await updatePlan(existingId, {
        routeDataJson,
        routeName,
        distanceKm,
        elevationGain,
        estimatedTime,
        source,
      });
      return;
    }
  }

  // Create new autosave
  const id = await savePlan({
    name: `Auto-save: ${routeName}`,
    routeName,
    distanceKm,
    elevationGain,
    estimatedTime,
    source,
    routeDataJson,
  });

  await setPreference(AUTOSAVE_KEY, id.toString());
}

export async function loadAutoSavedPlan(): Promise<SavedPlan | null> {
  const idStr = await getPreference(AUTOSAVE_KEY);
  if (!idStr) return null;

  const id = parseInt(idStr);
  const plan = await db.plans.get(id);
  return plan || null;
}

export async function clearAutoSave(): Promise<void> {
  const idStr = await getPreference(AUTOSAVE_KEY);
  if (idStr) {
    await db.plans.delete(parseInt(idStr));
    await deletePreference(AUTOSAVE_KEY);
  }
}

// Preference operations
export async function getPreference(key: string): Promise<string | null> {
  const pref = await db.preferences.get(key);
  return pref?.value ?? null;
}

export async function setPreference(key: string, value: string): Promise<void> {
  await db.preferences.put({ key, value });
}

export async function deletePreference(key: string): Promise<void> {
  await db.preferences.delete(key);
}

// Product rating operations
export async function addProductRating(rating: Omit<ProductRating, 'id' | 'createdAt'>): Promise<number> {
  return await db.productRatings.add({ ...rating, createdAt: new Date() }) as number;
}

export async function getProductRatings(productId: string): Promise<ProductRating[]> {
  return db.productRatings.where('productId').equals(productId).reverse().sortBy('createdAt');
}

export async function getAverageProductRating(productId: string): Promise<{ rating: number; count: number } | null> {
  const ratings = await db.productRatings.where('productId').equals(productId).toArray();
  if (ratings.length === 0) return null;
  const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  return { rating: Math.round(avg * 10) / 10, count: ratings.length };
}

export async function deleteProductRating(id: number): Promise<void> {
  await db.productRatings.delete(id);
}

// Feedback operations
export async function addFeedback(fb: Omit<PlanFeedback, 'id' | 'createdAt'>): Promise<number> {
  return await db.feedback.add({ ...fb, createdAt: new Date() }) as number;
}

export async function getAllFeedback(): Promise<PlanFeedback[]> {
  return db.feedback.orderBy('date').reverse().toArray();
}

export async function getFeedbackForPlan(planId: number): Promise<PlanFeedback[]> {
  return db.feedback.where('planId').equals(planId).toArray();
}

export async function deleteFeedback(id: number): Promise<void> {
  await db.feedback.delete(id);
}
