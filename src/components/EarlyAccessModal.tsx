import { useState, type FormEvent } from 'react';
import { X, Send, Check, Loader2, User, Mail, Sparkles, Target } from 'lucide-react';
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

const NOTES_MAX = 2000;

export function EarlyAccessModal({ isOpen, onClose }: EarlyAccessModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sports, setSports] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  const toggleSport = (s: typeof SPORTS[number]) => {
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const handleClose = () => {
    if (status === 'sending') return;
    onClose();
    setTimeout(() => {
      setName('');
      setEmail('');
      setSports([]);
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
        sports,
        notes: notes.trim().slice(0, NOTES_MAX) || null,
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
  const notesCount = notes.length;
  const notesNearLimit = notesCount > NOTES_MAX * 0.85;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center font-sans">
      <div
        className="absolute inset-0 bg-[#3D2152]/45 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-[#FFF9F0] border-t sm:border border-[#3D2152]/12 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[95dvh] sm:max-h-[90dvh] flex flex-col shadow-[0_40px_80px_-30px_rgba(61,33,82,0.5)] overflow-hidden animate-in slide-in-from-bottom-4 sm:fade-in sm:zoom-in-95 duration-200">
        {/* warm glow accents — give the modal a sense of depth without a hero image */}
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-[#F5A020]/15 blur-[80px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-[#3D2152]/10 blur-[90px]" />

        {/* mobile drag handle */}
        <div className="relative sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#3D2152]/15" />
        </div>

        {/* header */}
        <div className="relative flex items-start justify-between gap-3 px-6 pt-5 pb-5 border-b border-[#3D2152]/8">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px w-6 bg-[#F5A020]" />
              <span className="text-[10px] font-display uppercase tracking-[0.28em] text-[#F5A020] font-bold">
                Early Access
              </span>
            </div>
            <h2 className="text-[22px] font-display font-black text-[#3D2152] leading-[1.1] tracking-[-0.01em]">
              Get on the list.
            </h2>
            <p className="text-[12.5px] text-[#6B5A7A] mt-2 leading-relaxed">
              We're letting athletes in gradually so we can shape the product around real race-day feedback. Tell us a bit about yourself.
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
          <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 text-center gap-4">
            <div className="relative">
              <div aria-hidden className="absolute inset-0 rounded-full bg-[#F5A020]/20 blur-2xl" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#F5A020] to-[#E8671A] flex items-center justify-center shadow-[0_12px_30px_-10px_rgba(245,160,32,0.5)]">
                <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <h3 className="text-xl font-display font-black text-[#3D2152] tracking-tight">You're on the list</h3>
            <p className="text-[13px] text-[#6B5A7A] max-w-xs leading-relaxed">
              Thanks {name.split(' ')[0] || 'for the interest'} — keep an eye on your inbox. In the
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
            className="relative flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5"
          >
            <Field label="Your name" icon={<User className="w-3.5 h-3.5" />} required>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={sending}
                required
                placeholder="Jane Athlete"
                autoComplete="name"
              />
            </Field>

            <Field label="Email" icon={<Mail className="w-3.5 h-3.5" />} required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
                required
                placeholder="jane@example.com"
                autoComplete="email"
              />
            </Field>

            <div>
              <FieldLabel
                label="What do you race?"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                hint="Select all that apply"
              />
              <div className="flex flex-wrap gap-2">
                {SPORTS.map((s) => {
                  const selected = sports.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSport(s)}
                      disabled={sending}
                      aria-pressed={selected}
                      className={[
                        'group relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-display font-bold transition-all duration-150 disabled:opacity-50',
                        selected
                          ? 'bg-gradient-to-br from-[#F5A020] to-[#E8671A] text-white shadow-[0_6px_18px_-8px_rgba(232,103,26,0.65)] scale-[1.02]'
                          : 'bg-white text-[#3D2152] border border-[#3D2152]/10 hover:border-[#F5A020]/40 hover:bg-[#FFF5E8]/70',
                      ].join(' ')}
                    >
                      <span
                        aria-hidden
                        className={[
                          'inline-flex items-center justify-center w-4 h-4 rounded-full transition-all',
                          selected
                            ? 'bg-white/25'
                            : 'bg-[#3D2152]/[0.06] group-hover:bg-[#F5A020]/15',
                        ].join(' ')}
                      >
                        {selected ? (
                          <Check className="w-3 h-3" strokeWidth={3} />
                        ) : (
                          <span className="block w-1 h-1 rounded-full bg-[#3D2152]/40 group-hover:bg-[#F5A020]" />
                        )}
                      </span>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel
                label="What's your next big race or goal?"
                icon={<Target className="w-3.5 h-3.5" />}
                hint="Optional — helps us prioritise"
              />
              <div className="relative">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                  disabled={sending}
                  rows={3}
                  maxLength={NOTES_MAX}
                  placeholder="Comrades 2026, first sub-3 marathon, ironman in October…"
                  className="w-full px-3.5 py-3 rounded-xl bg-white border border-[#3D2152]/12 text-[14px] text-[#3D2152] placeholder:text-[#A0929E]/70 focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 disabled:opacity-60 transition-colors resize-none leading-relaxed"
                />
                <span
                  className={[
                    'absolute bottom-2 right-3 text-[10px] font-display tabular-nums tracking-wide',
                    notesNearLimit ? 'text-[#E8671A]' : 'text-[#A0929E]',
                  ].join(' ')}
                >
                  {notesCount}/{NOTES_MAX}
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="text-[12px] text-[#E8671A] bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-3 py-2 leading-relaxed">
                {errorMessage}
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={sending}
                className="group relative w-full flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-[#3D2152] text-white font-display font-bold text-[13px] uppercase tracking-wider overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_10px_30px_-12px_rgba(61,33,82,0.4)] transition-shadow hover:shadow-[0_14px_36px_-10px_rgba(61,33,82,0.5)]"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-[#F5A020] to-[#E8671A] opacity-0 group-hover:opacity-100 group-disabled:opacity-0 transition-opacity duration-500" />
                <span className="relative flex items-center gap-2.5">
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
                </span>
              </button>
              <p className="text-[10.5px] text-[#A0929E] text-center mt-3 leading-relaxed">
                We'll only email you about your access — no marketing.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─────────── form helpers ─────────── */

function Field({
  label,
  icon,
  hint,
  required,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} icon={icon} hint={hint} required={required} />
      {children}
    </label>
  );
}

function FieldLabel({
  label,
  icon,
  hint,
  required,
}: {
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <div className="flex items-center gap-1.5 text-[10.5px] font-display uppercase tracking-[0.2em] font-bold text-[#3D2152]">
        {icon && <span className="text-[#F5A020]">{icon}</span>}
        <span>{label}</span>
        {required && <span className="text-[#F5A020]">*</span>}
      </div>
      {hint && (
        <span className="text-[10px] font-display text-[#A0929E] tracking-wide">{hint}</span>
      )}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3.5 py-3 rounded-xl bg-white border border-[#3D2152]/12 text-[14px] text-[#3D2152] placeholder:text-[#A0929E]/70 focus:outline-none focus:border-[#F5A020] focus:ring-2 focus:ring-[#F5A020]/15 disabled:opacity-60 transition-colors"
    />
  );
}
