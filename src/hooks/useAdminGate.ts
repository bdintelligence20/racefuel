import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminCheck } from '../services/firebase/admin';

interface GateState {
  loading: boolean;
  isAdmin: boolean;
}

let cached: { uid: string; isAdmin: boolean } | null = null;

/** Cached admin allowlist check. Returns isAdmin once the callable resolves;
 *  null/false until then. The result is cached per-uid for the SPA session
 *  so the Sidebar nav, AdminLayout, and any other gates share one round trip. */
export function useAdminGate(): GateState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<GateState>(() => {
    if (cached && user && cached.uid === user.uid) {
      return { loading: false, isAdmin: cached.isAdmin };
    }
    return { loading: true, isAdmin: false };
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      cached = null;
      setState({ loading: false, isAdmin: false });
      return;
    }
    if (cached && cached.uid === user.uid) {
      setState({ loading: false, isAdmin: cached.isAdmin });
      return;
    }
    let cancelled = false;
    setState({ loading: true, isAdmin: false });
    adminCheck()
      .then((res) => {
        if (cancelled) return;
        cached = { uid: user.uid, isAdmin: res.isAdmin };
        setState({ loading: false, isAdmin: res.isAdmin });
      })
      .catch((err) => {
        console.warn('[admin] check failed:', err);
        if (cancelled) return;
        setState({ loading: false, isAdmin: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
