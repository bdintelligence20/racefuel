import { LegalPage, P, UL } from './LegalPage';
import { FUEL_LAB_SHIPPING } from '../../services/shipping/shippingRate';

const LAST_UPDATED = '7 May 2026';

export function ShippingReturns() {
  return (
    <LegalPage
      title="Shipping & Returns"
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          Flat-rate <strong>R{FUEL_LAB_SHIPPING.flatRateZAR}</strong> shipping anywhere in South
          Africa, free over <strong>R{FUEL_LAB_SHIPPING.freeShippingThresholdZAR}</strong>.
          Orders ship from Fuel Lab. Faulty or damaged goods can be returned for a full refund
          within 7 days of delivery; sealed unopened items within 14 days for store credit.
        </>
      }
      sections={[
        {
          heading: 'Where we ship',
          body: (
            <>
              <P>We currently ship to physical addresses within South Africa. We don't ship to PO boxes or international addresses. If you'd like that changed, email us — we'll add it to the roadmap.</P>
            </>
          ),
        },
        {
          heading: 'Shipping rates',
          body: (
            <UL>
              <li><strong>R{FUEL_LAB_SHIPPING.flatRateZAR} flat</strong> on orders under R{FUEL_LAB_SHIPPING.freeShippingThresholdZAR}.</li>
              <li><strong>Free shipping</strong> on orders R{FUEL_LAB_SHIPPING.freeShippingThresholdZAR} and above.</li>
              <li>Rate set by Fuel Lab; rises with courier fuel-fee adjustments. The rate shown at checkout is final — what you see is what you pay.</li>
            </UL>
          ),
        },
        {
          heading: 'Delivery time',
          body: (
            <>
              <P>Orders are despatched from Fuel Lab's warehouse on weekdays, typically within 1–2 business days of payment confirmation. Courier delivery times once despatched:</P>
              <UL>
                <li>Major centres (Cape Town, Johannesburg, Durban, Pretoria) — 2–3 business days.</li>
                <li>Outlying areas — 3–5 business days.</li>
              </UL>
              <P>You'll receive a tracking email from Shopify once your order goes out.</P>
            </>
          ),
        },
        {
          heading: 'Returns — faulty or damaged goods',
          body: (
            <>
              <P>If something arrives damaged, expired, or otherwise faulty, email <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a> within <strong>7 days of delivery</strong> with a photo of the issue and your order reference. We'll either:</P>
              <UL>
                <li>Send a replacement at no charge, or</li>
                <li>Refund the affected items in full (including the proportional share of the shipping fee).</li>
              </UL>
              <P>This right is in addition to any rights you have under the Consumer Protection Act 68 of 2008.</P>
            </>
          ),
        },
        {
          heading: 'Returns — change of mind',
          body: (
            <>
              <P>Endurance nutrition is sold as a perishable consumable, so we can only accept returns of <strong>sealed, unopened</strong> items in their original packaging within <strong>14 days of delivery</strong>. The credit is issued as store credit usable on a future order; we don't refund change-of-mind returns to the original payment method.</P>
              <P>We can't accept returns of opened gels, bars, chews, or drink mixes for hygiene reasons.</P>
              <P>Return shipping for change-of-mind items is the customer's responsibility; we recommend a tracked courier.</P>
            </>
          ),
        },
        {
          heading: 'Cancellations',
          body: (
            <P>You can cancel an order for a full refund (including shipping) up until it has been despatched. Once it's with the courier, the change-of-mind return rules above apply. Email <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a> with your order reference as soon as you'd like to cancel.</P>
          ),
        },
        {
          heading: 'Refund timing',
          body: (
            <P>Refunds to the original payment method are processed within 3 business days of the request being approved; depending on your bank it may take a further 3–7 days to appear on your statement. Store credit is issued immediately.</P>
          ),
        },
        {
          heading: 'Questions',
          body: (
            <P>Email <a className="text-warm hover:underline" href="mailto:hello@fuelcue.com">hello@fuelcue.com</a> with your order number and we'll come back within one business day.</P>
          ),
        },
      ]}
    />
  );
}
