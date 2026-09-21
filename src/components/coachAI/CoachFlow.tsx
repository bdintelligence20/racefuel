import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, Gauge, Droplets, TrendingUp, Clock, Package, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TrailBackdrop } from '../TrailBackdrop';
import { buildAthleteJourney, type AthleteJourney } from '../../services/coachAI/athleteJourney';
import { getCoachRecommendations, type CoachResult, type CoachCategory, type CoachRecommendation } from '../../services/coachAI/coachRecommender';
import { requestOpenGutTraining } from '../../services/gutTrainingOpen';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_META: Record<CoachCategory, { label: string; icon: React.ElementType }> = {
  carbs: { label: 'Carbs', icon: Gauge },
  hydration: { label: 'Hydration', icon: Droplets },
  products: { label: 'Products', icon: Package },
  'gut-training': { label: 'Gut training', icon: TrendingUp },
  execution: { label: 'Execution', icon: Clock },
};

/**
 * The athlete's AI coach surface. Builds their journey, asks the recommender,
 * and presents an answer-first read plus a short list of explained
 * recommendations. Full-screen, White + Pine, ruled structure over cards.
 */
export function CoachFlow({ isOpen, onClose }: Props) {
  const { userProfile } = useApp();
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<AthleteJourney | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setResult(null);
    setJourney(null);
    void (async () => {
      const j = await buildAthleteJourney(userProfile);
      if (cancelled) return;
      setJourney(j);
      if (!j.hasEnoughData) {
        setLoading(false);
        return;
      }
      const r = await getCoachRecommendations(j, userProfile);
      if (cancelled) return;
      setResult(r);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userProfile, nonce]);

  if (!isOpen) return null;

  const label = 'text-[9px] font-display font-semibold uppercase tracking-wider text-text-muted';

  return createPortal(
    <div className="fixed inset-0 z-50 bg-background flex flex-col safe-top safe-bottom">
      <TrailBackdrop showRoute={false} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Header */}
      <div className="relative flex-shrink-0 flex items-center justify-between px-4 py-3">
        <span className="text-sm font-display font-black text-text-primary tracking-tight">Your coach</span>
        <div className="flex items-center gap-1">
          {journey?.hasEnoughData && !loading && (
            <button
              onClick={() => setNonce((n) => n + 1)}
              className="p-2 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-5 py-6">
          {loading ? (
            <LoadingState />
          ) : !journey?.hasEnoughData ? (
            <EmptyState journey={journey} />
          ) : (
            <ReadyState journey={journey} result={result} label={label} onClose={onClose} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center text-center py-24">
      <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      <h2 className="text-base font-display font-bold text-text-primary mt-4">Reading your journey…</h2>
      <p className="text-sm text-text-muted mt-1">Looking at your runs, ratings and gut sessions</p>
    </div>
  );
}

function EmptyState({ journey }: { journey: AthleteJourney | null }) {
  const s = journey?.signals;
  return (
    <div className="flex flex-col items-center text-center min-h-[60vh] justify-center">
      <div className="text-[9px] font-display font-semibold uppercase tracking-wider text-accent/80">Your coach</div>
      <h2 className="text-[2rem] leading-[1.1] font-display font-black text-text-primary tracking-tight mt-3 max-w-md">
        Getting to know<br />
        <span className="text-accent">your gut.</span>
      </h2>
      <p className="text-sm text-text-secondary mt-3 max-w-sm leading-relaxed">
        As you log runs, rate products and train your gut, your coach learns what works for you and gives sharper, personal recommendations.
      </p>
      {s && (
        <div className="flex items-center gap-6 mt-6">
          <Signal n={s.runs} label="runs logged" />
          <Signal n={s.ratings} label="ratings" />
          <Signal n={s.gutSessions} label="gut sessions" />
        </div>
      )}
      <p className="text-[11px] text-text-muted mt-6 max-w-xs">
        Log a couple of runs and rate what you fuelled with to unlock your first recommendations.
      </p>
    </div>
  );
}

function Signal({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="text-2xl font-display font-black text-accent-muted tabular-nums">{n}</div>
      <div className="text-[9px] font-display font-semibold uppercase tracking-wider text-text-muted mt-1">{label}</div>
    </div>
  );
}

function ReadyState({
  journey,
  result,
  label,
  onClose,
}: {
  journey: AthleteJourney;
  result: CoachResult | null;
  label: string;
  onClose: () => void;
}) {
  const { runs, carb } = journey;
  return (
    <>
      {/* Answer-first read */}
      <div className="text-[9px] font-display font-semibold uppercase tracking-wider text-accent/80">Where you are</div>
      <h1 className="text-[1.75rem] leading-[1.15] font-display font-black text-text-primary tracking-tight mt-2 text-balance">
        {result?.headline ?? 'Here is what your data is telling us.'}
      </h1>

      {/* Journey stat band */}
      <div className="flex items-stretch mt-5 pb-5 border-b border-[var(--color-border)] gap-6 flex-wrap">
        <Stat value={String(journey.signals.runs)} unit="runs logged" label={label} />
        {carb.currentTargetGPerHour !== null && (
          <Stat value={String(carb.currentTargetGPerHour)} unit="g/h target" label={label} />
        )}
        {carb.gutTolerance && (
          <Stat value={carb.gutTolerance} unit="gut tolerance" label={label} capitalize />
        )}
        {runs.avgOverallFeel !== null && (
          <Stat value={`${runs.avgOverallFeel}`} unit="avg feel · /5" label={label} />
        )}
        {carb.cleanStreak > 0 && (
          <Stat value={String(carb.cleanStreak)} unit="clean gut sessions" label={label} />
        )}
      </div>

      {/* Recommendations — ruled rows */}
      <div className="mt-6">
        <div className={`${label} mb-1`}>Recommendations</div>
        <div>
          {(result?.recommendations ?? []).map((rec) => (
            <RecommendationRow key={rec.id} rec={rec} onClose={onClose} />
          ))}
        </div>
      </div>

      {/* Provenance */}
      {result && (
        <p className="text-[10px] text-text-muted mt-6 font-display">
          {result.source === 'ai' ? 'Personalised by FuelCue AI' : 'From your logged data'} · grounded in your history and the sports-nutrition evidence base.
        </p>
      )}
    </>
  );
}

function Stat({ value, unit, label, capitalize }: { value: string; unit: string; label: string; capitalize?: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-display font-black text-accent tabular-nums leading-none ${capitalize ? 'capitalize' : ''}`}>{value}</div>
      <div className={`${label} mt-1.5`}>{unit}</div>
    </div>
  );
}

function RecommendationRow({ rec, onClose }: { rec: CoachRecommendation; onClose: () => void }) {
  const meta = CATEGORY_META[rec.category];
  const Icon = meta.icon;
  const conf = rec.confidence;
  const confColor = conf === 'high' ? 'text-accent' : 'text-text-muted';
  // Only the gut-training action is safe to wire directly (it just opens the
  // flow). Other actions render as a quiet suggestion, not a button, so we
  // never imply automation we haven't built.
  const opensGut = rec.action && /gut training/i.test(rec.action);

  return (
    <div className="py-4 border-t border-[var(--color-border)] first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-display font-semibold uppercase tracking-wider text-accent">
          <Icon className="w-3.5 h-3.5" />
          {meta.label}
        </span>
        <span className={`text-[9px] font-display font-semibold uppercase tracking-wider ${confColor}`}>{conf} confidence</span>
      </div>
      <h3 className="text-[15px] font-display font-bold text-text-primary mt-2 leading-snug">{rec.title}</h3>
      <p className="text-sm text-text-secondary mt-1 leading-relaxed">{rec.detail}</p>
      {rec.why && (
        <p className="text-[12px] text-text-muted mt-2 leading-relaxed">
          <span className="font-display font-semibold uppercase tracking-wider text-[9px] text-text-muted/80">Why </span>
          {rec.why}
        </p>
      )}
      {rec.action && (
        opensGut ? (
          <button
            onClick={() => {
              onClose();
              requestOpenGutTraining();
            }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-accent/30 text-accent text-xs font-display font-bold hover:bg-accent/[0.06] transition-colors"
          >
            {rec.action} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-display font-semibold text-accent/90">
            <ArrowRight className="w-3 h-3" /> {rec.action}
          </div>
        )
      )}
    </div>
  );
}
