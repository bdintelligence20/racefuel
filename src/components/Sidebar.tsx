import { useState } from 'react';
import { Activity, User, Wind, Zap, LogOut, RotateCcw, FolderOpen, Save, History, Cloud, Gauge, Thermometer, Droplets, Ruler, Settings, ShieldCheck, Users, TrendingUp, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useCoachStore } from '../services/coach/coachStore';
import { useCoachPlanning } from '../services/coach/useCoachPlanning';
import { useAuth } from '../context/AuthContext';
import { useAdminGate } from '../hooks/useAdminGate';
import { EditableStatRow } from './EditableStatRow';
import { SavedPlansModal } from './SavedPlansModal';
import { HistoryView } from './HistoryView';
import { EventSearchModal } from './EventSearchModal';
import { requestOpenGutTraining } from '../services/gutTrainingOpen';
import { useGutTrainingAccess } from '../hooks/useGutTrainingAccess';
import { ThemeToggle } from './ThemeToggle';
import { NutritionStatsCard } from './NutritionStatsCard';
import { saveOrUpdatePlan } from '../persistence/db';
import { toast } from 'sonner';

export function Sidebar() {
  const { userProfile, updateProfile, routeData, strava, connectStrava, disconnectStrava, resetAll } = useApp();
  const { user, logout } = useAuth();
  const { isAdmin } = useAdminGate();
  // Only shown for eligible users. The entry opens the shell-level flow via the
  // signal bus (requestOpenGutTraining), so it no longer needs to own the flow
  // or subscribe here — App hosts it so it also opens from the route-entry
  // screen, where the sidebar isn't mounted.
  const showGutTraining = useGutTrainingAccess();

  const [detailsOpen, setDetailsOpen] = useState(false);
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

      {/* Strava Connection — a clean row, not a boxed card */}
      <div className="px-2 pb-2 pt-mobile-nav lg:pt-0">
        {strava.isConnected ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-lg bg-[#FC4C02] flex items-center justify-center flex-shrink-0">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display">Strava</div>
              <div className="text-[13px] font-display font-semibold text-text-primary truncate">
                {strava.athlete?.firstname} {strava.athlete?.lastname}
              </div>
            </div>
            <button
              onClick={disconnectStrava}
              className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-red-500/10 active:bg-red-500/15 transition-colors text-text-muted hover:text-red-400"
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
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-accent/[0.05] transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-lg bg-[#FC4C02] flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-[9px] text-text-muted uppercase tracking-wider font-display">
                {strava.isLoading ? 'Connecting…' : 'Connect to'}
              </div>
              <div className="text-[13px] font-display font-semibold text-text-primary">Strava</div>
            </div>
          </button>
        )}

        {strava.error && (
          <p className="mt-1.5 px-2 text-[10px] text-red-500 font-display">{strava.error}</p>
        )}
      </div>

      <div className="h-px bg-[var(--color-border)] mx-3" />

      {/* Athlete Profile + Preferences — every row is tap-to-edit inline,
          so there's no modal hop. Header subtitle makes the interaction
          discoverable on first use. */}
      <div className="flex-1 p-3 overflow-y-auto overscroll-contain">
        {/* Your details — collapsed by default (progressive disclosure, §5b).
            Specifics (weight, sweat, gut, climate) live one tap away so the
            sidebar leads with the plan, not a form of numbers. */}
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="w-full flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md hover:bg-accent/[0.05] transition-colors text-left"
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">Your details</span>
            {!detailsOpen && (
              <span className="block text-[10px] text-text-muted font-display truncate">{userProfile.weight} kg · {(userProfile.sport ?? 'running').replace(/^./, (c) => c.toUpperCase())} · {userProfile.sweatRate === 'light' ? 'Low' : userProfile.sweatRate === 'moderate' ? 'Med' : 'High'} sweat</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
        </button>
        {detailsOpen && (
        <div className="space-y-1">

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
        </div>
        )}

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
        <nav className="space-y-0.5">
        {[
          { onClick: () => setSavedPlansOpen(true), icon: FolderOpen, label: 'Saved Plans' },
          { onClick: () => setHistoryOpen(true), icon: History, label: 'History' },
          { onClick: () => setEventSearchOpen(true), icon: Cloud, label: 'Race Weather' },
          // Gut Training is beta-gated per user — the entry only appears for
          // eligible accounts (see showGutTraining). Opening it still routes
          // through the flow's own consent gate.
          ...(showGutTraining
            ? [{ onClick: () => requestOpenGutTraining(), icon: TrendingUp, label: 'Gut Training', beta: true }]
            : []),
        ].map(({ onClick, icon: Icon, label, beta }) => (
          <button
            key={label}
            onClick={onClick}
            className="group w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-text-secondary hover:bg-accent/[0.05] hover:text-text-primary active:scale-[0.99] transition-all text-left"
          >
            <Icon className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors flex-shrink-0" />
            <span className="text-[13px] font-display font-medium">{label}</span>
            {beta && (
              <span className="ml-auto px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-display font-bold uppercase tracking-wider">
                Beta
              </span>
            )}
          </button>
        ))}
        {isAdmin && (
          <a
            href="/admin"
            className="group w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-warm hover:bg-warm/[0.08] active:scale-[0.99] transition-all text-[13px] font-display font-semibold"
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            Admin Dashboard
          </a>
        )}
        </nav>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-[var(--color-border)] space-y-2">
        {/* Athlete ⇄ Coach mode switch — both journeys live in one account. */}
        <ModeSwitch />

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

/** Athlete ⇄ Coach switch. One account, two journeys — toggling flips the
 *  whole app surface between the planning flow and the coach roster. Both
 *  directions go through the coach-planning transitions so in-progress
 *  athlete work is saved and the coach's own plan/profile restored. */
function ModeSwitch() {
  const { mode } = useCoachStore();
  const { exitToRoster, returnToSelf } = useCoachPlanning();
  const toCoach = mode !== 'coach';
  return (
    <button
      onClick={() => {
        if (toCoach) void exitToRoster();
        else void returnToSelf();
      }}
      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent/[0.06] border border-accent/20 text-accent hover:bg-accent/[0.1] transition-colors text-[11px] font-display font-bold uppercase tracking-wider"
    >
      <Users className="w-3.5 h-3.5" />
      {toCoach ? 'Switch to coach mode' : 'Back to my own planning'}
    </button>
  );
}
