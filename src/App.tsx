import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { MapCanvas } from './components/MapCanvas';
import { NutritionPanel } from './components/NutritionPanel';
import { OnboardingModal } from './components/OnboardingModal';
import { ActionBar } from './components/ActionBar';
import { Menu, X, Map, Package } from 'lucide-react';

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
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface border-b border-white/10 flex items-center justify-between px-4 py-2 safe-top">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="p-2 hover:bg-white/10 transition-colors text-white"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>
      <h1 className="text-lg font-black italic tracking-tighter text-white">
        RACE<span className="text-neon-orange">FUEL</span>
      </h1>
      <div className="flex gap-1">
        <button
          onClick={() => setActiveTab('map')}
          className={`p-2 transition-colors ${activeTab === 'map' ? 'text-neon-orange' : 'text-text-muted hover:text-white'}`}
        >
          <Map className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab('nutrition')}
          className={`p-2 transition-colors ${activeTab === 'nutrition' ? 'text-neon-orange' : 'text-text-muted hover:text-white'}`}
        >
          <Package className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const { onboardingComplete } = useApp();
  const [mobileTab, setMobileTab] = useState<MobileTab>('map');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex w-full h-screen bg-background overflow-hidden selection:bg-neon-orange selection:text-black font-sans">
      {/* Mobile Nav Bar */}
      <MobileNav
        activeTab={mobileTab}
        setActiveTab={setMobileTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Sidebar - responsive: overlay on mobile, fixed on desktop */}
      <div className={`
        fixed lg:relative z-40 h-full transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content - responsive */}
      <div className={`flex-1 flex flex-col relative pt-12 lg:pt-0 ${mobileTab === 'map' ? 'flex' : 'hidden lg:flex'}`}>
        <ErrorBoundary>
          <MapCanvas />
        </ErrorBoundary>
        <ActionBar />
      </div>

      {/* Nutrition Panel - responsive */}
      <div className={`
        fixed lg:relative right-0 top-12 lg:top-0 bottom-0 z-30
        ${mobileTab === 'nutrition' ? 'block' : 'hidden lg:block'}
      `}>
        <ErrorBoundary>
          <NutritionPanel />
        </ErrorBoundary>
      </div>

      {/* Modals */}
      {!onboardingComplete && <OnboardingModal />}

      {/* Global Overlay Gradients for atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-50 bg-gradient-to-b from-transparent via-transparent to-black/20"></div>

      {/* Toast Notifications */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '12px',
          },
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
