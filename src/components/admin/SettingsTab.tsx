import { useEffect, useState } from 'react';
import { Loader2, UserPlus, X, Lock } from 'lucide-react';
import {
  adminListAdmins,
  adminAddAdmin,
  adminRemoveAdmin,
  type AdminListAdminsResult,
} from '../../services/firebase/admin';

function formatDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SettingsTab() {
  const [data, setData] = useState<AdminListAdminsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  const refresh = async () => {
    try {
      const res = await adminListAdmins();
      setData(res);
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load admins.');
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
      await adminAddAdmin({ email });
      setNewEmail('');
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add admin.');
    } finally {
      setAdding(false);
    }
  };

  const onRemove = async (email: string) => {
    if (!confirm(`Remove ${email} from admins?`)) return;
    setErr(null);
    try {
      await adminRemoveAdmin({ email });
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to remove admin.');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Settings</h1>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>
      )}

      <section className="bg-white border border-[#3D2152]/10 rounded-2xl p-5 shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)]">
        <h2 className="text-[13px] font-display font-bold text-[#3D2152] mb-1">Admin allowlist</h2>
        <p className="text-[11px] text-[#A0929E] mb-4">
          Only these accounts can sign in to <code>/admin</code>. The seed admin can't be removed.
        </p>

        {!data ? (
          <div className="text-[12px] text-[#A0929E] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
        ) : (
          <ul className="space-y-2">
            <li className="flex items-center gap-3 px-3 py-2.5 bg-[#FFF5E8] border border-[#F5A020]/20 rounded-xl">
              <Lock className="w-3.5 h-3.5 text-[#F5A020]" />
              <span className="text-[12.5px] font-display font-semibold text-[#3D2152]">{data.seedAdmin}</span>
              <span className="text-[10px] text-[#F5A020] uppercase tracking-[0.16em] font-bold ml-auto">Seed</span>
            </li>
            {data.admins.map((a) => (
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
            {data.admins.length === 0 && (
              <li className="text-[11.5px] text-[#A0929E] py-2">No additional admins yet.</li>
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
            Add admin
          </button>
        </form>
      </section>
    </div>
  );
}
