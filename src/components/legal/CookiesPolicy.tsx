import { LegalPage, P, UL } from './LegalPage';

const LAST_UPDATED = '7 May 2026';

export function CookiesPolicy() {
  return (
    <LegalPage
      title="Cookies Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          We use a small set of cookies and browser-storage entries to keep you signed in and
          remember your UI preferences. We do not use third-party advertising or
          cross-site tracking cookies.
        </>
      }
      sections={[
        {
          heading: 'What we use',
          body: (
            <>
              <P><strong>First-party cookies</strong> set by fuelcue.com or its auth domain:</P>
              <UL>
                <li><strong>Firebase Auth session cookies</strong> — keep you signed in across page loads. Set by Google Identity Toolkit. Required.</li>
                <li><strong>Firebase Hosting session</strong> — used for cache-control and request routing. Required.</li>
              </UL>

              <P><strong>Browser localStorage</strong> entries (not cookies, but functionally similar; never sent to a server, only read by the SPA):</P>
              <UL>
                <li><code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_profile</code>, <code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_last_plan</code> — local cache of your athlete profile and last plan, mirrored from Firestore so first paint is instant.</li>
                <li><code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_onboarding_complete</code>, <code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_route_color_mode</code>, <code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_kit_flavours</code> — UI preferences (theme, route colouring, flavour picks).</li>
                <li><code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_race_checklist</code> — your race-day checklist progress.</li>
                <li><code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_shipping_address</code> — last shipping address you typed at checkout, so you don't have to retype it.</li>
                <li><code className="text-[12px] bg-surfaceHighlight px-1 rounded">fuelcue_strava_tokens</code> — Strava OAuth tokens, used to fetch your activity list when you ask. Stored only on your device.</li>
              </UL>

              <P><strong>Third-party services</strong> we embed may set their own cookies on the domain they serve from (not on fuelcue.com):</P>
              <UL>
                <li><strong>Google Sign-In</strong> — for the OAuth handshake.</li>
                <li><strong>Mapbox</strong> — anonymous tile-request tracking, per Mapbox's policy.</li>
                <li><strong>Stitch (during checkout)</strong> — payment-session cookies on stitch.money.</li>
              </UL>
            </>
          ),
        },
        {
          heading: 'What we don\'t use',
          body: (
            <UL>
              <li>Advertising or remarketing cookies.</li>
              <li>Cross-site tracking pixels.</li>
              <li>Third-party analytics that profile individual users.</li>
            </UL>
          ),
        },
        {
          heading: 'Your choices',
          body: (
            <>
              <P>Most browsers let you block or clear cookies and localStorage from Settings → Privacy. Blocking the required ones will sign you out and prevent the app from working.</P>
              <P>Clearing your browser data while signed out has no effect on the data we store in Firestore — it lives in the cloud and re-hydrates next time you sign in.</P>
            </>
          ),
        },
        {
          heading: 'Changes',
          body: (
            <P>We'll update this page if we add or remove anything material. The "last updated" date at the top reflects the most recent revision.</P>
          ),
        },
      ]}
    />
  );
}
