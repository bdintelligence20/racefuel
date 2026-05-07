import { useEffect, useState } from 'react';
import { Loader2, Users, ShoppingBag, FileText, MessageSquare, Mail, Coins, Star, ChefHat, Megaphone } from 'lucide-react';
import { adminMetrics, type AdminMetrics } from '../../services/firebase/admin';
import { StatCard } from './charts/StatCard';
import { LineChart } from './charts/LineChart';

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function formatZAR(v: number): string {
  return `R${v.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`;
}

export function OverviewTab() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<AdminMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErr(null);
    adminMetrics({ rangeDays: range })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load metrics.'); });
    return () => { cancelled = true; };
  }, [range]);

  if (err) {
    return (
      <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">
        {err}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="text-[#A0929E] text-[13px] flex items-center gap-2 py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading metrics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Overview</h1>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Users" value={data.totals.usersCount} icon={Users} accent="warm" hint="signed in at least once" />
        <StatCard label="Revenue" value={formatZAR(data.totals.revenueZAR)} icon={Coins} accent="green" hint={`${data.totals.paidOrders} paid · ${range}d`} />
        <StatCard label="Orders" value={data.totals.ordersCount} icon={ShoppingBag} accent="plum" hint="all time" />
        <StatCard label="Saved plans" value={data.totals.plansCount} icon={FileText} accent="warm" hint="all time" />
        <StatCard label="Feedback" value={data.totals.feedbackCount} icon={MessageSquare} accent="rust" hint="all time" />
        <StatCard label="Early access" value={data.totals.earlyAccessCount} icon={Mail} accent="plum" />
        <StatCard label="Site feedback" value={data.totals.siteFeedbackCount} icon={Megaphone} accent="rust" hint="launch banner" />
        <StatCard label="Custom products" value={data.totals.customProductsCount} icon={ChefHat} accent="warm" />
        <StatCard label="Ratings" value={data.totals.ratingsCount} icon={Star} accent="rust" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Signups" subtitle={`Last ${range} days`}>
          <LineChart data={data.series.signupsByDay} color="#F5A020" />
        </ChartPanel>
        <ChartPanel title="Revenue (ZAR)" subtitle={`Last ${range} days`}>
          <LineChart data={data.series.revenueByDay} color="#0F8B47" formatValue={(v) => formatZAR(v)} />
        </ChartPanel>
        <ChartPanel title="Plans saved" subtitle={`Last ${range} days`}>
          <LineChart data={data.series.plansByDay} color="#3D2152" />
        </ChartPanel>
        <ChartPanel title="Feedback submissions" subtitle={`Last ${range} days`}>
          <LineChart data={data.series.feedbackByDay} color="#E8671A" />
        </ChartPanel>
      </div>

      <p className="text-[10.5px] text-[#A0929E] italic">
        Signups reflect users seen by instrumentation since 2026-05-07. Pre-existing users appear on
        their next sign-in.
      </p>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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
