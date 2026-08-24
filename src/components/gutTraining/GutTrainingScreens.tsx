/**
 * Gut Training v2 (beta) — the 8 presentational screens from the v2 concept
 * design (Aug 2026): goal event, current tolerance, weekly session
 * prescription, watch handoff, post-session log, trained milestone, race
 * day plan, and alert states. Dumb components — all state and persistence
 * live in GutTrainingFlowV2.tsx.
 *
 * Design rules followed throughout: cream is the surface everywhere; plum
 * is type plus one primary (filled) button per screen; target/route values
 * read as a tinted plum panel, not a saturated block; selection is a thin
 * plum outline, not a fill; alert tones (amber/brick) appear only on the
 * alert screen and the watch alert tile — never decoratively.
 */
import type { ReactNode } from 'react';
import { Check, ChevronRight, Watch as WatchIcon, Send, Share2 } from 'lucide-react';
import { NumberField } from '../ui/NumberField';
import {
  GUT_HISTORY_TAGS,
  type GutHistoryTag,
  type GutResponseV2,
  type RealismCheck,
  type SessionPrescription,
  type MilestoneStats,
  type RaceDayPlan,
  type GutTrainingAlert,
  type GutTrainingV2Program,
} from '../../services/nutrition/gutTrainingV2';

/* ------------------------------ shared bits ------------------------------ */

function Kicker({ children }: { children: ReactNode }) {
  return <div className="text-[10px] text-accent uppercase tracking-[0.18em] font-bold mb-1">{children}</div>;
}

function ScreenShell({ kicker, title, subtitle, children, footer }: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-6 space-y-5">
        <div>
          <Kicker>{kicker}</Kicker>
          <h1 className="text-xl font-display font-black text-text-primary leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
      <div className="flex-shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-[var(--color-border)] bg-background space-y-2">
        {footer}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, loading }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 bg-accent text-background text-sm font-display font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5"
    >
      {loading ? 'Working…' : children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 border border-accent/30 text-accent text-sm font-display font-semibold rounded-xl hover:bg-accent/[0.06] transition-colors disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Target/route values read as a tinted plum panel, per the design note —
 *  never a saturated block. */
function TintedPanel({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-surfaceHighlight p-4">{children}</div>;
}

/** Thin plum outline for selection — never a fill — per the design note. */
function OutlineChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        selected ? 'border-accent text-accent' : 'border-[var(--color-border)] text-text-secondary hover:border-accent/40'
      }`}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-[10px] font-medium text-text-secondary uppercase tracking-wider block mb-1.5">{children}</label>;
}

function fieldInputClass() {
  return 'w-full bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-base font-display p-3 focus:outline-none focus:border-accent transition-colors';
}

/* ---------------------------- 1 · goal event ------------------------------ */

export function GoalEventScreen({
  eventName, onChangeName, eventDate, onChangeDate, distanceKm, onChangeDistance, targetGPerHour, onNext,
}: {
  eventName: string; onChangeName: (v: string) => void;
  eventDate: string; onChangeDate: (v: string) => void;
  distanceKm: number; onChangeDistance: (v: number) => void;
  targetGPerHour: number; onNext: () => void;
}) {
  const canProceed = eventName.trim().length > 0 && eventDate.length > 0 && distanceKm > 0;
  return (
    <ScreenShell
      kicker="1 · SET UP"
      title="Your goal event"
      footer={<PrimaryButton onClick={onNext} disabled={!canProceed}>Next</PrimaryButton>}
    >
      <div>
        <FieldLabel>Event</FieldLabel>
        <input
          type="text"
          value={eventName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="e.g. Comrades Marathon"
          className={fieldInputClass()}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <FieldLabel>Date</FieldLabel>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => onChangeDate(e.target.value)}
            className={fieldInputClass()}
          />
        </div>
        <div className="flex-1">
          <FieldLabel>Distance</FieldLabel>
          <div className="flex items-center gap-2">
            <NumberField
              value={distanceKm}
              onChange={onChangeDistance}
              min={1}
              max={500}
              ariaLabel="Event distance in kilometres"
              commitOnBlur
              className={fieldInputClass()}
            />
            <span className="text-text-muted font-display text-xs">km</span>
          </div>
        </div>
      </div>

      {distanceKm > 0 && (
        <TintedPanel>
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">This route needs</div>
          <div className="text-3xl font-display font-black text-accent">{targetGPerHour} g/hr</div>
          <p className="text-[11px] text-text-muted mt-1.5">Derived from the course profile and your expected finish time.</p>
        </TintedPanel>
      )}
    </ScreenShell>
  );
}

/* -------------------------- 2 · current tolerance -------------------------- */

export function ToleranceScreen({
  startGPerHour, onChangeStart, gutHistory, onToggleHistory, weeksToEvent, onChangeWeeks, realism, onBuildPlan, saving,
}: {
  startGPerHour: number; onChangeStart: (v: number) => void;
  gutHistory: GutHistoryTag[]; onToggleHistory: (tag: GutHistoryTag) => void;
  weeksToEvent: number; onChangeWeeks: (v: number) => void;
  realism: RealismCheck; onBuildPlan: () => void; saving: boolean;
}) {
  const noteTone = realism.level === 'comfortable' ? 'text-text-secondary' : realism.level === 'tight' ? 'text-alert-amber' : 'text-alert-brick';
  return (
    <ScreenShell
      kicker="1 · SET UP"
      title="Where you're starting"
      footer={<PrimaryButton onClick={onBuildPlan} loading={saving}>Build my plan</PrimaryButton>}
    >
      <TintedPanel>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Comfortable now at</div>
        <div className="flex items-baseline gap-2">
          <NumberField
            value={startGPerHour}
            onChange={onChangeStart}
            min={10}
            max={120}
            ariaLabel="Comfortable carbs per hour"
            commitOnBlur
            className="w-24 bg-surface border border-[var(--color-border)] rounded-lg text-accent text-2xl font-display font-black p-2 focus:outline-none focus:border-accent transition-colors"
          />
          <span className="text-text-muted font-display text-sm">g/hr</span>
        </div>
      </TintedPanel>

      <div>
        <FieldLabel>Gut history</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {GUT_HISTORY_TAGS.map(({ value, label }) => (
            <OutlineChip key={value} label={label} selected={gutHistory.includes(value)} onClick={() => onToggleHistory(value)} />
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Weeks to event</FieldLabel>
        <div className="flex items-center gap-2">
          <NumberField
            value={weeksToEvent}
            onChange={onChangeWeeks}
            min={1}
            max={52}
            ariaLabel="Weeks to event"
            commitOnBlur
            className={`${fieldInputClass()} w-24`}
          />
          <span className="text-text-muted font-display text-xs">weeks</span>
        </div>
      </div>

      <p className={`text-xs leading-relaxed ${noteTone}`}>{realism.note}</p>
    </ScreenShell>
  );
}

/* -------------------------- 2 · weekly prescription ------------------------- */

export function WeeklySessionScreen({
  weekNumber, targetGPerHour, durationMinutes, onChangeDuration, prescription, onSendToWatch, onStartInApp,
}: {
  weekNumber: number; targetGPerHour: number;
  durationMinutes: number; onChangeDuration: (v: number) => void;
  prescription: SessionPrescription;
  onSendToWatch: () => void; onStartInApp: () => void;
}) {
  const hours = (durationMinutes / 60).toFixed(1).replace(/\.0$/, '');
  return (
    <ScreenShell
      kicker="2 · EACH WEEK"
      title="Saturday's session"
      subtitle={`Week ${weekNumber}`}
      footer={
        <>
          <PrimaryButton onClick={onSendToWatch}>
            <Send className="w-4 h-4" /> Send session plan to watch
          </PrimaryButton>
          <SecondaryButton onClick={onStartInApp}>Start in app</SecondaryButton>
        </>
      }
    >
      <TintedPanel>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Long run</div>
          <div className="flex items-center gap-1">
            <NumberField
              value={durationMinutes}
              onChange={onChangeDuration}
              min={30}
              max={720}
              step={15}
              ariaLabel="Session duration in minutes"
              commitOnBlur
              className="w-14 bg-surface border border-[var(--color-border)] rounded-md text-text-primary text-xs font-display p-1.5 text-right focus:outline-none focus:border-accent"
            />
            <span className="text-[10px] text-text-muted">min</span>
          </div>
        </div>
        <div className="text-2xl font-display font-black text-accent mt-1">{hours}hr · hold {targetGPerHour} g/hr</div>
      </TintedPanel>

      <div>
        <FieldLabel>Suggested intake</FieldLabel>
        <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
          {prescription.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-text-secondary">
                <span className="text-text-muted font-display text-[10px] mr-2">{item.timeLabel}</span>
                {item.label}
              </span>
              <span className="font-display font-semibold text-text-primary">{item.grams}g</span>
            </div>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-text-muted flex items-center gap-1">
            <ChevronRight className="w-2.5 h-2.5" /> repeat each hour
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-text-secondary">Session total</span>
        <span className="text-lg font-display font-black text-text-primary">≈{prescription.totalGrams}g</span>
      </div>
    </ScreenShell>
  );
}

/* ------------------------------ 2 · handoff -------------------------------- */

export function HandoffScreen({
  nextCueLabel, nextCueTimeLabel, nextCueGrams, targetGPerHour, deviceName, alertsQueuedCount, onChangeDevice, onImBack,
}: {
  nextCueLabel: string; nextCueTimeLabel: string; nextCueGrams: number; targetGPerHour: number;
  deviceName: string; alertsQueuedCount: number;
  onChangeDevice: () => void; onImBack: () => void;
}) {
  return (
    <ScreenShell
      kicker="2 · HANDOFF"
      title="Sent to your watch"
      footer={
        <>
          <SecondaryButton onClick={onChangeDevice}>Change device</SecondaryButton>
          <button onClick={onImBack} className="w-full py-2 text-xs text-text-muted hover:text-text-primary transition-colors">
            I'm back — log this session
          </button>
        </>
      }
    >
      {/* The one place deep plum stays as ground, per the design note — dark
          ground + cream type is what survives sunlight on a real watch. */}
      <div className="rounded-[28px] bg-accent p-6 flex flex-col items-center text-center gap-1.5 mx-auto max-w-[220px] aspect-square justify-center">
        <div className="text-[9px] text-background/60 uppercase tracking-[0.2em] font-bold">Next cue</div>
        <div className="text-2xl font-display font-black text-background uppercase">{nextCueLabel}</div>
        <div className="text-sm font-display text-background/80">{nextCueTimeLabel}</div>
        <div className="w-3/4 h-1 rounded-full bg-background/20 my-1.5 overflow-hidden">
          <div className="h-full bg-background/70" style={{ width: `${Math.min(100, Math.round((nextCueGrams / targetGPerHour) * 100))}%` }} />
        </div>
        <div className="text-[10px] text-background/60">{nextCueGrams} in {targetGPerHour} g/hr</div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        <div className="flex items-center justify-between px-3 py-2.5 text-sm">
          <span className="text-text-muted flex items-center gap-1.5"><WatchIcon className="w-3.5 h-3.5" /> Device</span>
          <span className="font-display font-semibold text-text-primary">{deviceName}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 text-sm">
          <span className="text-text-muted">Alerts queued</span>
          <span className="font-display font-semibold text-text-primary">{alertsQueuedCount} cues</span>
        </div>
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed px-1">
        Buzzes at each cue. Logs what you confirm, so the session writes itself.
      </p>
    </ScreenShell>
  );
}

/* --------------------------- 2 · post-session log --------------------------- */

export function PostSessionLogScreen({
  sessionTargetGPerHour, actualGPerHour, onChangeActual, durationMinutes, gutResponse, onChangeResponse, previewNote, onSave, saving,
}: {
  sessionTargetGPerHour: number; actualGPerHour: number; onChangeActual: (v: number) => void;
  durationMinutes: number;
  gutResponse: GutResponseV2; onChangeResponse: (r: GutResponseV2) => void;
  previewNote: string;
  onSave: () => void; saving: boolean;
}) {
  const rate = durationMinutes > 0 ? Math.round((actualGPerHour * 60) / durationMinutes) : actualGPerHour;
  const responses: { value: GutResponseV2; label: string; dot: string }[] = [
    { value: 'clean', label: 'Clean', dot: 'border-2 border-accent' },
    { value: 'mild', label: 'Mild', dot: 'bg-alert-amber/60' },
    { value: 'rough', label: 'Rough', dot: 'bg-alert-brick' },
  ];
  return (
    <ScreenShell
      kicker="2 · EACH WEEK"
      title="How did it sit?"
      footer={<PrimaryButton onClick={onSave} loading={saving}>Save session</PrimaryButton>}
    >
      <TintedPanel>
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">You took in</div>
        <div className="flex items-baseline gap-2">
          <NumberField
            value={actualGPerHour}
            onChange={onChangeActual}
            min={0}
            max={400}
            ariaLabel="Total grams taken in this session"
            commitOnBlur
            className="w-24 bg-surface border border-[var(--color-border)] rounded-lg text-accent text-2xl font-display font-black p-2 focus:outline-none focus:border-accent transition-colors"
          />
          <span className="text-text-muted font-display text-sm">g · {rate} g/hr</span>
        </div>
        <p className="text-[10px] text-text-muted mt-1.5">Pulled from your watch, edit if needed. Target was {sessionTargetGPerHour} g/hr.</p>
      </TintedPanel>

      <div>
        <FieldLabel>Gut response</FieldLabel>
        <div className="flex gap-2">
          {responses.map(({ value, label, dot }) => (
            <button
              key={value}
              onClick={() => onChangeResponse(value)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-colors ${
                gutResponse === value ? 'border-accent' : 'border-[var(--color-border)] hover:border-accent/40'
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${dot}`} />
              <span className="text-xs font-medium text-text-primary">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <TintedPanel>
        <p className="text-sm text-text-primary font-medium">{previewNote}</p>
      </TintedPanel>
    </ScreenShell>
  );
}

/* -------------------------------- 3 · trained -------------------------------- */

export function MilestoneScreen({ stats, program, onSeeRaceDayPlan }: {
  stats: MilestoneStats; program: GutTrainingV2Program; onSeeRaceDayPlan: () => void;
}) {
  return (
    <ScreenShell
      kicker="3 · TRAINED"
      title=""
      footer={<PrimaryButton onClick={onSeeRaceDayPlan}>See race day plan</PrimaryButton>}
    >
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
          <Check className="w-7 h-7 text-background" />
        </div>
        <div className="text-xs font-display font-bold text-text-secondary uppercase tracking-wider">You're gut trained</div>
        <div className="text-5xl font-display font-black text-accent">{stats.gPerHour} g/hr</div>
        <p className="text-sm text-text-secondary">up from {program.startGPerHour} g/hr in {stats.weeksElapsed} weeks</p>

        <div className="flex items-center gap-6 mt-2">
          <div className="text-center">
            <div className="text-lg font-display font-black text-text-primary">{stats.weeksElapsed}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">weeks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-display font-black text-text-primary">{stats.sessionsCount}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">sessions</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-display font-black text-text-primary">{stats.cleanPercent}%</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">clean</div>
          </div>
        </div>

        <p className="text-sm text-text-primary font-medium mt-2 max-w-xs">
          Your gut can now carry race pace. Ready for {program.event.name}.
        </p>
      </div>
    </ScreenShell>
  );
}

/* -------------------------------- 4 · race day -------------------------------- */

export function RaceDayScreen({ plan, onSendToWatch, onShareWithCrew }: {
  plan: RaceDayPlan; onSendToWatch: () => void; onShareWithCrew: () => void;
}) {
  const maxGrams = Math.max(...plan.segments.map((s) => s.grams), 1);
  return (
    <ScreenShell
      kicker="4 · RACE DAY"
      title={`${plan.event.name} · fuel plan`}
      subtitle={`${plan.event.distanceKm}km · hold ${plan.targetGPerHour} g/hr`}
      footer={
        <>
          <PrimaryButton onClick={onSendToWatch}>
            <Send className="w-4 h-4" /> Send race plan to watch
          </PrimaryButton>
          <SecondaryButton onClick={onShareWithCrew}>
            <span className="inline-flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /> Share with crew</span>
          </SecondaryButton>
        </>
      }
    >
      <div className="flex items-end gap-1.5 h-20 px-1">
        {plan.segments.map((seg, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t bg-accent/70" style={{ height: `${Math.max(8, (seg.grams / maxGrams) * 100)}%` }} />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
        {plan.segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-text-secondary">{seg.fromKm} to {seg.toKm}km</span>
            <span className="font-display font-semibold text-text-primary">{seg.grams}g</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-text-secondary">Total on course</span>
        <span className="text-lg font-display font-black text-text-primary">≈{plan.totalGrams}g</span>
      </div>
    </ScreenShell>
  );
}

/* ------------------------------- alert states -------------------------------- */

function AlertCard({ alert }: { alert: GutTrainingAlert }) {
  const bg = alert.tone === 'amber' ? 'bg-alert-amberTint' : 'bg-alert-brickTint';
  const text = alert.tone === 'amber' ? 'text-alert-amber' : 'text-alert-brick';
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <div className={`text-xs font-display font-bold uppercase tracking-wider mb-1 ${text}`}>{alert.title}</div>
      <p className="text-sm text-text-primary">{alert.message}</p>
    </div>
  );
}

export function AlertsScreen({ alerts, watchAlert, onBack }: {
  alerts: GutTrainingAlert[];
  watchAlert: { title: string; grams: number; targetGPerHour: number } | null;
  onBack: () => void;
}) {
  return (
    <ScreenShell
      kicker="ALERT STATES"
      title="When something is off"
      footer={<SecondaryButton onClick={onBack}>Back</SecondaryButton>}
    >
      <div className="space-y-3">
        {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
      </div>

      {watchAlert && (
        <div className="rounded-[28px] bg-accent p-6 flex flex-col items-center text-center gap-1.5 mx-auto max-w-[220px] aspect-square justify-center">
          <div className="text-[9px] text-alert-amber uppercase tracking-[0.2em] font-bold">{watchAlert.title}</div>
          <div className="text-2xl font-display font-black text-background uppercase">Gel now</div>
          <div className="text-[10px] text-background/60">{watchAlert.grams} of {watchAlert.targetGPerHour} g/hr</div>
        </div>
      )}

      <p className="text-[11px] text-text-muted leading-relaxed px-1">
        Amber for behind plan, brick for needs a decision. Both muted so they sit on screen without shouting.
      </p>
    </ScreenShell>
  );
}
