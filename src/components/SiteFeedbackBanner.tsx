import { useEffect, useState } from 'react';
import { X, MessageSquarePlus, Loader2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { submitSiteFeedback } from '../services/firebase/siteFeedback';

const DISMISS_KEY = 'fuelcue_site_feedback_dismissed_v1';

export function SiteFeedbackBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  // Publish banner height as a CSS var so other fixed-top elements (MobileNav)
  // can offset themselves while the banner is up.
  useEffect(() => {
    const root = document.documentElement;
    if (dismissed) {
      root.style.removeProperty('--banner-h');
    } else {
      root.style.setProperty('--banner-h', '36px');
    }
    return () => { root.style.removeProperty('--banner-h'); };
  }, [dismissed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // When closing, reset state so the next open is clean.
  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setErr(null);
    }
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await submitSiteFeedback({ message, email: email || null });
      setSubmitted(true);
      setMessage('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to send. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (dismissed) return null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[60] bg-[#3D2152] text-white shadow-[0_2px_10px_-4px_rgba(61,33,82,0.4)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-9 flex items-center gap-3 text-[12px] font-display">
          <span className="text-[#F5A020] font-bold uppercase tracking-[0.16em] text-[10px] hidden sm:inline">
            New
          </span>
          <span className="flex-1 truncate font-medium">
            We've just launched — help us shape it.
          </span>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F5A020] text-[#3D2152] text-[11px] font-bold uppercase tracking-[0.12em] hover:bg-[#F5A020]/90 transition-colors"
          >
            <MessageSquarePlus className="w-3 h-3" />
            Feedback
          </button>
          <button
            onClick={dismiss}
            className="w-7 h-7 flex items-center justify-center rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Spacer matching banner height so fixed-banner doesn't cover content. */}
      <div className="h-9" aria-hidden="true" />

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center font-sans">
          <div className="absolute inset-0 bg-[#3D2152]/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-[#FFF9F0] rounded-t-2xl sm:rounded-2xl border border-[#3D2152]/10 shadow-[0_24px_50px_-20px_rgba(61,33,82,0.4)] p-5 mx-0 sm:mx-4">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-[#A0929E] hover:text-[#3D2152] hover:bg-[#FFF5E8] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {submitted ? (
              <div className="py-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[#0F8B47]/10 mx-auto flex items-center justify-center mb-3">
                  <Check className="w-5 h-5 text-[#0F8B47]" />
                </div>
                <h2 className="text-[16px] font-display font-black text-[#3D2152] mb-1">Thanks!</h2>
                <p className="text-[12.5px] text-[#6B5A7A]">We read every message — usually within a day.</p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#3D2152] text-white text-[11.5px] font-display font-bold hover:bg-[#3D2152]/90 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F5A020]" />
                  <span className="text-[10px] font-display uppercase tracking-[0.18em] font-bold text-[#F5A020]">
                    Send feedback
                  </span>
                </div>
                <h2 className="text-[18px] font-display font-black text-[#3D2152] mb-1 leading-tight">
                  What's working? What's broken?
                </h2>
                <p className="text-[12px] text-[#6B5A7A] mb-3">
                  Tell us anything — bug reports, ideas, missing products. Goes straight to Nic.
                </p>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message…"
                  rows={5}
                  required
                  maxLength={4000}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#3D2152]/10 bg-white text-[13px] font-sans text-[#3D2152] placeholder:text-[#A0929E] focus:outline-none focus:border-[#F5A020]/50 resize-none"
                />

                {!user && (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your email (optional, so we can reply)"
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-white text-[12.5px] font-sans text-[#3D2152] placeholder:text-[#A0929E] focus:outline-none focus:border-[#F5A020]/50"
                  />
                )}

                {err && (
                  <div className="mt-2 text-[11px] text-[#E8671A] bg-[#E8671A]/10 border border-[#E8671A]/20 rounded-lg px-3 py-2">
                    {err}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[10.5px] text-[#A0929E] tabular-nums">{message.length}/4000</span>
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="px-4 py-2 rounded-lg bg-[#3D2152] text-white text-[11.5px] font-display font-bold hover:bg-[#3D2152]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {submitting ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
