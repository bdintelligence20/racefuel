/**
 * Gut Training v2 (beta) plan exports.
 *
 * Fuel cues are time-native: each cue knows the minute it should fire, and we
 * shape the export to what the device can actually do with that.
 *
 *   TCX  a workout of timed steps, so the watch beeps at each cue on the
 *        clock. This is the real time-based path (Garmin, Hammerhead, and
 *        other TCX-workout devices). FIT would be the native ideal but we
 *        cannot author it reliably in the browser.
 *   GPX  the cues as waypoints for devices that only take GPX. Honest scope:
 *        this is a fuel-cue file, not the race course. We ship no per-race
 *        polyline, so points are placed on a synthetic distance-faithful line
 *        east of the start and also carry a <time> stamp. Load the race's own
 *        route for navigation and these ride alongside it.
 *   PDF  a print-ready fuel sheet for the athlete or crew (accurate, no
 *        synthetic geo).
 *
 * Reuses the shared downloadFile helper (mobile share sheet plus desktop
 * anchor fallback).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadFile } from '../export/downloadFile';
import { deviceById, preferredFuelFormat, type WatchDevice, type ExportFormat } from '../../data/watchDevices';
import {
  estimateRaceDurationHours,
  type GutTrainingV2Program,
  type RaceDayPlan,
  type SessionPrescription,
} from './gutTrainingV2';

export interface FuelCue {
  /** Minutes from the start of the effort when this cue fires. */
  atMinutes: number;
  /** Short cue label, e.g. "Gel" or "500ml mix". */
  label: string;
  /** Grams of carbohydrate at this cue. */
  grams: number;
  /** Longer description for GPX <desc>. */
  detail: string;
  /** Distance in km, when known, for GPX placement. Derived from time if absent. */
  distanceKm?: number;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/* ------------------------------ cue builders ------------------------------ */

/** Race-day plan to time-native cues. Segment start distances become minutes
 *  using the estimated race duration (linear over the course), so a "45 km"
 *  cue also knows roughly when it lands on the clock. */
export function raceDayCues(program: GutTrainingV2Program, plan: RaceDayPlan): FuelCue[] {
  const distanceKm = plan.event.distanceKm || 1;
  const discipline = program.event.discipline ?? 'road-run';
  const totalMinutes = estimateRaceDurationHours(distanceKm, discipline, program.event.elevationGainM ?? 0) * 60;
  return plan.segments.map((seg) => ({
    atMinutes: Math.round((seg.fromKm / distanceKm) * totalMinutes),
    label: `Fuel ${seg.fromKm}k`,
    grams: seg.grams,
    detail: `${seg.fromKm} to ${seg.toKm} km, ${seg.grams} g carbs, hold ${plan.targetGPerHour} g/hr`,
    distanceKm: seg.fromKm,
  }));
}

/** Weekly session to time-native cues, spread across the run. Distance is
 *  derived from a nominal pace for GPX placement only. */
export function sessionCues(prescription: SessionPrescription, paceKmH = 10): FuelCue[] {
  const perItemMinutes = prescription.items.length > 1
    ? prescription.durationMinutes / prescription.items.length
    : prescription.durationMinutes;
  let minutes = 0;
  return prescription.items.map((item) => {
    const atMinutes = Math.round(minutes);
    const cue: FuelCue = {
      atMinutes,
      label: item.label,
      grams: item.grams,
      detail: `${item.timeLabel}, ${item.label}, ${item.grams} g carbs`,
      distanceKm: Math.round(((minutes / 60) * paceKmH) * 10) / 10,
    };
    minutes += perItemMinutes;
    return cue;
  });
}

/* -------------------------------- GPX --------------------------------- */

function kmToLngDegrees(km: number, lat: number): number {
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  return kmPerDegLng > 0 ? km / kmPerDegLng : 0;
}

/**
 * GPX of fuel-cue waypoints. Waypoints only (no rte/trk) so we never draw a
 * bogus straight-line course. Each carries a <time> stamp built from the
 * base start plus its minute offset, so the timing intent is encoded even
 * though most devices treat waypoints as places, not alarms.
 */
export function buildFuelCuesGpx(
  name: string,
  startLat: number,
  startLng: number,
  cues: FuelCue[],
  subtitle: string,
  baseStartMs: number,
  paceKmH = 10,
): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<gpx version="1.1" creator="fuelcue (https://fuelcue.com)" ' +
      'xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
  );
  lines.push('  <metadata>');
  lines.push(`    <name>${escapeXml(name)}</name>`);
  lines.push(`    <desc>${escapeXml(subtitle)}. Fuel cues only, load your race route for navigation.</desc>`);
  lines.push(`    <time>${new Date(baseStartMs).toISOString()}</time>`);
  lines.push('  </metadata>');

  for (const cue of cues) {
    const distanceKm = cue.distanceKm ?? (cue.atMinutes / 60) * paceKmH;
    const lat = startLat;
    const lng = startLng + kmToLngDegrees(distanceKm, startLat);
    const stamp = new Date(baseStartMs + cue.atMinutes * 60_000).toISOString();
    lines.push(`  <wpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}">`);
    lines.push(`    <time>${stamp}</time>`);
    lines.push(`    <name>${escapeXml(cue.label)} · ${cue.grams}g</name>`);
    lines.push(`    <cmt>${escapeXml(cue.detail)}</cmt>`);
    lines.push(`    <desc>${escapeXml(cue.detail)}</desc>`);
    lines.push('    <sym>Food</sym>');
    lines.push('    <type>nutrition</type>');
    lines.push('  </wpt>');
  }

  lines.push('</gpx>');
  return lines.join('\n');
}

/* -------------------------------- TCX --------------------------------- */

type TcxSport = 'Running' | 'Biking' | 'Other';

function tcxSportFor(program: GutTrainingV2Program): TcxSport {
  const d = program.event.discipline ?? 'road-run';
  if (d === 'road-run' || d === 'trail-run') return 'Running';
  if (d === 'road-cycle' || d === 'mtb' || d === 'gravel') return 'Biking';
  return 'Other';
}

/** TCX workout step names are tightly capped by many devices, so keep them short. */
function shortStepName(cue: FuelCue): string {
  const name = `${cue.label} ${cue.grams}g`;
  return name.length <= 15 ? name : name.slice(0, 15);
}

/**
 * A TCX workout of timed steps. Each step runs until the next cue, named for
 * what to take, so the device beeps at each transition. That gives real
 * time-based fuelling reminders on devices that import TCX workouts.
 */
export function buildWorkoutTcx(name: string, sport: TcxSport, cues: FuelCue[]): string {
  const sorted = [...cues].sort((a, b) => a.atMinutes - b.atMinutes);
  const workoutName = (name.length <= 15 ? name : name.slice(0, 15));

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<TrainingCenterDatabase ' +
      'xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 ' +
      'http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">',
  );
  lines.push('  <Workouts>');
  lines.push(`    <Workout Sport="${sport}">`);
  lines.push(`      <Name>${escapeXml(workoutName)}</Name>`);

  sorted.forEach((cue, i) => {
    const next = sorted[i + 1];
    // Step runs until the next cue. Last step gets a short tail so it is valid.
    const seconds = next ? Math.max(30, Math.round((next.atMinutes - cue.atMinutes) * 60)) : 300;
    lines.push('      <Step xsi:type="Step_t">');
    lines.push(`        <StepId>${i + 1}</StepId>`);
    lines.push(`        <Name>${escapeXml(shortStepName(cue))}</Name>`);
    lines.push('        <Duration xsi:type="Time_t">');
    lines.push(`          <Seconds>${seconds}</Seconds>`);
    lines.push('        </Duration>');
    lines.push('        <Intensity>Active</Intensity>');
    lines.push('        <Target xsi:type="None_t"/>');
    lines.push('      </Step>');
  });

  lines.push('    </Workout>');
  lines.push('  </Workouts>');
  lines.push('</TrainingCenterDatabase>');
  return lines.join('\n');
}

/* ------------------------------ export flow ------------------------------ */

function fileStem(program: GutTrainingV2Program, suffix: string): string {
  const base = (program.event.name || 'fuelcue-plan').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${base}-${suffix}`;
}

function baseStartMsFor(program: GutTrainingV2Program): number {
  // A 6am start on race day if we have a date, otherwise now. Only used to
  // stamp cue times in the GPX, the absolute value does not matter much.
  if (program.event.date) {
    const t = new Date(`${program.event.date}T06:00:00`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

/** How to load the file, worded for the format and brand. */
function loadHintFor(device: WatchDevice, format: ExportFormat): string {
  if (format === 'tcx') {
    if (device.brand === 'Garmin') {
      return 'In Garmin Connect, go to Training, Workouts, Import, then send it to your device. It beeps at each fuel cue.';
    }
    if (device.brand === 'Hammerhead') {
      return 'In the Hammerhead dashboard, import the workout, then sync. It cues you at each step.';
    }
    return 'Import the .tcx as a workout in your device app. It beeps at each fuel cue on the clock.';
  }
  return device.loadHint;
}

/**
 * Export the time-based fuel cues in the best format the chosen device can
 * use (TCX workout where possible, GPX otherwise). Returns the format and a
 * plain-language hint on how to load it.
 */
export async function exportFuelCuesToDevice(
  program: GutTrainingV2Program,
  cues: FuelCue[],
  subtitle: string,
  deviceId: string | undefined,
): Promise<{ format: ExportFormat; loadHint: string }> {
  const device = deviceById(deviceId);
  const format = preferredFuelFormat(device);
  const startLat = program.event.lat ?? -33.9249;
  const startLng = program.event.lng ?? 18.4241;

  let content: string;
  let mime: string;
  if (format === 'tcx') {
    content = buildWorkoutTcx(`${program.event.name} fuel`, tcxSportFor(program), cues);
    mime = 'application/vnd.garmin.tcx+xml';
  } else {
    content = buildFuelCuesGpx(
      `${program.event.name} fuel cues`,
      startLat,
      startLng,
      cues,
      subtitle,
      baseStartMsFor(program),
    );
    mime = 'application/gpx+xml';
  }

  const blob = new Blob([content], { type: mime });
  await downloadFile(blob, `${fileStem(program, 'fuel')}.${format}`, mime);
  return { format, loadHint: loadHintFor(device, format) };
}

/* -------------------------------- PDF -------------------------------- */

const PLUM: [number, number, number] = [43, 13, 61]; // #2B0D3D
const CREAM: [number, number, number] = [251, 243, 232]; // #FBF3E8
const PLUM_TINT: [number, number, number] = [230, 219, 224]; // #E6DBE0
const INK: [number, number, number] = [43, 13, 61];
const MUTED: [number, number, number] = [138, 68, 103]; // #8A4467

function pdfHeader(doc: jsPDF, title: string, subtitle: string): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...PLUM);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setTextColor(...CREAM);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('fuelcue', 14, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 23);
  doc.setFontSize(8);
  doc.setTextColor(205, 186, 202); // #CDBACA
  doc.text(subtitle, 14, 29);
  return 44;
}

function pdfFooterNote(doc: jsPDF, y: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'italic');
  const note =
    'Targets from the fuelcue engine: 60 to 90 g/hr for 2h+ efforts, up to 120 g/hr with a trained gut ' +
    '(Costa et al. 2025; Jeukendrup 2014; Hearris et al. 2022). A guide, tune it to your own gut.';
  const wrapped = doc.splitTextToSize(note, pageWidth - 28);
  doc.text(wrapped, 14, y);
}

/** Race-day fuel sheet PDF. */
export function downloadRaceDayPdf(program: GutTrainingV2Program, plan: RaceDayPlan): void {
  const doc = new jsPDF();
  const raceDate = program.event.date
    ? new Date(program.event.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  let y = pdfHeader(doc, `${program.event.name}, race-day fuel plan`, raceDate);

  doc.setTextColor(...INK);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Hold ${plan.targetGPerHour} g/hr, ${plan.event.distanceKm} km`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`About ${plan.totalGrams} g of carbohydrate on course.`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Segment', 'Carbs']],
    body: plan.segments.map((s) => [`${s.fromKm} to ${s.toKm} km`, `${s.grams} g`]),
    foot: [['Total on course', `${plan.totalGrams} g`]],
    headStyles: { fillColor: PLUM, textColor: CREAM, fontStyle: 'bold' },
    footStyles: { fillColor: PLUM_TINT, textColor: INK, fontStyle: 'bold' },
    bodyStyles: { textColor: INK },
    alternateRowStyles: { fillColor: CREAM },
    margin: { left: 14, right: 14 },
  });

  const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  pdfFooterNote(doc, endY + 12);

  const blob = doc.output('blob');
  void downloadFile(blob, `${fileStem(program, 'race-day')}.pdf`, 'application/pdf');
}

/** Weekly session fuel sheet PDF. */
export function downloadSessionPdf(program: GutTrainingV2Program, prescription: SessionPrescription): void {
  const doc = new jsPDF();
  const hrs = Math.round((prescription.durationMinutes / 60) * 10) / 10;
  let y = pdfHeader(doc, `${program.event.name}, week ${prescription.weekNumber} session`, `${hrs} hr long run`);

  doc.setTextColor(...INK);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Hold ${prescription.targetGPerHour} g/hr`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['When', 'Take', 'Carbs']],
    body: prescription.items.map((i) => [i.timeLabel, i.label, `${i.grams} g`]),
    foot: [['', 'Session total', `${prescription.totalGrams} g`]],
    headStyles: { fillColor: PLUM, textColor: CREAM, fontStyle: 'bold' },
    footStyles: { fillColor: PLUM_TINT, textColor: INK, fontStyle: 'bold' },
    bodyStyles: { textColor: INK },
    alternateRowStyles: { fillColor: CREAM },
    margin: { left: 14, right: 14 },
  });

  const endY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  pdfFooterNote(doc, endY + 12);

  const blob = doc.output('blob');
  void downloadFile(blob, `${fileStem(program, `week-${prescription.weekNumber}`)}.pdf`, 'application/pdf');
}
