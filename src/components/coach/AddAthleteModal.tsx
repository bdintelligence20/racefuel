import { useState } from 'react';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { X, UserPlus } from 'lucide-react';
import { addAthlete } from '../../services/coach/coachStore';
import { toast } from 'sonner';

export function AddAthleteModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [weight, setWeight] = useState('');
  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    addAthlete({
      name,
      email,
      eventName: eventName || undefined,
      eventDate: eventDate || undefined,
      weightKg: weight ? Number(weight) : undefined,
    });
    toast.success(`${name.trim()} added to your roster`);
    setName(''); setEmail(''); setEventName(''); setEventDate(''); setWeight('');
    onClose();
  };

  const input = 'w-full bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-sm font-display p-2.5 focus:outline-none focus:border-accent transition-colors';
  const label = 'text-[10px] text-text-secondary uppercase tracking-wider mb-1 block font-display font-bold';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-display font-bold text-text-primary">Add an athlete</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Name *</label>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Anina" required />
            </div>
            <div>
              <label className={label}>Weight (kg)</label>
              <input className={input} type="number" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="62" min={30} max={200} />
            </div>
          </div>
          <div>
            <label className={label}>Email *</label>
            <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anina@example.com" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Upcoming event</label>
              <input className={input} value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Two Oceans 56km" />
            </div>
            <div>
              <label className={label}>Event date</label>
              <input className={input} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
          </div>
          <p className="text-[11px] text-text-muted">
            Plans you send land in the fuelcue account with this email — they'll see them as soon as they sign in.
          </p>
          <button type="submit" className="w-full py-3 bg-accent text-white font-display font-bold uppercase tracking-wider rounded-xl hover:bg-accent-light transition-colors flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" /> Add to roster
          </button>
        </form>
      </div>
    </div>
  );
}
