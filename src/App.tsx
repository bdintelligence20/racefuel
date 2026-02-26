import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
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
        <MapCanvas />
        <ActionBar />
      </div>
      <NutritionPanel />

      {/* Modals */}
      {!onboardingComplete && <OnboardingModal />}

      {/* Global Overlay Gradients for atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-50 bg-gradient-to-b from-transparent via-transparent to-black/20"></div>
    </div>);

}
export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>);

}