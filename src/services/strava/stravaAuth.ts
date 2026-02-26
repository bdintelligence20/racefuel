// Strava OAuth authentication handling

import { StravaTokens, StravaOAuthResponse } from './stravaTypes';

// Strava OAuth endpoints
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

// Storage keys
const TOKENS_STORAGE_KEY = 'strava_tokens';

// Strava API credentials
// NOTE: For client-side OAuth, these are exposed in the browser.
// This is acceptable for personal/development use only.
// For production, use a backend to handle token exchange.
const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET || '';
const REDIRECT_URI = import.meta.env.VITE_STRAVA_REDIRECT_URI || `${window.location.origin}`;

// Scopes we need
const SCOPES = 'read,activity:read_all,profile:read_all';

/**
 * Build the Strava OAuth authorization URL
 */
export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    approval_prompt: 'force',
  });

  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

/**
 * Initiate OAuth flow by redirecting to Strava
 */
export function initiateOAuth(): void {
  if (!STRAVA_CLIENT_ID) {
    throw new Error('VITE_STRAVA_CLIENT_ID is not configured. Please add it to your .env file.');
  }
  window.location.href = buildAuthUrl();
}

/**
 * Check if current URL contains OAuth callback parameters
 */
export function hasOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('error');
}

/**
 * Parse OAuth callback from URL and clean up
 */
export function parseOAuthCallback(): { code?: string; error?: string; scope?: string } {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || undefined;
  const error = params.get('error') || undefined;
  const scope = params.get('scope') || undefined;

  // Clean up URL by removing OAuth params
  if (code || error) {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('error');
    url.searchParams.delete('scope');
    url.searchParams.delete('state');
    window.history.replaceState({}, '', url.pathname);
  }

  return { code, error, scope };
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<StravaOAuthResponse> {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    throw new Error('Strava API credentials not configured. Please add VITE_STRAVA_CLIENT_ID and VITE_STRAVA_CLIENT_SECRET to your .env file.');
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Token exchange failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    throw new Error('Strava API credentials not configured.');
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Token refresh failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Check if tokens are expired or will expire soon (within 10 minutes)
 */
export function isTokenExpired(tokens: StravaTokens): boolean {
  const now = Math.floor(Date.now() / 1000);
  const buffer = 10 * 60; // 10 minutes buffer
  return tokens.expires_at <= now + buffer;
}

/**
 * Get stored tokens from localStorage
 */
export function getStoredTokens(): StravaTokens | null {
  try {
    const stored = localStorage.getItem(TOKENS_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Store tokens in localStorage
 */
export function storeTokens(tokens: StravaTokens): void {
  localStorage.setItem(TOKENS_STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * Clear stored tokens from localStorage
 */
export function clearStoredTokens(): void {
  localStorage.removeItem(TOKENS_STORAGE_KEY);
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;

  if (isTokenExpired(tokens)) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      storeTokens(newTokens);
      return newTokens.access_token;
    } catch (error) {
      // Refresh failed, clear tokens
      clearStoredTokens();
      return null;
    }
  }

  return tokens.access_token;
}
