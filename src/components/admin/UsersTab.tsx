import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ChevronDown } from 'lucide-react';
import { adminListUsers, type AdminUserRow } from '../../services/firebase/admin';
import { UserDetailDrawer } from './UserDetailDrawer';

type SortBy = 'lastLoginAt' | 'createdAt' | 'loginCount';

const SORT_LABEL: Record<SortBy, string> = {
  lastLoginAt: 'Last login',
  createdAt: 'Joined',
  loginCount: 'Sessions',
};

function formatDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatZAR(v: number): string {
  return `R${v.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

export function UsersTab() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('lastLoginAt');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeUid, setActiveUid] = useState<string | null>(null);

  // Reset on search / sort change.
  useEffect(() => {
    let cancelled = false;
    setRows([]);
    setCursor(null);
    setLoading(true);
    setErr(null);
    adminListUsers({ search, sortBy, limit: 25 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.users);
        setCursor(res.nextCursor);
      })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load users.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, sortBy]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminListUsers({ cursor, search, sortBy, limit: 25 });
      setRows((prev) => [...prev, ...res.users]);
      setCursor(res.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load more.';
      setErr(msg);
    } finally {
      setLoadingMore(false);
    }
  };

  const totalRevenueShown = useMemo(
    () => rows.reduce((sum, r) => sum + r.revenueZAR, 0),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Users</h1>
          <p className="text-[12px] text-[#A0929E] mt-0.5">
            {rows.length} loaded · {formatZAR(totalRevenueShown)} revenue (visible)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#A0929E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email or name"
              className="pl-8 pr-3 py-2 rounded-xl border border-[#3D2152]/10 bg-white text-[12px] font-sans text-[#3D2152] placeholder:text-[#A0929E] focus:outline-none focus:border-[#F5A020]/50 w-56"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-white text-[12px] font-sans text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
          >
            {Object.entries(SORT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>Sort: {l}</option>
            ))}
          </select>
        </div>
      </div>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">
          {err}
        </div>
      )}

      <div className="bg-white border border-[#3D2152]/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] font-sans">
            <thead className="bg-[#FFF5E8]/60 text-left">
              <tr className="text-[10px] font-display uppercase tracking-[0.14em] font-bold text-[#6B5A7A]">
                <th className="px-4 py-3">User</th>
                <th className="px-3 py-3 text-center">Plans</th>
                <th className="px-3 py-3 text-center">Feedback</th>
                <th className="px-3 py-3 text-center">Custom</th>
                <th className="px-3 py-3 text-center">Orders</th>
                <th className="px-3 py-3 text-right">Revenue</th>
                <th className="px-3 py-3 text-right">Joined</th>
                <th className="px-3 py-3 text-right">Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D2152]/[0.06]">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[#A0929E] text-[12px]">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" /> Loading users…
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#A0929E] text-[12px]">
                  No users match.
                </td></tr>
              ) : rows.map((u) => (
                <tr
                  key={u.uid}
                  className="hover:bg-[#FFF5E8]/40 cursor-pointer transition-colors"
                  onClick={() => setActiveUid(u.uid)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[#F5A020]/10 flex items-center justify-center text-[#F5A020] text-[10px] font-display font-bold flex-shrink-0">
                          {(u.displayName || u.email || '?')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-display font-semibold text-[#3D2152] truncate">
                          {u.displayName || u.email || u.uid}
                        </div>
                        <div className="text-[10.5px] text-[#A0929E] truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">{u.plans}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{u.feedback}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{u.customProducts}</td>
                  <td className="px-3 py-3 text-center tabular-nums">{u.ordersCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-[#0F8B47]">
                    {u.revenueZAR > 0 ? formatZAR(u.revenueZAR) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#6B5A7A]">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#6B5A7A]">{formatDate(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full px-4 py-3 text-[11.5px] font-display font-bold text-[#3D2152] hover:bg-[#FFF5E8]/60 border-t border-[#3D2152]/[0.06] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>

      {activeUid && <UserDetailDrawer uid={activeUid} onClose={() => setActiveUid(null)} />}
    </div>
  );
}
