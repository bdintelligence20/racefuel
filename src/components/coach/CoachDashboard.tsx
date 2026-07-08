import { useState } from 'react';
import { toast } from 'sonner';
import {
  UserPlus, ChevronLeft, MapPin, Mountain, NotebookPen, Route as RouteIcon,
  Send, Share2, Trash2, Users, Zap,
} from 'lucide-react';
import {
  useCoachStore, loadAthleteSnapshot, PLAN_STATUS_LABELS,
  type CoachAthlete, type PlanStatus,
} from '../../services/coach/coachStore';
import { useCoachPlanning } from '../../services/coach/useCoachPlanning';
import { sharePlanWithAthlete } from '../../services/coach/sharedPlans';
import { AddAthleteModal } from './AddAthleteModal';

const STATUS_TONE: Record<PlanStatus, string> = {
  'not-started': 'bg-surfaceHighlight text-text-muted border-[var(--color-border)]',
  draft: 'bg-warm/10 text-warm border-warm/30',
  shared: 'bg-accent/10 text-accent border-accent/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
};

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Whole days from today until the event (0 = today, negative = past). */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const event = new Date(iso + 'T00:00:00');
  if (isNaN(event.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((event.getTime() - today.getTime()) / 86_400_000);
}

/** The roster's organizing element: how close is race day. Amber while
 *  there's runway, rust inside race week, quiet once it's behind them. */
function CountdownChip({ eventDate }: { eventDate?: string }) {
  const days = daysUntil(eventDate);
  if (days === null) return null;
  const label = days > 1 ? `${days} days` : days === 1 ? 'Tomorrow' : days === 0 ? 'Race day' : 'Raced';
  const tone = days < 0
    ? 'bg-surfaceHighlight text-text-muted border-[var(--color-border)]'
    : days <= 7
      ? 'bg-terrain-rust/10 text-terrain-rust border-terrain-rust/30'
      : 'bg-warm/10 text-warm border-warm/30';
  return (
    <span className={`text-[10px] font-display font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border tabular-nums flex-shrink-0 ${tone}`}>
      {label}
    </span>
  );
}

/** Roster order = coaching priority: soonest race first, past races and
 *  undated athletes after, each by most recent activity. */
function rosterOrder(a: CoachAthlete, b: CoachAthlete): number {
  const da = daysUntil(a.eventDate);
  const db = daysUntil(b.eventDate);
  const aUpcoming = da !== null && da >= 0;
  const bUpcoming = db !== null && db >= 0;
  if (aUpcoming && bUpcoming) return da! - db!;
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
  return (b.lastActivityISO ?? '').localeCompare(a.lastActivityISO ?? '');
}

export function CoachDashboard() {
  const { athletes, setPlanStatus, updateAthlete, removeAthlete } = useCoachStore();
  const { enterAthlete, returnToSelf } = useCoachPlanning();
  const [addOpen, setAddOpen] = useState(false);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);

  const share = async (a: CoachAthlete) => {
    setSharing(a.id);
    try {
      const snapshot = await loadAthleteSnapshot(a.id);
      if (!snapshot) {
        toast.error(`No plan to share yet — build one for ${a.name} first.`);
        return;
      }
      await sharePlanWithAthlete({ athleteEmail: a.email, athleteName: a.name, route: snapshot });
      setPlanStatus(a.id, 'shared');
      updateAthlete(a.id, { sharedAtISO: new Date().toISOString() });
      toast.success(`Plan sent to ${a.name}`, {
        description: `It's waiting in the fuelcue account for ${a.email}.`,
      });
    } catch {
      toast.error("Couldn't send the plan — check your connection and try again.");
    } finally {
      setSharing(null);
    }
  };

  const sorted = [...athletes].sort(rosterOrder);
  const nextRace = sorted.find((a) => {
    const d = daysUntil(a.eventDate);
    return d !== null && d >= 0;
  });

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
            <p className="text-[11px] text-text-muted font-display truncate">
              {nextRace?.eventDate
                ? `Next up: ${nextRace.name} · ${formatDate(nextRace.eventDate)}`
                : `${athletes.length} on your roster`}
            </p>
          </div>
        </div>
        <button
          onClick={() => void returnToSelf()}
          className="flex items-center gap-1 text-xs font-display font-semibold text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Plan for myself
        </button>
      </div>

      {/* Roster */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-primary font-display font-bold">Your roster is empty</p>
            <p className="text-text-muted text-sm mt-1 max-w-xs mx-auto">
              Add an athlete to build their race fuelling plan and send it straight to their fuelcue account.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-5 px-5 py-2.5 bg-accent text-white text-xs font-display font-bold uppercase tracking-wider rounded-lg hover:bg-accent-light transition-colors inline-flex items-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add your first athlete
            </button>
          </div>
        ) : (
          sorted.map((a) => {
            const eventDate = formatDate(a.eventDate);
            const summary = a.planSummary;
            const notesOpen = notesFor === a.id;
            return (
              <div key={a.id} className="bg-surface border border-[var(--color-border)] rounded-2xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0 text-accent font-display font-bold text-sm">
                      {a.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-display font-bold text-text-primary truncate">{a.name}</h3>
                        <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_TONE[a.planStatus]}`}>
                          {a.planStatus === 'shared' && a.sharedAtISO
                            ? `Sent ${formatDate(a.sharedAtISO.slice(0, 10))}`
                            : PLAN_STATUS_LABELS[a.planStatus]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 min-w-0">
                        <span className="text-[11px] text-text-secondary font-display truncate">
                          {a.eventName ? `${a.eventName}${eventDate ? ` · ${eventDate}` : ''}` : a.email}
                        </span>
                        <CountdownChip eventDate={a.eventDate} />
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm(`Remove ${a.name} from your roster? Their saved plan goes too.`)) removeAthlete(a.id); }}
                      aria-label={`Remove ${a.name}`}
                      className="p-1.5 text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Plan vitals — the thing a coach scans the roster for. */}
                  {summary && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] flex items-center gap-3 overflow-x-auto no-scrollbar text-[11px] font-display text-text-secondary tabular-nums">
                      <span className="flex items-center gap-1 min-w-0">
                        <RouteIcon className="w-3 h-3 flex-shrink-0 text-text-muted" />
                        <span className="whitespace-nowrap max-w-[14rem] truncate">{summary.routeName}</span>
                      </span>
                      <span className="flex-shrink-0">{summary.distanceKm.toFixed(1)} km</span>
                      <span className="flex items-center gap-1 flex-shrink-0"><MapPin className="w-3 h-3 text-text-muted" />{summary.points} pts</span>
                      <span className="flex items-center gap-1 flex-shrink-0"><Zap className="w-3 h-3 text-text-muted" />{summary.carbsPerHour} g/h</span>
                      {summary.score !== undefined && (
                        <span className={`flex-shrink-0 font-bold ${summary.score >= 80 ? 'text-accent' : summary.score >= 50 ? 'text-warm' : 'text-terrain-rust'}`}>
                          {summary.score}/100
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => void enterAthlete(a)}
                      className="flex-1 py-2.5 bg-accent text-white text-xs font-display font-bold uppercase tracking-wider rounded-lg hover:bg-accent-light transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Mountain className="w-3.5 h-3.5" /> {summary ? 'Open plan' : 'Build plan'}
                    </button>
                    <button
                      onClick={() => void share(a)}
                      disabled={!summary || sharing === a.id}
                      className="px-3 py-2.5 border border-accent/30 text-accent text-xs font-display font-bold uppercase tracking-wider rounded-lg hover:bg-accent/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                      title={summary ? `Send the plan to ${a.email}` : 'Build a plan first'}
                    >
                      <Share2 className="w-3.5 h-3.5" /> {sharing === a.id ? 'Sending…' : 'Send'}
                    </button>
                    <button
                      onClick={() => setNotesFor(notesOpen ? null : a.id)}
                      aria-label={`Notes on ${a.name}`}
                      aria-expanded={notesOpen}
                      className={`px-3 py-2.5 border rounded-lg transition-colors ${notesOpen ? 'border-accent/40 text-accent bg-accent/[0.06]' : 'border-[var(--color-border)] text-text-secondary hover:bg-surfaceHighlight'}`}
                    >
                      <NotebookPen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {notesOpen && <NotesPanel athleteId={a.id} athleteName={a.name} />}
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
      </div>

      <AddAthleteModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

/** Private, timestamped coaching notes — race-morning reminders, gut-history,
 *  what worked last time. Only the coach ever sees them. */
function NotesPanel({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const { notes, addNote, removeNote } = useCoachStore();
  const [text, setText] = useState('');
  const thread = notes.filter((n) => n.athleteId === athleteId);

  return (
    <div className="border-t border-[var(--color-border)] bg-surfaceHighlight p-3">
      <p className="text-[10px] text-text-muted font-display uppercase tracking-wider mb-2">
        Notes on {athleteName} — only you see these
      </p>
      <div className="max-h-40 overflow-y-auto overscroll-contain space-y-1.5 mb-2">
        {thread.length === 0 ? (
          <p className="text-[11px] text-text-muted py-1">
            Keep race reminders here — gut history, what worked last time, morning-of instructions.
          </p>
        ) : (
          thread.map((n) => (
            <div key={n.id} className="group flex items-start gap-2 bg-surface border border-[var(--color-border)] rounded-lg px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-display text-text-primary break-words">{n.text}</p>
                <p className="text-[9px] text-text-muted mt-0.5">
                  {new Date(n.atISO).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <button
                onClick={() => removeNote(n.id)}
                aria-label="Delete note"
                className="p-1 text-text-muted/50 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); addNote(athleteId, text); setText(''); }}
        className="flex items-center gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-xs font-display p-2 focus:outline-none focus:border-accent transition-colors"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Save note" className="p-2 bg-accent text-white rounded-lg disabled:opacity-40 transition-colors">
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
