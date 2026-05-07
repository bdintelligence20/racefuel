import { useEffect, useState } from 'react';
import { Loader2, Search, ChevronDown, Mail, Download } from 'lucide-react';
import { adminListSiteFeedback, type AdminSiteFeedbackRow } from '../../services/firebase/admin';

function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function csvEscape(v: string | number | undefined | null): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(rows: AdminSiteFeedbackRow[]) {
  const header = ['createdAt', 'email', 'displayName', 'message', 'path', 'referrer'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(r.createdAt ? new Date(r.createdAt).toISOString() : ''),
      csvEscape(r.email),
      csvEscape(r.displayName),
      csvEscape(r.message),
      csvEscape(r.path),
      csvEscape(r.referrer),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fuelcue-site-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SiteFeedbackTab() {
  const [rows, setRows] = useState<AdminSiteFeedbackRow[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
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
    adminListSiteFeedback({ search, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setCursor(res.nextCursor);
      })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load feedback.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminListSiteFeedback({ cursor, search, limit: 50 });
      setRows((prev) => [...prev, ...res.rows]);
      setCursor(res.nextCursor);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load more.');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Feedback</h1>
          <p className="text-[12px] text-[#A0929E] mt-0.5">{rows.length} loaded · launch banner submissions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#A0929E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search message / email"
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

      <div className="bg-white border border-[#3D2152]/10 rounded-2xl overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#A0929E] text-[12px] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-[#A0929E] text-[12px]">No feedback yet.</div>
        ) : (
          <ul className="divide-y divide-[#3D2152]/[0.06]">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-4 hover:bg-[#FFF5E8]/40 transition-colors">
                <div className="flex items-start gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {r.email ? (
                      <a href={`mailto:${r.email}`} className="text-[12px] font-display font-semibold text-[#3D2152] hover:text-[#F5A020] inline-flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 flex-shrink-0" /> {r.displayName ? `${r.displayName} · ` : ''}{r.email}
                      </a>
                    ) : (
                      <span className="text-[12px] text-[#A0929E] italic">Anonymous</span>
                    )}
                  </div>
                  {r.path && (
                    <span className="text-[10px] font-mono text-[#A0929E] bg-[#FFF5E8] px-1.5 py-0.5 rounded">{r.path}</span>
                  )}
                  <span className="text-[10.5px] text-[#A0929E] tabular-nums whitespace-nowrap">{formatDate(r.createdAt)}</span>
                </div>
                <div className="text-[12.5px] text-[#3D2152] whitespace-pre-wrap leading-relaxed">{r.message}</div>
                {r.referrer && (
                  <div className="mt-2 text-[10px] text-[#A0929E] truncate">via {r.referrer}</div>
                )}
              </li>
            ))}
          </ul>
        )}
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
