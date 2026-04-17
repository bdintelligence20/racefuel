import './index.css';
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Handle stale-chunk errors after a deploy: the cached index.html references
// JS bundles whose hashes no longer exist. Auto-reload once so the user picks
// up the new index.html (and new chunk names). The sessionStorage guard
// prevents infinite reload loops if something else is wrong.
const RELOAD_KEY = 'fuelcue_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 30_000;

function maybeReloadForChunkError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const isChunkError =
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('ChunkLoadError');
  if (!isChunkError) return;

  const last = Number(sessionStorage.getItem(RELOAD_KEY) || '0');
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  window.location.reload();
}

window.addEventListener('error', (e) => maybeReloadForChunkError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => maybeReloadForChunkError(e.reason));

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
