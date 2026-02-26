import React from 'react';
import { Toaster } from 'sonner';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { MapCanvas } from './components/MapCanvas';
import { NutritionPanel } from './components/NutritionPanel';
import { OnboardingModal } from './components/OnboardingModal';
import { ActionBar } from './components/ActionBar';

function AppContent() {
  const { onboardingComplete } = useApp();
  return (
    <div className="flex w-full h-screen bg-background overflow-hidden selection:bg-neon-orange selection:text-black font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col relative">
        <ErrorBoundary>
          <MapCanvas />
        </ErrorBoundary>
        <ActionBar />
      </div>
      <ErrorBoundary>
        <NutritionPanel />
      </ErrorBoundary>

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
