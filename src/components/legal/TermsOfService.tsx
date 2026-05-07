import { LegalPage, P, UL } from './LegalPage';

const LAST_UPDATED = '7 May 2026';

export function TermsOfService() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          FuelCue plans on-course nutrition for endurance events. Use it as a tool — not as
          medical or sports-nutrition advice. We sell physical product through Fuel Lab; orders
          are subject to our <a className="text-warm hover:underline" href="/shipping-returns">Shipping &amp; Returns</a> policy.
          By signing in or placing an order you agree to these terms.
        </>
      }
      sections={[
        {
          heading: 'Who these terms apply to',
          body: (
            <P>
              These terms cover anyone who uses fuelcue.com or any associated mobile or
              desktop interface ("the Service"). The Service is operated by Promogroup (Pty) Ltd
              from South Africa. By creating an account, signing in, or placing an order you
              accept these terms.
            </P>
          ),
        },
        {
          heading: 'Accounts',
          body: (
            <>
              <P>You sign in via Google. You're responsible for keeping your Google account secure. If we have reason to believe an account is being abused or used fraudulently we may suspend or terminate it.</P>
              <P>You can delete your account at any time by emailing <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a>; deletion follows the retention rules in our <a className="text-warm hover:underline" href="/privacy">Privacy Policy</a>.</P>
            </>
          ),
        },
        {
          heading: 'What FuelCue is and isn\'t',
          body: (
            <>
              <P>FuelCue is a planning tool. It calculates suggested carb intake, hydration, and product placements based on the data you give it (route, profile, conditions). The science is grounded in published endurance-nutrition research, but every athlete is different.</P>
              <P><strong>FuelCue is not a substitute for professional advice.</strong> It does not diagnose, treat, or cure any condition. If you have a medical condition (diabetes, heart disease, gastrointestinal disorder, allergies) — or you're pregnant, breastfeeding, or under 18 — consult a qualified medical or sports-nutrition professional before using FuelCue's plans.</P>
              <P>Plans are best-effort recommendations; you're responsible for what you actually consume during training and racing.</P>
            </>
          ),
        },
        {
          heading: 'Orders, payment, and fulfillment',
          body: (
            <>
              <P>When you check out, you're buying physical product from Fuel Lab via fuelcue.com. Payment is processed by Stitch (stitch.money) on Fuel Lab's behalf. By placing an order you authorise us to charge the amount shown on the checkout screen, including the applicable shipping rate.</P>
              <P>Title and risk in the goods passes to you on delivery. See our <a className="text-warm hover:underline" href="/shipping-returns">Shipping &amp; Returns</a> policy for delivery times, courier rules, and returns.</P>
              <P>Pricing and product availability are subject to change without notice. We reserve the right to refuse or cancel an order for any lawful reason — including pricing or stock errors, suspected fraud, or repeated charge-backs.</P>
            </>
          ),
        },
        {
          heading: 'Acceptable use',
          body: (
            <>
              <P>You agree not to:</P>
              <UL>
                <li>Use the Service to do anything illegal or to harm anyone.</li>
                <li>Reverse-engineer, scrape, or attempt to extract our planning algorithms or product catalogue.</li>
                <li>Use automated tools to place orders, create accounts, or submit feedback.</li>
                <li>Resell or redistribute our content (route data, plans, or product information) without permission.</li>
                <li>Probe or test the Service's vulnerabilities outside of an authorised security review.</li>
              </UL>
            </>
          ),
        },
        {
          heading: 'Intellectual property',
          body: (
            <>
              <P>FuelCue's brand, software, and design are our property or licensed to us. You may use the Service only as these terms allow.</P>
              <P>Anything you upload (routes, ratings, feedback) remains yours, but you grant us a non-exclusive, worldwide, royalty-free licence to use it to operate and improve the Service. We won't share your uploads publicly without your consent.</P>
            </>
          ),
        },
        {
          heading: 'Third-party services',
          body: (
            <P>FuelCue connects to third parties (Google Sign-in, Mapbox, Stitch, Strava, Shopify, Gemini). Their terms apply to your use of those features. We're not responsible for their availability, accuracy, or actions.</P>
          ),
        },
        {
          heading: 'Limitation of liability',
          body: (
            <>
              <P>To the fullest extent allowed by South African law, FuelCue is provided "as is" without warranties of any kind. We don't guarantee that plans are perfect, that the Service will always be available, or that orders will arrive without delay.</P>
              <P>Our total liability to you in any 12-month period for any claim arising from the Service or an order will not exceed the greater of (a) the amount you paid us in that period or (b) ZAR 500.</P>
              <P>Nothing in these terms limits our liability for fraud, gross negligence, or any liability that cannot legally be limited under the Consumer Protection Act 68 of 2008 or POPIA.</P>
            </>
          ),
        },
        {
          heading: 'Termination',
          body: (
            <P>You can stop using the Service and delete your account at any time. We can suspend or terminate access if you violate these terms. Sections that by their nature should survive termination (intellectual property, limitation of liability, governing law) survive.</P>
          ),
        },
        {
          heading: 'Governing law and disputes',
          body: (
            <>
              <P>These terms are governed by the laws of South Africa. Any dispute will first be raised with us in writing at <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a>; we'll try to resolve it informally within 30 days.</P>
              <P>If we can't resolve it, the dispute will be referred to the South African courts, with the courts of the Western Cape division having exclusive jurisdiction.</P>
            </>
          ),
        },
        {
          heading: 'Changes to these terms',
          body: (
            <P>We may update these terms from time to time. If a change materially affects your rights or obligations, we'll notify signed-in users by email at the address on file at least 14 days before the change takes effect. Continued use after the change means you accept the new terms.</P>
          ),
        },
      ]}
    />
  );
}
