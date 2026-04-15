import { useState, useEffect } from 'react';
import { X, MapPin, ChevronDown, ChevronUp, RotateCcw, Smile, Frown, Meh } from 'lucide-react';
import { getAllPlans, getAllFeedback, SavedPlan, PlanFeedback } from '../persistence/db';
import { useApp } from '../context/AppContext';
import { RouteData } from '../context/AppContext';
import { toast } from 'sonner';

interface HistoryViewProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  plan: SavedPlan;
  feedback?: PlanFeedback;
  nutritionSummary: {
    totalCarbs: number;
    totalSodium: number;
    totalCaffeine: number;
    totalCost: number;
    pointCount: number;
  };
}

function parsePlanSummary(plan: SavedPlan) {
  try {
    const route = JSON.parse(plan.routeDataJson) as RouteData;
    const points = route.nutritionPoints || [];
    return {
      totalCarbs: points.reduce((s, p) => s + p.product.carbs, 0),
      totalSodium: points.reduce((s, p) => s + p.product.sodium, 0),
      totalCaffeine: points.reduce((s, p) => s + p.product.caffeine, 0),
      totalCost: points.reduce((s, p) => s + (p.product.priceZAR || 0), 0),
      pointCount: points.length,
    };
  } catch {
    return { totalCarbs: 0, totalSodium: 0, totalCaffeine: 0, totalCost: 0, pointCount: 0 };
  }
}

function FeelIcon({ feel }: { feel: number }) {
  if (feel >= 4) return <Smile className="w-4 h-4 text-accent" />;
  if (feel >= 3) return <Meh className="w-4 h-4 text-warm" />;
  return <Frown className="w-4 h-4 text-red-400" />;
}

function HistoryCard({ entry, onReuse }: { entry: HistoryEntry; onReuse: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { plan, feedback, nutritionSummary } = entry;
  const date = plan.updatedAt || plan.createdAt;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-surfaceHighlight overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center gap-3 hover:bg-surfaceHighlight transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary truncate">
              {plan.routeName || plan.name}
            </span>
            {feedback && <FeelIcon feel={feedback.overallFeel} />}
          </div>
          <div className="text-[10px] text-text-muted font-display mt-0.5">
            {new Date(date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' · '}
            {plan.distanceKm.toFixed(1)}km
            {' · '}
            {nutritionSummary.pointCount} points
            {' · '}
            {nutritionSummary.totalCarbs}g carbs
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--color-border)]">
          {/* Nutrition Summary */}
          <div className="grid grid-cols-4 gap-2 pt-3">
            <div className="text-center">
              <div className="text-xs font-display font-bold text-warm">{nutritionSummary.totalCarbs}g</div>
              <div className="text-[8px] text-text-muted">carbs</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-display font-bold text-cyan-400">{nutritionSummary.totalSodium}mg</div>
              <div className="text-[8px] text-text-muted">sodium</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-display font-bold text-amber-400">{nutritionSummary.totalCaffeine}mg</div>
              <div className="text-[8px] text-text-muted">caffeine</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-display font-bold text-accent">R{nutritionSummary.totalCost.toFixed(0)}</div>
              <div className="text-[8px] text-text-muted">cost</div>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className="p-2.5 rounded-lg bg-surfaceHighlight space-y-1.5">
              <div className="text-[9px] text-text-muted uppercase tracking-wider">Feedback</div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-text-secondary">Feel: <span className="text-text-primary font-semibold">{feedback.overallFeel}/5</span></span>
                <span className="text-text-secondary">Execution: <span className="text-text-primary font-semibold">{feedback.executionQuality}/5</span></span>
                <span className={`font-medium ${feedback.bonkLevel === 0 ? 'text-accent' : feedback.bonkLevel === 1 ? 'text-warm' : 'text-red-400'}`}>
                  {feedback.bonkLevel === 0 ? 'No bonk' : feedback.bonkLevel === 1 ? 'Mild bonk' : 'Severe bonk'}
                </span>
              </div>
              {feedback.notes && (
                <p className="text-[10px] text-text-secondary italic">{feedback.notes}</p>
              )}
            </div>
          )}

          {/* Re-use Button */}
          <button
            onClick={onReuse}
            className="w-full py-2 rounded-lg border border-accent/20 text-accent text-xs font-medium hover:bg-accent/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            Re-use this plan
          </button>
        </div>
      )}
    </div>
  );
}

export function HistoryView({ isOpen, onClose }: HistoryViewProps) {
  const { loadSavedRoute } = useApp();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // We need setRouteData but it's not exposed. We'll use a workaround by accessing the full route from the plan.
  // Actually, we can use the existing context to load a route from saved plan data.

  useEffect(() => {
    if (!isOpen) return;

    async function load() {
      const [plans, feedback] = await Promise.all([getAllPlans(), getAllFeedback()]);

      // Filter out autosave plans
      const userPlans = plans.filter((p) => !p.name.startsWith('Auto-save:'));

      // Match feedback to plans
      const feedbackByPlan = new Map<number, PlanFeedback>();
      for (const fb of feedback) {
        if (fb.planId) feedbackByPlan.set(fb.planId, fb);
      }

      const entries: HistoryEntry[] = userPlans.map((plan) => ({
        plan,
        feedback: plan.id ? feedbackByPlan.get(plan.id) : undefined,
        nutritionSummary: parsePlanSummary(plan),
      }));

      setEntries(entries);
      setLoading(false);
    }

    load();
  }, [isOpen]);

  if (!isOpen) return null;

  // Group by month
  const grouped = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const date = entry.plan.updatedAt || entry.plan.createdAt;
    const key = new Date(date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    const existing = grouped.get(key) ?? [];
    existing.push(entry);
    grouped.set(key, existing);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div>
            <div className="text-[10px] text-accent uppercase tracking-wider font-bold">Past</div>
            <h2 className="text-lg font-bold text-text-primary">Nutrition History</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-secondary">No saved plans yet</p>
              <p className="text-[10px] text-text-muted mt-1">Save a plan to see it here</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([month, items]) => (
              <div key={month}>
                <h3 className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-2">{month}</h3>
                <div className="space-y-2">
                  {items.map((entry) => (
                    <HistoryCard
                      key={entry.plan.id}
                      entry={entry}
                      onReuse={() => {
                        try {
                          const route = JSON.parse(entry.plan.routeDataJson) as RouteData;
                          loadSavedRoute(route);
                          toast.success('Plan loaded');
                          onClose();
                        } catch {
                          toast.error('Failed to load plan');
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
