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

class FuelCueDB extends Dexie {
  plans!: EntityTable<SavedPlan, 'id'>;
  preferences!: EntityTable<SavedPreference, 'key'>;

  constructor() {
    super('racefuel');

    this.version(1).stores({
      plans: '++id, name, routeName, distanceKm, createdAt, updatedAt',
      preferences: 'key',
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
