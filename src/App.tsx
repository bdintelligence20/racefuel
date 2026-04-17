import { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { NutritionPanel } from './components/NutritionPanel';
import { OnboardingModal } from './components/OnboardingModal';
import { ActionBar } from './components/ActionBar';
import { LandingPage } from './components/LandingPage';
import { Menu, X, Map, Package } from 'lucide-react';

const MapCanvas = lazy(() =>
  import('./components/MapCanvas').then((m) => ({ default: m.MapCanvas }))
);

function MapLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-warm border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

type MobileTab = 'map' | 'nutrition';

function MobileNav({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
}: {
  activeTab: MobileTab;
  setActiveTab: (t: MobileTab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
}) {
  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface border-b border-[var(--color-border)] safe-top">
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Hamburger */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-accent/[0.06] active:bg-accent/[0.08] transition-colors text-text-primary"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Tab switcher — centered */}
        <div className="flex-1 flex justify-center">
          <div className="flex bg-surfaceHighlight rounded-xl p-1 border border-[var(--color-border)]">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all text-sm font-display font-semibold ${activeTab === 'map' ? 'bg-surface text-warm shadow-sm' : 'text-text-muted'}`}
            >
              <Map className="w-4 h-4" />
              Map
            </button>
            <button
              onClick={() => setActiveTab('nutrition')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all text-sm font-display font-semibold ${activeTab === 'nutrition' ? 'bg-surface text-warm shadow-sm' : 'text-text-muted'}`}
            >
              <Package className="w-4 h-4" />
              Fuel
            </button>
          </div>
        </div>

        {/* Spacer to balance hamburger */}
        <div className="w-11 flex-shrink-0" />
      </div>
    </div>
  );
}

function AppContent() {
  const { onboardingComplete } = useApp();
  const [mobileTab, setMobileTab] = useState<MobileTab>('map');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex w-full h-[100dvh] bg-background overflow-hidden font-sans">
      <MobileNav
        activeTab={mobileTab}
        setActiveTab={setMobileTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div className={`
        fixed lg:relative z-40 h-full transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`flex-1 flex flex-col relative pt-mobile-nav lg:pt-0 ${mobileTab === 'map' ? 'flex' : 'hidden lg:flex'}`}>
        <ErrorBoundary>
          <Suspense fallback={<MapLoadingFallback />}>
            <MapCanvas />
          </Suspense>
        </ErrorBoundary>
        <ActionBar />
      </div>

      <div className={`
        fixed lg:relative left-0 right-0 lg:left-auto top-mobile-nav lg:top-0 bottom-0 z-30
        ${mobileTab === 'nutrition' ? 'block' : 'hidden lg:block'}
      `}>
        <ErrorBoundary>
          <NutritionPanel />
        </ErrorBoundary>
      </div>

      {!onboardingComplete && <OnboardingModal />}

      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            fontFamily: '"Montserrat", sans-serif',
            fontSize: '13px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(61, 33, 82, 0.08)',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          },
        }}
      />
    </div>
  );
}

/** Minimal pathname-based routing: / = landing, /app = app (auth-gated). */
function useRoute() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to: string) => {
    if (window.location.pathname === to) return;
    window.history.pushState({}, '', to);
    setPathname(to);
  };

  return { pathname, navigate };
}

function AuthGate() {
  const { user, loading } = useAuth();
  const { pathname, navigate } = useRoute();

  const goToApp = () => navigate('/app');

  // Redirect unknown paths to landing
  useEffect(() => {
    if (pathname !== '/' && pathname !== '/app' && pathname !== '') {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [pathname]);

  // Landing page is public — /
  if (pathname === '/' || pathname === '') {
    return (
      <>
        <LandingPage onEnterApp={goToApp} />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontFamily: '"Montserrat", sans-serif',
              fontSize: '13px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(61, 33, 82, 0.08)',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
            },
          }}
        />
      </>
    );
  }

  // Auth loading
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/logo.png" alt="fuelcue" className="h-16 w-auto mx-auto mb-4" />
          <div className="w-8 h-8 border-2 border-warm border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Not signed in — show auth screen
  if (!user) {
    return <AuthScreen />;
  }

  // Signed in — show app
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ErrorBoundary>
  );
}
