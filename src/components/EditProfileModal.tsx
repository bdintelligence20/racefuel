import { useState, useEffect } from 'react';
import { X, User, Zap, Wind, Ruler, RefreshCw } from 'lucide-react';
import { useApp, UserProfile } from '../context/AppContext';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { userProfile, updateProfile, strava, syncProfileFromStrava } = useApp();

  const [formData, setFormData] = useState<UserProfile>(userProfile);
  const [syncing, setSyncing] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(userProfile);
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const handleChange = (field: keyof UserProfile, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    updateProfile(formData);
    onClose();
  };

  const handleSyncFromStrava = async () => {
    if (!strava.athlete) return;

    setSyncing(true);

    // Update form with Strava data
    const updates: Partial<UserProfile> = {};

    if (strava.athlete.weight) {
      updates.weight = Math.round(strava.athlete.weight);
    }

    if (strava.athlete.ftp) {
      updates.ftp = strava.athlete.ftp;
    }

    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({
        ...prev,
        ...updates,
      }));
    }

    // Also sync to context
    await syncProfileFromStrava();

    setSyncing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface border border-white/[0.06] rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-white">Edit Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Strava Sync */}
        {strava.isConnected && strava.athlete && (
          <div className="p-4 bg-[#FC4C02]/10 border-b border-[#FC4C02]/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-[#FC4C02] uppercase tracking-wider font-bold">
                  Strava Connected
                </div>
                <div className="text-sm text-white">
                  {strava.athlete.firstname} {strava.athlete.lastname}
                </div>
              </div>
              <button
                onClick={handleSyncFromStrava}
                disabled={syncing}
                className="flex items-center gap-2 px-3 py-2 bg-[#FC4C02] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#FC4C02]/80 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                Sync Data
              </button>
            </div>
            {strava.athlete.weight || strava.athlete.ftp ? (
              <div className="mt-2 text-[10px] text-text-muted">
                Available: {strava.athlete.weight ? `Weight (${strava.athlete.weight}kg)` : ''}
                {strava.athlete.weight && strava.athlete.ftp ? ' · ' : ''}
                {strava.athlete.ftp ? `FTP (${strava.athlete.ftp}W)` : ''}
              </div>
            ) : (
              <div className="mt-2 text-[10px] text-text-muted">
                Set weight & FTP in Strava settings to sync
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Weight */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <User className="w-3 h-3 text-accent" />
              Weight
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.weight}
                onChange={(e) => handleChange('weight', parseInt(e.target.value) || 0)}
                className="flex-1 bg-black/50 border border-white/[0.06] rounded-lg text-white text-lg font-mono p-3 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-text-muted font-mono text-sm w-12">kg</span>
            </div>
          </div>

          {/* Height */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Ruler className="w-3 h-3 text-accent" />
              Height
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.height}
                onChange={(e) => handleChange('height', parseInt(e.target.value) || 0)}
                className="flex-1 bg-black/50 border border-white/[0.06] rounded-lg text-white text-lg font-mono p-3 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-text-muted font-mono text-sm w-12">cm</span>
            </div>
          </div>

          {/* FTP */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Zap className="w-3 h-3 text-accent" />
              FTP (Functional Threshold Power)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.ftp}
                onChange={(e) => handleChange('ftp', parseInt(e.target.value) || 0)}
                className="flex-1 bg-black/50 border border-white/[0.06] rounded-lg text-white text-lg font-mono p-3 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-text-muted font-mono text-sm w-12">W</span>
            </div>
          </div>

          {/* Sweat Rate */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Wind className="w-3 h-3 text-accent" />
              Sweat Rate
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'moderate', 'heavy'] as const).map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleChange('sweatRate', rate)}
                  className={`py-3 rounded-lg text-sm font-bold uppercase transition-colors ${
                    formData.sweatRate === rate
                      ? 'bg-accent/20 border border-accent/50 text-accent'
                      : 'bg-black/30 border border-white/[0.06] text-text-muted hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {rate === 'light' ? 'Low' : rate === 'moderate' ? 'Medium' : 'High'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              Affects hydration recommendations. High = 1.5+ L/hr, Medium = 1-1.5 L/hr, Low = &lt;1 L/hr
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-white/[0.06] bg-surfaceHighlight flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/5 border border-white/[0.06] rounded-lg text-white text-sm font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-lg bg-accent text-black text-sm font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}
