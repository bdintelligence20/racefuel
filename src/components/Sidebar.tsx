import { useState } from 'react';
import { Activity, User, Wind, Zap, LogOut, RotateCcw, FolderOpen, Save, History, Cloud, Gauge, Thermometer, Droplets, Ruler, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { EditableStatRow } from './EditableStatRow';
import { SavedPlansModal } from './SavedPlansModal';
import { HistoryView } from './HistoryView';
import { EventSearchModal } from './EventSearchModal';
import { ThemeToggle } from './ThemeToggle';
import { NutritionStatsCard } from './NutritionStatsCard';
import { saveOrUpdatePlan } from '../persistence/db';
import { toast } from 'sonner';


export function Sidebar() {
  const { userProfile, updateProfile, routeData, strava, connectStrava, disconnectStrava, resetAll } = useApp();
  const { user, logout } = useAuth();
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

      {/* Athlete Profile + Preferences — every row is tap-to-edit inline,
          so there's no modal hop. Header subtitle makes the interaction
          discoverable on first use. */}
      <div className="flex-1 p-3 overflow-y-auto overscroll-contain">
        <div className="flex items-baseline justify-between mb-1.5 px-1">
          <h2 className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">
            Athlete Profile
          </h2>
          <span className="text-[9px] text-text-muted/70 font-display italic">tap any row to edit</span>
        </div>

        {/* Body basics — every row is tap-to-edit inline */}
        <div className="space-y-px mb-2.5">
          <EditableStatRow
            label="Weight"
            icon={User}
            displayValue={String(userProfile.weight)}
            displayUnit="kg"
            editor={{ type: 'number', min: 30, max: 200, unit: 'kg', current: userProfile.weight, onCommit: (v) => updateProfile({ weight: v }) }}
          />
          <EditableStatRow
            label="Height"
            icon={Ruler}
            displayValue={String(userProfile.height)}
            displayUnit="cm"
            editor={{ type: 'number', min: 120, max: 230, unit: 'cm', current: userProfile.height, onCommit: (v) => updateProfile({ height: v }) }}
          />
          <EditableStatRow
            label="Sport"
            icon={Activity}
            displayValue={(userProfile.sport ?? 'running').replace(/^./, (c) => c.toUpperCase())}
            editor={{
              type: 'choice',
              current: userProfile.sport ?? 'running',
              options: [
                { value: 'running', label: 'Running' },
                { value: 'cycling', label: 'Cycling' },
              ],
              onCommit: (v) => updateProfile({ sport: v as 'running' | 'cycling' }),
            }}
          />
          <EditableStatRow
            label="Sweat"
            icon={Wind}
            displayValue={userProfile.sweatRate === 'light' ? 'Low' : userProfile.sweatRate === 'moderate' ? 'Med' : 'High'}
            editor={{
              type: 'choice',
              current: userProfile.sweatRate,
              options: [
                { value: 'light', label: 'Low' },
                { value: 'moderate', label: 'Medium' },
                { value: 'heavy', label: 'High' },
              ],
              onCommit: (v) => updateProfile({ sweatRate: v as 'light' | 'moderate' | 'heavy' }),
            }}
          />
          <EditableStatRow
            label="FTP"
            icon={Zap}
            displayValue={String(userProfile.ftp)}
            displayUnit="W"
            editor={{ type: 'number', min: 50, max: 600, unit: 'W', current: userProfile.ftp, onCommit: (v) => updateProfile({ ftp: v }) }}
          />
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
            <EditableStatRow
              label="Gut"
              icon={Gauge}
              displayValue={(userProfile.gutTolerance ?? 'trained').replace(/^./, (c) => c.toUpperCase())}
              editor={{
                type: 'choice',
                current: userProfile.gutTolerance ?? 'trained',
                options: [
                  { value: 'beginner', label: '≤60 g/h' },
                  { value: 'trained', label: '≤90 g/h' },
                  { value: 'elite', label: '≤120 g/h' },
                ],
                onCommit: (v) => updateProfile({ gutTolerance: v as 'beginner' | 'trained' | 'elite' }),
              }}
            />
            <EditableStatRow
              label="Carb tgt"
              icon={Zap}
              displayValue={userProfile.carbTargetGPerHour ? `${userProfile.carbTargetGPerHour}` : 'Auto'}
              displayUnit={userProfile.carbTargetGPerHour ? 'g/h' : undefined}
              editor={{
                type: 'numberNullable',
                min: 0,
                max: 120,
                unit: 'g/h',
                current: userProfile.carbTargetGPerHour,
                autoLabel: 'Auto',
                onCommit: (v) => updateProfile({ carbTargetGPerHour: v }),
              }}
            />
            <EditableStatRow
              label="Brands"
              icon={Activity}
              displayValue={userProfile.preferredBrands && userProfile.preferredBrands.length > 0
                ? (userProfile.preferredBrands.length === 1 ? userProfile.preferredBrands[0] : `${userProfile.preferredBrands.length} picked`)
                : 'Any'}
              editor={{
                type: 'brands',
                current: userProfile.preferredBrands ?? [],
                onCommit: (v) => updateProfile({ preferredBrands: v }),
              }}
            />
            <EditableStatRow
              label="Fuel"
              icon={Zap}
              displayValue={userProfile.preferredCategories && userProfile.preferredCategories.length > 0
                ? userProfile.preferredCategories.map((c) => c[0].toUpperCase() + c.slice(1)).join(', ')
                : 'Any'}
              editor={{
                type: 'categories',
                current: userProfile.preferredCategories ?? [],
                onCommit: (v) => updateProfile({ preferredCategories: v as Array<'gel' | 'drink' | 'bar' | 'chew'> }),
              }}
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
            <EditableStatRow
              label="Sweat Na"
              icon={Droplets}
              displayValue={(userProfile.sweatSodiumBucket ?? 'unknown').replace(/^./, (c) => c.toUpperCase())}
              editor={{
                type: 'choice',
                current: userProfile.sweatSodiumBucket ?? 'unknown',
                options: [
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'unknown', label: 'Unknown' },
                ],
                onCommit: (v) => updateProfile({ sweatSodiumBucket: v as 'low' | 'medium' | 'high' | 'unknown' }),
              }}
            />
            <EditableStatRow
              label="Acclim"
              icon={Thermometer}
              displayValue={userProfile.heatAcclimatised ? 'Yes' : userProfile.earlySeasonHeat ? 'Early' : 'No'}
              editor={{
                type: 'acclim',
                acclimatised: userProfile.heatAcclimatised ?? false,
                earlySeason: userProfile.earlySeasonHeat ?? false,
                onCommit: (acclim, early) => updateProfile({ heatAcclimatised: acclim, earlySeasonHeat: early }),
              }}
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
