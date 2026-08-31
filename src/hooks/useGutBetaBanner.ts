import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from './useEntitlements';
import {
  loadBetaOptIns,
  setGutTrainingOptIn,
  recordGutTrainingDismissal,
  type BetaGutTrainingOptIn,
} from '../services/firebase/firestore';
import { requestOpenGutTraining } from '../services/gutTrainingOpen';

const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function dismissedRecently(optIn: BetaGutTrainingOptIn | null): boolean {
  if (!optIn?.dismissedAt) return false;
  const at = Date.parse(optIn.dismissedAt);
  if (Number.isNaN(at)) return false;
  return Date.now() - at < DISMISS_WINDOW_MS;
}

export interface BetaBannerState {
  /** true only once we've confirmed the user is eligible, not opted in, and
   *  not inside a dismissal window. Never true while anything is still
   *  loading, so an ineligible user never sees a flash. */
  visible: boolean;
  /** true until eligibility + opt-in state are both resolved. Callers show the
   *  fallback banner during this window rather than nothing. */
  loading: boolean;
  join: () => void;
  dismiss: () => void;
  pending: boolean;
}

/**
 * Resolves whether the gut-training opt-in banner should show for the current
 * user, and exposes the join / dismiss actions. Dismissal state lives on the
 * user doc (not localStorage) so it follows the athlete across devices and the
 * admin dashboard can see who's declining. A "Not now" hides the banner for 7
 * days, then it returns — it never disappears permanently while the user is
 * eligible and hasn't opted in.
 */
export function useGutBetaBanner(): BetaBannerState {
  const { user, loading: authLoading } = useAuth();
  const { betaGutTraining, loading: entLoading } = useEntitlements();
  // undefined = not yet loaded; null = no doc yet.
  const [optIn, setOptIn] = useState<BetaGutTrainingOptIn | null | undefined>(undefined);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (authLoading || entLoading) return;
    if (!user || !betaGutTraining) {
      setOptIn(null);
      return;
    }
    let cancelled = false;
    setOptIn(undefined);
    loadBetaOptIns()
      .then((d) => { if (!cancelled) setOptIn(d?.gutTraining ?? null); })
      // fail closed → treat as not-yet-decided; banner stays hidden until resolved
      .catch(() => { if (!cancelled) setOptIn(null); });
    return () => { cancelled = true; };
  }, [user, betaGutTraining, authLoading, entLoading]);

  const loading = authLoading || entLoading || (!!user && betaGutTraining && optIn === undefined);

  const resolved = optIn === undefined ? null : optIn;
  const visible =
    !loading &&
    !!user &&
    betaGutTraining &&
    optIn !== undefined &&
    !resolved?.optedIn &&
    !dismissedRecently(resolved);

  const join = useCallback(() => {
    setPending(true);
    void (async () => {
      try {
        await setGutTrainingOptIn();
        setOptIn((prev) => ({ ...(prev ?? {}), optedIn: true, optedInAt: new Date().toISOString() }));
        requestOpenGutTraining();
      } catch (err) {
        console.warn('[gut-training] opt-in from banner failed:', err);
      } finally {
        setPending(false);
      }
    })();
  }, []);

  const dismiss = useCallback(() => {
    setPending(true);
    void (async () => {
      try {
        await recordGutTrainingDismissal();
        setOptIn((prev) => ({
          ...(prev ?? {}),
          optedIn: prev?.optedIn ?? false,
          dismissedAt: new Date().toISOString(),
          dismissCount: (prev?.dismissCount ?? 0) + 1,
        }));
      } catch (err) {
        console.warn('[gut-training] dismissal failed:', err);
      } finally {
        setPending(false);
      }
    })();
  }, []);

  return { visible, loading, join, dismiss, pending };
}
