/**
 * H:MM:SS string parsing/formatting and a single helper for "the duration
 * that should drive plan metrics right now". The user-edited override wins
 * over the auto-estimate so headline values stay consistent with the rest
 * of the UI after the user tweaks the time.
 */

export function parseHmsToHours(hms: string | undefined, fallbackHours = 0): number {
  if (!hms) return fallbackHours;
  const parts = hms.split(':').map((p) => Number(p));
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return fallbackHours;
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  const total = h + m / 60 + s / 3600;
  return total > 0 ? total : fallbackHours;
}

export function formatHoursAsHms(hours: number): string {
  const safe = Number.isFinite(hours) && hours > 0 ? hours : 0;
  const h = Math.floor(safe);
  const m = Math.floor((safe - h) * 60);
  const s = Math.floor(((safe - h) * 60 - m) * 60);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function getActiveDurationHours(
  route: { estimatedTime?: string; userEstimatedTime?: string },
  fallbackHours = 0,
): number {
  return parseHmsToHours(route.userEstimatedTime ?? route.estimatedTime, fallbackHours);
}
