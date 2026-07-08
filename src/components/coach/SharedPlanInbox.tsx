import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Inbox, MapPin, Mountain, Route as RouteIcon, Timer, Trash2, X, Zap } from 'lucide-react';
import { useApp, type RouteData } from '../../context/AppContext';
import { useCoachStore } from '../../services/coach/coachStore';
import { listPlansSharedWithMe, deleteSharedPlan, type SharedPlan } from '../../services/coach/sharedPlans';

const LOADED_KEY = 'fuelcue_shared_plans_loaded';

function readLoadedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(LOADED_KEY) || '[]'); } catch { return []; }
}
function markLoaded(id: string) {
  try {
    const ids = readLoadedIds();
    if (!ids.includes(id)) localStorage.setItem(LOADED_KEY, JSON.stringify([...ids, id].slice(-100)));
  } catch { /* fine */ }
}

/**
 * The athlete side of coach sharing: plans addressed to the signed-in
 * user's email, delivered by their coach. A slim banner appears above the
 * map while there are plans the athlete hasn't loaded yet; the sheet lists
 * every plan still on the server with a one-tap load.
 */
export function SharedPlanInbox() {
  const { loadSavedRoute } = useApp();
  const { mode, activeAthleteId } = useCoachStore();
  const [plans, setPlans] = useState<SharedPlan[]>([]);
  const [open, setOpen] = useState(false);
  const [loadedIds, setLoadedIds] = useState<string[]>(readLoadedIds);

  useEffect(() => {
    listPlansSharedWithMe()
      .then(setPlans)
      .catch(() => { /* offline or rules not yet live — the inbox just stays empty */ });
  }, []);

  // Only in the athlete's own context — a coach building for someone else
  // shouldn't have their personal inbox layered into that session.
  if (mode !== 'athlete' || activeAthleteId) return null;
  if (plans.length === 0) return null;

  const fresh = plans.filter((p) => !loadedIds.includes(p.id));

  const loadPlan = (plan: SharedPlan) => {
    try {
      const route = JSON.parse(plan.routeDataJson) as RouteData;
      loadSavedRoute(route);
      markLoaded(plan.id);
      setLoadedIds(readLoadedIds());
      setOpen(false);
      toast.success(`Plan from ${plan.coachName} loaded`, { description: plan.routeName });
    } catch {
      toast.error("Couldn't load this plan — ask your coach to share it again.");
    }
  };

  const removePlan = async (plan: SharedPlan) => {
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    try { await deleteSharedPlan(plan.id); } catch { /* it re-appears next visit if the delete failed */ }
  };

  const formatWhen = (p: SharedPlan) =>
    p.createdAt ? p.createdAt.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

  return (
    <>
      {fresh.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="w-full bg-warm text-white px-3 py-2 flex items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Inbox className="w-4 h-4 flex-shrink-0" />
            <span className="text-[12px] font-display font-bold truncate">
              {fresh.length === 1
                ? `${fresh[0].coachName} sent you a plan — ${fresh[0].routeName}`
                : `${fresh.length} plans from your coach`}
            </span>
          </span>
          <span className="text-[11px] font-display font-bold uppercase tracking-wider bg-white/20 px-2 py-1 rounded-md flex-shrink-0">
            View
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" role="dialog" aria-label="Plans from your coach">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80dvh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight flex-shrink-0">
              <div className="flex items-center gap-3">
                <Inbox className="w-5 h-5 text-warm" />
                <h2 className="text-base font-display font-bold text-text-primary">From your coach</h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="p-2 text-text-muted hover:text-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[var(--color-border)] pb-[env(safe-area-inset-bottom)]">
              {plans.map((plan) => {
                const isLoaded = loadedIds.includes(plan.id);
                return (
                  <div key={plan.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-display font-bold text-text-primary truncate">{plan.routeName}</h3>
                        <p className="text-[11px] text-text-muted truncate">
                          {plan.coachName} · {formatWhen(plan)}{isLoaded ? ' · loaded' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => removePlan(plan)}
                        aria-label="Remove plan"
                        className="p-1.5 text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-text-secondary font-display tabular-nums flex-wrap">
                      <span className="flex items-center gap-1"><RouteIcon className="w-3 h-3" />{plan.distanceKm.toFixed(1)} km</span>
                      <span className="flex items-center gap-1"><Mountain className="w-3 h-3" />{Math.round(plan.elevationGain)} m</span>
                      <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{plan.estimatedTime}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{plan.points} fuel points</span>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{plan.totalCarbs} g carbs</span>
                    </div>
                    <button
                      onClick={() => loadPlan(plan)}
                      className="mt-3 w-full py-2.5 bg-accent text-white text-xs font-display font-bold uppercase tracking-wider rounded-lg hover:bg-accent-light transition-colors"
                    >
                      {isLoaded ? 'Load again' : 'Load plan'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
