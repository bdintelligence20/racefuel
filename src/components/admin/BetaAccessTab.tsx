import { useEffect, useState } from 'react';
import { Loader2, UserPlus, X, Lock, Power } from 'lucide-react';
import {
  adminListBeta,
  adminAddBeta,
  adminRemoveBeta,
  adminSetGutTrainingV2Enabled,
  type AdminListBetaResult,
} from '../../services/firebase/admin';

function formatDate(value: number | string | null): string {
  if (!value) return '—';
  const ms = typeof value === 'string' ? Date.parse(value) : value;
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function BetaAccessTab() {
  const [data, setData] = useState<AdminListBetaResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const refresh = async () => {
    try {
      const res = await adminListBeta();
      setData(res);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load beta access.');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAdding(true);
    setErr(null);
    try {
      await adminAddBeta({ email });
      setNewEmail('');
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add beta user.');
    } finally {
      setAdding(false);
    }
  };

  const onRemove = async (email: string) => {
    if (!confirm(`Remove ${email} from the gut-training beta?`)) return;
    setErr(null);
    try {
      await adminRemoveBeta({ email });
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to remove beta user.');
    }
  };

  const onToggleKill = async () => {
    if (!data) return;
    const next = !data.gutTrainingV2Enabled;
    if (!next && !confirm('Turn the gut-training beta OFF for everyone (admins included)?')) return;
    setToggling(true);
    setErr(null);
    try {
      await adminSetGutTrainingV2Enabled({ enabled: next });
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to toggle the kill switch.');
    } finally {
      setToggling(false);
    }
  };

  const optIns = data?.optIns ?? [];
  const decliners = [...optIns].filter((o) => !o.optedIn && o.dismissCount > 0)
    .sort((a, b) => b.dismissCount - a.dismissCount);
  const joined = optIns.filter((o) => o.optedIn);

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Gut-training beta</h1>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>
      )}

      {/* Kill switch */}
      <section className="bg-white border border-[#3D2152]/10 rounded-2xl p-5 shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)]">
        <h2 className="text-[13px] font-display font-bold text-[#3D2152] mb-1">Global kill switch</h2>
        <p className="text-[11px] text-[#A0929E] mb-4">
          When off, the beta is hidden for <strong>everyone</strong> — the per-user allowlist below is
          ANDed with this. Takes effect within a minute (no redeploy).
        </p>
        {!data ? (
          <div className="text-[12px] text-[#A0929E] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
        ) : (
          <button
            onClick={onToggleKill}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-display font-bold transition-colors disabled:opacity-50 ${
              data.gutTrainingV2Enabled
                ? 'bg-[#0F8B47]/10 text-[#0F8B47] hover:bg-[#0F8B47]/15'
                : 'bg-[#E8671A]/10 text-[#E8671A] hover:bg-[#E8671A]/15'
            }`}
          >
            {toggling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            {data.gutTrainingV2Enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
          </button>
        )}
      </section>

      {/* Allowlist */}
      <section className="bg-white border border-[#3D2152]/10 rounded-2xl p-5 shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)]">
        <h2 className="text-[13px] font-display font-bold text-[#3D2152] mb-1">Eligibility allowlist</h2>
        <p className="text-[11px] text-[#A0929E] mb-4">
          Only these accounts are offered the beta. Seed admins are always eligible.
        </p>

        {!data ? (
          <div className="text-[12px] text-[#A0929E] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
        ) : (
          <ul className="space-y-2">
            {data.seedAdmins.map((email) => (
              <li key={email} className="flex items-center gap-3 px-3 py-2.5 bg-[#FFF5E8] border border-[#F5A020]/20 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-[#F5A020]" />
                <span className="text-[12.5px] font-display font-semibold text-[#3D2152] truncate flex-1">{email}</span>
                <span className="text-[10px] text-[#F5A020] uppercase tracking-[0.16em] font-bold">Admin</span>
              </li>
            ))}
            {data.allow.map((a) => (
              <li key={a.email} className="flex items-center gap-3 px-3 py-2.5 bg-[#FFF9F0] border border-[#3D2152]/[0.08] rounded-xl">
                <span className="text-[12.5px] font-display font-semibold text-[#3D2152] truncate flex-1">{a.email}</span>
                <span className="text-[10.5px] text-[#A0929E] tabular-nums">{formatDate(a.addedAt)}</span>
                {a.addedBy && <span className="text-[10.5px] text-[#A0929E] hidden sm:inline">by {a.addedBy}</span>}
                <button
                  onClick={() => onRemove(a.email)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E8671A]/10 text-[#A0929E] hover:text-[#E8671A] transition-colors"
                  aria-label={`Remove ${a.email}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
            {data.allow.length === 0 && (
              <li className="text-[11.5px] text-[#A0929E] py-2">No beta users added yet.</li>
            )}
          </ul>
        )}

        <form onSubmit={onAdd} className="mt-4 flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] font-sans text-[#3D2152] placeholder:text-[#A0929E] focus:outline-none focus:border-[#F5A020]/50"
            required
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            className="px-4 py-2 rounded-xl bg-[#3D2152] text-white text-[11.5px] font-display font-bold hover:bg-[#3D2152]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Add
          </button>
        </form>
      </section>

      {/* Opt-in / decline tracking */}
      <section className="bg-white border border-[#3D2152]/10 rounded-2xl p-5 shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)]">
        <h2 className="text-[13px] font-display font-bold text-[#3D2152] mb-1">Who's declining</h2>
        <p className="text-[11px] text-[#A0929E] mb-4">
          Eligible users who dismissed the banner, most-dismissed first. High counts mean the offer
          isn't landing.
        </p>
        {!data ? (
          <div className="text-[12px] text-[#A0929E] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
        ) : decliners.length === 0 ? (
          <p className="text-[11.5px] text-[#A0929E]">Nobody's actively declining right now.</p>
        ) : (
          <ul className="space-y-2">
            {decliners.map((o) => (
              <li key={o.uid ?? o.email} className="flex items-center gap-3 px-3 py-2.5 bg-[#FFF9F0] border border-[#3D2152]/[0.08] rounded-xl">
                <span className="text-[12.5px] font-display font-semibold text-[#3D2152] truncate flex-1">{o.email ?? o.uid ?? '—'}</span>
                <span className="text-[10.5px] text-[#A0929E]">last {formatDate(o.dismissedAt)}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#E8671A]/10 text-[#E8671A] text-[10.5px] font-display font-bold tabular-nums">
                  {o.dismissCount}×
                </span>
              </li>
            ))}
          </ul>
        )}
        {data && joined.length > 0 && (
          <p className="mt-3 text-[11px] text-[#0F8B47] font-display font-semibold">
            {joined.length} {joined.length === 1 ? 'user has' : 'users have'} joined.
          </p>
        )}
      </section>
    </div>
  );
}
