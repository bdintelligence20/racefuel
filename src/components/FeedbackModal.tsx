import { useState } from 'react';
import { X, Frown, Meh, Smile, SmilePlus, Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { addFeedback } from '../persistence/db';
import { toast } from 'sonner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const feelIcons = [
  { value: 1, icon: Frown, label: 'Terrible' },
  { value: 2, icon: Frown, label: 'Bad' },
  { value: 3, icon: Meh, label: 'OK' },
  { value: 4, icon: Smile, label: 'Good' },
  { value: 5, icon: SmilePlus, label: 'Great' },
];

const gutOptions = [
  { value: 'none' as const, label: 'None', color: 'text-accent' },
  { value: 'mild' as const, label: 'Mild', color: 'text-warm' },
  { value: 'moderate' as const, label: 'Moderate', color: 'text-orange-400' },
  { value: 'severe' as const, label: 'Severe', color: 'text-red-400' },
];

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { routeData } = useApp();
  const [overallFeel, setOverallFeel] = useState(0);
  const [bonkLevel, setBonkLevel] = useState(0);
  const [executionQuality, setExecutionQuality] = useState(0);
  const [gutIssues, setGutIssues] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const totalCarbs = routeData.nutritionPoints.reduce((s, p) => s + p.product.carbs, 0);
  const totalSodium = routeData.nutritionPoints.reduce((s, p) => s + p.product.sodium, 0);
  const totalCaffeine = routeData.nutritionPoints.reduce((s, p) => s + p.product.caffeine, 0);

  const handleSubmit = async () => {
    if (overallFeel === 0) return;
    setSaving(true);
    try {
      await addFeedback({
        routeName: routeData.name,
        date: new Date(),
        overallFeel,
        bonkLevel,
        executionQuality,
        gutIssues,
        notes: notes.trim() || undefined,
        plannedCarbs: totalCarbs,
        plannedSodium: totalSodium,
        plannedCaffeine: totalCaffeine,
      });
      toast.success('Feedback saved');
      onClose();
    } catch {
      toast.error('Failed to save feedback');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div>
            <div className="text-[10px] text-accent uppercase tracking-wider font-bold">Post-Run</div>
            <h2 className="text-lg font-bold text-text-primary">Nutrition Feedback</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Route Summary */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surfaceHighlight border border-[var(--color-border)]">
            <div className="flex-1">
              <div className="text-sm font-semibold text-text-primary">{routeData.name || 'Unnamed Route'}</div>
              <div className="text-[10px] text-text-muted font-display">
                {routeData.distanceKm.toFixed(1)}km &middot; {totalCarbs}g carbs &middot; {totalSodium}mg Na
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Overall Feel */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">
              How did you feel?
            </label>
            <div className="flex gap-2">
              {feelIcons.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setOverallFeel(value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                    overallFeel === value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-[var(--color-border)] text-text-muted hover:border-[var(--color-border)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bonk Level */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">
              Did you bonk?
            </label>
            <div className="flex gap-2">
              {['No bonk', 'Mild bonk', 'Severe bonk'].map((label, i) => (
                <button
                  key={i}
                  onClick={() => setBonkLevel(i)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    bonkLevel === i
                      ? i === 0 ? 'border-accent bg-accent/10 text-accent'
                        : i === 1 ? 'border-warm bg-warm/10 text-warm'
                        : 'border-red-400 bg-red-400/10 text-red-400'
                      : 'border-[var(--color-border)] text-text-muted hover:border-[var(--color-border)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Execution Quality */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">
              Plan execution (did you follow the plan?)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setExecutionQuality(v)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-display font-bold transition-all ${
                    executionQuality === v
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-[var(--color-border)] text-text-muted hover:border-[var(--color-border)]'
                  }`}
                >
                  {v}/5
                </button>
              ))}
            </div>
          </div>

          {/* Gut Issues */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">
              Gut issues
            </label>
            <div className="flex gap-2">
              {gutOptions.map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() => setGutIssues(value)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    gutIssues === value
                      ? `border-current bg-current/10 ${color}`
                      : 'border-[var(--color-border)] text-text-muted hover:border-[var(--color-border)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wider block mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did the nutrition strategy work? Any changes for next time?"
              className="w-full bg-surfaceHighlight border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none h-24 focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="p-4 border-t border-[var(--color-border)] bg-surfaceHighlight">
          <button
            onClick={handleSubmit}
            disabled={overallFeel === 0 || saving}
            className="w-full py-3 bg-accent text-black text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Heart className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
