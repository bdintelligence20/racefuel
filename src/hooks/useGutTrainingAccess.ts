import { useEntitlements } from './useEntitlements';

// Build-time exclusion ONLY, for local work — set VITE_GUT_TRAINING_V2=false to
// compile the beta out of a dev build. It is NOT the per-user gate and NOT the
// kill switch: production access is server-authoritative (useEntitlements →
// getMyAccess), itself ANDed with the admin kill switch. See functions
// entitlements.ts.
const GUT_TRAINING_BUILD_ENABLED = import.meta.env.VITE_GUT_TRAINING_V2 !== 'false';

/**
 * Whether the current user may see and open the gut-training beta.
 *
 * In production this is server-authoritative (betaGutTraining), failing closed
 * while entitlements load so the entry never flashes in for an ineligible user.
 * In local dev there's no backend, so the entitlement fails closed — surface
 * the beta in dev anyway so the flow stays testable. `import.meta.env.DEV` is
 * false in prod builds. The flow's own consent gate still applies on open.
 *
 * Shared by every surface that offers the beta (sidebar entry, the route-entry
 * button, and the always-mounted flow host in App) so the gate can't drift.
 */
export function useGutTrainingAccess(): boolean {
  const { betaGutTraining } = useEntitlements();
  return GUT_TRAINING_BUILD_ENABLED && (betaGutTraining || import.meta.env.DEV);
}
