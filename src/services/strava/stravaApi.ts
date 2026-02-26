// Strava API client

import { StravaAthlete, StravaActivitySummary, StravaStream, SPORT_ACTIVITY_TYPES } from './stravaTypes';
import { getValidAccessToken } from './stravaAuth';
import { SportType } from '../../context/AppContext';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

class StravaApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'StravaApiError';
  }
}

/**
 * Make an authenticated request to the Strava API
 */
async function stravaFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new StravaApiError(401, 'Not authenticated with Strava');
  }

  const response = await fetch(`${STRAVA_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new StravaApiError(
      response.status,
      errorData.message || `Strava API error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Get the authenticated athlete's profile
 */
export async function getAthlete(): Promise<StravaAthlete> {
  return stravaFetch<StravaAthlete>('/athlete');
}

/**
 * Get the athlete's recent activities
 * @param page Page number (1-indexed)
 * @param perPage Number of activities per page (max 200)
 * @param sportType Filter by sport type, or null for all activities
 */
export async function getActivities(
  page = 1,
  perPage = 30,
  sportType: SportType | null = 'cycling'
): Promise<StravaActivitySummary[]> {
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
  });

  const activities = await stravaFetch<StravaActivitySummary[]>(
    `/athlete/activities?${params.toString()}`
  );

  if (sportType) {
    const allowedTypes = SPORT_ACTIVITY_TYPES[sportType];
    return activities.filter((activity) =>
      allowedTypes.includes(activity.type)
    );
  }

  return activities;
}

/**
 * Get activity streams (GPS coordinates, altitude, etc.)
 * @param activityId The activity ID
 * @param types Array of stream types to fetch
 */
export async function getActivityStreams(
  activityId: number,
  types: ('latlng' | 'altitude' | 'distance' | 'time')[] = ['latlng', 'altitude', 'distance']
): Promise<StravaStream[]> {
  const params = new URLSearchParams({
    keys: types.join(','),
    key_by_type: 'true',
  });

  // The response is an object keyed by stream type when key_by_type is true
  const response = await stravaFetch<Record<string, StravaStream>>(
    `/activities/${activityId}/streams?${params.toString()}`
  );

  // Convert object to array
  return Object.entries(response).map(([type, stream]) => ({
    ...stream,
    type: type as StravaStream['type'],
  }));
}

/**
 * Get a single activity by ID
 */
export async function getActivity(activityId: number): Promise<StravaActivitySummary> {
  return stravaFetch<StravaActivitySummary>(`/activities/${activityId}`);
}
