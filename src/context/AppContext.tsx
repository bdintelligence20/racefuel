import React, { useState, createContext, useContext, useEffect, useCallback, ReactNode } from 'react';
import { ProductProps } from '../components/NutritionCard';
import {
  StravaAthlete,
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

// Types
export type SportType = 'cycling' | 'running' | 'triathlon' | 'hiking';

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
  sportType: SportType;

  // Strava state
  strava: StravaAuthState;
  stravaActivities: StravaActivitySummary[];
  stravaActivitiesLoading: boolean;

  // Existing methods
  completeOnboarding: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
  setSportType: (sport: SportType) => void;
  loadRoute: (file: File) => void;
  addNutritionPoint: (product: ProductProps, distanceKm: number) => void;
  removeNutritionPoint: (id: string) => void;
  autoGeneratePlan: () => void;
  resetRoute: () => void;

  // Strava methods
  connectStrava: () => void;
  disconnectStrava: () => void;
  fetchStravaActivities: () => Promise<void>;
  importStravaActivity: (activity: StravaActivitySummary) => Promise<void>;
  syncProfileFromStrava: () => Promise<void>;

  // Reset everything for demo
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
const PROFILE_STORAGE_KEY = 'racefuel_profile';

// Load profile from localStorage
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

// Save profile to localStorage
function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save profile:', e);
  }
}

// Clear stored profile
function clearStoredProfile(): void {
  localStorage.removeItem(PROFILE_STORAGE_KEY);
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(loadStoredProfile);
  const [routeData, setRouteData] = useState<RouteData>(defaultRoute);
  const [sportType, setSportType] = useState<SportType>('cycling');

  // Strava state
  const [strava, setStrava] = useState<StravaAuthState>(defaultStravaState);
  const [stravaActivities, setStravaActivities] = useState<StravaActivitySummary[]>([]);
  const [stravaActivitiesLoading, setStravaActivitiesLoading] = useState(false);

  // Check for stored tokens and OAuth callback on mount
  useEffect(() => {
    const initializeStrava = async () => {
      // Check for OAuth callback first
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
            // Complete onboarding when connected via OAuth
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

      // Check for existing tokens
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
        } catch (err) {
          // Tokens might be invalid, clear them
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
      const activities = await getActivities(1, 30, sportType);
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
  }, [strava.isConnected, sportType]);

  const importStravaActivity = useCallback(async (activity: StravaActivitySummary) => {
    try {
      // Fetch detailed streams for better route data
      const streams = await getActivityStreams(activity.id, ['latlng', 'altitude', 'distance']);
      const routeInfo = transformActivityToRoute(activity, streams);

      setRouteData({
        ...routeInfo,
        nutritionPoints: [],
        source: 'strava',
        stravaActivityId: activity.id,
      });
    } catch (err) {
      // Fallback to activity summary polyline
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

  // Existing methods
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
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');

      // Extract track points from GPX
      const trackPoints = xml.querySelectorAll('trkpt');
      const routePoints = xml.querySelectorAll('rtept');
      const points = trackPoints.length > 0 ? trackPoints : routePoints;

      if (points.length === 0) {
        // No GPS data found, load demo route
        loadDemoRoute(file.name.replace('.gpx', ''));
        return;
      }

      const gpsPath: GpsPoint[] = [];
      let totalDistance = 0;
      let totalElevationGain = 0;
      let prevLat: number | null = null;
      let prevLng: number | null = null;
      let prevEle: number | null = null;

      points.forEach((point) => {
        const lat = parseFloat(point.getAttribute('lat') || '0');
        const lng = parseFloat(point.getAttribute('lon') || '0');
        const eleNode = point.querySelector('ele');
        const elevation = eleNode ? parseFloat(eleNode.textContent || '0') : undefined;

        gpsPath.push({ lat, lng, elevation });

        // Calculate distance (haversine)
        if (prevLat !== null && prevLng !== null) {
          const R = 6371; // Earth's radius in km
          const dLat = ((lat - prevLat) * Math.PI) / 180;
          const dLng = ((lng - prevLng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((prevLat * Math.PI) / 180) *
              Math.cos((lat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          totalDistance += R * c;
        }

        // Calculate elevation gain
        if (elevation !== undefined && prevEle !== null && elevation > prevEle) {
          totalElevationGain += elevation - prevEle;
        }

        prevLat = lat;
        prevLng = lng;
        if (elevation !== undefined) prevEle = elevation;
      });

      // Estimate time based on distance (assuming ~25km/h average)
      const hours = totalDistance / 25;
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      const estimatedTime = `${h}:${m.toString().padStart(2, '0')}:00`;

      // Create path for elevation profile (x = distance, y = elevation)
      const path = gpsPath.map((p, i) => ({
        x: (i / (gpsPath.length - 1)) * 1000,
        y: p.elevation || 0,
      }));

      setRouteData({
        loaded: true,
        name: file.name.replace('.gpx', '').replace(/_/g, ' '),
        distanceKm: Math.round(totalDistance * 10) / 10,
        elevationGain: Math.round(totalElevationGain),
        estimatedTime,
        path,
        gpsPath,
        nutritionPoints: [],
        source: 'gpx',
      });
    } catch (err) {
      console.error('Failed to parse GPX file:', err);
      // Fallback to demo route
      loadDemoRoute(file.name.replace('.gpx', ''));
    }
  };

  const loadDemoRoute = (name: string = 'Demo Route') => {
    // Generate demo route centered on Cape Town, South Africa
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
    const newPoint: NutritionPoint = {
      id: Math.random().toString(36).substr(2, 9),
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
    setRouteData((prev) => ({
      ...prev,
      nutritionPoints: prev.nutritionPoints.filter((p) => p.id !== id),
    }));
  };

  const autoGeneratePlan = () => {
    if (!routeData.loaded) return;
    // Simple algorithm: Hydration every 30min (~15km), Gel every 45min (~22km)
    const points: NutritionPoint[] = [];
    // Mock products
    const gel: ProductProps = {
      brand: 'GU',
      name: 'Energy Gel',
      calories: 100,
      carbs: 22,
      sodium: 60,
      caffeine: 20,
      color: 'orange',
    };
    const drink: ProductProps = {
      brand: 'SIS',
      name: 'Beta Fuel',
      calories: 320,
      carbs: 80,
      sodium: 500,
      caffeine: 0,
      color: 'blue',
    };
    // Add points
    for (let km = 15; km < routeData.distanceKm; km += 15) {
      points.push({
        id: Math.random().toString(36).substr(2, 9),
        distanceKm: km,
        product: km % 30 === 0 ? drink : gel,
      });
    }
    setRouteData((prev) => ({
      ...prev,
      nutritionPoints: points,
    }));
  };

  const resetRoute = () => {
    setRouteData(defaultRoute);
  };

  const resetAll = () => {
    // Clear Strava tokens and state
    clearStoredTokens();
    setStrava(defaultStravaState);
    setStravaActivities([]);

    // Clear stored profile
    clearStoredProfile();

    // Reset all app state
    setOnboardingComplete(false);
    setUserProfile(defaultProfile);
    setRouteData(defaultRoute);
    setSportType('cycling');
  };

  return (
    <AppContext.Provider
      value={{
        // Existing state
        onboardingComplete,
        userProfile,
        routeData,
        sportType,

        // Strava state
        strava,
        stravaActivities,
        stravaActivitiesLoading,

        // Existing methods
        completeOnboarding,
        updateProfile,
        setSportType,
        loadRoute,
        addNutritionPoint,
        removeNutritionPoint,
        autoGeneratePlan,
        resetRoute,

        // Strava methods
        connectStrava,
        disconnectStrava,
        fetchStravaActivities,
        importStravaActivity,
        syncProfileFromStrava,

        // Reset
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
