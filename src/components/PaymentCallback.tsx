import { useEffect, useState } from 'react';
import { Loader2, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../services/firebase/config';
import { useAuth } from '../context/AuthContext';

/**
 * Lands here after Stitch's hosted checkout. The redirect carries:
 *   ?orderId=<firestoreOrderId>&id=<stitchPaymentRequestId>&status=complete|closed|failed
 *
 * Per Stitch docs the `status` query param is NOT trustworthy (the user
 * can edit it). Truth comes from our Firestore order doc, which the
 * stitchWebhook function flips to 'paid' → 'placed' as the webhook
 * delivers. So this page subscribes to the Firestore doc and shows live
 * progress; the URL `status` is only used to decide which initial copy
 * to render (success-leaning vs failure-leaning).
 */

interface OrderDoc {
  status: 'pending' | 'paid' | 'placed' | 'paid-needs-fulfillment' | 'failed' | 'cancelled';
  amount?: { currency: string; total: number };
  shopify?: {
    name?: string;
    orderNumber?: number;
    adminUrl?: string;
    totalPrice?: string;
  };
  failureReason?: string;
}

export function PaymentCallback() {
  const { user, loading: authLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('orderId');
  const stitchStatus = params.get('status'); // 'complete' | 'closed' | 'failed'

  const [order, setOrder] = useState<OrderDoc | null>(null);
  const [readError, setReadError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    if (authLoading) return;
    if (!user) {
      setReadError('Sign in with the email used at checkout to view this order.');
      return;
    }
    const unsub = onSnapshot(
      doc(firestore, 'orders', orderId),
      (snap) => {
        if (!snap.exists()) {
          setReadError("We couldn't find this order.");
          return;
        }
        setOrder(snap.data() as OrderDoc);
      },
      (err) => {
        setReadError(`Permission denied: ${err.message}`);
      }
    );
    return () => unsub();
  }, [orderId, user, authLoading]);

  if (!orderId) {
    return (
      <Frame>
        <ErrorState
          title="No order to show"
          message="This URL is meant to be the redirect destination after a Stitch payment. There's no orderId in the query string."
        />
      </Frame>
    );
  }

  if (authLoading) {
    return <Frame><Loader2 className="w-6 h-6 animate-spin text-[#F5A020]" /></Frame>;
  }

  if (readError) {
    return (
      <Frame>
        <ErrorState title="Couldn't load this order" message={readError} />
      </Frame>
    );
  }

  if (!order) {
    return (
      <Frame>
        <Loader2 className="w-6 h-6 animate-spin text-[#F5A020]" />
        <p className="text-[13px] text-[#6B5A7A] mt-4">Loading your order…</p>
      </Frame>
    );
  }

  // The Firestore status is the source of truth — these branches all key off it.
  if (order.status === 'placed') {
    return (
      <Frame>
        <SuccessIcon />
        <h1 className="text-2xl font-display font-black text-[#3D2152] mt-5 mb-2 tracking-tight">
          You're all set.
        </h1>
        <p className="text-[14px] text-[#6B5A7A] leading-relaxed max-w-sm">
          Order <b className="text-[#3D2152]">{order.shopify?.name ?? `#${order.shopify?.orderNumber ?? '—'}`}</b>{' '}
          has been placed with Fuel Lab. They'll ship it to you shortly and email tracking when it goes out.
        </p>
        <div className="text-[11px] text-[#A0929E] mt-4 font-display tabular-nums">
          R{(order.amount?.total ?? 0).toFixed(2)} {order.amount?.currency ?? 'ZAR'}
        </div>
        {order.shopify?.adminUrl && user?.email === 'nicholasflemmer@gmail.com' && (
          <a
            href={order.shopify.adminUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-[12px] text-[#3D2152] underline hover:text-[#F5A020] transition-colors"
          >
            View in Shopify <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </Frame>
    );
  }

  if (order.status === 'paid' || order.status === 'paid-needs-fulfillment') {
    return (
      <Frame>
        <Loader2 className="w-12 h-12 animate-spin text-[#F5A020]" />
        <h1 className="text-xl font-display font-black text-[#3D2152] mt-5 mb-2 tracking-tight">
          Payment received — placing your order…
        </h1>
        <p className="text-[13px] text-[#6B5A7A] leading-relaxed max-w-sm">
          Your payment is in. We're now creating your order with Fuel Lab. This usually takes a couple of seconds.
        </p>
        {order.status === 'paid-needs-fulfillment' && (
          <div className="mt-4 text-[11.5px] text-[#E8671A] bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-3 py-2 max-w-sm leading-relaxed">
            We've taken your payment but hit a snag pushing the order to Fuel Lab. We've been notified and will fulfill manually — no further action needed from you.
          </div>
        )}
      </Frame>
    );
  }

  if (order.status === 'failed' || order.status === 'cancelled') {
    return (
      <Frame>
        <FailIcon />
        <h1 className="text-2xl font-display font-black text-[#3D2152] mt-5 mb-2 tracking-tight">
          {order.status === 'cancelled' ? 'Payment cancelled' : 'Payment failed'}
        </h1>
        <p className="text-[13px] text-[#6B5A7A] leading-relaxed max-w-sm">
          {order.status === 'cancelled'
            ? "You closed the Stitch payment window before completing it. No money was taken."
            : `Stitch reported the payment as failed${order.failureReason ? ` (${order.failureReason})` : ''}. Please try again.`}
        </p>
      </Frame>
    );
  }

  // status === 'pending' — webhook hasn't fired yet. Two flows land here:
  //   1. Same-tab redirect from Stitch (legacy / popup-blocked) — `status`
  //      query param is set, so we lean toward "Confirming…".
  //   2. New-tab flow: this tab never went to Stitch, the Stitch payment
  //      is happening in another tab. Show "complete in other tab" copy.
  return (
    <Frame>
      <Loader2 className="w-12 h-12 animate-spin text-[#F5A020]" />
      <h1 className="text-xl font-display font-black text-[#3D2152] mt-5 mb-2 tracking-tight">
        {stitchStatus === 'complete' ? 'Confirming your payment…' : 'Complete payment in the other tab'}
      </h1>
      <p className="text-[13px] text-[#6B5A7A] leading-relaxed max-w-sm">
        {stitchStatus === 'complete'
          ? "We'll update this page as soon as Stitch confirms the transaction. Don't close the tab."
          : "Your Stitch payment opened in a new tab. Once you finish there, this page will update automatically — no need to come back manually. You can close the Stitch tab when it's done."}
      </p>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center px-6 font-sans">
      <div className="max-w-md w-full bg-white border border-[#3D2152]/10 rounded-2xl p-10 text-center flex flex-col items-center shadow-[0_30px_70px_-30px_rgba(61,33,82,0.25)]">
        {children}
      </div>
    </div>
  );
}

function SuccessIcon() {
  return (
    <div className="relative">
      <div aria-hidden className="absolute inset-0 rounded-full bg-[#F5A020]/20 blur-2xl" />
      <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#F5A020] to-[#E8671A] flex items-center justify-center shadow-[0_12px_30px_-10px_rgba(245,160,32,0.5)]">
        <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function FailIcon() {
  return (
    <div className="w-14 h-14 rounded-full bg-[#3D2152]/10 flex items-center justify-center">
      <X className="w-7 h-7 text-[#3D2152]" strokeWidth={2.5} />
    </div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <>
      <div className="w-12 h-12 rounded-full bg-[#E8671A]/10 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-[#E8671A]" />
      </div>
      <h1 className="text-xl font-display font-black text-[#3D2152] mt-5 mb-2 tracking-tight">{title}</h1>
      <p className="text-[13px] text-[#6B5A7A] leading-relaxed max-w-sm">{message}</p>
    </>
  );
}
