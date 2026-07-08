import { useApp } from '../../context/AppContext';
import { getActiveDurationHours } from '../route/timeFormat';
import {
  type AthletePlanSummary,
  type CoachAthlete,
  hasSelfStash,
  loadAthleteSnapshot,
  popSelfPlan,
  popSelfProfile,
  saveAthleteSnapshot,
  setActiveAthlete,
  setUserMode,
  stashSelfPlan,
  stashSelfProfile,
  updateAthlete,
  useCoachStore,
} from './coachStore';

/**
 * The coach ⇄ athlete context switch, done safely. Entering an athlete's
 * planning session stashes the coach's own plan and profile first; leaving
 * saves the athlete's work as their snapshot (with a display summary on the
 * roster record) and restores whatever the coach had. Nothing is clobbered
 * in either direction — each athlete keeps their own plan between sessions.
 */
export function useCoachPlanning() {
  const { routeData, planValidation, userProfile, updateProfile, loadSavedRoute, resetRoute } = useApp();
  const { activeAthleteId, activeAthlete } = useCoachStore();

  const summarize = (): AthletePlanSummary => {
    const totalCarbs = routeData.nutritionPoints.reduce((sum, p) => sum + p.product.carbs, 0);
    const hours = getActiveDurationHours(routeData, 3);
    return {
      routeName: routeData.name || 'Unnamed route',
      distanceKm: routeData.distanceKm,
      points: routeData.nutritionPoints.length,
      totalCarbs,
      carbsPerHour: hours > 0 ? Math.round(totalCarbs / hours) : 0,
      score: planValidation?.score,
      updatedISO: new Date().toISOString(),
    };
  };

  /** Persist the active athlete's in-progress work (snapshot + roster summary). */
  const saveActiveWork = async (): Promise<void> => {
    if (!activeAthlete || !routeData.loaded) return;
    await saveAthleteSnapshot(activeAthlete.id, routeData);
    updateAthlete(activeAthlete.id, {
      planSummary: summarize(),
      // Fresh work on an unstarted plan makes it a draft; an already-shared
      // or completed plan keeps its status (summary still refreshes).
      planStatus: activeAthlete.planStatus === 'not-started' ? 'draft' : activeAthlete.planStatus,
    });
  };

  /** Open the planner in this athlete's context. */
  const enterAthlete = async (athlete: CoachAthlete): Promise<void> => {
    if (activeAthleteId === athlete.id) {
      // Same athlete, plan already in memory — just swap surfaces.
      setUserMode('athlete');
      return;
    }

    if (activeAthlete) {
      await saveActiveWork();
    } else if (!hasSelfStash()) {
      // Leaving self context: stash the coach's own plan and profile so the
      // athlete session can't overwrite them. Guarded so a second entry
      // can't replace the real stash with an athlete's data.
      if (routeData.loaded) await stashSelfPlan(routeData);
      stashSelfProfile(userProfile);
    }

    const snapshot = await loadAthleteSnapshot(athlete.id);
    if (snapshot) loadSavedRoute(snapshot);
    else resetRoute();

    if (athlete.weightKg) updateProfile({ weight: athlete.weightKg });
    setActiveAthlete(athlete.id);
    setUserMode('athlete');
  };

  /** Back to the roster, keeping the athlete session warm. */
  const exitToRoster = async (): Promise<void> => {
    await saveActiveWork();
    setUserMode('coach');
  };

  /** Leave coaching entirely — restore the coach's own plan and profile. */
  const returnToSelf = async (): Promise<void> => {
    await saveActiveWork();
    if (activeAthlete || hasSelfStash()) {
      const profile = popSelfProfile();
      if (profile) updateProfile(profile);
      const plan = await popSelfPlan();
      if (plan) loadSavedRoute(plan);
      else if (activeAthlete) resetRoute();
    }
    setActiveAthlete(null);
    setUserMode('athlete');
  };

  return { enterAthlete, exitToRoster, returnToSelf, saveActiveWork };
}
