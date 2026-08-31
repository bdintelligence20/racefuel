/**
 * Gut Training v2 (beta), orchestrator.
 *
 * Full-screen takeover (not a centered modal like v1). Opened from Sidebar
 * once VITE_GUT_TRAINING_V2 is on; reaching this and completing setup IS the
 * opt-in (see gutTrainingV2Program's `optedInAt`, the admin-visible record).
 *
 * Setup: pick an SA race (or enter one manually) to the app's carb engine
 * suggests a race-day g/hr the athlete can edit to tolerance to build. Then the
 * weekly loop (session to handoff to log) repeats to the milestone to race day.
 *
 * Handoff exports are real files (GPX fuel cues matched to the chosen device,
 * or a PDF) via the shared downloadFile helper, but there's no over-the-air
 * device integration; the athlete loads the file through their device's app.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Sparkles, Loader2 } from 'lucide-react';
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
  buildRealismNote,
  buildSessionPrescription,
  computeMilestoneStats,
  buildRaceDayPlan,
  getActiveAlerts,
  suggestCarbTarget,
  toGutComfort,
  type GutTrainingV2Program,
  type GutTrainingSession,
  type GutHistoryTag,
  type GutResponseV2,
  type CarbSuggestion,
  type FuelKitItem,
} from '../../services/nutrition/gutTrainingV2';
import { FuelPicker } from './FuelPicker';
import { searchRaces, nextOccurrence, type UpcomingRace, type RaceDiscipline } from '../../data/saRaces';
import { getRaceWeather, type RaceWeather } from '../../services/weather/weatherService';
import { deviceById, DEFAULT_DEVICE_ID } from '../../data/watchDevices';
import {
  exportFuelCuesToDevice, raceDayCues, sessionCues, downloadRaceDayPdf, downloadSessionPdf,
} from '../../services/nutrition/gutTrainingExport';
import {
  GoalEventScreen, ToleranceScreen, WeeklySessionScreen, HandoffScreen,
  PostSessionLogScreen, MilestoneScreen, RaceDayScreen, AlertsScreen,
} from './GutTrainingScreens';

type ScreenId =
  | 'goal-event' | 'tolerance' | 'weekly-prescription' | 'handoff'
  | 'post-session-log' | 'milestone' | 'race-day' | 'alerts';

const outcomeCopy: Record<'advance' | 'hold' | 'back-off', (g: number) => string> = {
  advance: (g) => `Love it, we'll nudge you up to ${g} g/hr next week.`,
  hold: (g) => `We'll hold ${g} g/hr next week and let it settle.`,
  'back-off': (g) => `No stress, we'll ease back to ${g} g/hr next week.`,
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
  const gutTolerance = userProfile.gutTolerance ?? 'trained';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [program, setProgram] = useState<GutTrainingV2Program | null>(null);
  const [sessions, setSessions] = useState<GutTrainingSession[]>([]);
  const [screen, setScreen] = useState<ScreenId>('goal-event');
  // Explicit beta consent. Separate from the program's `optedInAt` (which only
  // fires after full setup) — the flow shows a lightweight consent screen
  // first and won't proceed until the opt-in doc is written. Fails closed:
  // if we can't confirm prior consent, we ask for it.
  const [consented, setConsented] = useState(false);
  const [consenting, setConsenting] = useState(false);

  // ── Setup: race selection / manual entry ──
  const [raceQuery, setRaceQuery] = useState('');
  const [selectedRace, setSelectedRace] = useState<UpcomingRace | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  // Expected finish time is the PRIMARY input now — distance is only carried
  // along informationally when a catalog race is picked, never used to derive
  // duration. Effort (1–10) drives intensity; no route/pace inference.
  const [expectedDurationMinutes, setExpectedDurationMinutes] = useState(360); // 6h default
  const [effortLevel, setEffortLevel] = useState(6);
  const [distanceKm, setDistanceKm] = useState<number | undefined>(undefined);
  const [discipline, setDiscipline] = useState<RaceDiscipline>('road-run');
  const [elevationGainM, setElevationGainM] = useState(0);
  const [terrain, setTerrain] = useState<'flat' | 'rolling' | 'hilly' | 'mountainous'>('rolling');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const expectedDurationHours = expectedDurationMinutes / 60;

  // ── Setup: weather + engine suggestion + editable target ──
  const [weather, setWeather] = useState<RaceWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [targetGPerHour, setTargetGPerHour] = useState(90);
  const [targetEdited, setTargetEdited] = useState(false);

  // ── Tolerance form ──
  const [startGPerHour, setStartGPerHour] = useState(60);
  const [gutHistory, setGutHistory] = useState<GutHistoryTag[]>([]);
  const [weeksToEvent, setWeeksToEvent] = useState(8);

  // ── Weekly loop ──
  const [durationMinutes, setDurationMinutes] = useState(150);
  const [actualGPerHour, setActualGPerHour] = useState(0);
  const [gutResponse, setGutResponse] = useState<GutResponseV2>('clean');
  const [pendingSession, setPendingSession] = useState(false);

  // ── Handoff / export ──
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [exporting, setExporting] = useState(false);
  const [exportedHint, setExportedHint] = useState<string | null>(null);

  // ── Fuel kit (exact products the athlete will use) ──
  const [fuelPickerOpen, setFuelPickerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [p, s] = await Promise.all([getGutTrainingV2Program(), getAllGutTrainingV2Sessions()]);
      if (cancelled) return;
      setProgram(p);
      setSessions(s);
      if (p?.deviceId) setDeviceId(p.deviceId);
      setScreen(!p ? 'goal-event' : p.status === 'completed' ? 'milestone' : 'weekly-prescription');
      // Whether the athlete has already accepted the beta. Read separately so
      // a returning opted-in user skips the consent screen.
      try {
        const optIns = await firestoreService.loadBetaOptIns();
        if (!cancelled) setConsented(!!optIns?.gutTraining?.optedIn);
      } catch {
        if (!cancelled) setConsented(false); // fail closed → ask for consent
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Default weeks-to-event from the chosen date, without fighting later edits.
  useEffect(() => {
    if (eventDate) setWeeksToEvent(weeksBetween(eventDate));
  }, [eventDate]);

  // Engine suggestion, recompute as duration / effort change. Time-driven —
  // distance is never an input here.
  const suggestion = useMemo<CarbSuggestion | null>(() => {
    if (expectedDurationHours <= 0) return null;
    return suggestCarbTarget({ durationHours: expectedDurationHours, effortLevel, gutTolerance });
  }, [expectedDurationHours, effortLevel, gutTolerance]);

  // Keep the editable target synced to the suggestion until the athlete edits it.
  useEffect(() => {
    if (suggestion && !targetEdited) setTargetGPerHour(suggestion.targetGPerHour);
  }, [suggestion, targetEdited]);

  // Race-day weather, only when we have coordinates (a picked race) + a date.
  useEffect(() => {
    if (lat === undefined || lng === undefined || !eventDate) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    getRaceWeather(lat, lng, eventDate)
      .then((w) => { if (!cancelled) setWeather(w); })
      .catch(() => { if (!cancelled) setWeather(null); })
      .finally(() => { if (!cancelled) setWeatherLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lng, eventDate]);

  const raceResults = useMemo(() => searchRaces(raceQuery).slice(0, 12), [raceQuery]);

  const realism = useMemo(
    () => buildRealismNote(startGPerHour, targetGPerHour, weeksToEvent, 5),
    [startGPerHour, targetGPerHour, weeksToEvent],
  );

  const prescription = useMemo(
    () => (program ? buildSessionPrescription(program, durationMinutes) : null),
    [program, durationMinutes],
  );

  const alerts = useMemo(() => (program ? getActiveAlerts(program, sessions) : []), [program, sessions]);

  if (!isOpen) return null;

  const selectRace = (r: UpcomingRace) => {
    setSelectedRace(r);
    setEventName(r.name);
    setEventDate(nextOccurrence(r).toISOString().slice(0, 10));
    setDistanceKm(r.distanceKm);
    setDiscipline(r.discipline);
    setElevationGainM(r.elevationGainM);
    setTerrain(r.terrain);
    setLat(r.lat);
    setLng(r.lng);
    setTargetEdited(false); // let the new suggestion drive the target
  };

  const clearRace = () => {
    setSelectedRace(null);
    setLat(undefined);
    setLng(undefined);
    setWeather(null);
  };

  const changeTarget = (n: number) => {
    setTargetGPerHour(n);
    setTargetEdited(true);
  };

  async function persistProgram(next: GutTrainingV2Program) {
    await saveGutTrainingV2Program(next);
    if (getCurrentUser()) await firestoreService.saveGutTrainingV2Program(next);
  }

  async function persistSession(session: GutTrainingSession) {
    await addGutTrainingV2Session(session);
    if (getCurrentUser()) await firestoreService.addGutTrainingV2Session(session);
  }

  const handleConsent = async () => {
    setConsenting(true);
    try {
      await firestoreService.setGutTrainingOptIn();
    } catch (err) {
      // Persist can fail for the dev-bypass user (no real session). Proceed
      // locally so the flow is still usable; real users get it written.
      console.warn('[gut-training] opt-in persist failed:', err);
    } finally {
      setConsenting(false);
      setConsented(true);
    }
  };

  const handleBuildPlan = async () => {
    setSaving(true);
    try {
      const next = createProgramV2({
        event: {
          name: eventName.trim(),
          date: eventDate,
          durationHours: expectedDurationHours,
          // informational only (from a catalog pick); never drives duration
          distanceKm, discipline, terrain, elevationGainM, lat, lng,
        },
        startGPerHour,
        gutHistory,
        weeksToEvent,
        targetGPerHour,
        deviceId,
      });
      await persistProgram(next);
      setProgram(next);
      setSessions([]);
      toast.success('Your plan is ready');
      setScreen('weekly-prescription');
    } catch {
      toast.error("Couldn't build the plan");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFuelKit = async (kit: FuelKitItem[]) => {
    setFuelPickerOpen(false);
    if (!program) return;
    const next = { ...program, fuelKit: kit };
    setProgram(next);
    try {
      await persistProgram(next);
      toast.success(kit.length > 0 ? 'Fuel saved' : 'Fuel cleared');
    } catch {
      toast.error("Couldn't save your fuel");
    }
  };

  const handleSelectDevice = async (id: string) => {
    setDeviceId(id);
    setExportedHint(null);
    if (program) {
      const next = { ...program, deviceId: id };
      setProgram(next);
      try { await persistProgram(next); } catch { /* non-critical */ }
    }
  };

  const handleExportSessionGpx = async () => {
    if (!program || !prescription) return;
    setExporting(true);
    try {
      const { loadHint } = await exportFuelCuesToDevice(
        program, sessionCues(prescription), `Week ${prescription.weekNumber} session`, deviceId,
      );
      setExportedHint(loadHint);
      toast.success(`Sent to ${deviceById(deviceId).brand}`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportRaceGpx = async () => {
    if (!program) return;
    setExporting(true);
    try {
      const plan = buildRaceDayPlan(program);
      const { loadHint } = await exportFuelCuesToDevice(program, raceDayCues(program, plan), 'Race day', deviceId);
      toast.success(`Sent to ${deviceById(deviceId).brand}. ${loadHint}`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
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
      setExportedHint(null);

      if (updated.status === 'completed') {
        toast.success(`That's it, you're tolerating ${updated.targetGPerHour} g/hr!`);
        setScreen('milestone');
        return;
      }
      toast.success(outcomeCopy[session.outcome](updated.currentGPerHour));
      const nextAlerts = getActiveAlerts(updated, [session, ...sessions]);
      setScreen(nextAlerts.length > 0 ? 'alerts' : 'weekly-prescription');
    } catch {
      toast.error("Couldn't save the run");
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    setSaving(true);
    try {
      await clearGutTrainingV2Program();
      if (getCurrentUser()) await firestoreService.clearGutTrainingV2Program();
      setProgram(null);
      setSessions([]);
      setSelectedRace(null);
      setManualMode(false);
      setEventName('');
      setEventDate('');
      setExpectedDurationMinutes(360);
      setEffortLevel(6);
      setDistanceKm(undefined);
      setDiscipline('road-run');
      setElevationGainM(0);
      setTerrain('rolling');
      setLat(undefined);
      setLng(undefined);
      setTargetEdited(false);
      setStartGPerHour(60);
      setGutHistory([]);
      setExportedHint(null);
      setScreen('goal-event');
    } catch {
      toast.error("Couldn't reset");
    } finally {
      setSaving(false);
    }
  };

  const previewNote = (() => {
    if (!program) return '';
    const { program: preview, session } = recordSessionV2(program, {
      actualGPerHour, durationMinutes, gutComfort: toGutComfort(gutResponse),
    });
    if (preview.status === 'completed') return `That would do it, you'd be race-ready at ${preview.currentGPerHour} g/hr.`;
    return outcomeCopy[session.outcome](preview.currentGPerHour);
  })();

  const toggleGutHistory = (tag: GutHistoryTag) => {
    setGutHistory((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const hasEvent = selectedRace
    ? true
    : manualMode
      ? eventName.trim().length > 0 && eventDate.length > 0
      : false;
  const canProceedGoal = hasEvent && expectedDurationMinutes > 0;

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

    // Consent gate — explicit opt-in before the beta flow is usable.
    if (!consented) {
      return <ConsentGate onAccept={handleConsent} onDecline={onClose} pending={consenting} />;
    }

    switch (screen) {
      case 'goal-event':
        return (
          <GoalEventScreen
            raceQuery={raceQuery}
            onChangeRaceQuery={setRaceQuery}
            raceResults={raceResults}
            selectedRace={selectedRace}
            onSelectRace={selectRace}
            onClearRace={clearRace}
            manualMode={manualMode}
            onToggleManual={() => setManualMode((v) => !v)}
            eventName={eventName}
            onChangeName={setEventName}
            eventDate={eventDate}
            onChangeDate={setEventDate}
            durationMinutes={expectedDurationMinutes}
            onChangeDuration={setExpectedDurationMinutes}
            effortLevel={effortLevel}
            onChangeEffort={setEffortLevel}
            weather={weather}
            weatherLoading={weatherLoading}
            suggestion={suggestion}
            targetGPerHour={targetGPerHour}
            onChangeTarget={changeTarget}
            targetEdited={targetEdited}
            canProceed={canProceedGoal}
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
            hasFuelKit={(program.fuelKit?.length ?? 0) > 0}
            onChooseFuel={() => setFuelPickerOpen(true)}
            onSendToWatch={() => { setExportedHint(null); setPendingSession(true); setActualGPerHour(prescription.totalGrams); setScreen('handoff'); }}
            onStartInApp={() => { setPendingSession(true); setActualGPerHour(prescription.totalGrams); setScreen('post-session-log'); }}
            onExportPdf={() => downloadSessionPdf(program, prescription)}
          />
        );
      case 'handoff': {
        if (!program || !prescription) return null;
        const firstCue = prescription.items[1] ?? prescription.items[0];
        return (
          <HandoffScreen
            device={deviceById(deviceId)}
            onSelectDevice={handleSelectDevice}
            nextCueLabel={firstCue.label}
            nextCueTimeLabel={firstCue.timeLabel}
            nextCueGrams={firstCue.grams}
            targetGPerHour={program.currentGPerHour}
            cueCount={prescription.items.length}
            onExportGpx={handleExportSessionGpx}
            onExportPdf={() => downloadSessionPdf(program, prescription)}
            exportedHint={exportedHint}
            exporting={exporting}
            onDone={() => setScreen('post-session-log')}
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
            plan={buildRaceDayPlan(program)}
            exporting={exporting}
            onSendToWatch={handleExportRaceGpx}
            onExportPdf={() => downloadRaceDayPdf(program, buildRaceDayPlan(program))}
            onShareWithCrew={async () => {
              const plan = buildRaceDayPlan(program);
              const text = `${program.event.name} fuel plan, hold ${program.currentGPerHour} g/hr, ${plan.totalGrams}g on course.`;
              if (navigator.share) {
                try { await navigator.share({ title: `${program.event.name} fuel plan`, text }); } catch { /* cancelled */ }
              } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                toast.success('Copied, paste it to your crew');
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

  const showRestart = consented && program && !pendingSession && screen !== 'goal-event' && screen !== 'tolerance';

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background flex flex-col safe-top safe-bottom">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-display font-black text-text-primary tracking-tight">Gut training</span>
          <span className="text-[9px] font-display font-bold text-accent px-1.5 py-0.5 rounded-full bg-accent/10 uppercase tracking-wider">Beta</span>
        </div>
        <div className="flex items-center gap-1">
          {showRestart && (
            <button
              onClick={handleRestart}
              disabled={saving}
              className="p-2 text-text-muted hover:text-alert-brick transition-colors disabled:opacity-40"
              aria-label="Start over"
              title="Start over"
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

      <FuelPicker
        isOpen={fuelPickerOpen}
        initialKit={program?.fuelKit ?? []}
        preferredBrands={userProfile.preferredBrands}
        onClose={() => setFuelPickerOpen(false)}
        onSave={handleSaveFuelKit}
      />
    </div>,
    document.body,
  );
}

/** Lightweight consent screen shown before the beta flow is usable. Accepting
 *  writes the opt-in doc (see firestore.setGutTrainingOptIn); declining just
 *  closes the flow, leaving the athlete free to open it again later. */
function ConsentGate({
  onAccept,
  onDecline,
  pending,
}: {
  onAccept: () => void;
  onDecline: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-8">
      <div className="w-11 h-11 rounded-2xl bg-accent/10 flex items-center justify-center mb-5">
        <Sparkles className="w-5 h-5 text-accent" />
      </div>
      <h2 className="text-xl font-display font-black text-text-primary tracking-tight mb-2">
        Join the gut-training beta
      </h2>
      <p className="text-[13px] font-sans text-text-secondary leading-relaxed mb-6">
        Train your gut to hold more carbs per hour on race day, one weekly session at a
        time. It's still in beta, so expect the odd rough edge, and tell us what breaks.
      </p>
      <div className="flex flex-col gap-2.5">
        <button
          onClick={onAccept}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-white text-[13px] font-display font-bold hover:bg-accent-light transition-colors disabled:opacity-50"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {pending ? 'Setting up…' : "I'm in"}
        </button>
        <button
          onClick={onDecline}
          disabled={pending}
          className="w-full py-3 rounded-xl border border-[var(--color-border)] text-text-secondary text-[13px] font-display font-semibold hover:bg-accent/[0.06] hover:text-text-primary transition-colors disabled:opacity-50"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
