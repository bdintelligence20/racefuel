/**
 * Tiny open-signal bus for the gut-training flow.
 *
 * The flow lives inside the Sidebar (state `gutTrainingOpen`), but the opt-in
 * banner renders at the app shell's top level — outside AppProvider, so it
 * can't touch that state directly. The banner fires `requestOpenGutTraining()`
 * and the Sidebar (mounted on /app post-login) subscribes and opens the flow.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function requestOpenGutTraining(): void {
  listeners.forEach((l) => l());
}

export function onOpenGutTraining(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
