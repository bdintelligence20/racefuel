import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminProductInsights, type AdminProductInsights } from '../../services/firebase/admin';
import { StatCard } from './charts/StatCard';
import { BarChart } from './charts/BarChart';

export function ProductsTab() {
  const [data, setData] = useState<AdminProductInsights | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminProductInsights()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load.'); });
    return () => { cancelled = true; };
  }, []);

  if (err) return <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>;
  if (!data) return <div className="text-[#A0929E] text-[13px] flex items-center gap-2 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  const histogram = data.ratingHistogram.map((value, i) => ({ label: `${i + 1}★`, value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Products</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Ratings" value={data.ratingsCount} accent="warm" />
        <StatCard label="Custom products" value={data.customProductsCount} accent="plum" />
        <StatCard
          label="Avg rating"
          value={data.topRated.length > 0
            ? (data.topRated.reduce((s, t) => s + t.avgRating * t.count, 0) /
               data.topRated.reduce((s, t) => s + t.count, 0)).toFixed(2)
            : '—'}
          hint="all products"
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Rating distribution">
          <BarChart data={histogram} color="#F5A020" />
        </Panel>
        <Panel title="Top-rated products" subtitle="≥1 rating">
          {data.topRated.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-[#A0929E]">No ratings yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] font-sans">
                <thead className="text-left">
                  <tr className="text-[10px] font-display uppercase tracking-[0.14em] font-bold text-[#6B5A7A]">
                    <th className="py-2">Product ID</th>
                    <th className="py-2 text-center">N</th>
                    <th className="py-2 text-right">Avg</th>
                    <th className="py-2 text-right">Gut</th>
                    <th className="py-2 text-right">Taste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D2152]/[0.06]">
                  {data.topRated.slice(0, 12).map((t) => (
                    <tr key={t.productId}>
                      <td className="py-2 font-mono text-[10.5px] text-[#3D2152] truncate max-w-[200px]">{t.productId}</td>
                      <td className="py-2 text-center tabular-nums">{t.count}</td>
                      <td className="py-2 text-right tabular-nums font-semibold text-[#3D2152]">{t.avgRating.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums text-[#6B5A7A]">{t.avgGut.toFixed(2)}</td>
                      <td className="py-2 text-right tabular-nums text-[#6B5A7A]">{t.avgTaste.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Most-saved custom products" subtitle="across users">
        {data.topCustom.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[#A0929E]">No custom products yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] font-sans">
              <thead className="text-left">
                <tr className="text-[10px] font-display uppercase tracking-[0.14em] font-bold text-[#6B5A7A]">
                  <th className="py-2">Brand</th>
                  <th className="py-2">Name</th>
                  <th className="py-2">Category</th>
                  <th className="py-2 text-right">Saved by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D2152]/[0.06]">
                {data.topCustom.map((c, i) => (
                  <tr key={i}>
                    <td className="py-2 text-[11.5px] font-display font-semibold text-[#3D2152]">{c.brand}</td>
                    <td className="py-2 text-[11.5px] text-[#3D2152]">{c.name}</td>
                    <td className="py-2 text-[10.5px] text-[#A0929E]">{c.category ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
