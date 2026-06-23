import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NumberField } from './ui/NumberField';
import { ArrowRight, Check, MapPin, Truck, Watch, Sparkles } from 'lucide-react';

/**
 * Runna-style onboarding tutorial. The old version interrogated a first-time
 * user for weight, height, FTP and sweat rate before they'd seen anything —
 * exactly the "I'm a beginner and I feel stupid" problem the brief calls the
 * most important feedback we've had. This replaces it with a short, plain-
 * language tour that explains what fuelcue *does*, not how it works:
 *
 *   1. What fuelcue is        4. Your watch tells you when
 *   2. What a plan looks like 5. One quick question → Import your first route
 *   3. It comes to your door
 *
 * Rules from the brief: max five screens, no jargon, skippable but on by
 * default, and it ends on a single clear call to action — "Import your first
 * route" — which drops the user straight onto the import surface.
 *
 * The only thing we ask is body weight, because it's the one input that most
 * changes how much fuel a plan prescribes — and getting it wrong is a bad race,
 * not a cosmetic miss. Everything else uses smart defaults the user can refine
 * later in settings. The weight question is itself skippable.
 */

const SLIDES = [
  {
    icon: Sparkles,
    title: 'Welcome to fuelcue',
    body: "Tell us your route, and we build you a fuelling plan — exactly what to eat and drink, and when. No sports-science degree required.",
  },
  {
    icon: MapPin,
    title: 'A plan built for your route',
    body: 'We read the climbs, the distance and the conditions, then place fuel along the course and time it to the effort. You just follow it.',
  },
  {
    icon: Truck,
    title: 'The fuel comes to your door',
    body: "Like what's in your plan? We'll ship it. Already use a brand we don't stock? Add it anyway — it's clearly marked so you know to bring your own.",
  },
  {
    icon: Watch,
    title: 'Your watch tells you when',
    body: "Send the plan to your watch and it'll nudge you at each point. You never have to remember when to fuel — it tells you.",
  },
] as const;

export function OnboardingModal() {
  const { completeOnboarding, updateProfile, userProfile } = useApp();
  const [step, setStep] = useState(0);
  const lastSlide = SLIDES.length; // the weight/CTA screen sits after the slides
  const isFinal = step === lastSlide;

  const next = () => setStep((s) => Math.min(lastSlide, s + 1));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm sm:p-4">
      <div className="w-full sm:max-w-lg bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl shadow-2xl relative overflow-hidden max-h-[95dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">
        {/* Skip — on by default, but always escapable. Returning users never
            see this at all (gated on onboardingComplete in App). */}
        <button
          onClick={completeOnboarding}
          className="absolute top-3 right-4 z-20 text-xs font-display font-semibold text-text-muted hover:text-text-primary transition-colors"
        >
          Skip
        </button>

        {/* Progress dots */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5">
          {Array.from({ length: lastSlide + 1 }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-5 bg-warm' : i < step ? 'w-1.5 bg-warm/50' : 'w-1.5 bg-[var(--color-border)]'
              }`}
            />
          ))}
        </div>

        {!isFinal ? (
          <Slide
            slide={SLIDES[step]}
            isFirst={step === 0}
            onNext={next}
          />
        ) : (
          <FinalSlide
            weight={userProfile.weight}
            onWeight={(v) => updateProfile({ weight: v })}
            onDone={completeOnboarding}
          />
        )}
      </div>
    </div>
  );
}

function Slide({
  slide,
  isFirst,
  onNext,
}: {
  slide: (typeof SLIDES)[number];
  isFirst: boolean;
  onNext: () => void;
}) {
  const Icon = slide.icon;
  return (
    <div className="px-8 pt-16 pb-8 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-warm/10 flex items-center justify-center mb-6">
        <Icon className="w-9 h-9 text-warm" />
      </div>
      <h2 className="text-2xl font-display font-bold text-text-primary mb-3">{slide.title}</h2>
      <p className="text-text-secondary text-[15px] leading-relaxed max-w-sm mx-auto mb-8">{slide.body}</p>
      <button
        onClick={onNext}
        className="w-full py-4 bg-accent hover:bg-accent-light text-white font-display font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all rounded-xl"
      >
        {isFirst ? 'Show me how' : 'Next'} <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function FinalSlide({
  weight,
  onWeight,
  onDone,
}: {
  weight: number;
  onWeight: (v: number) => void;
  onDone: () => void;
}) {
  return (
    <div className="px-8 pt-16 pb-8 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6">
        <Check className="w-9 h-9 text-accent" />
      </div>
      <h2 className="text-2xl font-display font-bold text-text-primary mb-2">One quick thing</h2>
      <p className="text-text-secondary text-[15px] leading-relaxed max-w-sm mx-auto mb-6">
        Roughly how much do you weigh? It's the one number that shapes how much fuel you need. You can change it anytime.
      </p>

      <div className="max-w-[200px] mx-auto mb-8">
        <label className="block text-xs font-display font-bold text-text-secondary uppercase mb-2">Weight (kg)</label>
        <NumberField
          value={weight}
          onChange={onWeight}
          min={30}
          max={200}
          ariaLabel="Weight in kilograms"
          commitOnBlur
          className="w-full text-center bg-surface border border-[var(--color-border)] rounded-lg p-4 text-text-primary font-display text-2xl focus:border-warm focus:ring-1 focus:ring-warm/20 focus:outline-none transition-colors"
        />
      </div>

      <button
        onClick={onDone}
        className="w-full py-4 bg-accent hover:bg-accent-light text-white font-display font-bold uppercase tracking-wider flex items-center justify-center gap-3 transition-all rounded-xl shadow-[0_0_20px_rgba(61,33,82,0.15)]"
      >
        Import your first route <ArrowRight className="w-4 h-4" />
      </button>
      <button
        onClick={onDone}
        className="w-full py-3 mt-1 text-text-muted hover:text-text-primary font-display text-sm transition-colors"
      >
        I'll set this later
      </button>
    </div>
  );
}
