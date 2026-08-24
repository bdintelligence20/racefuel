import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Users, ShoppingBag, Activity, Mail, Package, Settings as SettingsIcon, MessageSquare, Tag, FileText, Loader2, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdminGate } from '../../hooks/useAdminGate';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';
import { OrdersTab } from './OrdersTab';
import { ActivityTab } from './ActivityTab';
import { EarlyAccessTab } from './EarlyAccessTab';
import { GutTrainingTab } from './GutTrainingTab';
import { ProductsTab } from './ProductsTab';
import { SettingsTab } from './SettingsTab';
import { SiteFeedbackTab } from './SiteFeedbackTab';
import { CouponsTab } from './CouponsTab';
import { BlogTab } from './BlogTab';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
  { id: 'early-access', label: 'Early Access', icon: Mail },
  { id: 'gut-training', label: 'Gut Training', icon: TrendingUp },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'coupons', label: 'Coupons', icon: Tag },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const;

type TabId = (typeof TABS)[number]['id'];

function readTabFromUrl(): TabId {
  if (typeof window === 'undefined') return 'overview';
  const t = new URLSearchParams(window.location.search).get('tab') ?? '';
  return TABS.some((x) => x.id === t) ? (t as TabId) : 'overview';
}

export function AdminLayout() {
  const { user, loading: authLoading } = useAuth();
  const { loading: gateLoading, isAdmin } = useAdminGate();
  const [tab, setTab] = useState<TabId>(readTabFromUrl);

  useEffect(() => {
    const onPop = () => setTab(readTabFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigateTab = (id: TabId) => {
    const url = `/admin?tab=${id}`;
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState({}, '', url);
    }
    setTab(id);
  };

  const content = useMemo(() => {
    switch (tab) {
      case 'overview': return <OverviewTab />;
      case 'users': return <UsersTab />;
      case 'orders': return <OrdersTab />;
      case 'activity': return <ActivityTab />;
      case 'feedback': return <SiteFeedbackTab />;
      case 'early-access': return <EarlyAccessTab />;
      case 'gut-training': return <GutTrainingTab />;
      case 'products': return <ProductsTab />;
      case 'blog': return <BlogTab />;
      case 'coupons': return <CouponsTab />;
      case 'settings': return <SettingsTab />;
    }
  }, [tab]);

  if (authLoading || gateLoading) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center font-sans">
        <Loader2 className="w-6 h-6 animate-spin text-[#F5A020]" />
      </div>
    );
  }
  if (!user) {
    return <Gate message="Sign in to view the admin dashboard." />;
  }
  if (!isAdmin) {
    return <Gate message={`Admin only — signed in as ${user.email}`} />;
  }

  return (
    <div className="min-h-screen bg-[#FFF9F0] font-sans">
      <header className="bg-white border-b border-[#3D2152]/10 sticky z-30" style={{ top: 'var(--banner-h, 0px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <a
            href="/app"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#FFF5E8] text-[#6B5A7A] transition-colors"
            title="Back to app"
            aria-label="Back to app"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <img src="/logo.png" alt="fuelcue" className="h-7 w-auto" />
          <span className="text-[10px] font-display uppercase tracking-[0.28em] font-bold text-[#F5A020] hidden sm:block">
            Admin
          </span>
          <div className="ml-auto text-[11px] text-[#A0929E] truncate hidden md:block">
            {user.email}
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => navigateTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-display font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-[#F5A020] text-[#3D2152]'
                    : 'border-transparent text-[#6B5A7A] hover:text-[#3D2152]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {content}
      </main>
    </div>
  );
}

function Gate({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center font-sans">
      <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-8 max-w-sm text-center">
        <h1 className="text-lg font-display font-black text-[#3D2152] mb-2">Restricted</h1>
        <p className="text-[13px] text-[#6B5A7A] mb-4">{message}</p>
        <a
          href="/app"
          className="inline-block px-4 py-2 rounded-lg bg-[#3D2152] text-white text-[12px] font-display font-bold hover:bg-[#3D2152]/90 transition-colors"
        >
          Back to app
        </a>
      </div>
    </div>
  );
}
