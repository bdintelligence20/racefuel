import { useState } from 'react';
import { toast } from 'sonner';
import {
  UserPlus, ChevronLeft, Calendar, MessageSquare, Send, Trash2, MapPin, Share2, Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  useCoachStore, PLAN_STATUS_LABELS, type CoachAthlete, type PlanStatus,
} from '../../services/coach/coachStore';
import { AddAthleteModal } from './AddAthleteModal';

const STATUS_TONE: Record<PlanStatus, string> = {
  'not-started': 'bg-surfaceHighlight text-text-muted border-[var(--color-border)]',
  draft: 'bg-warm/10 text-warm border-warm/30',
  shared: 'bg-accent/10 text-accent border-accent/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
};

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  // Display-only; app runtime so Date is fine.
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Coach mode home — the athlete roster. The brief's coach seven-step journey
 * starts here: see your athletes and their plan status, pick one, build for
 * them, share. Radical-simplicity principle applies equally to both journeys.
 */
export function CoachDashboard() {
  const { athletes, setUserMode, setActiveAthlete, setPlanStatus, removeAthlete } = useCoachStore();
  const { updateProfile, routeData } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [openMsgFor, setOpenMsgFor] = useState<string | null>(null);

  const buildFor = (a: CoachAthlete) => {
    // Load the athlete's profile basics into the planner so the plan is built
    // for them, not the coach. (Weight is the input that most moves the plan.)
    if (a.weightKg) updateProfile({ weight: a.weightKg });
    setActiveAthlete(a.id);
    if (a.planStatus === 'not-started') setPlanStatus(a.id, 'draft');
    setUserMode('athlete');
    toast.success(`Planning for ${a.name}`);
  };

  return (
    <div className="flex flex-col h-full bg-background" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-surface flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-display font-bold text-text-primary leading-tight">Your athletes</h1>
            <p className="text-[11px] text-text-muted font-display">{athletes.length} on your roster · Coach mode</p>
          </div>
        </div>
        <button
          onClick={() => { setActiveAthlete(null); setUserMode('athlete'); }}
          className="flex items-center gap-1 text-xs font-display font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Plan for myself
        </button>
      </div>

      {/* Roster */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
        {athletes.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-primary font-display font-bold">No athletes yet</p>
            <p className="text-text-muted text-sm mt-1 max-w-xs mx-auto">
              Add the athletes you coach. You'll build and share fuelling plans for each of them from here.
            </p>
          </div>
        ) : (
          athletes.map((a) => {
            const eventDate = formatDate(a.eventDate);
            const isActiveMsg = openMsgFor === a.id;
            return (
              <div key={a.id} className="bg-surface border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-display font-bold text-text-primary truncate">{a.name}</h3>
                        <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_TONE[a.planStatus]}`}>
                          {PLAN_STATUS_LABELS[a.planStatus]}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted truncate">{a.email}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-secondary font-display flex-wrap">
                        {a.eventName && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.eventName}</span>}
                        {eventDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {eventDate}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm(`Remove ${a.name} from your roster?`)) removeAthlete(a.id); }}
                      aria-label="Remove athlete"
                      className="p-1.5 text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => buildFor(a)}
                      className="flex-1 py-2.5 bg-accent text-white text-xs font-display font-bold uppercase tracking-wider rounded-lg hover:bg-accent-light transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Build plan
                    </button>
                    <button
                      onClick={() => {
                        setPlanStatus(a.id, 'shared');
                        toast.success(`Plan shared with ${a.name}`, { description: 'Cross-account delivery is the backend step.' });
                      }}
                      disabled={a.planStatus === 'not-started'}
                      className="px-3 py-2.5 border border-accent/30 text-accent text-xs font-display font-bold uppercase tracking-wider rounded-lg hover:bg-accent/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                      title={`Share with ${a.name}`}
                    >
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                    <button
                      onClick={() => setOpenMsgFor(isActiveMsg ? null : a.id)}
                      className="px-3 py-2.5 border border-[var(--color-border)] text-text-secondary text-xs rounded-lg hover:bg-surfaceHighlight transition-colors"
                      aria-label="Messages"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isActiveMsg && <MessageThread athleteId={a.id} athleteName={a.name} />}
              </div>
            );
          })
        )}
      </div>

      {/* Add athlete — persistent primary action */}
      <div className="p-4 border-t border-[var(--color-border)] bg-surface flex-shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => setAddOpen(true)}
          className="w-full py-3.5 bg-warm text-white font-display font-bold uppercase tracking-wider rounded-xl hover:bg-warm-light transition-colors flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add an athlete
        </button>
        {routeData.loaded && (
          <p className="text-[10px] text-text-muted text-center mt-2">A route is loaded — pick an athlete to build their plan.</p>
        )}
      </div>

      <AddAthleteModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function MessageThread({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const { messages, addMessage } = useCoachStore();
  const [text, setText] = useState('');
  const thread = messages.filter((m) => m.athleteId === athleteId);

  return (
    <div className="border-t border-[var(--color-border)] bg-surfaceHighlight p-3">
      <div className="max-h-40 overflow-y-auto space-y-2 mb-2">
        {thread.length === 0 ? (
          <p className="text-[11px] text-text-muted text-center py-3">No messages with {athleteName} yet.</p>
        ) : (
          thread.map((m) => (
            <div key={m.id} className={`flex ${m.from === 'coach' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs font-display ${m.from === 'coach' ? 'bg-accent text-white' : 'bg-surface border border-[var(--color-border)] text-text-primary'}`}>
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); addMessage(athleteId, 'coach', text); setText(''); }}
        className="flex items-center gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${athleteName}…`}
          className="flex-1 bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-xs font-display p-2 focus:outline-none focus:border-accent transition-colors"
        />
        <button type="submit" disabled={!text.trim()} className="p-2 bg-accent text-white rounded-lg disabled:opacity-40 transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
