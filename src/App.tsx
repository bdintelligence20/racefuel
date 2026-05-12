import { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MapProvider } from './context/MapContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { NutritionPanel } from './components/NutritionPanel';
import { OnboardingModal } from './components/OnboardingModal';
import { ActionBar } from './components/ActionBar';
import { LandingPage } from './components/LandingPage';
import { AutoGenProgress } from './components/AutoGenProgress';
import { PlanStrategyModal } from './components/PlanStrategyModal';
import { CheckoutTest } from './components/CheckoutTest';
import { PaymentCallback } from './components/PaymentCallback';
import { AdminLayout } from './components/admin/AdminLayout';
import { SiteFeedbackBanner } from './components/SiteFeedbackBanner';
import { PrivacyPolicy } from './components/legal/PrivacyPolicy';
import { TermsOfService } from './components/legal/TermsOfService';
import { CookiesPolicy } from './components/legal/CookiesPolicy';
import { ShippingReturns } from './components/legal/ShippingReturns';
import { BlogIndex } from './components/blog/BlogIndex';
import { BlogPost } from './components/blog/BlogPost';
import { MobilePreview } from './dev/MobilePreview';
import { Menu, X } from 'lucide-react';

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

function MobileNav({
  sidebarOpen,
  setSidebarOpen,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (o: boolean) => void;
}) {
  return (
    <div className="lg:hidden fixed left-0 right-0 z-50 bg-surface border-b border-[var(--color-border)] safe-top" style={{ top: 'var(--banner-h, 0px)' }}>
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Hamburger */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-accent/[0.06] active:bg-accent/[0.08] transition-colors text-text-primary"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Logo — pushed to the right by `ml-auto` now that the Map/Fuel
            tab switcher is gone, and bumped to h-9 since there's room. */}
        <img
          src="/logo.png"
          alt="fuelcue"
          className="h-9 w-auto object-contain flex-shrink-0 ml-auto"
        />
      </div>
    </div>
  );
}

function AppContent() {
  const { onboardingComplete, autoGenStatus, pendingPlan, applyPendingPlan, regeneratePendingPlan, dismissPendingPlan } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="flex w-full bg-background overflow-hidden font-sans" style={{ height: 'calc(100dvh - var(--banner-h, 0px))' }}>
      <MobileNav
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

      {/* Mobile-only floating ActionBar — anchored to the bottom of the
          viewport via `position: fixed`. This deliberately takes it OUT of
          both column layouts so nothing inside MapCanvas (chips, strip,
          elevation) and nothing inside NutritionPanel can affect its
          width / visibility. Single render across both tabs. Desktop
          (lg+) has its own ActionBar copy inside the Map column. Hidden
          while the sidebar drawer is open so its z-40 doesn't cover the
          sidebar's footer (sign-out / theme / reset). */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-bottom-zero pointer-events-auto ${sidebarOpen ? 'hidden' : ''}`}>
        <ActionBar />
      </div>

      {/* Map column. pb-mobile-action-bar leaves room for the fixed
          ActionBar above so the elevation panel + strip aren't covered.
          On mobile this is the *only* column — the Fuel tab and its tab
          switcher were removed once the map view absorbed product browsing
          (fuel strip), product details (tap markers / strip cards), and
          kit access (View Kit in ActionBar). */}
      <div className="flex-1 min-w-0 flex flex-col relative overflow-x-hidden pt-mobile-nav lg:pt-0 pb-mobile-action-bar lg:pb-0">
        <ErrorBoundary>
          <Suspense fallback={<MapLoadingFallback />}>
            <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              <MapCanvas />
            </div>
          </Suspense>
        </ErrorBoundary>
        {/* Desktop-only ActionBar inside the column. */}
        <div className="hidden lg:block flex-shrink-0">
          <ActionBar />
        </div>
      </div>

      {/* Fuel column — desktop only. Mobile gets all the same affordances
          via the on-map fuel strip + ActionBar's View Kit button. */}
      <div className="hidden lg:flex lg:relative lg:top-0 lg:left-auto bottom-0 z-30 flex-col">
        <ErrorBoundary>
          <div className="flex-1 min-h-0 overflow-hidden">
            <NutritionPanel />
          </div>
        </ErrorBoundary>
      </div>

      {!onboardingComplete && <OnboardingModal />}

      <AutoGenProgress
        open={autoGenStatus !== null}
        phase={autoGenStatus?.phase ?? ''}
      />

      <PlanStrategyModal
        plan={pendingPlan?.plan ?? null}
        context={pendingPlan?.context ?? null}
        onApply={applyPendingPlan}
        onRegenerate={regeneratePendingPlan}
        onClose={dismissPendingPlan}
      />


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

  // SPA navigation → gtag page_view. Initial load is tracked by the inline
  // gtag('config') call; this picks up history.pushState route changes.
  useEffect(() => {
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== 'function') return;
    gtag('event', 'page_view', {
      page_path: pathname + window.location.search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  // If a Strava OAuth callback (?code=... or ?error=...) lands at '/', push it to /app.
  useEffect(() => {
    if (pathname === '/' || pathname === '') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('code') || params.has('error')) {
        window.history.replaceState({}, '', `/app${window.location.search}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    }
  }, [pathname]);

  // Redirect unknown paths to landing. /blog is a public CMS-backed surface
  // (Strapi); any /blog/<slug> path is treated as known so the BlogPost
  // component can fetch and render or fall back to its own 'not-found' state.
  const KNOWN_PATHS = ['/', '/app', '/checkout-test', '/payment-callback', '/admin', '/admin/orders', '/dev/preview', '/privacy', '/terms', '/cookies', '/shipping-returns', '/blog', ''];
  useEffect(() => {
    const isBlogPath = pathname === '/blog' || pathname.startsWith('/blog/');
    if (!KNOWN_PATHS.includes(pathname) && !isBlogPath) {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Back-compat: /admin/orders → /admin?tab=orders
  useEffect(() => {
    if (pathname === '/admin/orders') {
      window.history.replaceState({}, '', '/admin?tab=orders');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [pathname]);

  // Dev-only mobile preview harness — renders the SPA inside a phone-sized
  // iframe with a device frame so we can iterate on mobile UX without
  // deploy/reload cycles. See src/dev/MobilePreview.tsx.
  if (import.meta.env.DEV && pathname === '/dev/preview') {
    return <MobilePreview />;
  }

  // Public legal pages — must be reachable without sign-in so they can be
  // linked from the OAuth consent screen, Stitch checkout, and email
  // footers. Render before the auth gate.
  if (pathname === '/privacy') return <PrivacyPolicy />;
  if (pathname === '/terms') return <TermsOfService />;
  if (pathname === '/cookies') return <CookiesPolicy />;
  if (pathname === '/shipping-returns') return <ShippingReturns />;

  // Public blog — list at /blog, detail at /blog/:slug. Rendered before the
  // auth gate so posts can be linked and shared without sign-in.
  if (pathname === '/blog') return <BlogIndex />;
  if (pathname.startsWith('/blog/')) {
    const slug = pathname.slice('/blog/'.length);
    if (slug.length > 0) return <BlogPost slug={decodeURIComponent(slug)} />;
  }

  // Landing page is public — /
  if (pathname === '/' || pathname === '') {
    return (
      <>
        <LandingPage onOpenApp={() => navigate('/app')} />
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
      <div className="fixed left-0 right-0 bottom-0 flex items-center justify-center bg-background" style={{ top: 'var(--banner-h, 0px)' }}>
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

  // Signed-in routes
  if (pathname === '/checkout-test') return <CheckoutTest />;
  if (pathname === '/payment-callback') return <PaymentCallback />;
  if (pathname === '/admin' || pathname === '/admin/orders') return <AdminLayout />;

  // Default signed-in surface — the main app
  return (
    <AppProvider>
      <MapProvider>
        <AppContent />
      </MapProvider>
    </AppProvider>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SiteFeedbackBanner />
        <AuthGate />
      </AuthProvider>
    </ErrorBoundary>
  );
}
