import React, { useState } from 'react';
import { Activity, User, Wind, Zap, Edit2, LogOut, Bike, PersonStanding, Trophy, Mountain, RotateCcw } from 'lucide-react';
import { useApp, SportType } from '../context/AppContext';
import { EditProfileModal } from './EditProfileModal';

interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
}

function StatRow({ label, value, unit, icon: Icon }: StatProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 group hover:bg-white/5 px-2 transition-colors">
      <div className="flex items-center gap-3 text-text-secondary">
        <Icon className="w-4 h-4 text-neon-orange" />
        <span className="text-xs uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <div className="font-mono text-text-primary">
        <span className="text-lg font-bold">{value}</span>
        {unit && <span className="text-xs text-text-muted ml-1">{unit}</span>}
      </div>
    </div>
  );
}

const sportOptions: { type: SportType; label: string; icon: React.ElementType }[] = [
  { type: 'cycling', label: 'Cycling', icon: Bike },
  { type: 'running', label: 'Running', icon: PersonStanding },
  { type: 'triathlon', label: 'Triathlon', icon: Trophy },
  { type: 'hiking', label: 'Hiking', icon: Mountain },
];

export function Sidebar() {
  const { userProfile, strava, connectStrava, disconnectStrava, sportType, setSportType, resetAll } = useApp();
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  return (
    <aside className="w-72 bg-surface border-r border-white/10 flex flex-col h-full z-30 shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-black italic tracking-tighter text-white">
          RACE<span className="text-neon-orange">FUEL</span>
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></div>
          <span className="text-xs font-mono text-neon-green uppercase tracking-widest">
            System Online
          </span>
        </div>
      </div>

      {/* Sport Selector */}
      <div className="p-4 border-b border-white/10">
        <div className="grid grid-cols-4 gap-1">
          {sportOptions.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setSportType(type)}
              className={`flex flex-col items-center gap-1 p-2 transition-all ${
                sportType === type
                  ? 'bg-neon-orange/20 border border-neon-orange/50 text-neon-orange'
                  : 'bg-white/5 border border-transparent text-text-muted hover:bg-white/10 hover:text-white'
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-mono uppercase tracking-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Strava Status */}
      <div className="p-6 border-b border-white/10 bg-surfaceHighlight/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Connections
          </h2>
          <span
            className={`px-2 py-0.5 border text-[10px] font-mono uppercase ${
              strava.isConnected
                ? 'bg-neon-green/10 border-neon-green/20 text-neon-green'
                : 'bg-white/5 border-white/10 text-text-muted'
            }`}
          >
            {strava.isConnected ? 'Active' : 'Offline'}
          </span>
        </div>

        {strava.isConnected ? (
          <div className="flex items-center gap-3 p-3 border bg-black/40 border-white/5 group">
            <div className="w-8 h-8 bg-[#FC4C02] flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-text-secondary">Connected as</div>
              <div className="text-sm font-bold text-white font-mono truncate">
                {strava.athlete?.firstname} {strava.athlete?.lastname}
              </div>
            </div>
            <button
              onClick={disconnectStrava}
              className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-red-400"
              title="Disconnect Strava"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={connectStrava}
            disabled={strava.isLoading}
            className="w-full flex items-center gap-3 p-3 border bg-black/20 border-white/5 hover:border-[#FC4C02]/50 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 bg-[#FC4C02] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-xs text-text-secondary group-hover:text-white transition-colors">
                {strava.isLoading ? 'Connecting...' : 'Connect to'}
              </div>
              <div className="text-sm font-bold text-white font-mono">STRAVA</div>
            </div>
          </button>
        )}

        {strava.error && (
          <p className="mt-2 text-xs text-red-400 font-mono">{strava.error}</p>
        )}
      </div>

      {/* Athlete Profile */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Athlete Profile
          </h2>
          <button
            onClick={() => setEditProfileOpen(true)}
            className="text-xs text-neon-blue hover:text-white transition-colors font-mono flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" /> [EDIT]
          </button>
        </div>

        <div className="space-y-1">
          <StatRow
            label="Weight"
            value={userProfile.weight}
            unit="KG"
            icon={User}
          />

          <StatRow
            label="Height"
            value={userProfile.height}
            unit="CM"
            icon={User}
          />

          <StatRow
            label="Sweat Rate"
            value={
              userProfile.sweatRate === 'light'
                ? 'LOW'
                : userProfile.sweatRate === 'moderate'
                ? 'MED'
                : 'HIGH'
            }
            unit=""
            icon={Wind}
          />

          <StatRow label="FTP" value={userProfile.ftp} unit="W" icon={Zap} />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={resetAll}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors text-xs font-mono uppercase tracking-wider"
        >
          <RotateCcw className="w-3 h-3" />
          Reset Demo
        </button>
        <div className="mt-2 text-[10px] text-text-muted font-mono text-center">
          v2.4.0-RC1 // BUILD 8922
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
    </aside>
  );
}
