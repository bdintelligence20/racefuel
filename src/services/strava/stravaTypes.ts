// Strava API TypeScript interfaces

// OAuth token response from Strava
export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp (seconds)
  expires_in: number; // Seconds until expiration
  token_type: 'Bearer';
}

// Athlete profile from Strava
export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile_medium: string; // Avatar URL
  profile: string; // Full size avatar
  weight: number | null; // In kg
  ftp: number | null; // Functional Threshold Power
  measurement_preference: 'feet' | 'meters';
}

// Strava activity summary (from list endpoint)
export interface StravaActivitySummary {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string; // ISO 8601
  start_date_local: string;
  distance: number; // In meters
  moving_time: number; // In seconds
  elapsed_time: number; // In seconds
  total_elevation_gain: number; // In meters
  average_speed: number; // In m/s
  max_speed: number; // In m/s
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  map: {
    id: string;
    summary_polyline: string; // Encoded polyline
    resource_state: number;
  };
}

// GPS stream data from activity streams endpoint
export interface StravaStream {
  type: 'latlng' | 'altitude' | 'distance' | 'time' | 'watts' | 'heartrate';
  data: number[] | [number, number][];
  series_type: 'distance' | 'time';
  original_size: number;
  resolution: 'low' | 'medium' | 'high';
}

// Auth state for the app
export interface StravaAuthState {
  isConnected: boolean;
  isLoading: boolean;
  athlete: StravaAthlete | null;
  tokens: StravaTokens | null;
  error: string | null;
}

// OAuth callback response (includes tokens + athlete)
export interface StravaOAuthResponse extends StravaTokens {
  athlete: StravaAthlete;
}

// Strava saved route (from /athlete/routes endpoint). Distinct from
// activities — these are routes the user has built/saved on Strava but may
// not have ridden yet, which is the gap our import flow was missing.
export interface StravaRouteSummary {
  id: number;
  id_str: string;
  name: string;
  description: string;
  type: number; // 1 = Ride, 2 = Run
  sub_type: number; // 1 road, 2 mtb, 3 cx, 4 trail, 5 mixed
  private: boolean;
  starred: boolean;
  timestamp: number;
  created_at: string;
  updated_at: string;
  distance: number; // meters
  elevation_gain: number; // meters
  estimated_moving_time: number; // seconds
  map: {
    id: string;
    summary_polyline: string;
    resource_state: number;
  };
}

// Activity type display labels for filtering
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  Ride: 'Cycling',
  VirtualRide: 'Virtual Ride',
  EBikeRide: 'E-Bike',
  Run: 'Running',
  VirtualRun: 'Virtual Run',
  TrailRun: 'Trail Run',
  Swim: 'Swimming',
  Hike: 'Hiking',
  Walk: 'Walking',
} as const;
