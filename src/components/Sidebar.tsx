import { useState } from 'react';
import { Activity, User, Wind, Zap, Edit2, LogOut, RotateCcw, FolderOpen, Save, History, Cloud, Gauge, Thermometer, Droplets, Ruler, Settings } from 'lucide-react';
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
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent/[0.04] transition-colors">
      <div className="flex items-center gap-2 text-text-secondary min-w-0">
        <Icon className="w-3 h-3 text-warm flex-shrink-0" />
        <span className="text-[10px] uppercase tracking-wider font-display font-medium truncate">
          {label}
        </span>
      </div>
      <div className="font-display text-text-primary flex items-baseline gap-1 flex-shrink-0 pl-2">
        <span className="text-xs font-bold tabular-nums">{value}</span>
        {unit && <span className="text-[9px] text-text-muted">{unit}</span>}
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
      <div className="hidden lg:flex p-3 pb-2 justify-center">
        <img
          src="/logo.png"
          alt="fuelcue — Route Aware Nutrition"
          className="h-10 w-auto object-contain"
        />
      </div>

      {/* Strava Connection */}
      <div className="px-3 pb-3 pt-mobile-nav lg:pt-0">
        {strava.isConnected ? (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-surfaceHighlight border border-[var(--color-border)]">
            <div className="w-6 h-6 rounded-md bg-[#FC4C02] flex items-center justify-center flex-shrink-0">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display">Strava</div>
              <div className="text-xs font-display font-semibold text-text-primary truncate">
                {strava.athlete?.firstname} {strava.athlete?.lastname}
              </div>
            </div>
            <button
              onClick={disconnectStrava}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-red-500/10 active:bg-red-500/15 transition-colors text-text-muted hover:text-red-400"
              title="Disconnect"
              aria-label="Disconnect Strava"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectStrava}
            disabled={strava.isLoading}
            className="w-full flex items-center gap-2 p-2 rounded-lg bg-surfaceHighlight border border-[var(--color-border)] hover:border-[#FC4C02]/40 transition-all cursor-pointer group"
          >
            <div className="w-6 h-6 rounded-md bg-[#FC4C02] flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display">
                {strava.isLoading ? 'Connecting…' : 'Connect to'}
              </div>
              <div className="text-xs font-display font-semibold text-text-primary">Strava</div>
            </div>
          </button>
        )}

        {strava.error && (
          <p className="mt-1.5 text-[10px] text-red-500 font-display">{strava.error}</p>
        )}
      </div>

      <div className="h-px bg-[var(--color-border)] mx-3" />

      {/* Athlete Profile + Preferences — scrollable, surfaces every setting so
          users don't have to open the modal to see what's active. */}
      <div className="flex-1 p-3 overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <h2 className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">
            Athlete Profile
          </h2>
          <button
            onClick={() => setEditProfileOpen(true)}
            aria-label="Edit athlete profile and preferences"
            className="min-h-[1.75rem] px-2 text-[10px] text-white bg-warm hover:bg-warm-light transition-colors font-display font-bold uppercase tracking-wider flex items-center gap-1 rounded-md shadow-sm"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
        </div>

        {/* Body basics */}
        <div className="space-y-px mb-2.5">
          <StatRow label="Weight" value={userProfile.weight} unit="kg" icon={User} />
          <StatRow label="Height" value={userProfile.height} unit="cm" icon={Ruler} />
          <StatRow
            label="Sport"
            value={(userProfile.sport ?? 'running').replace(/^./, (c) => c.toUpperCase())}
            icon={Activity}
          />
          <StatRow
            label="Sweat"
            value={userProfile.sweatRate === 'light' ? 'Low' : userProfile.sweatRate === 'moderate' ? 'Med' : 'High'}
            icon={Wind}
          />
          <StatRow label="FTP" value={userProfile.ftp} unit="W" icon={Zap} />
        </div>

        {/* Fueling preferences */}
        <div className="mb-2.5">
          <div className="flex items-center gap-1 mb-1 px-1">
            <Settings className="w-2.5 h-2.5 text-text-muted" />
            <h3 className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider">
              Fueling
            </h3>
          </div>
          <div className="space-y-px">
            <StatRow
              label="Gut"
              value={(userProfile.gutTolerance ?? 'trained').replace(/^./, (c) => c.toUpperCase())}
              icon={Gauge}
            />
            <StatRow
              label="Carb tgt"
              value={userProfile.carbTargetGPerHour ? `${userProfile.carbTargetGPerHour}` : 'Auto'}
              unit={userProfile.carbTargetGPerHour ? 'g/h' : undefined}
              icon={Zap}
            />
            <StatRow
              label="Brands"
              value={userProfile.preferredBrands && userProfile.preferredBrands.length > 0
                ? (userProfile.preferredBrands.length === 1 ? userProfile.preferredBrands[0] : `${userProfile.preferredBrands.length} picked`)
                : 'Any'}
              icon={Activity}
            />
            <StatRow
              label="Fuel"
              value={userProfile.preferredCategories && userProfile.preferredCategories.length > 0
                ? userProfile.preferredCategories.map((c) => c[0].toUpperCase() + c.slice(1)).join(', ')
                : 'Any'}
              icon={Zap}
            />
          </div>
        </div>

        {/* Sweat & climate */}
        <div className="mb-2.5">
          <div className="flex items-center gap-1 mb-1 px-1">
            <Droplets className="w-2.5 h-2.5 text-text-muted" />
            <h3 className="text-[9px] font-display font-semibold text-text-muted uppercase tracking-wider">
              Climate
            </h3>
          </div>
          <div className="space-y-px">
            <StatRow
              label="Sweat Na"
              value={(userProfile.sweatSodiumBucket ?? 'unknown').replace(/^./, (c) => c.toUpperCase())}
              icon={Droplets}
            />
            <StatRow
              label="Acclim"
              value={userProfile.heatAcclimatised ? 'Yes' : userProfile.earlySeasonHeat ? 'Early' : 'No'}
              icon={Thermometer}
            />
          </div>
        </div>

        <div className="h-px bg-[var(--color-border)] my-2.5" />

        <NutritionStatsCard />

        {/* Tools — inside scrollable area so they follow content, not pushed to bottom */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1.5">
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
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md bg-accent text-white hover:bg-accent-light transition-colors text-[11px] font-display font-bold uppercase tracking-wider"
          >
            <Save className="w-3 h-3" />
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
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-surfaceHighlight border border-[var(--color-border)] text-text-secondary hover:bg-accent/[0.06] hover:text-text-primary active:scale-[0.98] transition-all text-[11px] font-display font-medium"
          >
            <Icon className="w-3.5 h-3.5 text-text-muted" />
            {label}
          </button>
        ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-[var(--color-border)] space-y-2">
        {/* User info */}
        {user && (
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent text-[10px] font-display font-bold">
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-display font-medium text-text-primary truncate">
                {user.displayName || user.email}
              </div>
            </div>
            <button
              onClick={logout}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-red-500/10 active:bg-red-500/15 text-text-muted hover:text-red-400 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <ThemeToggle />
          <button
            onClick={resetAll}
            className="flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-red-500/5 border border-red-500/10 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors text-[9px] font-display font-medium"
          >
            <RotateCcw className="w-2.5 h-2.5" />
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
