import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminActivityInsights, type AdminActivityInsights } from '../../services/firebase/admin';
import { StatCard } from './charts/StatCard';
import { BarChart } from './charts/BarChart';
import { PieChart } from './charts/PieChart';

const RANGES = [30, 90, 180, 365] as const;
type Range = (typeof RANGES)[number];

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}
function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
}

export function ActivityTab() {
  const [range, setRange] = useState<Range>(90);
  const [data, setData] = useState<AdminActivityInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErr(null);
    adminActivityInsights({ rangeDays: range })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load activity insights.'); });
    return () => { cancelled = true; };
  }, [range]);

  if (err) {
    return <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>;
  }
  if (!data) {
    return <div className="text-[#A0929E] text-[13px] flex items-center gap-2 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  }

  const gutData = Object.entries(data.gutBuckets).map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Activity</h1>
        <div className="flex gap-1 bg-white border border-[#3D2152]/10 rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-display font-bold transition-colors ${
                range === r ? 'bg-[#3D2152] text-white' : 'text-[#6B5A7A] hover:text-[#3D2152]'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Feedback" value={data.feedbackCount} accent="warm" />
        <StatCard label="Avg feel" value={data.avgOverallFeel.toFixed(2)} hint="out of 5" accent="green" />
        <StatCard label="Bonk rate" value={pct(data.bonkRateAny)} hint={`severe ${pct(data.bonkRateSevere)}`} accent="rust" />
        <StatCard label="Avg execution" value={data.avgExecutionQuality.toFixed(2)} hint="out of 5" accent="plum" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Gut issues distribution" subtitle={`${data.feedbackCount} feedback entries`}>
          <PieChart data={gutData} />
        </Panel>
        <Panel title="Carb adherence" subtitle="planned vs actual (g)">
          <BarChart
            data={[
              { label: 'Planned', value: Math.round(data.plannedCarbsAvg), color: '#3D2152' },
              { label: 'Actual', value: Math.round(data.actualCarbsAvg), color: '#F5A020' },
            ]}
            height={240}
          />
          <p className="text-[10.5px] text-[#A0929E] italic mt-2">
            Actual carbs reported in {data.actualCarbsCount} of {data.feedbackCount} feedback entries.
          </p>
        </Panel>
      </div>

      <Panel title="Top routes (by saved plans)">
        {data.topRoutes.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[#A0929E]">No plans saved yet.</div>
        ) : (
          <BarChart
            data={data.topRoutes.slice(0, 10).map((r) => ({ label: r.routeName, value: r.count }))}
            color="#0F8B47"
            horizontal
            height={Math.max(180, 44 * Math.min(10, data.topRoutes.length))}
          />
        )}
      </Panel>

      <Panel title="Recent feedback" subtitle="latest 25">
        <div className="space-y-2">
          {data.recent.length === 0 ? (
            <div className="text-[12px] text-[#A0929E] py-4 text-center">No feedback yet.</div>
          ) : data.recent.map((f) => (
            <div key={String(f.id)} className="bg-[#FFF9F0] border border-[#3D2152]/[0.06] rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[12px] font-display font-bold text-[#3D2152]">{String(f.routeName ?? '—')}</span>
                <span className="text-[10.5px] text-[#A0929E] tabular-nums ml-auto">{formatDate(Number(f.createdAt) || null)}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] text-[#6B5A7A]">
                <span>Feel: <b className="text-[#3D2152]">{String(f.overallFeel ?? '—')}/5</b></span>
                <span>Exec: <b className="text-[#3D2152]">{String(f.executionQuality ?? '—')}/5</b></span>
                <span>Bonk: <b className="text-[#3D2152]">{Number(f.bonkLevel ?? 0) === 0 ? 'No' : Number(f.bonkLevel) >= 2 ? 'Severe' : 'Mild'}</b></span>
                <span>Gut: <b className="text-[#3D2152]">{String(f.gutIssues ?? 'none')}</b></span>
              </div>
              {Boolean(f.notes) && <div className="text-[10.5px] text-[#3D2152] mt-1.5 italic line-clamp-2">{String(f.notes)}</div>}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)]">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[13px] font-display font-bold text-[#3D2152]">{title}</h2>
        {subtitle && <span className="text-[10px] text-[#A0929E]">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}
