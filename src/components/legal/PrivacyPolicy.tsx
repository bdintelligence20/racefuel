import { LegalPage, P, UL } from './LegalPage';

const LAST_UPDATED = '7 May 2026';

export function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          We collect the minimum data needed to plan your nutrition and ship your fuel: your athlete
          profile, the routes you load, the orders you place, and the email Google gives us when
          you sign in. We don't sell your data, and you can delete your account at any time by
          emailing <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a>.
        </>
      }
      sections={[
        {
          heading: 'Who we are',
          body: (
            <>
              <P>
                FuelCue (<em>"we", "us", "our"</em>) is operated by Promogroup (Pty) Ltd, a
                company registered in South Africa. The website is fuelcue.com. For privacy
                queries, contact <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a>.
              </P>
              <P>
                This policy explains what personal information we collect, why, how we store it,
                and the rights you have over it under the South African Protection of Personal
                Information Act (POPIA) and similar laws where applicable.
              </P>
            </>
          ),
        },
        {
          heading: 'What we collect',
          body: (
            <>
              <P>From your Google account when you sign in:</P>
              <UL>
                <li>Email address, display name, and profile photo (Google uses these to identify you).</li>
                <li>A unique Firebase user ID we generate to keep your data separate from other users'.</li>
              </UL>
              <P>From you, while using the app:</P>
              <UL>
                <li>Athlete profile (weight, height, sport, gut tolerance, sweat rate, FTP, etc.).</li>
                <li>Routes you load (GPX/TCX files), planned dates, and the placements you make.</li>
                <li>Custom products you add and product ratings or feedback you submit.</li>
                <li>Orders you place — line items, shipping address, phone, payment status.</li>
              </UL>
              <P>From your device automatically:</P>
              <UL>
                <li>Cookies and local-storage entries needed to keep you signed in and remember UI preferences. See our <a className="text-warm hover:underline" href="/cookies">Cookies Policy</a>.</li>
                <li>Approximate request information (IP, user agent, request time) captured by hosting infrastructure for security and abuse prevention.</li>
              </UL>
              <P>From third parties you connect:</P>
              <UL>
                <li>Strava activity data, if you connect Strava (used to import routes you've ridden or run).</li>
                <li>Mapbox tile request information (anonymous, used by Mapbox to render the map).</li>
              </UL>
            </>
          ),
        },
        {
          heading: 'Why we collect it',
          body: (
            <UL>
              <li><strong>To plan your nutrition.</strong> Your profile and route data are inputs to the planning algorithm; without them we can't compute carb targets, hydration, or product placements.</li>
              <li><strong>To process orders.</strong> Shipping address, phone, and order details are sent to our payment processor (Stitch) and our fulfillment partner (Fuel Lab on Shopify).</li>
              <li><strong>To keep you signed in.</strong> Google authentication uses the email + photo to identify you across sessions and devices.</li>
              <li><strong>To improve the product.</strong> Aggregated, de-identified usage patterns help us decide which features to build next.</li>
              <li><strong>To fight abuse and meet legal obligations.</strong> Logs help us detect fraud, debug bugs, and comply with tax/accounting law.</li>
            </UL>
          ),
        },
        {
          heading: 'Where it lives and who can see it',
          body: (
            <>
              <P>Your data is stored in Google Cloud's Firestore database (Firebase project <code className="text-[12px] bg-surfaceHighlight px-1 rounded">promogroup</code>) in the <em>us-central1</em> region. Access is locked down at the database level so only the signed-in owner can read or write their own data; we (Promogroup staff) only access individual records when troubleshooting a specific support request you've raised.</P>
              <P>We share specific data with these processors, only for the purpose described:</P>
              <UL>
                <li><strong>Google Firebase</strong> — authentication, database, hosting.</li>
                <li><strong>Mapbox</strong> — rendering map tiles for routes you view.</li>
                <li><strong>Stitch (stitch.money)</strong> — payment processing for orders. We send name, email, phone, and order amount.</li>
                <li><strong>Fuel Lab / Shopify</strong> — fulfilling orders. We send shipping address, line items, and order reference.</li>
                <li><strong>Resend</strong> — sending transactional email (order confirmations, support replies).</li>
                <li><strong>Strava</strong> — only if you connect it; we exchange OAuth tokens to fetch your activity list when you ask.</li>
                <li><strong>Google Gemini API</strong> — when you tap "Auto Generate"; we send your route summary and athlete profile to the model and discard the response after applying it.</li>
              </UL>
              <P>We don't sell, rent, or trade your data with anyone else.</P>
            </>
          ),
        },
        {
          heading: 'How long we keep it',
          body: (
            <>
              <P>While your account is active, we keep your data so the app works. If you ask us to delete your account, we delete:</P>
              <UL>
                <li>Your profile, preferences, saved plans, ratings, and feedback within 7 days.</li>
                <li>Order records are retained for 5 years to comply with South African tax law (the bare minimum: name, address, items, amount, date — nothing else).</li>
                <li>Backups roll off on a 30-day cycle; deleted data is purged within that window.</li>
              </UL>
            </>
          ),
        },
        {
          heading: 'Your rights',
          body: (
            <>
              <P>Under POPIA you have the right to:</P>
              <UL>
                <li>Access the personal information we hold about you.</li>
                <li>Correct or update it.</li>
                <li>Have it deleted (subject to the retention rule above for orders).</li>
                <li>Object to specific processing activities.</li>
                <li>Lodge a complaint with the South African Information Regulator (<a className="text-warm hover:underline" href="https://inforegulator.org.za" target="_blank" rel="noreferrer">inforegulator.org.za</a>).</li>
              </UL>
              <P>To exercise any of these, email <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a> from the address linked to your account. We'll reply within 30 days, usually sooner.</P>
            </>
          ),
        },
        {
          heading: 'Children',
          body: (
            <P>FuelCue is built for adult endurance athletes. We do not knowingly collect data from anyone under 16. If you believe a minor has signed up, email us and we'll delete the account.</P>
          ),
        },
        {
          heading: 'Changes',
          body: (
            <P>If we change this policy in a way that materially affects how we handle your data, we'll email signed-in users at the address on file at least 14 days before the change takes effect. The "last updated" date at the top of this page reflects the most recent revision.</P>
          ),
        },
      ]}
    />
  );
}
