// Build/config kill switch — set VITE_GUT_TRAINING_V2=false to compile the beta
// out of a build. This is the ONLY remaining gate: the feature is otherwise
// open to everyone (see below).
const GUT_TRAINING_BUILD_ENABLED = import.meta.env.VITE_GUT_TRAINING_V2 !== 'false';

/**
 * Whether the gut-training beta is shown.
 *
 * Now open to ALL athletes on prod by product decision — the previous
 * server-authoritative entitlement gate (useEntitlements → getMyAccess, ANDed
 * with the admin kill switch) has been lifted, so eligibility allowlists and
 * the runtime kill switch no longer hide it. Only the build/config flag above
 * remains. The flow's own consent (opt-in) screen still applies on open, and
 * all its writes are owner-scoped, so opening it to everyone is safe.
 *
 * Kept as a `use`-prefixed function so existing call sites (sidebar entry,
 * route-entry button, the shell-mounted flow host in App) don't change.
 */
export function useGutTrainingAccess(): boolean {
  return GUT_TRAINING_BUILD_ENABLED;
}
