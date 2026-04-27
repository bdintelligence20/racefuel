import { useState, type FormEvent } from 'react';
import { X, Send, Check, Loader2 } from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../services/firebase/config';

interface EarlyAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SPORTS = [
  'Road running',
  'Trail running',
  'Road cycling',
  'Gravel',
  'Triathlon',
  'Ultra',
  'Other',
] as const;

export function EarlyAccessModal({ isOpen, onClose }: EarlyAccessModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sport, setSport] = useState<typeof SPORTS[number] | ''>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  const handleClose = () => {
    if (status === 'sending') return;
    onClose();
    setTimeout(() => {
      setName('');
      setEmail('');
      setSport('');
      setNotes('');
      setStatus('idle');
      setErrorMessage(null);
    }, 250);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    if (!name.trim() || !email.trim()) {
      setErrorMessage('Name and email are required.');
      return;
    }

    const cleanName = name.trim().slice(0, 200);
    const cleanEmail = email.trim().toLowerCase().slice(0, 200);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setErrorMessage("That email address doesn't look right.");
      return;
    }

    setStatus('sending');
    setErrorMessage(null);
    try {
      await addDoc(collection(firestore, 'earlyAccessRequests'), {
        name: cleanName,
        email: cleanEmail,
        sport: sport || null,
        notes: notes.trim().slice(0, 2000) || null,
        userAgent:
          typeof navigator !== 'undefined' && navigator.userAgent
            ? navigator.userAgent.slice(0, 500)
            : null,
        referrer:
          typeof document !== 'undefined' && document.referrer
            ? document.referrer.slice(0, 500)
            : null,
        createdAt: serverTimestamp(),
      });
      setStatus('sent');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[earlyAccess] submit failed', err);
      setStatus('error');
      setErrorMessage(
        err instanceof Error
          ? `Couldn't submit — ${err.message}. Please email hello@fuelcue.com instead.`
          : 'Could not submit. Please email hello@fuelcue.com instead.'
      );
    }
  };

  const sending = status === 'sending';
  const sent = status === 'sent';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center font-sans">
      <div
        className="absolute inset-0 bg-[#3D2152]/45 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-[#FFF9F0] border-t sm:border border-[#3D2152]/12 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[95dvh] sm:max-h-[90dvh] flex flex-col shadow-[0_40px_80px_-30px_rgba(61,33,82,0.5)] overflow-hidden animate-in slide-in-from-bottom-4 sm:fade-in sm:zoom-in-95 duration-200">
        {/* mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#3D2152]/15" />
        </div>

        {/* header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#3D2152]/8">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-display uppercase tracking-[0.28em] text-[#F5A020] font-bold mb-1">
              Early Access
            </div>
            <h2 className="text-xl font-display font-black text-[#3D2152] leading-tight">
              Get on the list
            </h2>
            <p className="text-[12px] text-[#6B5A7A] mt-1 leading-relaxed">
              We're letting athletes in gradually so we can shape it with real users. Tell us a bit about yourself.
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={sending}
            aria-label="Close"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-[#6B5A7A] hover:bg-[#3D2152]/[0.06] disabled:opacity-40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#F5A020]/15 flex items-center justify-center">
              <Check className="w-7 h-7 text-[#F5A020]" />
            </div>
            <h3 className="text-lg font-display font-black text-[#3D2152]">You're on the list</h3>
            <p className="text-[13px] text-[#6B5A7A] max-w-xs">
              Thanks {name.split(' ')[0] || 'for the interest'} — we'll be in touch soon. In the
              meantime, scroll the page to see what we're building.
            </p>
            <button
              onClick={handleClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-[#3D2152] text-white text-[13px] font-display font-bold hover:bg-[#5C2D6E] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4"
          >
            <Field label="Your name" required>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={sending}
                required
                placeholder="Jane Athlete"
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#3D2152]/12 text-[14px] text-[#3D2152] placeholder:text-[#A0929E]/70 focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 disabled:opacity-60 transition-colors"
              />
            </Field>

            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
                required
                placeholder="jane@example.com"
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#3D2152]/12 text-[14px] text-[#3D2152] placeholder:text-[#A0929E]/70 focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 disabled:opacity-60 transition-colors"
              />
            </Field>

            <Field label="What do you race?">
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as typeof SPORTS[number] | '')}
                disabled={sending}
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#3D2152]/12 text-[14px] text-[#3D2152] focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 disabled:opacity-60 transition-colors"
              >
                <option value="">Select…</option>
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="What's your next big race or goal?">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={sending}
                rows={3}
                placeholder="Comrades 2026, first sub-3 marathon, ironman in October…"
                className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#3D2152]/12 text-[14px] text-[#3D2152] placeholder:text-[#A0929E]/70 focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 disabled:opacity-60 transition-colors resize-none"
              />
            </Field>

            {errorMessage && (
              <div className="text-[12px] text-[#E8671A] bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-3 py-2 leading-relaxed">
                {errorMessage}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#3D2152] text-white font-display font-bold text-[13px] uppercase tracking-wider hover:bg-[#5C2D6E] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Request Early Access
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-display uppercase tracking-[0.18em] font-bold text-[#3D2152] mb-1.5">
        {label}{required && <span className="text-[#F5A020] ml-1">*</span>}
      </div>
      {children}
    </label>
  );
}
