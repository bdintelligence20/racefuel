import { useEffect, useState } from 'react';
import { X, Loader2, ExternalLink } from 'lucide-react';
import { adminGetUser, type AdminUserDetail } from '../../services/firebase/admin';

type SectionId = 'profile' | 'plans' | 'feedback' | 'ratings' | 'custom' | 'orders';

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'plans', label: 'Plans' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'ratings', label: 'Ratings' },
  { id: 'custom', label: 'Custom products' },
  { id: 'orders', label: 'Orders' },
];

function formatDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatZAR(v: number): string {
  return `R${v.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
}

interface DrawerProps {
  uid: string;
  onClose: () => void;
}

export function UserDetailDrawer({ uid, onClose }: DrawerProps) {
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('profile');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setErr(null);
    adminGetUser({ uid })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setErr(e.message ?? 'Failed to load user.'); });
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end font-sans">
      <div className="absolute inset-0 bg-[#3D2152]/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl h-full bg-[#FFF9F0] overflow-y-auto shadow-[-8px_0_30px_-10px_rgba(61,33,82,0.25)]">
        <header className="sticky top-0 z-10 bg-[#FFF9F0]/95 backdrop-blur border-b border-[#3D2152]/10 px-5 py-3 flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FFF5E8] text-[#6B5A7A]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-display font-bold text-[#3D2152] truncate">
              {data?.meta?.displayName as string || (data?.meta?.email as string) || uid}
            </h2>
            {Boolean(data?.meta?.email) && (
              <div className="text-[11px] text-[#A0929E] truncate">{String(data?.meta?.email)}</div>
            )}
          </div>
        </header>

        {err && (
          <div className="m-5 bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">
            {err}
          </div>
        )}

        {!data && !err ? (
          <div className="px-5 py-10 text-[#A0929E] text-[12px] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : data && (
          <>
            <nav className="px-5 pt-3 flex gap-1 overflow-x-auto scrollbar-hide border-b border-[#3D2152]/10 sticky top-[3.4rem] bg-[#FFF9F0]/95 backdrop-blur z-10">
              {SECTIONS.map((s) => {
                const count = sectionCount(data, s.id);
                const active = section === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={`flex items-center gap-1 px-3 py-2 text-[11.5px] font-display font-semibold whitespace-nowrap border-b-2 transition-colors ${
                      active
                        ? 'border-[#F5A020] text-[#3D2152]'
                        : 'border-transparent text-[#6B5A7A] hover:text-[#3D2152]'
                    }`}
                  >
                    {s.label}
                    {count != null && (
                      <span className="text-[10px] tabular-nums opacity-60">({count})</span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-5">
              {section === 'profile' && <ProfileSection data={data} />}
              {section === 'plans' && <PlansSection data={data} />}
              {section === 'feedback' && <FeedbackSection data={data} />}
              {section === 'ratings' && <RatingsSection data={data} />}
              {section === 'custom' && <CustomSection data={data} />}
              {section === 'orders' && <OrdersSection data={data} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function sectionCount(data: AdminUserDetail, id: SectionId): number | null {
  switch (id) {
    case 'profile': return null;
    case 'plans': return data.plans.length;
    case 'feedback': return data.feedback.length;
    case 'ratings': return data.ratings.length;
    case 'custom': return data.customProducts.length;
    case 'orders': return data.orders.length;
  }
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 mb-3">
      {title && <h3 className="text-[10.5px] font-display uppercase tracking-[0.18em] font-bold text-[#F5A020] mb-2">{title}</h3>}
      {children}
    </div>
  );
}

function KeyVal({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#3D2152]/[0.05] last:border-b-0">
      <span className="text-[11px] text-[#A0929E]">{k}</span>
      <span className="text-[12px] font-display font-semibold text-[#3D2152] text-right truncate">{v}</span>
    </div>
  );
}

function ProfileSection({ data }: { data: AdminUserDetail }) {
  const m = data.meta ?? {};
  const p = data.profile ?? {};
  const s = data.strava ?? {};
  return (
    <>
      <Card title="Account">
        <KeyVal k="UID" v={<code className="text-[10.5px]">{data.uid}</code>} />
        <KeyVal k="Email" v={String(m.email ?? '—')} />
        <KeyVal k="Name" v={String(m.displayName ?? '—')} />
        <KeyVal k="Joined" v={formatDate(Number(m.createdAt) || null)} />
        <KeyVal k="Last login" v={formatDate(Number(m.lastLoginAt) || null)} />
        <KeyVal k="Sessions" v={String(m.loginCount ?? 0)} />
        <KeyVal k="Sign-in" v={String(m.lastSignInProvider ?? '—')} />
      </Card>
      <Card title="Athlete profile">
        <KeyVal k="Sport" v={String(p.sport ?? '—')} />
        <KeyVal k="Weight" v={`${p.weight ?? '—'} kg`} />
        <KeyVal k="Height" v={`${p.height ?? '—'} cm`} />
        <KeyVal k="FTP" v={`${p.ftp ?? '—'} W`} />
        <KeyVal k="Sweat rate" v={String(p.sweatRate ?? '—')} />
        <KeyVal k="Sweat Na" v={String(p.sweatSodiumBucket ?? '—')} />
        <KeyVal k="Gut tolerance" v={String(p.gutTolerance ?? '—')} />
        <KeyVal k="Carb target" v={p.carbTargetGPerHour ? `${p.carbTargetGPerHour} g/h` : 'Auto'} />
        <KeyVal k="Heat acclim." v={p.heatAcclimatised ? 'Yes' : p.earlySeasonHeat ? 'Early-season' : '—'} />
        <KeyVal k="Preferred brands" v={Array.isArray(p.preferredBrands) ? (p.preferredBrands as string[]).join(', ') || '—' : '—'} />
        <KeyVal k="Preferred categories" v={Array.isArray(p.preferredCategories) ? (p.preferredCategories as string[]).join(', ') || '—' : '—'} />
      </Card>
      {data.strava && (
        <Card title="Strava">
          <KeyVal k="Connected" v={formatDate(Number(s.connectedAt) || null)} />
          <KeyVal k="Athlete" v={String(s.athleteName ?? '—')} />
          <KeyVal k="Username" v={String(s.username ?? '—')} />
          <KeyVal k="City" v={String(s.city ?? '—')} />
          <KeyVal k="Last sync" v={formatDate(Number(s.lastSyncAt) || null)} />
          {s.disconnectedAt != null && (
            <KeyVal k="Disconnected" v={formatDate(Number(s.disconnectedAt) || null)} />
          )}
        </Card>
      )}
    </>
  );
}

function PlansSection({ data }: { data: AdminUserDetail }) {
  if (data.plans.length === 0) return <Empty msg="No plans saved." />;
  return (
    <div className="space-y-2">
      {data.plans.map((p) => (
        <div key={p.id} className="bg-white border border-[#3D2152]/10 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-display font-bold text-[#3D2152] truncate">
              {String(p.name ?? p.routeName ?? p.id)}
            </div>
            <div className="text-[10.5px] text-[#A0929E] tabular-nums mt-0.5">
              {Number(p.distanceKm ?? 0).toFixed(1)} km · {Number(p.elevationGain ?? 0).toFixed(0)} m gain · {String(p.estimatedTime ?? '—')}
            </div>
          </div>
          <div className="text-[10px] text-[#A0929E] tabular-nums whitespace-nowrap">
            {formatDate(Number(p.updatedAt) || Number(p.createdAt) || null)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedbackSection({ data }: { data: AdminUserDetail }) {
  if (data.feedback.length === 0) return <Empty msg="No feedback submitted." />;
  return (
    <div className="space-y-2">
      {data.feedback.map((f) => (
        <div key={f.id} className="bg-white border border-[#3D2152]/10 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12.5px] font-display font-bold text-[#3D2152]">{String(f.routeName ?? '—')}</span>
            <span className="text-[10.5px] text-[#A0929E] tabular-nums ml-auto">{formatDate(Number(f.createdAt) || null)}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] text-[#6B5A7A]">
            <span>Feel: <b className="text-[#3D2152]">{String(f.overallFeel ?? '—')}/5</b></span>
            <span>Execution: <b className="text-[#3D2152]">{String(f.executionQuality ?? '—')}/5</b></span>
            <span>Bonk: <b className="text-[#3D2152]">{Number(f.bonkLevel ?? 0) === 0 ? 'No' : Number(f.bonkLevel) >= 2 ? 'Severe' : 'Mild'}</b></span>
            <span>Gut: <b className="text-[#3D2152]">{String(f.gutIssues ?? 'none')}</b></span>
          </div>
          {Boolean(f.notes) && <div className="text-[11px] text-[#3D2152] mt-2 italic">{String(f.notes)}</div>}
        </div>
      ))}
    </div>
  );
}

function RatingsSection({ data }: { data: AdminUserDetail }) {
  if (data.ratings.length === 0) return <Empty msg="No product ratings." />;
  return (
    <div className="space-y-2">
      {data.ratings.map((r) => (
        <div key={r.id} className="bg-white border border-[#3D2152]/10 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-[10.5px] text-[#3D2152]">{String(r.productId ?? '—')}</code>
            <span className="text-[10.5px] text-[#A0929E] tabular-nums ml-auto">{formatDate(Number(r.createdAt) || null)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10.5px] text-[#6B5A7A]">
            <span>Overall: <b className="text-[#3D2152]">{String(r.rating ?? '—')}/5</b></span>
            <span>Gut: <b className="text-[#3D2152]">{String(r.gutComfort ?? '—')}/5</b></span>
            <span>Taste: <b className="text-[#3D2152]">{String(r.taste ?? '—')}/5</b></span>
          </div>
          {Boolean(r.notes) && <div className="text-[11px] text-[#3D2152] mt-2 italic">{String(r.notes)}</div>}
        </div>
      ))}
    </div>
  );
}

function CustomSection({ data }: { data: AdminUserDetail }) {
  if (data.customProducts.length === 0) return <Empty msg="No custom products." />;
  return (
    <div className="space-y-2">
      {data.customProducts.map((c) => (
        <div key={c.id} className="bg-white border border-[#3D2152]/10 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-display font-bold text-[#3D2152] truncate">
              {String(c.brand ?? '')} {String(c.name ?? '')}
            </div>
            <div className="text-[10.5px] text-[#A0929E] tabular-nums mt-0.5">
              {String(c.category ?? '—')} · {String(c.carbs ?? 0)}g carbs · {String(c.sodium ?? 0)}mg Na · {String(c.caffeine ?? 0)}mg caf
            </div>
          </div>
          <div className="text-[10.5px] text-[#0F8B47] tabular-nums">{formatZAR(Number(c.priceZAR ?? 0))}</div>
        </div>
      ))}
    </div>
  );
}

function OrdersSection({ data }: { data: AdminUserDetail }) {
  if (data.orders.length === 0) return <Empty msg="No orders for this email." />;
  return (
    <div className="space-y-2">
      {data.orders.map((o) => {
        const amount = (o.amount as { total?: number; currency?: string } | undefined)?.total ?? 0;
        const shopify = (o.shopify as { name?: string; adminUrl?: string } | undefined);
        const items = (o.lineItems as Array<{ title?: string; quantity?: number }> | undefined) ?? [];
        return (
          <div key={o.id} className="bg-white border border-[#3D2152]/10 rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10.5px] font-display uppercase tracking-[0.16em] font-bold px-1.5 py-0.5 rounded bg-[#3D2152]/10 text-[#3D2152]">
                  {String(o.status ?? 'unknown')}
                </span>
                {shopify?.name && <span className="text-[12.5px] font-display font-bold text-[#3D2152]">{shopify.name}</span>}
                <span className="text-[10.5px] text-[#A0929E] tabular-nums ml-auto">{formatDate(Number(o.createdAt) || null)}</span>
              </div>
              {items.length > 0 && (
                <div className="text-[10.5px] text-[#6B5A7A] truncate">
                  {items.map((li) => `${li.quantity}× ${li.title}`).join(' · ')}
                </div>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[13px] font-display font-black text-[#3D2152] tabular-nums">{formatZAR(amount)}</div>
              {shopify?.adminUrl && (
                <a
                  href={shopify.adminUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10.5px] text-[#3D2152] hover:text-[#F5A020] inline-flex items-center gap-1 mt-1"
                >
                  Shopify <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-[12px] text-[#A0929E] py-8 text-center">{msg}</div>;
}
