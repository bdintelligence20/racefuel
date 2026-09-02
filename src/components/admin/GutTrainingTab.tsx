import { useEffect, useState } from 'react';
import { Loader2, Search, ChevronDown, Download } from 'lucide-react';
import { adminListGutTrainingV2, type AdminGutTrainingV2Row } from '../../services/firebase/admin';

// Note: unlike its sibling tabs (EarlyAccessTab etc., which still use raw
// hex literals — a pre-existing debt flagged for a separate app-wide pass),
// this tab is written against the semantic color tokens
// (bg-surface/text-accent/...) so it renders in the current brand palette
// without needing that refactor first.

function formatDate(iso: string | number | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function csvEscape(v: string | number | undefined | null): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(rows: AdminGutTrainingV2Row[]) {
  const header = ['optedInAt', 'email', 'event', 'eventDate', 'durationHours', 'startGPerHour', 'targetGPerHour', 'currentGPerHour', 'weekNumber', 'sessionsCount', 'status'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(r.optedInAt),
      csvEscape(r.email),
      csvEscape(r.event?.name),
      csvEscape(r.event?.date),
      csvEscape(r.event?.durationHours),
      csvEscape(r.startGPerHour),
      csvEscape(r.targetGPerHour),
      csvEscape(r.currentGPerHour),
      csvEscape(r.weekNumber),
      csvEscape(r.sessionsCount),
      csvEscape(r.status),
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fuelcue-gut-training-v2-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusBadge(status: string | null) {
  if (status === 'completed') return { label: 'Trained', className: 'bg-accent/10 text-accent' };
  if (status === 'paused') return { label: 'Paused', className: 'bg-alert-amberTint text-alert-amber' };
  return { label: 'Active', className: 'bg-surfaceHighlight text-text-secondary' };
}

export function GutTrainingTab() {
  const [rows, setRows] = useState<AdminGutTrainingV2Row[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
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
    adminListGutTrainingV2({ search, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setCursor(res.nextCursor);
        setTotal(res.total);
      })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminListGutTrainingV2({ cursor, search, limit: 50 });
      setRows((prev) => [...prev, ...res.rows]);
      setCursor(res.nextCursor);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load more.');
    } finally {
      setLoadingMore(false);
    }
  };

  const trainedCount = rows.filter((r) => r.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-black text-text-primary tracking-tight">Gut Training (beta)</h1>
          <p className="text-[12px] text-text-muted mt-0.5">{total} opted in · {trainedCount} trained</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email / event"
              className="pl-8 pr-3 py-2 rounded-xl border border-[var(--color-border)] bg-surface text-[12px] font-sans text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 w-64"
            />
          </div>
          <button
            onClick={() => downloadCSV(rows)}
            disabled={rows.length === 0}
            className="px-3 py-2 rounded-xl bg-accent text-background text-[11.5px] font-display font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-alert-brickTint border border-alert-brick/20 rounded-xl px-4 py-3 text-[12.5px] text-alert-brick">{err}</div>
      )}

      <div className="bg-surface border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] font-sans">
            <thead className="bg-surfaceHighlight text-left">
              <tr className="text-[10px] font-display uppercase tracking-[0.14em] font-bold text-text-secondary">
                <th className="px-4 py-3">Athlete</th>
                <th className="px-3 py-3">Event</th>
                <th className="px-3 py-3">g/hr</th>
                <th className="px-3 py-3">Week</th>
                <th className="px-3 py-3">Sessions</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Opted in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted text-[12px]">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" /> Loading…
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted text-[12px]">No one has opted in yet.</td></tr>
              ) : rows.map((r) => {
                const badge = statusBadge(r.status);
                return (
                  <tr key={r.uid} className="hover:bg-surfaceHighlight/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[12.5px] font-display font-semibold text-text-primary">{r.email || r.uid}</div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-text-secondary">
                      {r.event?.name ?? '—'}
                      {r.event?.durationHours ? <span className="text-text-muted"> · {r.event.durationHours}h</span> : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-text-primary">
                      {r.currentGPerHour ?? '—'}{r.targetGPerHour ? <span className="text-text-muted"> / {r.targetGPerHour}</span> : null}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">{r.weekNumber ?? '—'}</td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">{r.sessionsCount}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-display font-bold ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-text-muted">{formatDate(r.optedInAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {cursor && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full px-4 py-3 text-[11.5px] font-display font-bold text-text-primary hover:bg-surfaceHighlight/60 border-t border-[var(--color-border)] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
