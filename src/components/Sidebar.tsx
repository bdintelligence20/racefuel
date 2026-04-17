import { useState } from 'react';
import { Activity, User, Wind, Zap, Edit2, LogOut, RotateCcw, FolderOpen, Save, History, Cloud } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { EditProfileModal } from './EditProfileModal';
import { SavedPlansModal } from './SavedPlansModal';
import { HistoryView } from './HistoryView';
import { EventSearchModal } from './EventSearchModal';
import { ThemeToggle } from './ThemeToggle';
import { NutritionStatsCard } from './NutritionStatsCard';
import { saveOrUpdatePlan } from '../persistence/db';
import { toast } from 'sonner';

interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
}

function StatRow({ label, value, unit, icon: Icon }: StatProps) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-accent/[0.04] transition-colors group">
      <div className="flex items-center gap-2.5 text-text-secondary">
        <div className="w-7 h-7 rounded-md bg-warm/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-warm" />
        </div>
        <span className="text-xs uppercase tracking-wider font-display font-medium">
          {label}
        </span>
      </div>
      <div className="font-display text-text-primary">
        <span className="text-base font-bold">{value}</span>
        {unit && <span className="text-[10px] text-text-muted ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { userProfile, routeData, strava, connectStrava, disconnectStrava, resetAll } = useApp();
  const { user, logout } = useAuth();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [eventSearchOpen, setEventSearchOpen] = useState(false);

  return (
    <aside className="w-[min(18rem,85vw)] bg-surface border-r border-[var(--color-border)] flex flex-col h-full z-30 safe-left">
      {/* Header — brand logo (hidden on mobile since MobileNav already shows it) */}
      <div className="hidden lg:flex p-4 pb-3 justify-center">
        <img
          src="/logo.png"
          alt="fuelcue — Route Aware Nutrition"
          className="h-14 w-auto object-contain"
        />
      </div>

      {/* Strava Connection */}
      <div className="px-4 pb-4 pt-mobile-nav lg:pt-0">
        {strava.isConnected ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surfaceHighlight border border-[var(--color-border)]">
            <div className="w-8 h-8 rounded-lg bg-[#FC4C02] flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-display">Strava</div>
              <div className="text-sm font-display font-semibold text-text-primary truncate">
                {strava.athlete?.firstname} {strava.athlete?.lastname}
              </div>
            </div>
            <button
              onClick={disconnectStrava}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-red-500/10 active:bg-red-500/15 transition-colors text-text-muted hover:text-red-400"
              title="Disconnect"
              aria-label="Disconnect Strava"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectStrava}
            disabled={strava.isLoading}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] hover:border-[#FC4C02]/40 transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#FC4C02] flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-display">
                {strava.isLoading ? 'Connecting...' : 'Connect to'}
              </div>
              <div className="text-sm font-display font-semibold text-text-primary">Strava</div>
            </div>
          </button>
        )}

        {strava.error && (
          <p className="mt-2 text-xs text-red-500 font-display">{strava.error}</p>
        )}
      </div>

      <div className="h-px bg-[var(--color-border)] mx-4" />

      {/* Athlete Profile — scrollable area includes tools on mobile */}
      <div className="flex-1 p-4 overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-display font-semibold text-text-muted uppercase tracking-wider">
            Athlete Profile
          </h2>
          <button
            onClick={() => setEditProfileOpen(true)}
            aria-label="Edit athlete profile"
            className="min-h-[2.25rem] px-2 text-[11px] text-warm hover:text-warm-muted active:text-warm-muted transition-colors font-display font-medium flex items-center gap-1 rounded-md hover:bg-warm/[0.06]"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>

        <div className="space-y-0.5">
          <StatRow label="Weight" value={userProfile.weight} unit="KG" icon={User} />
          <StatRow label="Height" value={userProfile.height} unit="CM" icon={User} />
          <StatRow
            label="Sweat"
            value={
              userProfile.sweatRate === 'light' ? 'Low'
                : userProfile.sweatRate === 'moderate' ? 'Med'
                : 'High'
            }
            unit=""
            icon={Wind}
          />
          <StatRow label="FTP" value={userProfile.ftp} unit="W" icon={Zap} />
        </div>

        <div className="h-px bg-[var(--color-border)] my-4" />

        <NutritionStatsCard />

        {/* Tools — inside scrollable area so they follow content, not pushed to bottom */}
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
        {routeData.loaded && (
          <button
            onClick={async () => {
              try {
                const label = routeData.nutritionPoints.length > 0 ? 'Plan' : 'Route';
                await saveOrUpdatePlan({
                  name: routeData.name || `${label} — ${new Date().toLocaleDateString('en-ZA')}`,
                  routeName: routeData.name,
                  distanceKm: routeData.distanceKm,
                  elevationGain: routeData.elevationGain,
                  estimatedTime: routeData.estimatedTime,
                  source: routeData.source,
                  routeDataJson: JSON.stringify(routeData),
                });
                toast.success(`${label} saved`);
              } catch {
                toast.error('Failed to save');
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-light transition-colors text-xs font-display font-bold uppercase tracking-wider"
          >
            <Save className="w-3.5 h-3.5" />
            {routeData.nutritionPoints.length > 0 ? 'Save Plan' : 'Save Route'}
          </button>
        )}
        {[
          { onClick: () => setSavedPlansOpen(true), icon: FolderOpen, label: 'Saved Plans' },
          { onClick: () => setHistoryOpen(true), icon: History, label: 'History' },
          { onClick: () => setEventSearchOpen(true), icon: Cloud, label: 'Race Weather' },
        ].map(({ onClick, icon: Icon, label }) => (
          <button
            key={label}
            onClick={onClick}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-surfaceHighlight border border-[var(--color-border)] text-text-secondary hover:bg-accent/[0.06] hover:text-text-primary active:scale-[0.98] transition-all text-sm font-display font-medium"
          >
            <Icon className="w-4 h-4 text-text-muted" />
            {label}
          </button>
        ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-[var(--color-border)] space-y-3">
        {/* User info */}
        {user && (
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-display font-bold">
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-display font-medium text-text-primary truncate">
                {user.displayName || user.email}
              </div>
            </div>
            <button
              onClick={logout}
              className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-red-500/10 active:bg-red-500/15 text-text-muted hover:text-red-400 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <ThemeToggle />
          <button
            onClick={resetAll}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors text-[10px] font-display font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Modals */}
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
      <SavedPlansModal
        isOpen={savedPlansOpen}
        onClose={() => setSavedPlansOpen(false)}
      />
      <HistoryView
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      <EventSearchModal
        isOpen={eventSearchOpen}
        onClose={() => setEventSearchOpen(false)}
      />
    </aside>
  );
}
