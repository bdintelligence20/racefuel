/**
 * Tiny open-signal bus for the AI coach surface, mirroring gutTrainingOpen.ts.
 *
 * The coach flow is mounted once at the app shell (always present, even on the
 * route-entry screen where the sidebar isn't). Any entry point — the big card
 * on the first screen, a future sidebar item — fires `requestOpenCoach()` and
 * the shell-mounted flow opens.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function requestOpenCoach(): void {
  listeners.forEach((l) => l());
}

export function onOpenCoach(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
