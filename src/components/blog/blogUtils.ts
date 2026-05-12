/** Format an ISO timestamp from Strapi as a human-readable date. Falls back
 *  to the raw string if parsing fails so we never render "Invalid Date". */
export function formatPublishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
