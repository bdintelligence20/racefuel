/**
 * Gut Training v2 (beta), the screens.
 *
 * Consumer-app voice (think Runna): warm, direct coaching copy, no clinical
 * "step 1 of 8" / "SET UP" section labels on screen, progress is a quiet bar,
 * not a heading. Dumb components; all state + persistence live in
 * GutTrainingFlowV2.tsx.
 *
 * Design language: cream is the surface everywhere; plum is type plus one
 * primary (filled) button per screen; target/route values read as a tinted
 * plum panel, not a saturated block; selection is a thin plum outline;
 * alert tones (amber/brick) appear only on alerts and the watch alert tile.
 */
import { useState, type ReactNode } from 'react';
import {
  Check, Search, Watch as WatchIcon, Send, Share2, FileDown, MapPin,
  Calendar, Thermometer, Droplets, Wind, ChevronDown, Pencil,
} from 'lucide-react';
import { NumberField } from '../ui/NumberField';
import {
  GUT_HISTORY_TAGS, type GutHistoryTag, type GutResponseV2, type RealismCheck,
  type SessionPrescription, type MilestoneStats, type RaceDayPlan,
  type GutTrainingAlert, type GutTrainingV2Program, type CarbSuggestion,
} from '../../services/nutrition/gutTrainingV2';
import {
  DISCIPLINE_LABELS, type UpcomingRace,
} from '../../data/saRaces';
import type { RaceWeather } from '../../services/weather/weatherService';
import { WATCH_DEVICES, preferredFuelFormat, type WatchDevice } from '../../data/watchDevices';

/* ------------------------------ shared bits ------------------------------ */

function ScreenShell({ title, subtitle, progress, children, footer }: {
  title: string;
  subtitle?: string;
  /** 0 to 1 setup progress; renders a quiet bar. Omit on the recurring loop. */
  progress?: number;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      {progress !== undefined && (
        <div className="px-5 pt-1">
          <div className="h-1 rounded-full bg-surfaceHighlight overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-6 space-y-5">
        <div>
          <h1 className="text-2xl font-display font-black text-text-primary leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-text-secondary mt-1.5">{subtitle}</p>}
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
  children: ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 bg-accent text-background text-sm font-display font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-1.5"
    >
      {loading ? 'One sec…' : children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 border border-accent/30 text-accent text-sm font-display font-semibold rounded-xl hover:bg-accent/[0.06] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
    >
      {children}
    </button>
  );
}

function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full py-2 text-xs font-display font-semibold text-text-muted hover:text-text-primary transition-colors">
      {children}
    </button>
  );
}

/** Target/route values read as a tinted plum panel, per the design note. */
function TintedPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surfaceHighlight p-4 ${className}`}>{children}</div>;
}

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

function formatEffort(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function formatRaceDate(d: Date): string {
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ------------------------- weather + target panels ------------------------ */

function WeatherPanel({ weather, loading }: { weather: RaceWeather | null; loading: boolean }) {
  if (loading) {
    return (
      <TintedPanel>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Checking race-day conditions…
        </div>
      </TintedPanel>
    );
  }
  if (!weather || Number.isNaN(weather.tempMax)) return null;

  const hot = weather.tempMax >= 26;
  return (
    <TintedPanel>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          {weather.source === 'forecast' ? 'Race-day forecast' : 'Typical for race week'}
        </span>
        <span className="text-[9px] font-display font-bold text-accent px-1.5 py-0.5 rounded-full bg-accent/10 uppercase tracking-wider">
          {weather.source === 'forecast' ? 'Forecast' : `${weather.yearsAveraged ?? 3}-yr avg`}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Thermometer className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-display font-bold text-text-primary">{weather.tempMin}, {weather.tempMax}°C</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Droplets className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-display text-text-secondary">{weather.humidity}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Wind className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-display text-text-secondary">{weather.windSpeed} km/h</span>
        </div>
      </div>
      {hot && (
        <p className="text-[11px] text-text-secondary mt-2 leading-relaxed">
          Warm day likely, keep your carbs up and lift fluid + sodium. Fuelling actually protects your gut in the heat, so don't back off the plan.
        </p>
      )}
    </TintedPanel>
  );
}

function TargetPanel({ suggestion, targetGPerHour, onChangeTarget, edited }: {
  suggestion: CarbSuggestion | null;
  targetGPerHour: number;
  onChangeTarget: (n: number) => void;
  edited: boolean;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <TintedPanel>
      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Your race-day fuelling</div>
      <div className="flex items-baseline gap-2">
        <NumberField
          value={targetGPerHour}
          onChange={onChangeTarget}
          min={20}
          max={120}
          ariaLabel="Race-day carbs per hour"
          commitOnBlur
          className="w-24 bg-surface border border-[var(--color-border)] rounded-lg text-accent text-3xl font-display font-black p-2 focus:outline-none focus:border-accent transition-colors"
        />
        <span className="text-text-muted font-display text-sm">g/hr</span>
        <Pencil className="w-3.5 h-3.5 text-text-muted ml-auto self-center" />
      </div>
      {suggestion && (
        <p className="text-[11px] text-text-secondary mt-2 leading-relaxed">
          {edited && targetGPerHour !== suggestion.targetGPerHour
            ? `We suggested ${suggestion.targetGPerHour} g/hr for a ${formatEffort(suggestion.durationHours)} effort, this is yours to set.`
            : `A starting point for a ${formatEffort(suggestion.durationHours)} effort. Change it to whatever your gut knows it can handle.`}
        </p>
      )}
      {suggestion && (
        <>
          <button onClick={() => setWhyOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-[10px] font-display font-semibold text-accent">
            Why this number <ChevronDown className={`w-3 h-3 transition-transform ${whyOpen ? 'rotate-180' : ''}`} />
          </button>
          {whyOpen && (
            <p className="text-[10px] text-text-muted mt-1.5 leading-relaxed">
              {suggestion.rationale} Based on current sports-nutrition consensus, 60 to 90 g/hr for 2 hr+ efforts, up to 120 g/hr with a trained gut (Costa 2025; Jeukendrup 2014; Hearris 2022).
            </p>
          )}
        </>
      )}
    </TintedPanel>
  );
}

/* --------------------------- 1 · goal event ------------------------------ */

const EFFORT_OPTIONS: { label: string; bucket: 'easy' | 'moderate' | 'hard'; level: number }[] = [
  { label: 'Easy', bucket: 'easy', level: 3 },
  { label: 'Moderate', bucket: 'moderate', level: 6 },
  { label: 'Hard', bucket: 'hard', level: 9 },
];

function effortBucket(level: number): 'easy' | 'moderate' | 'hard' {
  return level <= 4 ? 'easy' : level <= 7 ? 'moderate' : 'hard';
}

/** Elapsed minutes → readable "6h" / "6h 30m". */
function formatHrs(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function GoalEventScreen(props: {
  raceQuery: string;
  onChangeRaceQuery: (v: string) => void;
  raceResults: UpcomingRace[];
  selectedRace: UpcomingRace | null;
  onSelectRace: (r: UpcomingRace) => void;
  onClearRace: () => void;
  manualMode: boolean;
  onToggleManual: () => void;
  eventName: string;
  onChangeName: (v: string) => void;
  eventDate: string;
  onChangeDate: (v: string) => void;
  durationMinutes: number;
  onChangeDuration: (v: number) => void;
  effortLevel: number;
  onChangeEffort: (v: number) => void;
  weather: RaceWeather | null;
  weatherLoading: boolean;
  suggestion: CarbSuggestion | null;
  targetGPerHour: number;
  onChangeTarget: (n: number) => void;
  targetEdited: boolean;
  canProceed: boolean;
  onNext: () => void;
}) {
  const {
    raceQuery, onChangeRaceQuery, raceResults, selectedRace, onSelectRace, onClearRace,
    manualMode, onToggleManual, eventName, onChangeName, eventDate, onChangeDate,
    durationMinutes, onChangeDuration, effortLevel, onChangeEffort,
    weather, weatherLoading, suggestion, targetGPerHour, onChangeTarget, targetEdited,
    canProceed, onNext,
  } = props;

  // Expected finish time + effort drive the whole plan — no distance anywhere.
  const timeAndEffort = (
    <>
      <div>
        <FieldLabel>Expected finish time</FieldLabel>
        <div className="flex items-center gap-2">
          <NumberField value={durationMinutes} onChange={onChangeDuration} min={30} max={1440} step={15} ariaLabel="Expected finish time in minutes" commitOnBlur className={`${fieldInputClass()} w-28`} />
          <span className="text-text-muted font-display text-xs whitespace-nowrap">min · {formatHrs(durationMinutes)}</span>
        </div>
      </div>
      <div>
        <FieldLabel>How hard will you push?</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {EFFORT_OPTIONS.map((o) => (
            <OutlineChip key={o.label} label={o.label} selected={effortBucket(effortLevel) === o.bucket} onClick={() => onChangeEffort(o.level)} />
          ))}
        </div>
      </div>
    </>
  );

  const body = selectedRace ? (
    // ── A race is chosen: show it, weather, then time/effort + target ──
    <>
      <TintedPanel className="!bg-accent/[0.06]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-base font-display font-black text-text-primary leading-snug">{selectedRace.name}</div>
            <div className="text-xs text-text-secondary mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{DISCIPLINE_LABELS[selectedRace.discipline]}</span>
              <span className="text-text-muted">·</span>
              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{formatRaceDate(selectedRace.date)}</span>
            </div>
            <div className="text-[11px] text-text-muted mt-1 inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedRace.location}</div>
          </div>
        </div>
      </TintedPanel>

      <WeatherPanel weather={weather} loading={weatherLoading} />
      {timeAndEffort}
      <TargetPanel suggestion={suggestion} targetGPerHour={targetGPerHour} onChangeTarget={onChangeTarget} edited={targetEdited} />
    </>
  ) : manualMode ? (
    // ── Manual entry fallback ──
    <>
      <div>
        <FieldLabel>Event</FieldLabel>
        <input type="text" value={eventName} onChange={(e) => onChangeName(e.target.value)} placeholder="Your race" className={fieldInputClass()} />
      </div>
      <div>
        <FieldLabel>Date</FieldLabel>
        <input type="date" value={eventDate} onChange={(e) => onChangeDate(e.target.value)} className={fieldInputClass()} />
      </div>
      {timeAndEffort}
      <TargetPanel suggestion={suggestion} targetGPerHour={targetGPerHour} onChangeTarget={onChangeTarget} edited={targetEdited} />
    </>
  ) : (
    // ── Default: search the SA race list (no distance shown) ──
    <>
      <div className="relative">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={raceQuery}
          onChange={(e) => onChangeRaceQuery(e.target.value)}
          placeholder="Search races like Comrades, Cape Epic, Otter…"
          className="w-full bg-surface border border-[var(--color-border)] rounded-xl text-text-primary text-sm p-3 pl-9 focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div className="space-y-1.5 -mx-1">
        {raceResults.length === 0 ? (
          <p className="text-xs text-text-muted px-1 py-3">No races match. Try a different search, or add yours manually below.</p>
        ) : (
          raceResults.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRace(r)}
              className="w-full text-left px-3 py-2.5 rounded-xl border border-[var(--color-border)] hover:border-accent/40 hover:bg-accent/[0.04] transition-colors"
            >
              <div className="text-sm font-display font-semibold text-text-primary leading-snug">{r.name}</div>
              <div className="text-[11px] text-text-secondary mt-0.5 flex flex-wrap items-center gap-x-1.5">
                <span>{DISCIPLINE_LABELS[r.discipline]}</span>
                <span className="text-text-muted">·</span>
                <span>{formatRaceDate(r.date)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );

  return (
    <ScreenShell
      title="What are you training for?"
      subtitle="Tell us your race and expected finish time — that shapes the plan."
      progress={1 / 3}
      footer={
        <>
          <PrimaryButton onClick={onNext} disabled={!canProceed}>Continue</PrimaryButton>
          {selectedRace ? (
            <TextLink onClick={onClearRace}>Choose a different race</TextLink>
          ) : (
            <TextLink onClick={onToggleManual}>{manualMode ? 'Back to race search' : "Can't find your race? Add it manually"}</TextLink>
          )}
        </>
      }
    >
      {body}
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
      title="Where's your gut right now?"
      subtitle="Be honest, this is just your starting point, not a test."
      progress={2 / 3}
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
        <FieldLabel>Anything your gut does on long runs?</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {GUT_HISTORY_TAGS.map(({ value, label }) => (
            <OutlineChip key={value} label={label} selected={gutHistory.includes(value)} onClick={() => onToggleHistory(value)} />
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Weeks until race day</FieldLabel>
        <div className="flex items-center gap-2">
          <NumberField value={weeksToEvent} onChange={onChangeWeeks} min={1} max={52} ariaLabel="Weeks to event" commitOnBlur className={`${fieldInputClass()} w-24`} />
          <span className="text-text-muted font-display text-xs">weeks</span>
        </div>
      </div>

      <p className={`text-sm leading-relaxed ${noteTone}`}>{realism.note}</p>
    </ScreenShell>
  );
}

/* -------------------------- weekly prescription ------------------------- */

export function WeeklySessionScreen({
  weekNumber, targetGPerHour, durationMinutes, onChangeDuration, prescription, hasFuelKit, onChooseFuel, onSendToWatch, onStartInApp, onExportPdf,
}: {
  weekNumber: number; targetGPerHour: number;
  durationMinutes: number; onChangeDuration: (v: number) => void;
  prescription: SessionPrescription;
  hasFuelKit: boolean; onChooseFuel: () => void;
  onSendToWatch: () => void; onStartInApp: () => void; onExportPdf: () => void;
}) {
  const hours = (durationMinutes / 60).toFixed(1).replace(/\.0$/, '');
  return (
    <ScreenShell
      title="This week's long run"
      subtitle={`Week ${weekNumber}, practise fuelling exactly like race day.`}
      footer={
        <>
          <PrimaryButton onClick={onSendToWatch}><Send className="w-4 h-4" /> Send to watch</PrimaryButton>
          <SecondaryButton onClick={onStartInApp}>Start in app</SecondaryButton>
          <TextLink onClick={onExportPdf}>Export as PDF</TextLink>
        </>
      }
    >
      <TintedPanel>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">How long you're out</div>
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
        <div className="text-2xl font-display font-black text-accent mt-1">{hours} hr · hold {targetGPerHour} g/hr</div>
      </TintedPanel>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel>Your fuelling for the run</FieldLabel>
          <button onClick={onChooseFuel} className="text-[10px] font-display font-bold text-accent hover:opacity-80 transition-opacity">
            {hasFuelKit ? 'Change fuel' : 'Choose your fuel'}
          </button>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] overflow-hidden">
          {prescription.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-text-secondary">
                <span className="text-text-muted font-display text-[10px] mr-2 tabular-nums">{item.timeLabel}</span>
                {item.label}
              </span>
              <span className="font-display font-semibold text-text-primary">{item.grams}g</span>
            </div>
          ))}
        </div>
        {!hasFuelKit && (
          <p className="text-[11px] text-text-muted mt-1.5">
            Pick the exact products you'll use and this becomes a real shopping list, counts and all.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-text-secondary">That's about</span>
        <span className="text-lg font-display font-black text-text-primary">{prescription.totalGrams}g over the run</span>
      </div>
    </ScreenShell>
  );
}

/* ------------------------------ handoff -------------------------------- */

function DevicePickerRow({ device, selected, onSelect }: { device: WatchDevice; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
        selected ? 'border-accent bg-accent/[0.04]' : 'border-[var(--color-border)] hover:border-accent/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-display font-semibold text-text-primary">{device.brand}</div>
          <div className="text-[11px] text-text-muted">{device.model}</div>
        </div>
        {selected && <Check className="w-4 h-4 text-accent flex-shrink-0" />}
      </div>
    </button>
  );
}

export function HandoffScreen({
  device, onSelectDevice, nextCueLabel, nextCueTimeLabel, nextCueGrams, targetGPerHour,
  cueCount, onExportGpx, onExportPdf, exportedHint, exporting, onDone,
}: {
  device: WatchDevice;
  onSelectDevice: (id: string) => void;
  nextCueLabel: string; nextCueTimeLabel: string; nextCueGrams: number; targetGPerHour: number;
  cueCount: number;
  onExportGpx: () => void; onExportPdf: () => void;
  exportedHint: string | null; exporting: boolean;
  onDone: () => void;
}) {
  const [changing, setChanging] = useState(false);
  return (
    <ScreenShell
      title="Ready for your watch"
      subtitle="We'll build a file your device can follow on the run."
      footer={
        <>
          <PrimaryButton onClick={onExportGpx} loading={exporting}>
            <Send className="w-4 h-4" /> Export to {device.brand}
          </PrimaryButton>
          <SecondaryButton onClick={onExportPdf}><FileDown className="w-4 h-4" /> Export as PDF</SecondaryButton>
          <TextLink onClick={onDone}>I'm back, log this run</TextLink>
        </>
      }
    >
      {/* The one place deep plum stays as ground, dark + cream survives sunlight. */}
      <div className="rounded-[28px] bg-accent p-6 flex flex-col items-center text-center gap-1.5 mx-auto max-w-[220px] aspect-square justify-center">
        <div className="text-[9px] text-background/60 uppercase tracking-[0.2em] font-bold">First cue</div>
        <div className="text-2xl font-display font-black text-background uppercase">{nextCueLabel}</div>
        <div className="text-sm font-display text-background/80">{nextCueTimeLabel}</div>
        <div className="w-3/4 h-1 rounded-full bg-background/20 my-1.5 overflow-hidden">
          <div className="h-full bg-background/70" style={{ width: `${Math.min(100, Math.round((nextCueGrams / targetGPerHour) * 100))}%` }} />
        </div>
        <div className="text-[10px] text-background/60">{nextCueGrams}g · hold {targetGPerHour} g/hr</div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        <button onClick={() => setChanging((v) => !v)} className="w-full flex items-center justify-between px-3 py-2.5 text-sm">
          <span className="text-text-muted flex items-center gap-1.5"><WatchIcon className="w-3.5 h-3.5" /> Device</span>
          <span className="font-display font-semibold text-text-primary flex items-center gap-1">
            {device.brand} <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${changing ? 'rotate-180' : ''}`} />
          </span>
        </button>
        <div className="flex items-center justify-between px-3 py-2.5 text-sm">
          <span className="text-text-muted">Cues queued</span>
          <span className="font-display font-semibold text-text-primary">{cueCount}</span>
        </div>
      </div>

      {changing && (
        <div className="space-y-1.5">
          {WATCH_DEVICES.map((d) => (
            <DevicePickerRow key={d.id} device={d} selected={d.id === device.id} onSelect={() => { onSelectDevice(d.id); setChanging(false); }} />
          ))}
        </div>
      )}

      {exportedHint ? (
        <TintedPanel>
          <p className="text-[11px] text-text-secondary leading-relaxed">{exportedHint}</p>
        </TintedPanel>
      ) : (
        <p className="text-[11px] text-text-muted leading-relaxed px-1">
          {preferredFuelFormat(device) === 'tcx'
            ? `Exports a timed workout your ${device.brand} follows on the clock, beeping at each fuel cue.`
            : 'Exports your fuel cues as GPX waypoints. Load your race route for navigation and these sit alongside it.'}
        </p>
      )}
    </ScreenShell>
  );
}

/* --------------------------- post-session log --------------------------- */

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
    { value: 'clean', label: 'Felt great', dot: 'border-2 border-accent' },
    { value: 'mild', label: 'A bit off', dot: 'bg-alert-amber/60' },
    { value: 'rough', label: 'Rough', dot: 'bg-alert-brick' },
  ];
  return (
    <ScreenShell
      title="How did that sit?"
      subtitle="Two taps, this is what moves your plan forward."
      footer={<PrimaryButton onClick={onSave} loading={saving}>Save this run</PrimaryButton>}
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
        <p className="text-[10px] text-text-muted mt-1.5">Straight off your watch, tweak it if it's off. You were aiming for {sessionTargetGPerHour} g/hr.</p>
      </TintedPanel>

      <div>
        <FieldLabel>And your gut?</FieldLabel>
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

/* -------------------------------- milestone -------------------------------- */

export function MilestoneScreen({ stats, program, onSeeRaceDayPlan }: {
  stats: MilestoneStats; program: GutTrainingV2Program; onSeeRaceDayPlan: () => void;
}) {
  return (
    <ScreenShell
      title=""
      footer={<PrimaryButton onClick={onSeeRaceDayPlan}>See my race-day plan</PrimaryButton>}
    >
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
          <Check className="w-7 h-7 text-background" />
        </div>
        <div className="text-xs font-display font-bold text-text-secondary uppercase tracking-wider">You did it, your gut's ready</div>
        <div className="text-5xl font-display font-black text-accent">{stats.gPerHour} g/hr</div>
        <p className="text-sm text-text-secondary">up from {program.startGPerHour} g/hr in {stats.weeksElapsed} weeks</p>

        <div className="flex items-center gap-6 mt-2">
          <div className="text-center">
            <div className="text-lg font-display font-black text-text-primary">{stats.weeksElapsed}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">weeks</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-display font-black text-text-primary">{stats.sessionsCount}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">runs</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-display font-black text-text-primary">{stats.cleanPercent}%</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider">felt great</div>
          </div>
        </div>

        <p className="text-sm text-text-primary font-medium mt-2 max-w-xs">
          Your gut can carry race pace now. Bring on {program.event.name}.
        </p>
      </div>
    </ScreenShell>
  );
}

/* -------------------------------- race day -------------------------------- */

export function RaceDayScreen({ plan, onSendToWatch, onExportPdf, onShareWithCrew, exporting }: {
  plan: RaceDayPlan; onSendToWatch: () => void; onExportPdf: () => void; onShareWithCrew: () => void; exporting: boolean;
}) {
  const maxGrams = Math.max(...plan.segments.map((s) => s.grams), 1);
  return (
    <ScreenShell
      title={`Your ${plan.event.name} game plan`}
      subtitle={`${formatHrs(plan.durationMinutes)} · hold ${plan.targetGPerHour} g/hr`}
      footer={
        <>
          <PrimaryButton onClick={onSendToWatch} loading={exporting}><Send className="w-4 h-4" /> Send to watch</PrimaryButton>
          <SecondaryButton onClick={onExportPdf}><FileDown className="w-4 h-4" /> Export as PDF</SecondaryButton>
          <TextLink onClick={onShareWithCrew}><span className="inline-flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" /> Share with your crew</span></TextLink>
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
            <span className="text-text-secondary">{formatHrs(seg.fromMinutes)}–{formatHrs(seg.toMinutes)}</span>
            <span className="font-display font-semibold text-text-primary">{seg.grams}g</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-text-secondary">On course, all in</span>
        <span className="text-lg font-display font-black text-text-primary">about {plan.totalGrams}g</span>
      </div>
    </ScreenShell>
  );
}

/* ------------------------------- alerts -------------------------------- */

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
      title="Worth a quick look"
      subtitle="Nothing's broken, just a nudge so race day goes well."
      footer={<PrimaryButton onClick={onBack}>Got it</PrimaryButton>}
    >
      <div className="space-y-3">
        {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
      </div>

      {watchAlert && (
        <div className="rounded-[28px] bg-accent p-6 flex flex-col items-center text-center gap-1.5 mx-auto max-w-[220px] aspect-square justify-center">
          <div className="text-[9px] text-alert-amber uppercase tracking-[0.2em] font-bold">{watchAlert.title}</div>
          <div className="text-2xl font-display font-black text-background uppercase">Gel now</div>
          <div className="text-[10px] text-background/60">{watchAlert.grams}g of {watchAlert.targetGPerHour} g/hr</div>
        </div>
      )}

      <p className="text-[11px] text-text-muted leading-relaxed px-1">
        You'll only see these when the plan needs a small change of course.
      </p>
    </ScreenShell>
  );
}
