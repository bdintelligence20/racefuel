import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, ShoppingBag, AlertCircle, Filter } from 'lucide-react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { firestore } from '../services/firebase/config';
import { useAuth } from '../context/AuthContext';

const ADMIN_EMAIL = 'nicholasflemmer@gmail.com';

interface OrderRow {
  id: string;
  status: string;
  customer?: { firstName: string; lastName: string; email: string; phone?: string };
  amount?: { currency: string; total: number };
  lineItems?: Array<{ title: string; quantity: number; unitPrice: number }>;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  shopify?: { name?: string; orderNumber?: number; adminUrl?: string };
  stitch?: { paymentRequestId?: string; state?: string };
  failureReason?: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending payment', color: 'text-[#A0929E] bg-[#A0929E]/10' },
  paid: { label: 'Paid — placing', color: 'text-[#F5A020] bg-[#F5A020]/10' },
  placed: { label: 'Placed', color: 'text-[#0F8B47] bg-[#0F8B47]/10' },
  'paid-needs-fulfillment': { label: 'Paid — manual fulfill', color: 'text-[#E8671A] bg-[#E8671A]/10' },
  failed: { label: 'Failed', color: 'text-[#E8671A] bg-[#E8671A]/10' },
  cancelled: { label: 'Cancelled', color: 'text-[#6B5A7A] bg-[#6B5A7A]/10' },
};

const STATUS_FILTERS = ['all', 'placed', 'paid', 'pending', 'paid-needs-fulfillment', 'failed', 'cancelled'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export function AdminOrders() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) return;
    const q = query(collection(firestore, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<OrderRow, 'id'>) })));
      },
      (e) => setErr(e.message)
    );
    return () => unsub();
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <Frame>
        <Loader2 className="w-6 h-6 animate-spin text-[#F5A020]" />
      </Frame>
    );
  }
  if (!user) return <Gate message="Sign in to view the orders dashboard." />;
  if (user.email !== ADMIN_EMAIL) return <Gate message={`Admin only — signed in as ${user.email}`} />;

  const filtered = (orders ?? []).filter((o) => filter === 'all' || o.status === filter);

  return (
    <div className="min-h-screen bg-[#FFF9F0] py-12 px-4 font-sans">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px w-10 bg-[#F5A020]" />
          <span className="text-[10px] font-display uppercase tracking-[0.28em] font-bold text-[#F5A020]">
            Admin · Orders
          </span>
        </div>
        <h1 className="text-3xl font-display font-black text-[#3D2152] mb-8 tracking-tight leading-[1.05]">
          Orders dashboard
        </h1>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Filter className="w-4 h-4 text-[#A0929E] mr-1 self-center" />
          {STATUS_FILTERS.map((f) => {
            const count = orders?.filter((o) => f === 'all' || o.status === f).length ?? 0;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-[11.5px] font-display font-bold transition-all ${
                  filter === f
                    ? 'bg-[#3D2152] text-white shadow-[0_6px_18px_-8px_rgba(61,33,82,0.5)]'
                    : 'bg-white text-[#3D2152] border border-[#3D2152]/10 hover:border-[#F5A020]/40'
                }`}
              >
                {f === 'all' ? 'All' : (STATUS_LABEL[f]?.label ?? f)}{' '}
                <span className="opacity-60 ml-1 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        {err && (
          <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 mb-4 flex items-start gap-2 text-[12.5px] text-[#E8671A]">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>{err}</div>
          </div>
        )}

        {orders == null ? (
          <div className="text-[#A0929E] text-[13px] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading orders…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-12 text-center text-[13px] text-[#6B5A7A]">
            <ShoppingBag className="w-7 h-7 text-[#A0929E] mx-auto mb-3 opacity-50" />
            {orders.length === 0
              ? "No orders yet — once a customer pays via Stitch, they'll show up here in real time."
              : `No orders matching "${filter}".`}
          </div>
        ) : (
          <div className="bg-white border border-[#3D2152]/10 rounded-2xl overflow-hidden divide-y divide-[#3D2152]/[0.06]">
            {filtered.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order: o }: { order: OrderRow }) {
  const status = STATUS_LABEL[o.status] ?? { label: o.status, color: 'text-[#6B5A7A] bg-[#6B5A7A]/10' };
  const created = o.createdAt?.toDate?.();

  return (
    <div className="px-5 py-4 hover:bg-[#FFF5E8]/60 transition-colors">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className={`text-[10.5px] font-display uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-md ${status.color}`}>
              {status.label}
            </span>
            {o.shopify?.name && (
              <span className="text-[12.5px] font-display font-bold text-[#3D2152]">
                {o.shopify.name}
              </span>
            )}
            <span className="text-[11px] text-[#A0929E] tabular-nums">
              {created
                ? `${created.toLocaleDateString('en-ZA')} ${created.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`
                : '—'}
            </span>
          </div>
          <div className="text-[13px] text-[#3D2152]">
            {o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : '—'}
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
            R{(o.amount?.total ?? 0).toFixed(2)}
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

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center font-sans">
      {children}
    </div>
  );
}

function Gate({ message }: { message: string }) {
  return (
    <Frame>
      <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-8 max-w-sm text-center">
        <h1 className="text-lg font-display font-black text-[#3D2152] mb-2">Restricted</h1>
        <p className="text-[13px] text-[#6B5A7A]">{message}</p>
      </div>
    </Frame>
  );
}
