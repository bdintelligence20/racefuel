import { useEffect, useMemo, useState } from 'react';
import { Loader2, ExternalLink, ShoppingBag, AlertCircle, Search, ChevronDown } from 'lucide-react';
import { adminListOrders, type AdminOrderRow } from '../../services/firebase/admin';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending payment', color: 'text-[#A0929E] bg-[#A0929E]/10' },
  paid: { label: 'Paid — placing', color: 'text-[#F5A020] bg-[#F5A020]/10' },
  placed: { label: 'Placed', color: 'text-[#0F8B47] bg-[#0F8B47]/10' },
  'paid-needs-fulfillment': { label: 'Paid — manual fulfill', color: 'text-[#E8671A] bg-[#E8671A]/10' },
  failed: { label: 'Failed', color: 'text-[#E8671A] bg-[#E8671A]/10' },
  cancelled: { label: 'Cancelled', color: 'text-[#6B5A7A] bg-[#6B5A7A]/10' },
};

const STATUS_FILTERS = ['all', 'placed', 'paid', 'pending', 'paid-needs-fulfillment', 'failed', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function formatZAR(v: number): string {
  return `R${v.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
}

export function OrdersTab() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOrders([]);
    setCursor(null);
    setLoading(true);
    setErr(null);
    adminListOrders({ status: filter, search, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setOrders(res.orders);
        setCursor(res.nextCursor);
      })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load orders.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, search]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await adminListOrders({ status: filter, search, cursor, limit: 50 });
      setOrders((prev) => [...prev, ...res.orders]);
      setCursor(res.nextCursor);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load more.';
      setErr(msg);
    } finally {
      setLoadingMore(false);
    }
  };

  const stats = useMemo(() => {
    let revenue = 0;
    let paidCount = 0;
    for (const o of orders) {
      if (['paid', 'placed', 'paid-needs-fulfillment'].includes(o.status ?? '')) {
        revenue += Number(o.amount?.total ?? 0);
        paidCount += 1;
      }
    }
    return { revenue, paidCount };
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Orders</h1>
          <p className="text-[12px] text-[#A0929E] mt-0.5">
            {orders.length} loaded · {stats.paidCount} paid · {formatZAR(stats.revenue)} revenue (visible)
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#A0929E] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer / Shopify ref"
            className="pl-8 pr-3 py-2 rounded-xl border border-[#3D2152]/10 bg-white text-[12px] font-sans text-[#3D2152] placeholder:text-[#A0929E] focus:outline-none focus:border-[#F5A020]/50 w-64"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-[11.5px] font-display font-bold transition-all ${
              filter === f
                ? 'bg-[#3D2152] text-white shadow-[0_6px_18px_-8px_rgba(61,33,82,0.5)]'
                : 'bg-white text-[#3D2152] border border-[#3D2152]/10 hover:border-[#F5A020]/40'
            }`}
          >
            {f === 'all' ? 'All' : (STATUS_LABEL[f]?.label ?? f)}
          </button>
        ))}
      </div>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 flex items-start gap-2 text-[12.5px] text-[#E8671A]">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{err}</div>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="text-[#A0929E] text-[13px] flex items-center gap-2 py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-12 text-center text-[13px] text-[#6B5A7A]">
          <ShoppingBag className="w-7 h-7 text-[#A0929E] mx-auto mb-3 opacity-50" />
          No orders match these filters.
        </div>
      ) : (
        <div className="bg-white border border-[#3D2152]/10 rounded-2xl overflow-hidden divide-y divide-[#3D2152]/[0.06]">
          {orders.map((o) => <OrderRow key={o.id} order={o} />)}
          {cursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full px-4 py-3 text-[11.5px] font-display font-bold text-[#3D2152] hover:bg-[#FFF5E8]/60 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60"
            >
              {loadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order: o }: { order: AdminOrderRow }) {
  const status = STATUS_LABEL[o.status ?? ''] ?? { label: o.status ?? 'unknown', color: 'text-[#6B5A7A] bg-[#6B5A7A]/10' };
  const created = o.createdAt ? new Date(o.createdAt) : null;

  return (
    <div className="px-5 py-4 hover:bg-[#FFF5E8]/60 transition-colors">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className={`text-[10.5px] font-display uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-md ${status.color}`}>
              {status.label}
            </span>
            {o.shopify?.name && (
              <span className="text-[12.5px] font-display font-bold text-[#3D2152]">{o.shopify.name}</span>
            )}
            <span className="text-[11px] text-[#A0929E] tabular-nums">
              {created ? `${created.toLocaleDateString('en-ZA')} ${created.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}` : '—'}
            </span>
          </div>
          <div className="text-[13px] text-[#3D2152]">
            {o.customer ? `${o.customer.firstName ?? ''} ${o.customer.lastName ?? ''}`.trim() : '—'}
            <span className="text-[#A0929E]"> · {o.customer?.email}</span>
          </div>
          {o.lineItems && o.lineItems.length > 0 && (
            <div className="text-[11.5px] text-[#6B5A7A] mt-1 truncate">
              {o.lineItems.map((li) => `${li.quantity}× ${li.title}`).join(' · ')}
            </div>
          )}
          {o.failureReason && (
            <div className="text-[11px] text-[#E8671A] mt-1">{o.failureReason}</div>
          )}
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="text-[14px] font-display font-black text-[#3D2152] tabular-nums">
            {formatZAR(Number(o.amount?.total ?? 0))}
          </div>
          <div className="text-[10px] text-[#A0929E] tabular-nums">{o.amount?.currency ?? 'ZAR'}</div>
          {o.shopify?.adminUrl && (
            <a
              href={o.shopify.adminUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-[#3D2152] hover:text-[#F5A020] transition-colors"
            >
              Shopify <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
