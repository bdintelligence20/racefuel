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

// Sport type from app context
import { SportType } from '../../context/AppContext';

// Activity type mappings for each sport
export const SPORT_ACTIVITY_TYPES: Record<SportType, readonly string[]> = {
  cycling: ['Ride', 'VirtualRide', 'EBikeRide', 'Handcycle', 'Velomobile'],
  running: ['Run', 'VirtualRun', 'TrailRun'],
  triathlon: ['Ride', 'VirtualRide', 'EBikeRide', 'Run', 'VirtualRun', 'TrailRun', 'Swim'],
  hiking: ['Hike', 'Walk'],
} as const;

// Legacy export for backwards compatibility
export const CYCLING_ACTIVITY_TYPES = SPORT_ACTIVITY_TYPES.cycling;

export type CyclingActivityType = typeof CYCLING_ACTIVITY_TYPES[number];
