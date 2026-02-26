import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Activity,
  ArrowRight,
  Check,
  Droplets,
  Ruler,
  User,
  Weight,
  AlertCircle,
} from 'lucide-react';

export function OnboardingModal() {
  const {
    completeOnboarding,
    updateProfile,
    userProfile,
    strava,
    connectStrava,
    syncProfileFromStrava,
  } = useApp();
  const [step, setStep] = useState(1);

  // Auto-advance if already connected via OAuth callback
  useEffect(() => {
    if (strava.isConnected && step === 1) {
      // Sync profile from Strava if available
      syncProfileFromStrava();
      setStep(2);
    }
  }, [strava.isConnected, step, syncProfileFromStrava]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else completeOnboarding();
  };

  const handleConnect = () => {
    connectStrava();
  };

  const handleSkipStrava = () => {
    handleNext();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
          <div
            className="h-full bg-neon-orange transition-all duration-500 ease-out"
            style={{
              width: `${(step / 4) * 100}%`,
            }}
          ></div>
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black italic text-white mb-2">
              SETUP <span className="text-neon-orange">PROFILE</span>
            </h2>
            <p className="text-text-secondary text-sm font-mono">
              STEP {step}/4:{' '}
              {step === 1
                ? 'CONNECT DATA'
                : step === 2
                ? 'BODY METRICS'
                : step === 3
                ? 'SWEAT PROFILE'
                : 'READY TO PLAN'}
            </p>
          </div>

          {/* Step 1: Strava */}
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="p-6 border border-white/10 bg-white/5 mx-auto w-32 h-32 flex items-center justify-center rounded-full mb-6 relative group">
                <div className="absolute inset-0 border border-neon-orange/30 rounded-full animate-pulse-glow"></div>
                <Activity className="w-12 h-12 text-neon-orange" />
              </div>
              <p className="text-text-secondary mb-6">
                Connect Strava to import your routes and historical performance
                data for accurate nutrition planning.
              </p>

              {/* Error message */}
              {strava.error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{strava.error}</span>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={strava.isLoading}
                className="w-full py-4 bg-[#FC4C02] hover:bg-[#e34402] text-white font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all clip-corner disabled:opacity-70"
              >
                {strava.isLoading ? (
                  <span className="animate-pulse">CONNECTING...</span>
                ) : (
                  <>
                    <span>CONNECT WITH STRAVA</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                onClick={handleSkipStrava}
                className="w-full py-3 text-text-secondary hover:text-white font-mono text-sm transition-colors"
              >
                SKIP FOR NOW
              </button>
            </div>
          )}

          {/* Step 2: Stats */}
          {step === 2 && (
            <div className="space-y-6">
              {strava.isConnected && strava.athlete && (
                <div className="flex items-center gap-3 p-3 bg-[#FC4C02]/10 border border-[#FC4C02]/30 mb-4">
                  <div className="w-8 h-8 bg-[#FC4C02] flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-sm">
                    <span className="text-text-secondary">Connected as </span>
                    <span className="text-white font-bold">
                      {strava.athlete.firstname} {strava.athlete.lastname}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    Weight (kg)
                  </label>
                  <div className="relative group">
                    <input
                      type="number"
                      value={userProfile.weight}
                      onChange={(e) =>
                        updateProfile({
                          weight: Number(e.target.value),
                        })
                      }
                      className="w-full bg-black border border-white/20 p-4 text-white font-mono text-xl focus:border-neon-orange focus:outline-none transition-colors"
                    />
                    <Weight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-neon-orange" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    Height (cm)
                  </label>
                  <div className="relative group">
                    <input
                      type="number"
                      value={userProfile.height}
                      onChange={(e) =>
                        updateProfile({
                          height: Number(e.target.value),
                        })
                      }
                      className="w-full bg-black border border-white/20 p-4 text-white font-mono text-xl focus:border-neon-blue focus:outline-none transition-colors"
                    />
                    <Ruler className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-neon-blue" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase">
                  FTP (Watts)
                </label>
                <div className="relative group">
                  <input
                    type="number"
                    value={userProfile.ftp}
                    onChange={(e) =>
                      updateProfile({
                        ftp: Number(e.target.value),
                      })
                    }
                    className="w-full bg-black border border-white/20 p-4 text-white font-mono text-xl focus:border-neon-green focus:outline-none transition-colors"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-text-muted">
                    WATTS
                  </div>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all mt-4 clip-corner"
              >
                CONTINUE <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 3: Sweat Profile */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-text-secondary text-sm mb-4">
                How much do you typically sweat during intense exercise? This
                helps us calculate hydration needs.
              </p>

              {(['light', 'moderate', 'heavy'] as const).map((rate) => (
                <button
                  key={rate}
                  onClick={() =>
                    updateProfile({
                      sweatRate: rate,
                    })
                  }
                  className={`w-full p-4 border flex items-center justify-between group transition-all duration-300 ${
                    userProfile.sweatRate === rate
                      ? 'bg-neon-blue/10 border-neon-blue'
                      : 'bg-transparent border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 flex items-center justify-center rounded-full ${
                        userProfile.sweatRate === rate
                          ? 'bg-neon-blue text-black'
                          : 'bg-white/5 text-text-muted'
                      }`}
                    >
                      <Droplets className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div
                        className={`font-bold uppercase tracking-wider ${
                          userProfile.sweatRate === rate
                            ? 'text-white'
                            : 'text-text-secondary'
                        }`}
                      >
                        {rate} Sweater
                      </div>
                      <div className="text-xs font-mono text-text-muted">
                        {rate === 'light'
                          ? '< 0.8 L/hr'
                          : rate === 'moderate'
                          ? '0.8 - 1.5 L/hr'
                          : '> 1.5 L/hr'}
                      </div>
                    </div>
                  </div>
                  {userProfile.sweatRate === rate && (
                    <Check className="w-5 h-5 text-neon-blue" />
                  )}
                </button>
              ))}

              <button
                onClick={handleNext}
                className="w-full py-4 bg-neon-blue hover:bg-neon-blue/90 text-black font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all mt-4 clip-corner"
              >
                CONTINUE <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-neon-green/10 rounded-full flex items-center justify-center mx-auto border border-neon-green/30">
                <Check className="w-10 h-10 text-neon-green" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white">
                  PROFILE COMPLETE
                </h3>
                <p className="text-text-secondary">
                  Your physiological profile has been calibrated. You are ready
                  to generate precision nutrition plans.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center py-4 border-y border-white/10">
                <div>
                  <div className="text-[10px] text-text-muted uppercase">
                    Weight
                  </div>
                  <div className="font-mono font-bold text-white">
                    {userProfile.weight}kg
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase">
                    FTP
                  </div>
                  <div className="font-mono font-bold text-white">
                    {userProfile.ftp}W
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-muted uppercase">
                    Sweat
                  </div>
                  <div className="font-mono font-bold text-white capitalize">
                    {userProfile.sweatRate}
                  </div>
                </div>
              </div>

              {strava.isConnected && (
                <div className="flex items-center justify-center gap-2 text-sm text-[#FC4C02]">
                  <Activity className="w-4 h-4" />
                  <span>Strava Connected</span>
                </div>
              )}

              <button
                onClick={completeOnboarding}
                className="w-full py-4 bg-neon-green hover:bg-neon-green/90 text-black font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all clip-corner shadow-[0_0_20px_rgba(0,255,136,0.3)] hover:shadow-[0_0_30px_rgba(0,255,136,0.5)]"
              >
                START PLANNING
              </button>
            </div>
          )}
        </div>

        {/* Decorative corner */}
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/10"></div>
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/10"></div>
      </div>
    </div>
  );
}
