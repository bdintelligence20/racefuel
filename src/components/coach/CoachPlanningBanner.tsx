import { useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Share2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCoachStore, setPlanStatus, updateAthlete } from '../../services/coach/coachStore';
import { useCoachPlanning } from '../../services/coach/useCoachPlanning';
import { sharePlanWithAthlete } from '../../services/coach/sharedPlans';

/**
 * Shown across the top of the athlete planning surface when a coach is
 * building for one of their athletes. Keeps the coach oriented ("you're
 * planning for Anina, not yourself") and offers the two coach actions
 * inline: send the plan to the athlete's account, or head back to the
 * roster (which saves this athlete's work). Renders nothing for a normal
 * athlete session.
 */
export function CoachPlanningBanner() {
  const { mode, activeAthlete } = useCoachStore();
  const { exitToRoster, saveActiveWork } = useCoachPlanning();
  const { routeData } = useApp();
  const [sending, setSending] = useState(false);
  if (mode !== 'athlete' || !activeAthlete) return null;

  const hasPlan = routeData.nutritionPoints.length > 0;

  const send = async () => {
    setSending(true);
    try {
      await saveActiveWork();
      await sharePlanWithAthlete({ athleteEmail: activeAthlete.email, athleteName: activeAthlete.name, route: routeData });
      setPlanStatus(activeAthlete.id, 'shared');
      updateAthlete(activeAthlete.id, { sharedAtISO: new Date().toISOString() });
      toast.success(`Plan sent to ${activeAthlete.name}`, {
        description: `It's waiting in the fuelcue account for ${activeAthlete.email}.`,
      });
    } catch {
      toast.error("Couldn't send the plan — check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full bg-accent text-white px-3 py-1.5 flex items-center justify-between gap-2">
      <button
        onClick={() => void exitToRoster()}
        className="flex items-center gap-1 text-[11px] font-display font-semibold opacity-90 hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Roster
      </button>
      <div className="flex items-center gap-1.5 min-w-0">
        <Users className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
        <span className="text-[12px] font-display font-bold truncate">Planning for {activeAthlete.name}</span>
      </div>
      <button
        onClick={() => void send()}
        disabled={!hasPlan || sending}
        className="flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider bg-white/15 px-2 py-1 rounded-md hover:bg-white/25 disabled:opacity-50 transition-colors flex-shrink-0"
      >
        <Share2 className="w-3 h-3" /> {sending ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}
