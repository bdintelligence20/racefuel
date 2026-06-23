import { toast } from 'sonner';
import { ChevronLeft, Share2, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCoachStore } from '../../services/coach/coachStore';

/**
 * Shown across the top of the athlete planning surface when a coach is building
 * for one of their athletes. Keeps the coach oriented ("you're planning for
 * Anina, not yourself"), and offers the two coach actions inline: share the
 * plan, or jump back to the roster. Renders nothing for a normal athlete.
 */
export function CoachPlanningBanner() {
  const { mode, activeAthlete, setUserMode, setPlanStatus } = useCoachStore();
  const { routeData } = useApp();
  if (mode !== 'athlete' || !activeAthlete) return null;

  const hasPlan = routeData.nutritionPoints.length > 0;

  return (
    <div className="w-full bg-accent text-white px-3 py-1.5 flex items-center justify-between gap-2">
      <button
        onClick={() => setUserMode('coach')}
        className="flex items-center gap-1 text-[11px] font-display font-semibold opacity-90 hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <ChevronLeft className="w-3.5 h-3.5" /> Roster
      </button>
      <div className="flex items-center gap-1.5 min-w-0">
        <Users className="w-3.5 h-3.5 flex-shrink-0 opacity-80" />
        <span className="text-[12px] font-display font-bold truncate">Planning for {activeAthlete.name}</span>
      </div>
      <button
        onClick={() => {
          setPlanStatus(activeAthlete.id, 'shared');
          toast.success(`Plan shared with ${activeAthlete.name}`, { description: 'Cross-account delivery is the backend step.' });
        }}
        disabled={!hasPlan}
        className="flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-wider bg-white/15 px-2 py-1 rounded-md hover:bg-white/25 disabled:opacity-50 transition-colors flex-shrink-0"
      >
        <Share2 className="w-3 h-3" /> Share
      </button>
    </div>
  );
}
