import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NumberField } from './ui/NumberField';
import {
  Activity,
  ArrowRight,
  Check,
  Droplets,
  Ruler,
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
  const [step, setStep] = useState(0);

  // Auto-advance if already connected via OAuth callback
  useEffect(() => {
    if (strava.isConnected && step === 1) {
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
    setStep(2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm sm:p-4">
      <div className="w-full sm:max-w-lg bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl shadow-2xl relative overflow-hidden max-h-[95dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">

        {/* Step 0: Brand Splash */}
        {step === 0 && (
          <div className="relative">
            {/* Illustrated hero — the logo is already IN the illustration */}
            <div className="relative overflow-hidden rounded-t-2xl">
              <img
                src="/logo-illustrated.jpg"
                alt="fuelcue — Route Aware Nutrition"
                className="w-full aspect-square object-cover"
              />
              {/* Gradient fade to surface at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface to-transparent" />
            </div>

            <div className="px-8 pb-8 -mt-6 relative z-10 text-center">
              <p className="text-text-secondary text-sm leading-relaxed max-w-xs mx-auto mb-5">
                Terrain-aware nutrition planning for endurance athletes.
              </p>
              <button
                onClick={handleNext}
                className="w-full py-4 bg-accent hover:bg-accent-light text-white font-display font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all rounded-xl"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Steps 1-4 */}
        {step >= 1 && (
          <>
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-surfaceHighlight rounded-t-2xl overflow-hidden z-10">
              <div
                className="h-full bg-warm transition-all duration-500 ease-out"
                style={{
                  width: `${(step / 4) * 100}%`,
                }}
              ></div>
            </div>

            <div className="p-8">
              {/* Header */}
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-display font-bold text-text-primary mb-2">
                  Setup <span className="text-warm">Profile</span>
                </h2>
                <p className="text-text-secondary text-sm font-display">
                  Step {step}/4:{' '}
                  {step === 1
                    ? 'Connect Data'
                    : step === 2
                    ? 'Body Metrics'
                    : step === 3
                    ? 'Sweat Profile'
                    : 'Ready to Plan'}
                </p>
              </div>

              {/* Step 1: Strava */}
              {step === 1 && (
                <div className="space-y-6 text-center">
                  <div className="p-6 border border-[var(--color-border)] bg-surfaceHighlight mx-auto w-32 h-32 flex items-center justify-center rounded-full mb-6 relative group">
                    <div className="absolute inset-0 border border-[#FC4C02]/20 rounded-full animate-pulse-glow"></div>
                    <Activity className="w-12 h-12 text-[#FC4C02]" />
                  </div>
                  <p className="text-text-secondary mb-6">
                    Connect Strava to import your routes and historical performance
                    data for accurate nutrition planning.
                  </p>

                  {strava.error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm mb-4">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{strava.error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleConnect}
                    disabled={strava.isLoading}
                    className="w-full py-4 bg-[#FC4C02] hover:bg-[#e34402] text-white font-display font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all rounded-xl disabled:opacity-70"
                  >
                    {strava.isLoading ? (
                      <span className="animate-pulse">Connecting...</span>
                    ) : (
                      <>
                        <span>Connect with Strava</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSkipStrava}
                    className="w-full py-3 text-text-secondary hover:text-text-primary font-display text-sm transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
              )}

              {/* Step 2: Stats */}
              {step === 2 && (
                <div className="space-y-6">
                  {strava.isConnected && strava.athlete && (
                    <div className="flex items-center gap-3 p-3 bg-[#FC4C02]/10 border border-[#FC4C02]/30 rounded-lg mb-4">
                      <div className="w-8 h-8 bg-[#FC4C02] rounded-lg flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-sm">
                        <span className="text-text-secondary">Connected as </span>
                        <span className="text-text-primary font-bold">
                          {strava.athlete.firstname} {strava.athlete.lastname}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-display font-bold text-text-secondary uppercase">
                        Weight (kg)
                      </label>
                      <div className="relative group">
                        <NumberField
                          value={userProfile.weight}
                          onChange={(v) => updateProfile({ weight: v })}
                          min={30}
                          max={200}
                          ariaLabel="Weight in kilograms"
                          commitOnBlur
                          className="w-full bg-surface border border-[var(--color-border)] rounded-lg p-4 text-text-primary font-display text-xl focus:border-warm focus:ring-1 focus:ring-warm/20 focus:outline-none transition-colors"
                        />
                        <Weight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-warm" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-display font-bold text-text-secondary uppercase">
                        Height (cm)
                      </label>
                      <div className="relative group">
                        <NumberField
                          value={userProfile.height}
                          onChange={(v) => updateProfile({ height: v })}
                          min={120}
                          max={230}
                          ariaLabel="Height in centimetres"
                          commitOnBlur
                          className="w-full bg-surface border border-[var(--color-border)] rounded-lg p-4 text-text-primary font-display text-xl focus:border-warm focus:ring-1 focus:ring-warm/20 focus:outline-none transition-colors"
                        />
                        <Ruler className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-warm" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-display font-bold text-text-secondary uppercase">
                      FTP (Watts)
                    </label>
                    <div className="relative group">
                      <NumberField
                        value={userProfile.ftp}
                        onChange={(v) => updateProfile({ ftp: v })}
                        min={50}
                        max={600}
                        ariaLabel="FTP in watts"
                        commitOnBlur
                        className="w-full bg-surface border border-[var(--color-border)] rounded-lg p-4 text-text-primary font-display text-xl focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none transition-colors"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-display text-text-muted">
                        WATTS
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleNext}
                    className="w-full py-4 bg-accent text-white font-display font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all mt-4 rounded-xl"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
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
                      onClick={() => updateProfile({ sweatRate: rate })}
                      className={`w-full p-4 border rounded-xl flex items-center justify-between group transition-all duration-300 ${
                        userProfile.sweatRate === rate
                          ? 'bg-warm/10 border-warm'
                          : 'bg-transparent border-[var(--color-border)] hover:border-warm/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 flex items-center justify-center rounded-full ${
                            userProfile.sweatRate === rate
                              ? 'bg-warm text-white'
                              : 'bg-surfaceHighlight text-text-muted'
                          }`}
                        >
                          <Droplets className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <div
                            className={`font-display font-bold uppercase tracking-wider ${
                              userProfile.sweatRate === rate
                                ? 'text-text-primary'
                                : 'text-text-secondary'
                            }`}
                          >
                            {rate} Sweater
                          </div>
                          <div className="text-xs font-display text-text-muted">
                            {rate === 'light'
                              ? '< 0.8 L/hr'
                              : rate === 'moderate'
                              ? '0.8 - 1.5 L/hr'
                              : '> 1.5 L/hr'}
                          </div>
                        </div>
                      </div>
                      {userProfile.sweatRate === rate && (
                        <Check className="w-5 h-5 text-warm" />
                      )}
                    </button>
                  ))}

                  <button
                    onClick={handleNext}
                    className="w-full py-4 bg-warm hover:bg-warm-light text-white font-display font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all mt-4 rounded-xl"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Step 4: Ready */}
              {step === 4 && (
                <div className="text-center space-y-6">
                  {/* Brand illustration as celebration */}
                  <div className="w-24 h-24 rounded-full overflow-hidden mx-auto border-4 border-warm/20 shadow-lg">
                    <img
                      src="/logo-illustrated.jpg"
                      alt="fuelcue"
                      className="w-full h-full object-cover scale-150"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xl font-display font-bold text-text-primary">
                      Profile Complete
                    </h3>
                    <p className="text-text-secondary font-display">
                      Your physiological profile has been calibrated. You are ready
                      to generate precision nutrition plans.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center py-4 border-y border-[var(--color-border)]">
                    <div>
                      <div className="text-[10px] text-text-muted uppercase font-display">
                        Weight
                      </div>
                      <div className="font-display font-bold text-text-primary">
                        {userProfile.weight}kg
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-muted uppercase font-display">
                        FTP
                      </div>
                      <div className="font-display font-bold text-text-primary">
                        {userProfile.ftp}W
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-muted uppercase font-display">
                        Sweat
                      </div>
                      <div className="font-display font-bold text-text-primary capitalize">
                        {userProfile.sweatRate}
                      </div>
                    </div>
                  </div>

                  {strava.isConnected && (
                    <div className="flex items-center justify-center gap-2 text-sm text-[#FC4C02]">
                      <Activity className="w-4 h-4" />
                      <span className="font-display font-medium">Strava Connected</span>
                    </div>
                  )}

                  <button
                    onClick={completeOnboarding}
                    className="w-full py-4 bg-accent hover:bg-accent-light text-white font-display font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all rounded-xl shadow-[0_0_20px_rgba(61,33,82,0.15)] hover:shadow-[0_0_30px_rgba(61,33,82,0.25)]"
                  >
                    Start Planning
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
