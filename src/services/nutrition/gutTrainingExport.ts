/**
 * Gut Training v2 (beta) — plan exports.
 *
 * Two artifacts an athlete can take away from the flow:
 *   - GPX: the fuelling cues as GPX waypoints, so they land on a watch /
 *     head unit as on-course reminders. Honest scope: this is a *fuel-cue*
 *     file, not the race's navigation course — we don't ship per-race
 *     polylines, so waypoints are placed on a synthetic distance-faithful
 *     line east of the start (spacing reflects real km). For turn-by-turn
 *     the athlete loads the race's own route; these ride alongside it.
 *   - PDF: a print-ready fuel sheet (accurate, no synthetic geo) for the
 *     athlete or their crew.
 *
 * GPX is the common-denominator format every device in watchDevices.ts
 * accepts. Reuses the shared downloadFile helper (mobile share sheet +
 * desktop anchor fallback).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadFile } from '../export/downloadFile';
import { deviceById, preferredExportFormat } from '../../data/watchDevices';
import type { GutTrainingV2Program, RaceDayPlan, SessionPrescription } from './gutTrainingV2';

export interface FuelCue {
  /** Distance from the start in km (for placement + labelling). */
  distanceKm: number;
  /** Short cue label, e.g. "Fuel 21k" or "Gel :40". */
  label: string;
  /** Grams of carbohydrate at this cue. */
  grams: number;
  /** Longer description for the waypoint's <desc>. */
  detail: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Degrees of longitude per km at a given latitude — for placing cue
 *  waypoints east of the start so their spacing reflects real distance. */
function kmToLngDegrees(km: number, lat: number): number {
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  return kmPerDegLng > 0 ? km / kmPerDegLng : 0;
}

/**
 * Build a GPX document of fuel-cue waypoints. Waypoints only (no <rte>/<trk>)
 * so we never draw a bogus straight-line course on the athlete's map — these
 * are POIs that sit alongside the real route they load for navigation.
 */
export function buildFuelCuesGpx(
  name: string,
  startLat: number,
  startLng: number,
  cues: FuelCue[],
  subtitle: string,
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
  lines.push(`    <desc>${escapeXml(subtitle)} — fuel cues only; load your race route for navigation.</desc>`);
  lines.push(`    <time>${new Date().toISOString()}</time>`);
  lines.push('  </metadata>');

  for (const cue of cues) {
    const lat = startLat;
    const lng = startLng + kmToLngDegrees(cue.distanceKm, startLat);
    lines.push(`  <wpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}">`);
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

/** Race-day plan → one cue per segment boundary. */
export function raceDayCues(plan: RaceDayPlan): FuelCue[] {
  return plan.segments.map((seg) => ({
    distanceKm: seg.fromKm,
    label: `Fuel ${seg.fromKm}k`,
    grams: seg.grams,
    detail: `${seg.fromKm}–${seg.toKm} km · ${seg.grams} g carbs · hold ${plan.targetGPerHour} g/hr`,
  }));
}

/** Weekly session → cues placed by time, mapped to distance via a nominal
 *  pace so watch spacing is sensible. */
export function sessionCues(prescription: SessionPrescription, paceKmH = 10): FuelCue[] {
  let minutes = 0;
  const perItemMinutes = prescription.items.length > 1
    ? prescription.durationMinutes / prescription.items.length
    : prescription.durationMinutes;
  return prescription.items.map((item) => {
    const distanceKm = (minutes / 60) * paceKmH;
    const cue: FuelCue = {
      distanceKm: Math.round(distanceKm * 10) / 10,
      label: `${item.label} ${item.timeLabel}`,
      grams: item.grams,
      detail: `${item.timeLabel} · ${item.label} · ${item.grams} g carbs`,
    };
    minutes += perItemMinutes;
    return cue;
  });
}

function fileStem(program: GutTrainingV2Program, suffix: string): string {
  const base = (program.event.name || 'fuelcue-plan').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${base}-${suffix}`;
}

/** Export fuel cues as a GPX matched to the chosen device's format. Returns
 *  the device's load hint so the caller can surface "how to load it". */
export async function exportFuelCuesToDevice(
  program: GutTrainingV2Program,
  cues: FuelCue[],
  subtitle: string,
  deviceId: string | undefined,
): Promise<{ format: string; loadHint: string }> {
  const device = deviceById(deviceId);
  const format = preferredExportFormat(device);
  const startLat = program.event.lat ?? -33.9249;
  const startLng = program.event.lng ?? 18.4241;
  const gpx = buildFuelCuesGpx(
    `${program.event.name} — fuel cues`,
    startLat,
    startLng,
    cues,
    subtitle,
  );
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  await downloadFile(blob, `${fileStem(program, 'fuel')}.${format}`, 'application/gpx+xml');
  return { format, loadHint: device.loadHint };
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
    'Targets from the fuelcue engine: 60–90 g/hr for 2h+ efforts, up to 120 g/hr with a trained gut ' +
    '(Costa et al. 2025; Jeukendrup 2014; Hearris et al. 2022). A guide — tune to your own gut.';
  const wrapped = doc.splitTextToSize(note, pageWidth - 28);
  doc.text(wrapped, 14, y);
}

/** Race-day fuel sheet PDF. */
export function downloadRaceDayPdf(program: GutTrainingV2Program, plan: RaceDayPlan): void {
  const doc = new jsPDF();
  const raceDate = program.event.date
    ? new Date(program.event.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  let y = pdfHeader(doc, `${program.event.name} — race-day fuel plan`, raceDate);

  doc.setTextColor(...INK);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Hold ${plan.targetGPerHour} g/hr · ${plan.event.distanceKm} km`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(`About ${plan.totalGrams} g of carbohydrate on course.`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Segment', 'Carbs']],
    body: plan.segments.map((s) => [`${s.fromKm}–${s.toKm} km`, `${s.grams} g`]),
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
  let y = pdfHeader(doc, `${program.event.name} — week ${prescription.weekNumber} session`, `${Math.round(prescription.durationMinutes / 60 * 10) / 10} hr long run`);

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
