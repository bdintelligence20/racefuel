import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyAccess } from '../services/firebase/admin';

export interface EntitlementsState {
  loading: boolean;
  isAdmin: boolean;
  betaGutTraining: boolean;
}

/** Short cache TTL so a kill-switch flip (or a newly granted allowlist entry)
 *  takes effect within a minute without a page reload. The Sidebar and the
 *  opt-in banner share the same in-flight request and cache entry, so at most
 *  one getMyAccess round trip is in flight per interval. */
const TTL_MS = 30_000;

interface CacheEntry {
  uid: string;
  isAdmin: boolean;
  betaGutTraining: boolean;
  at: number;
}

let cached: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

async function fetchAccess(uid: string): Promise<CacheEntry> {
  try {
    const res = await getMyAccess();
    return { uid, isAdmin: !!res.isAdmin, betaGutTraining: !!res.betaGutTraining, at: Date.now() };
  } catch (err) {
    // FAIL CLOSED — any error (network, timeout, App Check reject) yields no
    // access. Timestamped so the next interval retries rather than sticking.
    console.warn('[entitlements] getMyAccess failed (fail-closed):', err);
    return { uid, isAdmin: false, betaGutTraining: false, at: Date.now() };
  }
}

function load(uid: string, force = false): Promise<CacheEntry> {
  const current = cached;
  if (!force && current && current.uid === uid && Date.now() - current.at < TTL_MS) {
    return Promise.resolve(current);
  }
  if (inflight) return inflight;
  inflight = fetchAccess(uid).then((entry) => {
    cached = entry;
    inflight = null;
    return entry;
  });
  return inflight;
}

/**
 * Per-user entitlement gate. Mirrors useAdminGate but resolves the full access
 * set in one call and re-checks on a short interval.
 *
 * `loading` stays true until the first resolution, so callers can hold off
 * rendering gated UI — the feature never flashes in for an ineligible user
 * and never appears then disappears.
 */
export function useEntitlements(): EntitlementsState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<EntitlementsState>(() => {
    const c = cached;
    if (c && user && c.uid === user.uid && Date.now() - c.at < TTL_MS) {
      return { loading: false, isAdmin: c.isAdmin, betaGutTraining: c.betaGutTraining };
    }
    return { loading: true, isAdmin: false, betaGutTraining: false };
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      cached = null;
      setState({ loading: false, isAdmin: false, betaGutTraining: false });
      return;
    }

    let cancelled = false;
    const apply = (e: CacheEntry) => {
      if (cancelled || e.uid !== user.uid) return;
      setState({ loading: false, isAdmin: e.isAdmin, betaGutTraining: e.betaGutTraining });
    };

    const fresh = cached && cached.uid === user.uid && Date.now() - cached.at < TTL_MS;
    if (!fresh) setState((s) => ({ ...s, loading: true }));
    void load(user.uid).then(apply);

    // Re-check on the TTL so a kill-switch flip propagates without a reload.
    const iv = setInterval(() => { void load(user.uid, true).then(apply); }, TTL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [user, authLoading]);

  return state;
}
