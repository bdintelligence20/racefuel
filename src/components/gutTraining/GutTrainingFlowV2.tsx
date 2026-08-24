/**
 * Gut Training v2 (beta) — orchestrator.
 *
 * Full-screen takeover (not a centered modal like v1's GutTrainingPanel) —
 * the v2 concept design's 8 screens are full mobile pages, not a squeezed
 * dialog. Opened from Sidebar once VITE_GUT_TRAINING_V2 is on; reaching
 * this component at all (via the sidebar's "Gut Training" item) plus
 * completing setup IS the opt-in — see gutTrainingV2Program's `optedInAt`,
 * which functions as the admin-visible opt-in record (adminListGutTrainingV2
 * in functions/src/admin.ts).
 *
 * State machine: setup (goal-event → tolerance) creates the program, then
 * the weekly loop (weekly-prescription → [handoff] → post-session-log)
 * repeats until the program completes (→ milestone → race-day). Alerts are
 * reachable any time active alerts exist.
 *
 * Watch handoff is a stub — see HandoffScreen's docstring and the flagged
 * assumption called out to the user: no Garmin/BLE/device-pairing
 * integration exists in this repo, so "sent to watch" and "confirm to log"
 * are simulated, not real.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../../context/AppContext';
import {
  getGutTrainingV2Program,
  saveGutTrainingV2Program,
  clearGutTrainingV2Program,
  addGutTrainingV2Session,
  getAllGutTrainingV2Sessions,
} from '../../persistence/db';
import * as firestoreService from '../../services/firebase/firestore';
import { getCurrentUser } from '../../services/firebase/auth';
import {
  createProgramV2,
  recordSessionV2,
  deriveTargetGPerHour,
  buildRealismNote,
  buildSessionPrescription,
  computeMilestoneStats,
  buildRaceDayPlan,
  getActiveAlerts,
  toGutComfort,
  type GutTrainingV2Program,
  type GutTrainingSession,
  type GutHistoryTag,
  type GutResponseV2,
} from '../../services/nutrition/gutTrainingV2';
import {
  GoalEventScreen,
  ToleranceScreen,
  WeeklySessionScreen,
  HandoffScreen,
  PostSessionLogScreen,
  MilestoneScreen,
  RaceDayScreen,
  AlertsScreen,
} from './GutTrainingScreens';

type ScreenId =
  | 'goal-event'
  | 'tolerance'
  | 'weekly-prescription'
  | 'handoff'
  | 'post-session-log'
  | 'milestone'
  | 'race-day'
  | 'alerts';

const outcomeCopy: Record<'advance' | 'hold' | 'back-off', (g: number) => string> = {
  advance: (g) => `Nice — bumped to ${g} g/hr for next week.`,
  hold: (g) => `Held at ${g} g/hr for next week.`,
  'back-off': (g) => `Backed off to ${g} g/hr for next week.`,
};

interface GutTrainingFlowV2Props {
  isOpen: boolean;
  onClose: () => void;
}

function weeksBetween(isoDate: string): number {
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return 8;
  const days = (target - Date.now()) / 86_400_000;
  return Math.max(1, Math.round(days / 7));
}

export function GutTrainingFlowV2({ isOpen, onClose }: GutTrainingFlowV2Props) {
  const { userProfile } = useApp();
  const sport = userProfile.sport ?? 'running';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [program, setProgram] = useState<GutTrainingV2Program | null>(null);
  const [sessions, setSessions] = useState<GutTrainingSession[]>([]);
  const [screen, setScreen] = useState<ScreenId>('goal-event');

  // Setup form state
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [distanceKm, setDistanceKm] = useState(90);
  const [startGPerHour, setStartGPerHour] = useState(60);
  const [gutHistory, setGutHistory] = useState<GutHistoryTag[]>([]);
  const [weeksToEvent, setWeeksToEvent] = useState(8);

  // This-week session form state
  const [durationMinutes, setDurationMinutes] = useState(150);
  const [actualGPerHour, setActualGPerHour] = useState(0);
  const [gutResponse, setGutResponse] = useState<GutResponseV2>('clean');
  const [pendingSession, setPendingSession] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [p, s] = await Promise.all([getGutTrainingV2Program(), getAllGutTrainingV2Sessions()]);
      if (cancelled) return;
      setProgram(p);
      setSessions(s);
      // Reopening after the program already completed should land on the
      // milestone, not re-offer a "Saturday's session" that doesn't exist
      // any more — race day is a tap away from there either way.
      setScreen(!p ? 'goal-event' : p.status === 'completed' ? 'milestone' : 'weekly-prescription');
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Keep the date field pre-filled with a sane default weeks-to-event once
  // an event date is picked, without fighting the user's own edits after.
  useEffect(() => {
    if (eventDate) setWeeksToEvent(weeksBetween(eventDate));
  }, [eventDate]);

  const derivedTargetGPerHour = useMemo(
    () => (distanceKm > 0 ? deriveTargetGPerHour(distanceKm, sport) : 0),
    [distanceKm, sport],
  );

  const realism = useMemo(
    () => buildRealismNote(startGPerHour, derivedTargetGPerHour, weeksToEvent, 5),
    [startGPerHour, derivedTargetGPerHour, weeksToEvent],
  );

  const prescription = useMemo(
    () => (program ? buildSessionPrescription(program, durationMinutes) : null),
    [program, durationMinutes],
  );

  const alerts = useMemo(
    () => (program ? getActiveAlerts(program, sessions) : []),
    [program, sessions],
  );

  if (!isOpen) return null;

  async function persistProgram(next: GutTrainingV2Program) {
    await saveGutTrainingV2Program(next);
    if (getCurrentUser()) {
      await firestoreService.saveGutTrainingV2Program(next);
    }
  }

  async function persistSession(session: GutTrainingSession) {
    await addGutTrainingV2Session(session);
    if (getCurrentUser()) {
      await firestoreService.addGutTrainingV2Session(session);
    }
  }

  const handleBuildPlan = async () => {
    setSaving(true);
    try {
      const next = createProgramV2({
        event: { name: eventName.trim(), date: eventDate, distanceKm },
        startGPerHour,
        gutHistory,
        weeksToEvent,
        sport,
      });
      await persistProgram(next);
      setProgram(next);
      setSessions([]);
      toast.success('Gut training plan built');
      setScreen('weekly-prescription');
    } catch {
      toast.error('Failed to build plan');
    } finally {
      setSaving(false);
    }
  };

  const handleSendToWatch = () => {
    // Stub — no real device integration. See module docstring.
    setPendingSession(true);
    setActualGPerHour(prescription?.totalGrams ?? 0);
    setScreen('handoff');
  };

  const handleStartInApp = () => {
    setPendingSession(true);
    setActualGPerHour(prescription?.totalGrams ?? 0);
    setScreen('post-session-log');
  };

  const handleSaveSession = async () => {
    if (!program) return;
    setSaving(true);
    try {
      const { program: updated, session } = recordSessionV2(program, {
        actualGPerHour,
        durationMinutes,
        gutComfort: toGutComfort(gutResponse),
      });
      await persistProgram(updated);
      await persistSession(session);
      setProgram(updated);
      setSessions((prev) => [session, ...prev]);
      setPendingSession(false);
      setActualGPerHour(0);
      setGutResponse('clean');

      if (updated.status === 'completed') {
        toast.success(`Trained — you're tolerating ${updated.targetGPerHour} g/hr!`);
        setScreen('milestone');
        return;
      }
      toast.success(outcomeCopy[session.outcome](updated.currentGPerHour));
      const nextAlerts = getActiveAlerts(updated, [session, ...sessions]);
      setScreen(nextAlerts.length > 0 ? 'alerts' : 'weekly-prescription');
    } catch {
      toast.error('Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    setSaving(true);
    try {
      await clearGutTrainingV2Program();
      if (getCurrentUser()) {
        await firestoreService.clearGutTrainingV2Program();
      }
      setProgram(null);
      setSessions([]);
      setEventName('');
      setEventDate('');
      setDistanceKm(90);
      setStartGPerHour(60);
      setGutHistory([]);
      setScreen('goal-event');
    } catch {
      toast.error('Failed to reset program');
    } finally {
      setSaving(false);
    }
  };

  // Live preview of what saving this response will do to next week's
  // target — recordSessionV2 is pure, so we can call it speculatively
  // without persisting anything.
  const previewNote = (() => {
    if (!program) return '';
    const { program: preview, session } = recordSessionV2(program, {
      actualGPerHour,
      durationMinutes,
      gutComfort: toGutComfort(gutResponse),
    });
    if (preview.status === 'completed') return `Target reached — you're gut trained at ${preview.currentGPerHour} g/hr.`;
    return outcomeCopy[session.outcome](preview.currentGPerHour);
  })();

  const toggleGutHistory = (tag: GutHistoryTag) => {
    setGutHistory((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const behindPlanAlert = alerts.find((a) => a.type === 'behind-plan');
  const latestSession = sessions[0];

  const screenNode = (() => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    switch (screen) {
      case 'goal-event':
        return (
          <GoalEventScreen
            eventName={eventName}
            onChangeName={setEventName}
            eventDate={eventDate}
            onChangeDate={setEventDate}
            distanceKm={distanceKm}
            onChangeDistance={setDistanceKm}
            targetGPerHour={derivedTargetGPerHour}
            onNext={() => setScreen('tolerance')}
          />
        );
      case 'tolerance':
        return (
          <ToleranceScreen
            startGPerHour={startGPerHour}
            onChangeStart={setStartGPerHour}
            gutHistory={gutHistory}
            onToggleHistory={toggleGutHistory}
            weeksToEvent={weeksToEvent}
            onChangeWeeks={setWeeksToEvent}
            realism={realism}
            onBuildPlan={handleBuildPlan}
            saving={saving}
          />
        );
      case 'weekly-prescription':
        if (!program || !prescription) return null;
        return (
          <WeeklySessionScreen
            weekNumber={program.weekNumber}
            targetGPerHour={program.currentGPerHour}
            durationMinutes={durationMinutes}
            onChangeDuration={setDurationMinutes}
            prescription={prescription}
            onSendToWatch={handleSendToWatch}
            onStartInApp={handleStartInApp}
          />
        );
      case 'handoff': {
        if (!program || !prescription) return null;
        const firstCue = prescription.items[1] ?? prescription.items[0];
        return (
          <HandoffScreen
            nextCueLabel={firstCue.label}
            nextCueTimeLabel={firstCue.timeLabel}
            nextCueGrams={firstCue.grams}
            targetGPerHour={program.currentGPerHour}
            deviceName="Garmin Forerunner"
            alertsQueuedCount={prescription.items.length}
            onChangeDevice={() => toast.info('Device pairing is a fast-follow — Garmin Forerunner is the beta default.')}
            onImBack={() => setScreen('post-session-log')}
          />
        );
      }
      case 'post-session-log':
        if (!program) return null;
        return (
          <PostSessionLogScreen
            sessionTargetGPerHour={program.currentGPerHour}
            actualGPerHour={actualGPerHour}
            onChangeActual={setActualGPerHour}
            durationMinutes={durationMinutes}
            gutResponse={gutResponse}
            onChangeResponse={setGutResponse}
            previewNote={previewNote}
            onSave={handleSaveSession}
            saving={saving}
          />
        );
      case 'milestone':
        if (!program) return null;
        return (
          <MilestoneScreen
            stats={computeMilestoneStats(program, sessions)}
            program={program}
            onSeeRaceDayPlan={() => setScreen('race-day')}
          />
        );
      case 'race-day':
        if (!program) return null;
        return (
          <RaceDayScreen
            plan={buildRaceDayPlan(program, sport)}
            onSendToWatch={() => toast.success('Race plan sent to watch')}
            onShareWithCrew={async () => {
              const text = `${program.event.name} fuel plan — hold ${program.currentGPerHour} g/hr, ${buildRaceDayPlan(program, sport).totalGrams}g on course.`;
              if (navigator.share) {
                try { await navigator.share({ title: `${program.event.name} fuel plan`, text }); } catch { /* user cancelled */ }
              } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                toast.success('Copied — paste it to your crew');
              }
            }}
          />
        );
      case 'alerts':
        return (
          <AlertsScreen
            alerts={alerts}
            watchAlert={behindPlanAlert && latestSession
              ? { title: behindPlanAlert.title, grams: latestSession.actualGPerHour, targetGPerHour: latestSession.sessionTargetGPerHour }
              : null}
            onBack={() => setScreen('weekly-prescription')}
          />
        );
    }
  })();

  // Portaled to document.body — this is a full-screen viewport takeover
  // (per the v2 concept's full mobile pages, not a squeezed dialog like
  // v1's centered modal). Rendered from inside Sidebar's <aside>, whose
  // wrapper applies a `translate-x-*` utility for the mobile drawer — any
  // CSS transform on an ancestor becomes the containing block for
  // `position: fixed` descendants, which would otherwise trap this overlay
  // inside the sidebar's own box instead of the true viewport. The portal
  // sidesteps that entirely.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-background flex flex-col safe-top safe-bottom">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
        <div className="text-[10px] text-accent uppercase tracking-wider font-bold">Gut Training · Beta</div>
        <div className="flex items-center gap-1">
          {program && !pendingSession && screen !== 'goal-event' && screen !== 'tolerance' && (
            <button
              onClick={handleRestart}
              disabled={saving}
              className="p-2 text-text-muted hover:text-alert-brick transition-colors disabled:opacity-40"
              aria-label="Restart program"
              title="Restart program"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 max-w-md w-full mx-auto flex flex-col">
        {screenNode}
      </div>
    </div>,
    document.body,
  );
}
