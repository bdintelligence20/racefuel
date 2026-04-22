import { useState, createContext, useContext, useEffect, useCallback, useRef, ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { ProductProps } from '../components/NutritionCard';
import { parseGpx } from '../services/route/gpxParser';
import { parseTcx } from '../services/route/tcxParser';
import { analyzeRoute, RouteAnalysis } from '../services/route/routeAnalyzer';
import { generatePlan, GeneratedPlan } from '../services/nutrition/planGenerator';
import { generatePlanWithGemini, isGeminiEnabled } from '../services/nutrition/geminiPlanner';
import { validatePlan, ValidationResult } from '../services/nutrition/planValidator';
import { autoSavePlan, loadAutoSavedPlan, clearAutoSave } from '../persistence/db';
import * as firestoreService from '../services/firebase/firestore';
import { getCurrentUser } from '../services/firebase/auth';
import { bundles as allBundles } from '../data/bundles';
import { getWeatherForecast, WeatherForecast } from '../services/weather/weatherService';
import {
  StravaActivitySummary,
  StravaAuthState,
  initiateOAuth,
  hasOAuthCallback,
  parseOAuthCallback,
  exchangeCodeForTokens,
  getStoredTokens,
  storeTokens,
  clearStoredTokens,
  getAthlete,
  getActivities,
  getActivityStreams,
  transformActivityToRoute,
} from '../services/strava';

export type NutritionCategoryPreference = 'gel' | 'drink' | 'bar' | 'chew';
export type Sport = 'running' | 'cycling';
export type GutTolerance = 'beginner' | 'trained' | 'elite';
export type SweatSodiumBucket = 'low' | 'medium' | 'high' | 'unknown';

export interface UserProfile {
  weight: number;
  height: number;
  sweatRate: 'light' | 'moderate' | 'heavy';
  ftp: number;
  /** Categories the user prefers. Soft bias in plan generation — empty/undefined = no preference. */
  preferredCategories?: NutritionCategoryPreference[];
  /** Sport — drives baseline sweat rate and intensity coefficients. */
  sport?: Sport;
  /** Gut-trained carb ceiling. Spec §2.3: hard MIN cap on carb prescription. */
  gutTolerance?: GutTolerance;
  /** Sweat [Na+] bucket — self-reported or from a sweat test. Default: unknown → Medium. */
  sweatSodiumBucket?: SweatSodiumBucket;
  /** True for athletes regularly training in 30°C+ for 2+ weeks. */
  heatAcclimatised?: boolean;
  /** True during the first 10–14 days of seasonal heat exposure. */
  earlySeasonHeat?: boolean;
}

export interface NutritionPoint {
  id: string;
  distanceKm: number;
  product: ProductProps;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface RouteData {
  loaded: boolean;
  name: string;
  distanceKm: number;
  elevationGain: number;
  estimatedTime: string;
  /** User override for expected duration, in "H:MM" or "H:MM:SS" format. Preferred by autoGeneratePlan when set. */
  userEstimatedTime?: string;
  /** ISO date (YYYY-MM-DD) for when the user plans to do this route. Drives weather-aware planning. */
  plannedDate?: string;
  path: {
    x: number;
    y: number;
  }[];
  gpsPath?: GpsPoint[];
  nutritionPoints: NutritionPoint[];
  source?: 'gpx' | 'strava' | 'demo';
  stravaActivityId?: number;
}

interface AppContextType {
  // Existing state
  onboardingComplete: boolean;
  userProfile: UserProfile;
  routeData: RouteData;
  // New: analysis & validation
  routeAnalysis: RouteAnalysis | null;
  planValidation: ValidationResult | null;
  lastGeneratedPlan: GeneratedPlan | null;
  /** Live auto-gen progress. null when idle. */
  autoGenStatus: { phase: string; source: 'gemini' | 'algorithm' } | null;

  // Strava state
  strava: StravaAuthState;
  stravaActivities: StravaActivitySummary[];
  stravaActivitiesLoading: boolean;

  // Undo/redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Existing methods
  completeOnboarding: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  loadRoute: (file: File) => void;
  addNutritionPoint: (product: ProductProps, distanceKm: number) => void;
  removeNutritionPoint: (id: string) => void;
  moveNutritionPoint: (id: string, newDistanceKm: number) => void;
  autoGeneratePlan: () => void;
  resetRoute: () => void;
  loadSavedRoute: (routeData: RouteData) => void;
  setUserEstimatedTime: (hms: string | undefined) => void;
  setPlannedDate: (isoDate: string | undefined) => void;
  selectedBundleId: string | null;
  selectBundle: (id: string | null) => void;

  // Strava methods
  connectStrava: () => void;
  disconnectStrava: () => void;
  fetchStravaActivities: () => Promise<void>;
  importStravaActivity: (activity: StravaActivitySummary) => Promise<void>;
  syncProfileFromStrava: () => Promise<void>;

  // Reset everything
  resetAll: () => void;
}

const defaultProfile: UserProfile = {
  weight: 70,
  height: 175,
  sweatRate: 'moderate',
  ftp: 250,
  sport: 'running',
  gutTolerance: 'trained',
  sweatSodiumBucket: 'unknown',
  heatAcclimatised: false,
  earlySeasonHeat: false,
};

const defaultRoute: RouteData = {
  loaded: false,
  name: '',
  distanceKm: 0,
  elevationGain: 0,
  estimatedTime: '0:00',
  path: [],
  nutritionPoints: [],
};

const defaultStravaState: StravaAuthState = {
  isConnected: false,
  isLoading: false,
  athlete: null,
  tokens: null,
  error: null,
};

// Storage keys
const PROFILE_STORAGE_KEY = 'fuelcue_profile';

function loadStoredProfile(): UserProfile {
  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored) {
      return { ...defaultProfile, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load profile:', e);
  }
  return defaultProfile;
}

function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    // Sync to Firestore if authenticated
    if (getCurrentUser()) {
      firestoreService.saveProfile({
        ...profile,
        onboardingComplete: localStorage.getItem('fuelcue_onboarding_complete') === 'true',
      }).catch(console.error);
    }
  } catch (e) {
    console.error('Failed to save profile:', e);
  }
}

function clearStoredProfile(): void {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

// Undo/redo history
interface HistoryEntry {
  nutritionPoints: NutritionPoint[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [onboardingComplete, setOnboardingComplete] = useState(() => {
    return localStorage.getItem('fuelcue_onboarding_complete') === 'true';
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(loadStoredProfile);
  const [routeData, setRouteData] = useState<RouteData>(defaultRoute);
  // Analysis & validation
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [planValidation, setPlanValidation] = useState<ValidationResult | null>(null);
  const [lastGeneratedPlan, setLastGeneratedPlan] = useState<GeneratedPlan | null>(() => {
    try {
      const stored = localStorage.getItem('fuelcue_last_plan');
      return stored ? (JSON.parse(stored) as GeneratedPlan) : null;
    } catch {
      return null;
    }
  });
  const [autoGenStatus, setAutoGenStatus] = useState<{ phase: string; source: 'gemini' | 'algorithm' } | null>(null);

  // Persist lastGeneratedPlan so its targets survive refresh
  useEffect(() => {
    if (lastGeneratedPlan) {
      localStorage.setItem('fuelcue_last_plan', JSON.stringify(lastGeneratedPlan));
    } else {
      localStorage.removeItem('fuelcue_last_plan');
    }
  }, [lastGeneratedPlan]);

  // Strava state
  const [strava, setStrava] = useState<StravaAuthState>(defaultStravaState);
  const [stravaActivities, setStravaActivities] = useState<StravaActivitySummary[]>([]);
  const [stravaActivitiesLoading, setStravaActivitiesLoading] = useState(false);

  // Undo/redo
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((points: NutritionPoint[]) => {
    undoStack.current.push({ nutritionPoints: [...points] });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const entry = undoStack.current.pop();
    if (!entry) return;
    setRouteData(prev => {
      redoStack.current.push({ nutritionPoints: [...prev.nutritionPoints] });
      setCanRedo(true);
      setCanUndo(undoStack.current.length > 0);
      return { ...prev, nutritionPoints: entry.nutritionPoints };
    });
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const entry = redoStack.current.pop();
    if (!entry) return;
    setRouteData(prev => {
      undoStack.current.push({ nutritionPoints: [...prev.nutritionPoints] });
      setCanUndo(true);
      setCanRedo(redoStack.current.length > 0);
      return { ...prev, nutritionPoints: entry.nutritionPoints };
    });
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Run route analysis when route changes
  useEffect(() => {
    if (routeData.loaded && routeData.gpsPath && routeData.gpsPath.length > 0) {
      const analysis = analyzeRoute(routeData.gpsPath, routeData.distanceKm);
      setRouteAnalysis(analysis);
    } else {
      setRouteAnalysis(null);
    }
  }, [routeData.loaded, routeData.gpsPath, routeData.distanceKm]);

  // Validate plan when nutrition points change
  useEffect(() => {
    if (!routeData.loaded || routeData.nutritionPoints.length === 0) {
      setPlanValidation(null);
      return;
    }

    const timeParts = (routeData.estimatedTime || '3:00:00').split(':').map(Number);
    const durationHours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;

    const validation = validatePlan(
      routeData.nutritionPoints,
      routeData.distanceKm,
      durationHours,
      lastGeneratedPlan?.carbTarget,
      lastGeneratedPlan?.hydrationTarget,
      lastGeneratedPlan?.caffeineStrategy,
      userProfile.weight
    );

    setPlanValidation(validation);
  }, [routeData.nutritionPoints, routeData.loaded, routeData.distanceKm, routeData.estimatedTime, lastGeneratedPlan, userProfile.weight]);

  // Auto-save plan (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!routeData.loaded) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      // Save to IndexedDB (local)
      autoSavePlan(
        JSON.stringify(routeData),
        routeData.name,
        routeData.distanceKm,
        routeData.elevationGain,
        routeData.estimatedTime,
        routeData.source
      ).catch(console.error);
      // Sync to Firestore (cloud)
      if (getCurrentUser()) {
        firestoreService.autoSave(JSON.stringify(routeData), {
          routeName: routeData.name,
          distanceKm: routeData.distanceKm,
          elevationGain: routeData.elevationGain,
          estimatedTime: routeData.estimatedTime,
          source: routeData.source,
        }).catch(console.error);
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [routeData]);

  // Restore auto-saved plan on mount — try Firestore first, then IndexedDB.
  // Restores ANY loaded route, even with zero nutrition points (user might have
  // just uploaded a GPX and not yet placed fuel).
  useEffect(() => {
    const restore = async () => {
      if (getCurrentUser()) {
        try {
          const cloudSave = await firestoreService.loadAutoSave();
          if (cloudSave?.routeDataJson) {
            const restored = JSON.parse(cloudSave.routeDataJson) as RouteData;
            if (restored.loaded) {
              setRouteData(restored);
              return;
            }
          }
        } catch (e) {
          console.error('Failed to restore from Firestore:', e);
        }
      }
      const saved = await loadAutoSavedPlan();
      if (saved) {
        try {
          const restored = JSON.parse(saved.routeDataJson) as RouteData;
          if (restored.loaded) {
            setRouteData(restored);
          }
        } catch (e) {
          console.error('Failed to restore autosave:', e);
        }
      }
    };
    restore().catch(console.error);
  }, []);

  // Load profile from Firestore on mount
  useEffect(() => {
    if (!getCurrentUser()) return;
    firestoreService.loadProfile().then(cloudProfile => {
      if (cloudProfile) {
        const restored: UserProfile = {
          ...defaultProfile,
          weight: cloudProfile.weight ?? defaultProfile.weight,
          height: cloudProfile.height ?? defaultProfile.height,
          sweatRate: cloudProfile.sweatRate ?? defaultProfile.sweatRate,
          ftp: cloudProfile.ftp ?? defaultProfile.ftp,
          sport: cloudProfile.sport ?? defaultProfile.sport,
          gutTolerance: cloudProfile.gutTolerance ?? defaultProfile.gutTolerance,
          sweatSodiumBucket: cloudProfile.sweatSodiumBucket ?? defaultProfile.sweatSodiumBucket,
          heatAcclimatised: cloudProfile.heatAcclimatised ?? defaultProfile.heatAcclimatised,
          earlySeasonHeat: cloudProfile.earlySeasonHeat ?? defaultProfile.earlySeasonHeat,
        };
        setUserProfile(restored);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(restored));
        if (cloudProfile.onboardingComplete) {
          setOnboardingComplete(true);
          localStorage.setItem('fuelcue_onboarding_complete', 'true');
        }
      }
    }).catch(console.error);
  }, []);

  // Check for stored tokens and OAuth callback on mount
  useEffect(() => {
    const initializeStrava = async () => {
      if (hasOAuthCallback()) {
        const { code, error } = parseOAuthCallback();

        if (error) {
          setStrava((prev) => ({
            ...prev,
            error: `Strava authorization failed: ${error}`,
          }));
          return;
        }

        if (code) {
          setStrava((prev) => ({ ...prev, isLoading: true }));
          try {
            const response = await exchangeCodeForTokens(code);
            storeTokens(response);
            setStrava({
              isConnected: true,
              isLoading: false,
              athlete: response.athlete,
              tokens: response,
              error: null,
            });
            setOnboardingComplete(true);
          } catch (err) {
            setStrava({
              ...defaultStravaState,
              error: err instanceof Error ? err.message : 'Failed to connect to Strava',
            });
          }
          return;
        }
      }

      const storedTokens = getStoredTokens();
      if (storedTokens) {
        setStrava((prev) => ({ ...prev, isLoading: true }));
        try {
          const athlete = await getAthlete();
          setStrava({
            isConnected: true,
            isLoading: false,
            athlete,
            tokens: storedTokens,
            error: null,
          });
          setOnboardingComplete(true);
        } catch {
          clearStoredTokens();
          setStrava(defaultStravaState);
        }
      }
    };

    initializeStrava();
  }, []);

  // Strava methods
  const connectStrava = useCallback(() => {
    setStrava((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      initiateOAuth();
    } catch (err) {
      setStrava((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to initiate Strava connection',
      }));
    }
  }, []);

  const disconnectStrava = useCallback(() => {
    clearStoredTokens();
    setStrava(defaultStravaState);
    setStravaActivities([]);
  }, []);

  const fetchStravaActivities = useCallback(async () => {
    if (!strava.isConnected) return;

    setStravaActivitiesLoading(true);
    try {
      const activities = await getActivities(1, 30);
      setStravaActivities(activities);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setStrava((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to fetch activities',
      }));
    } finally {
      setStravaActivitiesLoading(false);
    }
  }, [strava.isConnected]);

  const importStravaActivity = useCallback(async (activity: StravaActivitySummary) => {
    try {
      const streams = await getActivityStreams(activity.id, ['latlng', 'altitude', 'distance']);
      const routeInfo = transformActivityToRoute(activity, streams);

      setRouteData({
        ...routeInfo,
        nutritionPoints: [],
        source: 'strava',
        stravaActivityId: activity.id,
      });
    } catch {
      const routeInfo = transformActivityToRoute(activity);
      setRouteData({
        ...routeInfo,
        nutritionPoints: [],
        source: 'strava',
        stravaActivityId: activity.id,
      });
    }
  }, []);

  const syncProfileFromStrava = useCallback(async () => {
    if (!strava.athlete) return;

    const updates: Partial<UserProfile> = {};

    if (strava.athlete.weight) {
      updates.weight = strava.athlete.weight;
    }

    if (strava.athlete.ftp) {
      updates.ftp = strava.athlete.ftp;
    }

    if (Object.keys(updates).length > 0) {
      setUserProfile((prev) => {
        const updated = { ...prev, ...updates };
        saveProfile(updated);
        return updated;
      });
    }
  }, [strava.athlete]);

  const completeOnboarding = () => {
    setOnboardingComplete(true);
    localStorage.setItem('fuelcue_onboarding_complete', 'true');
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    setUserProfile((prev) => {
      const updated = { ...prev, ...data };
      saveProfile(updated);
      return updated;
    });
  };

  const loadRoute = async (file: File) => {
    try {
      const text = await file.text();
      const isTcx = file.name.toLowerCase().endsWith('.tcx');
      const parsed = isTcx ? parseTcx(text, file.name) : parseGpx(text, file.name);

      setRouteData({
        loaded: true,
        name: parsed.name,
        distanceKm: parsed.distanceKm,
        elevationGain: parsed.elevationGain,
        estimatedTime: parsed.estimatedTime,
        path: parsed.path,
        gpsPath: parsed.gpsPath,
        nutritionPoints: [],
        source: 'gpx',
      });
    } catch (err) {
      console.error('Failed to parse route file:', err);
      loadDemoRoute(file.name.replace(/\.(gpx|tcx)$/i, ''));
    }
  };

  const loadDemoRoute = (name = 'Demo Route') => {
    const gpsPath: GpsPoint[] = [];
    const numPoints = 100;
    const baseLat = -33.9249;
    const baseLng = 18.4241;

    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const lat = baseLat + t * 0.3 + Math.sin(t * Math.PI * 4) * 0.02;
      const lng = baseLng + t * 0.5 + Math.sin(t * Math.PI * 3) * 0.03;
      const elevation = 100 + Math.sin(t * Math.PI * 6) * 200 + t * 300;
      gpsPath.push({ lat, lng, elevation });
    }

    const path = gpsPath.map((p, i) => ({
      x: (i / numPoints) * 1000,
      y: p.elevation || 0,
    }));

    setRouteData({
      loaded: true,
      name: name || 'Cape Town Loop',
      distanceKm: 85.4,
      elevationGain: 1240,
      estimatedTime: '3:15:00',
      path,
      gpsPath,
      nutritionPoints: [],
      source: 'demo',
    });
  };

  const addNutritionPoint = (product: ProductProps, distanceKm: number) => {
    pushHistory(routeData.nutritionPoints);
    const newPoint: NutritionPoint = {
      id: nanoid(),
      distanceKm,
      product,
    };
    setRouteData((prev) => ({
      ...prev,
      nutritionPoints: [...prev.nutritionPoints, newPoint].sort(
        (a, b) => a.distanceKm - b.distanceKm
      ),
    }));
  };

  const removeNutritionPoint = (id: string) => {
    pushHistory(routeData.nutritionPoints);
    setRouteData((prev) => ({
      ...prev,
      nutritionPoints: prev.nutritionPoints.filter((p) => p.id !== id),
    }));
  };

  const moveNutritionPoint = (id: string, newDistanceKm: number) => {
    pushHistory(routeData.nutritionPoints);
    setRouteData((prev) => ({
      ...prev,
      nutritionPoints: prev.nutritionPoints
        .map((p) => p.id === id ? { ...p, distanceKm: Math.max(0, Math.min(prev.distanceKm, newDistanceKm)) } : p)
        .sort((a, b) => a.distanceKm - b.distanceKm),
    }));
  };

  const autoGeneratePlan = async () => {
    if (!routeData.loaded) return;

    try {
      // Prefer the user-set expected time if present; fall back to the auto-estimated one.
      const timeString = routeData.userEstimatedTime || routeData.estimatedTime || '3:00:00';
      const timeParts = timeString.split(':').map(Number);
      let durationHours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
      if (!durationHours || durationHours <= 0) {
        durationHours = routeData.distanceKm / 25;
      }

      // Sports-nutrition research: below ~60 min, stored glycogen covers the effort.
      // No mid-run fueling is recommended or needed.
      if (durationHours < 1) {
        const minutes = Math.round(durationHours * 60);
        toast.info(
          `Under an hour (${minutes} min) doesn't need mid-run fuel — glycogen stores cover it. Hydrate well and go.`,
          { duration: 6000 }
        );
        return;
      }

      // Just over 1hr at a very low speed (e.g. hilly short route estimated at 1:05):
      // if the usable distance for placement is negligible, skip. This mirrors the
      // generator's own early exit but gives the user a friendlier message.
      const avgSpeed = routeData.distanceKm / durationHours;
      const endBuffer = Math.max(1, Math.min(3, avgSpeed * 0.15));
      if (routeData.distanceKm - endBuffer < 3) {
        toast.info(
          `Route is too short to auto-plan — drag a product onto the route to add fuel manually.`,
          { duration: 6000 }
        );
        return;
      }

      // Weather-aware planning: if the user picked a race date, fetch the forecast for
      // that day at the route start. Fall back to sensible defaults on any failure.
      let temperatureCelsius = 22;
      let humidity = 50;
      if (routeData.plannedDate && routeData.gpsPath && routeData.gpsPath.length > 0) {
        try {
          const start = routeData.gpsPath[0];
          const daysFromNow = Math.max(
            1,
            Math.min(
              16,
              Math.ceil((new Date(routeData.plannedDate).getTime() - Date.now()) / (24 * 3600 * 1000)) + 1,
            ),
          );
          const forecast: WeatherForecast[] = await getWeatherForecast(start.lat, start.lng, daysFromNow);
          const match = forecast.find((f) => f.date === routeData.plannedDate) || forecast[forecast.length - 1];
          if (match) {
            temperatureCelsius = Math.round((match.tempMax + match.tempMin) / 2);
            humidity = match.humidity;
          }
        } catch (err) {
          console.error('Weather fetch failed, using defaults:', err);
        }
      }

      // Bundle-aware planning: if a bundle is selected, constrain the generator to its
      // products and cap total spend at its price.
      const selectedBundle = selectedBundleId ? allBundles.find((b) => b.id === selectedBundleId) : null;
      const preferredProductIds = selectedBundle?.products.map((p) => p.productId);
      const budget = selectedBundle?.priceZAR ?? null;

      pushHistory(routeData.nutritionPoints);

      const plannerInput = {
        distanceKm: routeData.distanceKm,
        durationHours,
        elevationGainM: routeData.elevationGain,
        gpsPath: routeData.gpsPath,
        routeAnalysis: routeAnalysis || undefined,
        profile: userProfile,
        isCompetition: false,
        temperatureCelsius,
        humidity,
        preferredCategories: userProfile.preferredCategories,
        preferredProductIds,
        budget,
      };

      // Prefer the Gemini agent when the key is configured. It shares the same
      // carb/hydration/sodium targets as the algorithm (those are evidence-locked)
      // but makes smarter product-selection calls. Any failure or timeout falls
      // back to the deterministic algorithm.
      let plan: GeneratedPlan;
      let source: 'gemini' | 'algorithm' = 'algorithm';

      if (isGeminiEnabled()) {
        setAutoGenStatus({ phase: 'Reading your route', source: 'gemini' });
        const agentPlan = await generatePlanWithGemini({
          ...plannerInput,
          onPhase: (phase) => setAutoGenStatus({ phase, source: 'gemini' }),
        });
        if (agentPlan) {
          plan = agentPlan;
          source = 'gemini';
        } else {
          setAutoGenStatus({ phase: 'Falling back to deterministic planner', source: 'algorithm' });
          plan = generatePlan(plannerInput);
        }
      } else {
        setAutoGenStatus({ phase: 'Placing fuel points', source: 'algorithm' });
        plan = generatePlan(plannerInput);
      }

      if (plan.nutritionPoints.length === 0) {
        toast.info('No fuel points needed — this effort fits within a well-fueled athlete\'s glycogen window.');
        return;
      }

      setLastGeneratedPlan(plan);
      setRouteData((prev) => ({
        ...prev,
        nutritionPoints: plan.nutritionPoints,
      }));
      // Keep the success toast brand-neutral regardless of which engine produced the plan.
      void source;
      toast.success(
        `Plan generated by FuelCue — ${plan.metrics.totalCarbs}g carbs (${plan.metrics.carbsPerHour}g/h), ${plan.nutritionPoints.length} fuel points`
      );
    } catch (err) {
      console.error('[AutoGenerate] Error:', err);
      toast.error('Failed to generate plan — please try again');
    } finally {
      setAutoGenStatus(null);
    }
  };

  const loadSavedRoute = (saved: RouteData) => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setLastGeneratedPlan(null);
    setRouteData(saved);
  };

  const setUserEstimatedTime = (hms: string | undefined) => {
    setRouteData((prev) => ({ ...prev, userEstimatedTime: hms }));
  };

  const setPlannedDate = (isoDate: string | undefined) => {
    setRouteData((prev) => ({ ...prev, plannedDate: isoDate }));
  };

  const [selectedBundleId, setSelectedBundleIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('fuelcue_selected_bundle_id');
  });
  const selectBundle = (id: string | null) => {
    setSelectedBundleIdState(id);
    if (id) localStorage.setItem('fuelcue_selected_bundle_id', id);
    else localStorage.removeItem('fuelcue_selected_bundle_id');
  };

  const resetRoute = () => {
    setRouteData(defaultRoute);
    setRouteAnalysis(null);
    setPlanValidation(null);
    setLastGeneratedPlan(null);
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    clearAutoSave().catch(console.error);
    if (getCurrentUser()) firestoreService.clearAutoSave().catch(console.error);
  };

  const resetAll = () => {
    clearStoredTokens();
    setStrava(defaultStravaState);
    setStravaActivities([]);
    clearStoredProfile();
    setOnboardingComplete(false);
    localStorage.removeItem('fuelcue_onboarding_complete');
    localStorage.removeItem('fuelcue_seen_landing');
    setUserProfile(defaultProfile);
    setRouteData(defaultRoute);
    setRouteAnalysis(null);
    setPlanValidation(null);
    setLastGeneratedPlan(null);
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    clearAutoSave().catch(console.error);
    if (getCurrentUser()) firestoreService.clearAutoSave().catch(console.error);
    localStorage.removeItem('fuelcue_last_plan');
    localStorage.removeItem('fuelcue_mobile_tab');
  };

  return (
    <AppContext.Provider
      value={{
        onboardingComplete,
        userProfile,
        routeData,
        routeAnalysis,
        planValidation,
        lastGeneratedPlan,
        autoGenStatus,

        strava,
        stravaActivities,
        stravaActivitiesLoading,

        canUndo,
        canRedo,
        undo,
        redo,

        completeOnboarding,
        updateProfile,
        loadRoute,
        addNutritionPoint,
        removeNutritionPoint,
        moveNutritionPoint,
        autoGeneratePlan,
        resetRoute,
        loadSavedRoute,
        setUserEstimatedTime,
        setPlannedDate,
        selectedBundleId,
        selectBundle,

        connectStrava,
        disconnectStrava,
        fetchStravaActivities,
        importStravaActivity,
        syncProfileFromStrava,

        resetAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
