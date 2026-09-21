/**
 * South African race catalog, Gut Training v2 beta.
 *
 * A curated seed dataset of marquee SA road/trail runs and road/MTB/gravel
 * races, so an athlete can pick their goal event instead of typing it in.
 * There is no comprehensive free SA race API, so this is hand-maintained,  * structured deliberately so it can later migrate to an admin-managed
 * Firestore collection without changing the picker's shape.
 *
 * Dates drift year to year (Comrades, Two Oceans, and the stage races move),
 * so each entry stores a *typical* month + approximate day; the flow computes
 * the next occurrence and leaves the exact date editable. `lat`/`lng` are the
 * start/host town, used for race-day weather (forecast when near, historical
 * average when far out). `distanceKm` for stage races is one representative
 * stage, flagged with `stage: true` and explained in `notes`.
 *
 * NOT exhaustive, a solid curated starting set to expand over time.
 */

export type RaceDiscipline = 'road-run' | 'trail-run' | 'road-cycle' | 'mtb' | 'gravel';

export type RaceTerrain = 'flat' | 'rolling' | 'hilly' | 'mountainous';

export interface SARace {
  id: string;
  name: string;
  discipline: RaceDiscipline;
  /** Signature distance in km. For stage races, one representative stage. */
  distanceKm: number;
  elevationGainM: number;
  terrain: RaceTerrain;
  location: string;
  province: string;
  lat: number;
  lng: number;
  /** Typical calendar month (1 to 12). */
  month: number;
  /** Approximate day-of-month, the flow keeps the exact date editable. */
  day: number;
  /** Multi-day stage race; distanceKm is one representative stage. */
  stage?: boolean;
  notes?: string;
}

export const DISCIPLINE_LABELS: Record<RaceDiscipline, string> = {
  'road-run': 'Road run',
  'trail-run': 'Trail run',
  'road-cycle': 'Road cycle',
  mtb: 'MTB',
  gravel: 'Gravel',
};

/** Curated SA race seed set. Distances/elevation/dates are representative. */
export const SA_RACES: SARace[] = [
  // ── Road runs ──
  { id: 'comrades', name: 'Comrades Marathon', discipline: 'road-run', distanceKm: 90, elevationGainM: 1600, terrain: 'hilly', location: 'Durban ⇄ Pietermaritzburg', province: 'KZN', lat: -29.7, lng: 30.7, month: 6, day: 8 },
  { id: 'two-oceans-ultra', name: 'Two Oceans Ultra Marathon', discipline: 'road-run', distanceKm: 56, elevationGainM: 620, terrain: 'hilly', location: 'Cape Town', province: 'WC', lat: -34.05, lng: 18.46, month: 4, day: 4 },
  { id: 'two-oceans-half', name: 'Two Oceans Half Marathon', discipline: 'road-run', distanceKm: 21.1, elevationGainM: 180, terrain: 'rolling', location: 'Cape Town', province: 'WC', lat: -33.97, lng: 18.47, month: 4, day: 4 },
  { id: 'cape-town-marathon', name: 'Sanlam Cape Town Marathon', discipline: 'road-run', distanceKm: 42.2, elevationGainM: 200, terrain: 'flat', location: 'Cape Town', province: 'WC', lat: -33.925, lng: 18.424, month: 10, day: 19 },
  { id: 'soweto-marathon', name: 'Soweto Marathon', discipline: 'road-run', distanceKm: 42.2, elevationGainM: 460, terrain: 'hilly', location: 'Soweto, Johannesburg', province: 'GP', lat: -26.267, lng: 27.858, month: 11, day: 2 },
  { id: 'om-die-dam', name: 'Om die Dam Ultra', discipline: 'road-run', distanceKm: 50, elevationGainM: 700, terrain: 'hilly', location: 'Hartbeespoort', province: 'NW', lat: -25.75, lng: 27.85, month: 3, day: 15 },
  { id: 'loskop-ultra', name: 'Loskop Ultra Marathon', discipline: 'road-run', distanceKm: 50, elevationGainM: 550, terrain: 'hilly', location: 'Middelburg', province: 'MP', lat: -25.77, lng: 29.46, month: 4, day: 26 },
  { id: 'knysna-forest', name: 'Knysna Forest Marathon', discipline: 'road-run', distanceKm: 42.2, elevationGainM: 700, terrain: 'hilly', location: 'Knysna', province: 'WC', lat: -34.036, lng: 23.048, month: 7, day: 5 },
  { id: 'kaapsehoop-marathon', name: 'Kaapsehoop Marathon', discipline: 'road-run', distanceKm: 42.2, elevationGainM: 480, terrain: 'hilly', location: 'Kaapsehoop, Mbombela', province: 'MP', lat: -25.58, lng: 30.75, month: 11, day: 8 },
  { id: 'gun-run-half', name: 'FNB Cape Town 12 ONERUN / Gun Run Half', discipline: 'road-run', distanceKm: 21.1, elevationGainM: 120, terrain: 'flat', location: 'Cape Town', province: 'WC', lat: -33.9, lng: 18.42, month: 10, day: 12 },
  { id: 'buffalo-marathon', name: 'Buffalo Marathon', discipline: 'road-run', distanceKm: 42.2, elevationGainM: 300, terrain: 'rolling', location: 'East London', province: 'EC', lat: -33.02, lng: 27.9, month: 5, day: 24 },
  { id: 'om-die-berg', name: 'PPC Ncumo / Deloitte Challenge 21', discipline: 'road-run', distanceKm: 21.1, elevationGainM: 150, terrain: 'rolling', location: 'Johannesburg', province: 'GP', lat: -26.14, lng: 28.05, month: 9, day: 21 },

  // ── Trail runs ──
  { id: 'otter-trail-run', name: 'Otter African Trail Run', discipline: 'trail-run', distanceKm: 42, elevationGainM: 2600, terrain: 'mountainous', location: 'Storms River, Tsitsikamma', province: 'EC', lat: -34.02, lng: 23.88, month: 10, day: 8 },
  { id: 'utct-100', name: 'RMB Ultra-trail Cape Town 100K', discipline: 'trail-run', distanceKm: 100, elevationGainM: 4300, terrain: 'mountainous', location: 'Cape Town', province: 'WC', lat: -33.96, lng: 18.41, month: 11, day: 29 },
  { id: 'utct-65', name: 'RMB Ultra-trail Cape Town 65K', discipline: 'trail-run', distanceKm: 65, elevationGainM: 2900, terrain: 'mountainous', location: 'Cape Town', province: 'WC', lat: -33.96, lng: 18.41, month: 11, day: 29 },
  { id: 'skyrun', name: 'Skyrun', discipline: 'trail-run', distanceKm: 100, elevationGainM: 4800, terrain: 'mountainous', location: 'Lady Grey, Witteberg', province: 'EC', lat: -30.71, lng: 27.22, month: 11, day: 21 },
  { id: 'mont-aux-sources', name: 'Mont-aux-Sources Challenge', discipline: 'trail-run', distanceKm: 50, elevationGainM: 2200, terrain: 'mountainous', location: 'Northern Drakensberg', province: 'FS', lat: -28.75, lng: 28.9, month: 9, day: 6 },
  { id: 'karkloof-100', name: 'Karkloof 100 Miler', discipline: 'trail-run', distanceKm: 160, elevationGainM: 3800, terrain: 'hilly', location: 'Karkloof, Howick', province: 'KZN', lat: -29.4, lng: 30.28, month: 9, day: 13 },
  { id: 'addo-trail', name: 'Addo Elephant Trail Run 44K', discipline: 'trail-run', distanceKm: 44, elevationGainM: 1500, terrain: 'hilly', location: 'Addo, Sundays River', province: 'EC', lat: -33.5, lng: 25.75, month: 3, day: 21 },
  { id: 'golden-gate', name: 'Golden Gate Challenge', discipline: 'trail-run', distanceKm: 36, elevationGainM: 1400, terrain: 'mountainous', location: 'Golden Gate, Clarens', province: 'FS', lat: -28.51, lng: 28.61, month: 9, day: 27 },
  { id: 'jonkershoek', name: 'Jonkershoek Mountain Challenge', discipline: 'trail-run', distanceKm: 36, elevationGainM: 1900, terrain: 'mountainous', location: 'Stellenbosch', province: 'WC', lat: -33.98, lng: 18.93, month: 5, day: 17 },
  { id: 'table-mountain-challenge', name: 'Table Mountain Challenge', discipline: 'trail-run', distanceKm: 36, elevationGainM: 2000, terrain: 'mountainous', location: 'Cape Town', province: 'WC', lat: -33.96, lng: 18.41, month: 2, day: 22 },

  // ── Road cycling ──
  { id: 'cape-town-cycle-tour', name: 'Cape Town Cycle Tour', discipline: 'road-cycle', distanceKm: 109, elevationGainM: 1100, terrain: 'hilly', location: 'Cape Town', province: 'WC', lat: -33.9, lng: 18.42, month: 3, day: 8 },
  { id: 'ride-joburg', name: '947 Ride Joburg', discipline: 'road-cycle', distanceKm: 94, elevationGainM: 900, terrain: 'rolling', location: 'Johannesburg', province: 'GP', lat: -26.14, lng: 28.05, month: 11, day: 16 },
  { id: 'amashova', name: 'Amashova Durban Classic', discipline: 'road-cycle', distanceKm: 106, elevationGainM: 950, terrain: 'hilly', location: 'Pietermaritzburg to Durban', province: 'KZN', lat: -29.7, lng: 30.7, month: 10, day: 19 },
  { id: 'tour-durban', name: 'Tour Durban', discipline: 'road-cycle', distanceKm: 105, elevationGainM: 1000, terrain: 'hilly', location: 'Durban', province: 'KZN', lat: -29.858, lng: 31.021, month: 6, day: 22 },

  // ── MTB ──
  { id: 'cape-epic-stage', name: 'Absa Cape Epic (single stage)', discipline: 'mtb', distanceKm: 100, elevationGainM: 2200, terrain: 'mountainous', location: 'Western Cape', province: 'WC', lat: -33.6, lng: 19.0, month: 3, day: 15, stage: true, notes: '8-day stage race, this is one representative queen stage. Fuel per stage.' },
  { id: 'sani2c', name: 'sani2c', discipline: 'mtb', distanceKm: 88, elevationGainM: 1500, terrain: 'hilly', location: 'Underberg to Scottburgh', province: 'KZN', lat: -29.78, lng: 29.49, month: 5, day: 14, stage: true, notes: '3-day stage race, this is one representative stage. Fuel per stage.' },
  { id: 'wines2whales', name: 'FNB Wines2Whales', discipline: 'mtb', distanceKm: 75, elevationGainM: 1600, terrain: 'hilly', location: 'Elgin to Onrus', province: 'WC', lat: -34.16, lng: 19.02, month: 11, day: 1, stage: true, notes: '3-day stage race, this is one representative stage. Fuel per stage.' },
  { id: 'attakwas', name: 'Momentum Attakwas Extreme', discipline: 'mtb', distanceKm: 121, elevationGainM: 2600, terrain: 'mountainous', location: 'Oudtshoorn to Great Brak River', province: 'WC', lat: -33.9, lng: 22.1, month: 1, day: 18 },
  { id: 'tankwa-trek', name: 'Momentum Tankwa Trek (single stage)', discipline: 'mtb', distanceKm: 95, elevationGainM: 2000, terrain: 'mountainous', location: 'Ceres, Koue Bokkeveld', province: 'WC', lat: -33.1, lng: 19.6, month: 2, day: 7, stage: true, notes: '3-day stage race, this is one representative stage. Fuel per stage.' },
  { id: 'berg-and-bush', name: 'Berg & Bush (single stage)', discipline: 'mtb', distanceKm: 82, elevationGainM: 1300, terrain: 'hilly', location: 'Winterton, Drakensberg', province: 'KZN', lat: -28.82, lng: 29.53, month: 10, day: 16, stage: true, notes: 'Multi-day stage race, this is one representative stage. Fuel per stage.' },

  // ── Gravel & ultra-distance ──
  { id: 'the-munga', name: 'The Munga', discipline: 'gravel', distanceKm: 1000, elevationGainM: 7000, terrain: 'rolling', location: 'Bloemfontein to Wellington', province: 'FS', lat: -29.085, lng: 26.159, month: 11, day: 26, notes: 'Non-stop ~1000 km ultra with a 120-hour cutoff, fuel over multiple days.' },
  { id: 'trans-baviaans', name: 'Trans Baviaans', discipline: 'gravel', distanceKm: 230, elevationGainM: 3300, terrain: 'mountainous', location: 'Willowmore to Jeffreys Bay', province: 'EC', lat: -33.29, lng: 23.49, month: 8, day: 23, notes: 'Single-push 230 km through the Baviaanskloof.' },
  { id: 'karoo-to-coast', name: 'Momentum Karoo to Coast', discipline: 'gravel', distanceKm: 100, elevationGainM: 1600, terrain: 'hilly', location: 'Uniondale to Knysna', province: 'WC', lat: -33.66, lng: 23.13, month: 9, day: 28 },
  { id: 'gravel-burn-stage', name: 'Gravel Burn (single stage)', discipline: 'gravel', distanceKm: 130, elevationGainM: 1800, terrain: 'hilly', location: 'Karoo, Western Cape', province: 'WC', lat: -33.0, lng: 22.0, month: 10, day: 5, stage: true, notes: 'Multi-day gravel stage race, this is one representative stage. Fuel per stage.' },
  { id: 'around-the-pot', name: 'Around the Pot Gravel', discipline: 'gravel', distanceKm: 120, elevationGainM: 1400, terrain: 'rolling', location: 'Tulbagh', province: 'WC', lat: -33.28, lng: 19.14, month: 5, day: 3 },
];

/**
 * The next calendar date on/after `from` matching a race's typical month/day.
 * If this year's date has already passed, rolls to next year. Uses a simple
 * clamp for day-of-month so no entry can produce an invalid date.
 */
export function nextOccurrence(race: SARace, from: Date = new Date()): Date {
  const makeDate = (year: number) => {
    const lastDay = new Date(year, race.month, 0).getDate(); // day 0 of next month = last of this
    const day = Math.min(race.day, lastDay);
    return new Date(year, race.month - 1, day);
  };
  const thisYear = makeDate(from.getFullYear());
  // Compare on date only (ignore time-of-day) so today's race still counts.
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return thisYear >= fromMidnight ? thisYear : makeDate(from.getFullYear() + 1);
}

export interface UpcomingRace extends SARace {
  date: Date;
}

/**
 * All races whose next occurrence falls within `withinDays` of `from`,
 * soonest first. Defaults to the coming year.
 */
export function upcomingRaces(withinDays = 365, from: Date = new Date()): UpcomingRace[] {
  const cutoff = new Date(from.getTime() + withinDays * 86_400_000);
  return SA_RACES
    .map((race) => ({ ...race, date: nextOccurrence(race, from) }))
    .filter((r) => r.date <= cutoff)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Case-insensitive search over name/location/province/discipline label,
 *  optionally filtered to one discipline, returned in date order. */
export function searchRaces(
  query: string,
  discipline?: RaceDiscipline,
  from: Date = new Date(),
): UpcomingRace[] {
  const q = query.trim().toLowerCase();
  return upcomingRaces(365, from).filter((r) => {
    if (discipline && r.discipline !== discipline) return false;
    if (!q) return true;
    const hay = `${r.name} ${r.location} ${r.province} ${DISCIPLINE_LABELS[r.discipline]}`.toLowerCase();
    return hay.includes(q);
  });
}
