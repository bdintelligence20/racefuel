import { useState } from 'react';
import { Activity, User, Wind, Zap, Edit2, LogOut, RotateCcw, FolderOpen, GitCompare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EditProfileModal } from './EditProfileModal';
import { SavedPlansModal } from './SavedPlansModal';
import { PlanComparison } from './PlanComparison';

interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
}

function StatRow({ label, value, unit, icon: Icon }: StatProps) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.03] transition-colors group">
      <div className="flex items-center gap-2.5 text-text-secondary">
        <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-accent" />
        </div>
        <span className="text-xs uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <div className="font-mono text-text-primary">
        <span className="text-base font-bold">{value}</span>
        {unit && <span className="text-[10px] text-text-muted ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { userProfile, strava, connectStrava, disconnectStrava, resetAll } = useApp();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [savedPlansOpen, setSavedPlansOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  return (
    <aside className="w-72 bg-surface border-r border-white/[0.06] flex flex-col h-full z-30">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <span className="text-accent font-extrabold text-sm">fc</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white">
              Fuel<span className="text-accent">Cue</span>
            </h1>
            <p className="text-[10px] font-mono text-text-muted tracking-wide">
              NUTRITION PLANNER
            </p>
          </div>
        </div>
      </div>

      {/* Strava Connection */}
      <div className="px-4 pb-4">
        {strava.isConnected ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="w-8 h-8 rounded-lg bg-[#FC4C02] flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Strava</div>
              <div className="text-sm font-semibold text-white truncate">
                {strava.athlete?.firstname} {strava.athlete?.lastname}
              </div>
            </div>
            <button
              onClick={disconnectStrava}
              className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-text-muted hover:text-red-400"
              title="Disconnect"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectStrava}
            disabled={strava.isLoading}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#FC4C02]/40 transition-all cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#FC4C02] flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">
                {strava.isLoading ? 'Connecting...' : 'Connect to'}
              </div>
              <div className="text-sm font-semibold text-white">Strava</div>
            </div>
          </button>
        )}

        {strava.error && (
          <p className="mt-2 text-xs text-red-400 font-mono">{strava.error}</p>
        )}
      </div>

      <div className="h-px bg-white/[0.06] mx-4" />

      {/* Athlete Profile */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Athlete Profile
          </h2>
          <button
            onClick={() => setEditProfileOpen(true)}
            className="text-[10px] text-accent hover:text-accent-light transition-colors font-mono flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" /> Edit
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
      </div>

      {/* Tools */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => setSavedPlansOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-text-secondary hover:bg-white/[0.06] hover:text-white transition-colors text-[10px] font-medium"
        >
          <FolderOpen className="w-3 h-3" />
          Plans
        </button>
        <button
          onClick={() => setComparisonOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-text-secondary hover:bg-white/[0.06] hover:text-white transition-colors text-[10px] font-medium"
        >
          <GitCompare className="w-3 h-3" />
          Compare
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.06]">
        <button
          onClick={resetAll}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors text-[10px] font-medium"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
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
      <PlanComparison
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
      />
    </aside>
  );
}
