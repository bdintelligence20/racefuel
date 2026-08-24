import { useEffect, useState } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, TrendingUp, Sparkles, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { NumberField } from './ui/NumberField';
import {
  getGutTrainingProgram,
  saveGutTrainingProgram,
  clearGutTrainingProgram,
  addGutTrainingSession,
  getAllGutTrainingSessions,
} from '../persistence/db';
import * as firestoreService from '../services/firebase/firestore';
import { getCurrentUser } from '../services/firebase/auth';
import { gutCeilingFor } from '../services/nutrition/carbCalculator';
import {
  createProgram,
  recordSession,
  type GutTrainingProgram,
  type GutTrainingSession,
  type GutComfort,
} from '../services/nutrition/gutTraining';

interface GutTrainingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Same four-button GI-comfort scale as FeedbackModal's "Gut issues" row —
 *  same values, same language, so the two features read as one system. */
const comfortOptions: { value: GutComfort; label: string; color: string }[] = [
  { value: 'none', label: 'None', color: 'text-accent' },
  { value: 'mild', label: 'Mild', color: 'text-warm' },
  { value: 'moderate', label: 'Moderate', color: 'text-orange-400' },
  { value: 'severe', label: 'Severe', color: 'text-red-400' },
];

const outcomeCopy: Record<GutTrainingSession['outcome'], (g: number) => string> = {
  advance: (g) => `Nice — bumped to ${g} g/h for next session.`,
  hold: (g) => `Held at ${g} g/h for next session.`,
  'back-off': (g) => `Backed off to ${g} g/h for next session.`,
};

function numberInputClass() {
  return 'flex-1 bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-lg font-display p-3 focus:outline-none focus:border-accent transition-colors';
}

export function GutTrainingPanel({ isOpen, onClose }: GutTrainingPanelProps) {
  const { userProfile, updateProfile } = useApp();
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState<GutTrainingProgram | null>(null);
  const [sessions, setSessions] = useState<GutTrainingSession[]>([]);
  const [saving, setSaving] = useState(false);

  // Setup form
  const [startGPerHour, setStartGPerHour] = useState(40);
  const [targetGPerHour, setTargetGPerHour] = useState(90);

  // Log session form
  const [actualGPerHour, setActualGPerHour] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [gutComfort, setGutComfort] = useState<GutComfort>('none');
  const [notes, setNotes] = useState('');

  useModalBehavior(isOpen, onClose);

  // Default the target to the next tier above the athlete's current gut
  // tolerance (same 60/90/120 ceilings carbCalculator caps plans at) once
  // per open, so the setup form isn't just a blank "guess a number" field.
  useEffect(() => {
    if (!isOpen) return;
    setTargetGPerHour(gutCeilingFor(userProfile.gutTolerance ?? 'trained'));
  }, [isOpen, userProfile.gutTolerance]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [p, s] = await Promise.all([getGutTrainingProgram(), getAllGutTrainingSessions()]);
      if (cancelled) return;
      setProgram(p);
      setSessions(s);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async () => {
    if (startGPerHour <= 0 || targetGPerHour <= 0) {
      toast.error('Enter valid g/h values');
      return;
    }
    setSaving(true);
    try {
      const newProgram = createProgram(startGPerHour, targetGPerHour);
      await saveGutTrainingProgram(newProgram);
      if (getCurrentUser()) {
        await firestoreService.saveGutTrainingProgram(newProgram);
      }
      setProgram(newProgram);
      setSessions([]);
      toast.success('Gut training program started');
    } catch {
      toast.error('Failed to start program');
    } finally {
      setSaving(false);
    }
  };

  const handleLogSession = async () => {
    if (!program) return;
    if (actualGPerHour < 0) {
      toast.error('Enter what you actually took in, in g/h');
      return;
    }
    if (durationMinutes <= 0) {
      toast.error('Enter a session duration');
      return;
    }
    setSaving(true);
    try {
      const { program: updatedProgram, session } = recordSession(program, {
        actualGPerHour,
        durationMinutes,
        gutComfort,
        notes: notes.trim() || undefined,
      });

      await saveGutTrainingProgram(updatedProgram);
      await addGutTrainingSession(session);
      if (getCurrentUser()) {
        await firestoreService.saveGutTrainingProgram(updatedProgram);
        await firestoreService.addGutTrainingSession(session);
      }

      setProgram(updatedProgram);
      setSessions((prev) => [session, ...prev]);
      setActualGPerHour(0);
      setDurationMinutes(60);
      setGutComfort('none');
      setNotes('');

      if (updatedProgram.status === 'completed') {
        toast.success(`Program complete — you're tolerating ${updatedProgram.targetGPerHour} g/h!`);
      } else {
        toast.success(outcomeCopy[session.outcome](updatedProgram.currentGPerHour));
      }
    } catch {
      toast.error('Failed to log session');
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    setSaving(true);
    try {
      await clearGutTrainingProgram();
      if (getCurrentUser()) {
        await firestoreService.clearGutTrainingProgram();
      }
      setProgram(null);
      setSessions([]);
    } catch {
      toast.error('Failed to reset program');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToProfile = () => {
    if (!program) return;
    updateProfile({ carbTargetGPerHour: program.targetGPerHour });
    toast.success(`Carb target set to ${program.targetGPerHour} g/h`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-md max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div>
            <div className="text-[10px] text-accent uppercase tracking-wider font-bold">Beta</div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Gut Training
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-5">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : !program ? (
            <>
              <p className="text-sm text-text-secondary">
                Build your gut's tolerance for carbs the same way you build fitness —
                gradually. Pick where you're starting from and the g/h you want to
                reach; each logged session either advances, holds, or backs off the
                next target based on how your gut handled it.
              </p>

              <div>
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">
                  Starting point
                </label>
                <div className="flex items-center gap-2">
                  <NumberField
                    value={startGPerHour}
                    onChange={setStartGPerHour}
                    min={10}
                    max={120}
                    ariaLabel="Starting carbs per hour"
                    commitOnBlur
                    className={numberInputClass()}
                  />
                  <span className="text-text-muted font-display text-sm w-10">g/h</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">
                  Target
                </label>
                <div className="flex items-center gap-2">
                  <NumberField
                    value={targetGPerHour}
                    onChange={setTargetGPerHour}
                    min={10}
                    max={120}
                    ariaLabel="Target carbs per hour"
                    commitOnBlur
                    className={numberInputClass()}
                  />
                  <span className="text-text-muted font-display text-sm w-10">g/h</span>
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={saving}
                className="w-full py-3 bg-accent text-black text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-40"
              >
                {saving ? 'Starting…' : 'Start program'}
              </button>
            </>
          ) : (
            <>
              <ProgressCard program={program} />

              {program.status === 'completed' ? (
                <div className="text-center py-4 space-y-3">
                  <Sparkles className="w-8 h-8 text-accent mx-auto" />
                  <p className="text-sm text-text-primary font-semibold">
                    Program complete — your gut is trained for {program.targetGPerHour} g/h.
                  </p>
                  <button
                    onClick={handleApplyToProfile}
                    className="w-full py-3 bg-accent text-black text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-accent/90 transition-colors"
                  >
                    Apply {program.targetGPerHour} g/h to my carb target
                  </button>
                </div>
              ) : (
                <div className="space-y-4 p-4 rounded-xl bg-surfaceHighlight border border-[var(--color-border)]">
                  <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Log session — target {program.currentGPerHour} g/h
                  </h3>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Actual g/h</label>
                      <NumberField
                        value={actualGPerHour}
                        onChange={setActualGPerHour}
                        min={0}
                        max={200}
                        ariaLabel="Actual carbs per hour taken"
                        commitOnBlur
                        className="w-full bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-sm font-display p-2.5 focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Duration (min)</label>
                      <NumberField
                        value={durationMinutes}
                        onChange={setDurationMinutes}
                        min={1}
                        max={1440}
                        ariaLabel="Session duration in minutes"
                        commitOnBlur
                        className="w-full bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-sm font-display p-2.5 focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">Gut comfort</label>
                    <div className="flex gap-2">
                      {comfortOptions.map(({ value, label, color }) => (
                        <button
                          key={value}
                          onClick={() => setGutComfort(value)}
                          className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                            gutComfort === value
                              ? `border-current bg-current/10 ${color}`
                              : 'border-[var(--color-border)] text-text-muted hover:border-[var(--color-border)]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional) — product used, weather, anything worth remembering"
                    className="w-full bg-surface border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none h-16 focus:outline-none focus:border-accent/50"
                  />

                  <button
                    onClick={handleLogSession}
                    disabled={saving}
                    className="w-full py-2.5 bg-accent text-black text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : 'Log session'}
                  </button>
                </div>
              )}

              {sessions.length > 0 && (
                <div>
                  <h3 className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">Session history</h3>
                  <div className="space-y-1.5">
                    {sessions.map((s, i) => (
                      <SessionRow key={s.id ?? i} session={s} />
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleRestart}
                disabled={saving}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md bg-red-500/5 border border-red-500/10 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors text-[9px] font-display font-medium disabled:opacity-40"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Restart program
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ program }: { program: GutTrainingProgram }) {
  const span = program.targetGPerHour - program.startGPerHour;
  const progressed = program.currentGPerHour - program.startGPerHour;
  const pct = span > 0 ? Math.round((progressed / span) * 100) : 100;

  return (
    <div className="p-4 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          {program.startGPerHour} g/h → {program.targetGPerHour} g/h
        </span>
        <span className="text-sm font-display font-bold text-accent">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <p className="text-[10px] text-text-muted">
        {program.status === 'completed'
          ? 'Target reached.'
          : `Next session target: ${program.currentGPerHour} g/h`}
      </p>
    </div>
  );
}

function SessionRow({ session }: { session: GutTrainingSession }) {
  const comfortMeta = comfortOptions.find((c) => c.value === session.gutComfort);
  const outcomeLabel = session.outcome === 'advance' ? 'Advanced' : session.outcome === 'back-off' ? 'Backed off' : 'Held';
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-surfaceHighlight border border-[var(--color-border)] text-[11px]">
      <div className="flex-1 min-w-0">
        <div className="text-text-primary font-display font-medium">
          {session.actualGPerHour} g/h actual &middot; target {session.sessionTargetGPerHour} g/h &middot; {session.durationMinutes}min
        </div>
        <div className="text-text-muted">
          {new Date(session.createdAt).toLocaleDateString('en-ZA')} &middot; {outcomeLabel}
        </div>
      </div>
      {comfortMeta && (
        <span className={`flex-shrink-0 text-[9px] font-bold uppercase ${comfortMeta.color}`}>{comfortMeta.label}</span>
      )}
    </div>
  );
}
