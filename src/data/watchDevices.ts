/**
 * Watch / head-unit catalog — Gut Training v2 beta handoff.
 *
 * Lets an athlete pick where the plan goes, and drives the export format so
 * we only ever hand a device a file it actually accepts. Every device here
 * imports GPX courses/waypoints (via its companion app), which is why GPX is
 * the common-denominator export we generate client-side. FIT is Garmin-native
 * and not something we can reliably build in the browser, so where a device
 * lists 'fit' it's informational only — `preferredExportFormat` picks the
 * best format we can actually produce for that device (always GPX today).
 *
 * NOT device integration — see the flow: nothing is pushed over the air. We
 * generate a file the athlete loads through the device's own app.
 */

export type ExportFormat = 'gpx' | 'fit' | 'tcx';

export interface WatchDevice {
  id: string;
  brand: string;
  /** Device family / type shown under the brand. */
  model: string;
  kind: 'watch' | 'bike-computer';
  /** Formats the device's app can import for courses / waypoints. */
  acceptedFormats: ExportFormat[];
  /** How the athlete gets the file onto it — shown as a hint on handoff. */
  loadHint: string;
}

export const WATCH_DEVICES: WatchDevice[] = [
  {
    id: 'garmin-watch',
    brand: 'Garmin',
    model: 'Forerunner / Fenix / Epix',
    kind: 'watch',
    acceptedFormats: ['gpx', 'fit', 'tcx'],
    loadHint: 'Garmin Connect → Training → Courses → Import, then send to device.',
  },
  {
    id: 'garmin-edge',
    brand: 'Garmin',
    model: 'Edge (bike computer)',
    kind: 'bike-computer',
    acceptedFormats: ['gpx', 'fit', 'tcx'],
    loadHint: 'Garmin Connect → Courses → Import, then sync to your Edge.',
  },
  {
    id: 'wahoo',
    brand: 'Wahoo',
    model: 'ELEMNT / BOLT / ROAM',
    kind: 'bike-computer',
    acceptedFormats: ['gpx', 'fit', 'tcx'],
    loadHint: 'Wahoo app → Routes → add the .gpx, then it syncs to your ELEMNT.',
  },
  {
    id: 'coros',
    brand: 'Coros',
    model: 'Pace / Apex / Vertix',
    kind: 'watch',
    acceptedFormats: ['gpx', 'fit'],
    loadHint: 'Coros app → Navigation → Import Route, then sync to your watch.',
  },
  {
    id: 'suunto',
    brand: 'Suunto',
    model: 'Race / Vertical / 9',
    kind: 'watch',
    acceptedFormats: ['gpx'],
    loadHint: 'Suunto app → Add route (.gpx), then sync to your watch.',
  },
  {
    id: 'polar',
    brand: 'Polar',
    model: 'Vantage / Grit / Pacer',
    kind: 'watch',
    acceptedFormats: ['gpx'],
    loadHint: 'Import the .gpx via Komoot or Polar Flow, then sync to your watch.',
  },
  {
    id: 'hammerhead',
    brand: 'Hammerhead',
    model: 'Karoo',
    kind: 'bike-computer',
    acceptedFormats: ['gpx', 'tcx'],
    loadHint: 'Hammerhead dashboard → Routes → Upload the .gpx, then sync.',
  },
  {
    id: 'apple-watch',
    brand: 'Apple Watch',
    model: 'via WorkOutdoors / third-party',
    kind: 'watch',
    acceptedFormats: ['gpx'],
    loadHint: 'Open the .gpx in WorkOutdoors (or similar) to load it on your Apple Watch.',
  },
  {
    id: 'other',
    brand: 'Other / not sure',
    model: 'Any GPX-compatible device',
    kind: 'watch',
    acceptedFormats: ['gpx'],
    loadHint: 'Most watches and bike computers import a .gpx through their companion app.',
  },
];

export const DEFAULT_DEVICE_ID = 'garmin-watch';

export function deviceById(id: string | undefined): WatchDevice {
  return WATCH_DEVICES.find((d) => d.id === id) ?? WATCH_DEVICES[0];
}

/** The best format we can actually generate for a device. We produce GPX
 *  today (browser-side FIT authoring isn't reliable), and every device
 *  accepts GPX — so this returns 'gpx' unless a device somehow excludes it. */
export function preferredExportFormat(device: WatchDevice): ExportFormat {
  return device.acceptedFormats.includes('gpx') ? 'gpx' : device.acceptedFormats[0];
}
