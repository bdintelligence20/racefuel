import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ChevronDown, Download, Mail } from 'lucide-react';
import { adminListEarlyAccess, type AdminEarlyAccessRow } from '../../services/firebase/admin';
import { PieChart } from './charts/PieChart';

function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function csvEscape(v: string | number | undefined | null): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCSV(rows: AdminEarlyAccessRow[]) {
  const header = ['createdAt', 'name', 'email', 'sports', 'notes', 'referrer', 'userAgent'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(r.createdAt ? new Date(r.createdAt).toISOString() : ''),
      csvEscape(r.name),
      csvEscape(r.email),
      csvEscape((r.sports ?? []).join('; ')),
      csvEscape(r.notes),
      csvEscape(r.referrer),
      csvEscape(r.userAgent),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fuelcue-early-access-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function EarlyAccessTab() {
  const [rows, setRows] = useState<AdminEarlyAccessRow[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [sportCounts, setSportCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows([]);
    setCursor(null);
    setLoading(true);
    setErr(null);
    adminListEarlyAccess({ search, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setCursor(res.nextCursor);
        setSportCounts(res.sportCounts);
      })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminListEarlyAccess({ cursor, search, limit: 50 });
      setRows((prev) => [...prev, ...res.rows]);
      setCursor(res.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load more.';
      setErr(msg);
    } finally {
      setLoadingMore(false);
    }
  };

  const sportData = useMemo(
    () =>
      Object.entries(sportCounts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value),
    [sportCounts]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Early access</h1>
          <p className="text-[12px] text-[#A0929E] mt-0.5">{rows.length} loaded</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#A0929E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / email / sport"
              className="pl-8 pr-3 py-2 rounded-xl border border-[#3D2152]/10 bg-white text-[12px] font-sans text-[#3D2152] placeholder:text-[#A0929E] focus:outline-none focus:border-[#F5A020]/50 w-64"
            />
          </div>
          <button
            onClick={() => downloadCSV(rows)}
            disabled={rows.length === 0}
            className="px-3 py-2 rounded-xl bg-[#3D2152] text-white text-[11.5px] font-display font-bold hover:bg-[#3D2152]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>
      )}

      {sportData.length > 0 && (
        <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)]">
          <h2 className="text-[13px] font-display font-bold text-[#3D2152] mb-2">Sport interests</h2>
          <PieChart data={sportData} height={220} />
        </div>
      )}

      <div className="bg-white border border-[#3D2152]/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] font-sans">
            <thead className="bg-[#FFF5E8]/60 text-left">
              <tr className="text-[10px] font-display uppercase tracking-[0.14em] font-bold text-[#6B5A7A]">
                <th className="px-4 py-3">Person</th>
                <th className="px-3 py-3">Sports</th>
                <th className="px-3 py-3">Referrer</th>
                <th className="px-3 py-3 text-right">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D2152]/[0.06]">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-[#A0929E] text-[12px]">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" /> Loading…
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-[#A0929E] text-[12px]">No signups match.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#FFF5E8]/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-[12.5px] font-display font-semibold text-[#3D2152]">{r.name ?? '—'}</div>
                    <a href={`mailto:${r.email}`} className="text-[10.5px] text-[#A0929E] hover:text-[#F5A020] inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {r.email}
                    </a>
                    {r.notes && <div className="text-[10.5px] text-[#6B5A7A] italic mt-1 line-clamp-2 max-w-md">{r.notes}</div>}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-[#3D2152]">{(r.sports ?? []).join(', ') || '—'}</td>
                  <td className="px-3 py-3 text-[10.5px] text-[#A0929E] truncate max-w-[200px]">{r.referrer ?? '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-[#6B5A7A]">{formatDate(r.createdAt)}</td>
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
    </div>
  );
}
