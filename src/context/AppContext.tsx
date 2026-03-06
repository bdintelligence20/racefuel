import { useState, createContext, useContext, useEffect, useCallback, useRef, ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { ProductProps } from '../components/NutritionCard';
import { parseGpx } from '../services/route/gpxParser';
import { parseTcx } from '../services/route/tcxParser';
import { analyzeRoute, RouteAnalysis } from '../services/route/routeAnalyzer';
import { generatePlan, GeneratedPlan } from '../services/nutrition/planGenerator';
import { validatePlan, ValidationResult } from '../services/nutrition/planValidator';
import { autoSavePlan, loadAutoSavedPlan, clearAutoSave } from '../persistence/db';
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

export interface UserProfile {
  weight: number;
  height: number;
  sweatRate: 'light' | 'moderate' | 'heavy';
  ftp: number;
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
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(loadStoredProfile);
  const [routeData, setRouteData] = useState<RouteData>(defaultRoute);
  // Analysis & validation
  const [routeAnalysis, setRouteAnalysis] = useState<RouteAnalysis | null>(null);
  const [planValidation, setPlanValidation] = useState<ValidationResult | null>(null);
  const [lastGeneratedPlan, setLastGeneratedPlan] = useState<GeneratedPlan | null>(null);

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
    const entry = undoStack.current.pop()!;
    setRouteData(prev => {
      redoStack.current.push({ nutritionPoints: [...prev.nutritionPoints] });
      setCanRedo(true);
      setCanUndo(undoStack.current.length > 0);
      return { ...prev, nutritionPoints: entry.nutritionPoints };
    });
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const entry = redoStack.current.pop()!;
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
      autoSavePlan(
        JSON.stringify(routeData),
        routeData.name,
        routeData.distanceKm,
        routeData.elevationGain,
        routeData.estimatedTime,
        routeData.source
      ).catch(console.error);
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [routeData]);

  // Restore auto-saved plan on mount
  useEffect(() => {
    loadAutoSavedPlan().then(saved => {
      if (saved) {
        try {
          const restored = JSON.parse(saved.routeDataJson) as RouteData;
          if (restored.loaded && restored.nutritionPoints.length > 0) {
            setRouteData(restored);
          }
        } catch (e) {
          console.error('Failed to restore autosave:', e);
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

  const completeOnboarding = () => setOnboardingComplete(true);

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

  const loadDemoRoute = (name: string = 'Demo Route') => {
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

  const autoGeneratePlan = () => {
    if (!routeData.loaded) return;

    try {
      pushHistory(routeData.nutritionPoints);

      const timeParts = (routeData.estimatedTime || '3:00:00').split(':').map(Number);
      let durationHours = timeParts[0] + (timeParts[1] || 0) / 60 + (timeParts[2] || 0) / 3600;
      // Fallback: estimate duration from distance if time is missing/zero
      if (!durationHours || durationHours <= 0) {
        durationHours = routeData.distanceKm / 25; // assume ~25 km/h avg
      }

      console.log('[AutoGenerate] Starting...', { distanceKm: routeData.distanceKm, durationHours, profile: userProfile });

      const plan = generatePlan({
        distanceKm: routeData.distanceKm,
        durationHours,
        gpsPath: routeData.gpsPath,
        routeAnalysis: routeAnalysis || undefined,
        profile: userProfile,
        isCompetition: false,
        temperatureCelsius: 22,
        humidity: 50,
      });

      console.log('[AutoGenerate] Generated', plan.nutritionPoints.length, 'points');

      setLastGeneratedPlan(plan);
      setRouteData((prev) => ({
        ...prev,
        nutritionPoints: plan.nutritionPoints,
      }));
    } catch (err) {
      console.error('[AutoGenerate] Error:', err);
    }
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
  };

  const resetAll = () => {
    clearStoredTokens();
    setStrava(defaultStravaState);
    setStravaActivities([]);
    clearStoredProfile();
    setOnboardingComplete(false);
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
