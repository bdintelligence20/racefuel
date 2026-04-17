import { useState, useEffect } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, FolderOpen, Trash2, Edit3, Check, Calendar, Mountain, Route } from 'lucide-react';
import { SavedPlan, getAllPlans, deletePlan, updatePlan } from '../persistence/db';
import { useApp, RouteData } from '../context/AppContext';
import { toast } from 'sonner';

interface SavedPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SavedPlansModal({ isOpen, onClose }: SavedPlansModalProps) {
  const { loadSavedRoute } = useApp();
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const allPlans = await getAllPlans();
      // Hide internal auto-saves — they're resume-state, not user-facing saved plans
      const userPlans = allPlans.filter((p) => !p.name.startsWith('Auto-save:'));
      setPlans(userPlans);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePlan(id);
      setPlans(prev => prev.filter(p => p.id !== id));
      toast.success('Plan deleted');
    } catch {
      toast.error('Failed to delete plan');
    }
  };

  const handleRename = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await updatePlan(id, { name: editName.trim() });
      setPlans(prev => prev.map(p => p.id === id ? { ...p, name: editName.trim() } : p));
      setEditingId(null);
      toast.success('Plan renamed');
    } catch {
      toast.error('Failed to rename plan');
    }
  };

  const handleLoad = (plan: SavedPlan) => {
    try {
      const route = JSON.parse(plan.routeDataJson) as RouteData;
      loadSavedRoute(route);
      toast.success('Plan loaded');
      onClose();
    } catch {
      toast.error('Failed to load plan — data may be corrupted');
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  useModalBehavior(isOpen, onClose);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[80dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text-primary">Saved Plans</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plans List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="text-center py-12 text-text-muted font-display text-sm">
              Loading plans...
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-muted">No saved plans yet</p>
              <p className="text-xs text-text-secondary mt-1">
                Plans are auto-saved as you work
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-4 hover:bg-surfaceHighlight transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {editingId === plan.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="bg-surface border border-[var(--color-border)] text-text-primary text-sm font-display p-1.5 focus:outline-none focus:border-accent flex-1"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRename(plan.id ?? 0);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button
                            onClick={() => handleRename(plan.id ?? 0)}
                            className="p-1.5 bg-accent-light/20 text-accent-light hover:bg-accent-light/30 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <h3 className="text-sm font-bold text-text-primary truncate">
                          {plan.name}
                        </h3>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted font-display">
                        <span className="flex items-center gap-1">
                          <Route className="w-3 h-3" />
                          {plan.distanceKm.toFixed(1)}km
                        </span>
                        <span className="flex items-center gap-1">
                          <Mountain className="w-3 h-3" />
                          {plan.elevationGain}m
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(plan.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingId(plan.id ?? 0);
                          setEditName(plan.name);
                        }}
                        className="p-1.5 hover:bg-accent/[0.08] text-text-muted hover:text-text-primary transition-colors"
                        title="Rename"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id ?? 0)}
                        className="p-1.5 hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Load button */}
                  <button
                    onClick={() => handleLoad(plan)}
                    className="mt-2 w-full py-1.5 text-[10px] font-bold uppercase tracking-wider bg-surfaceHighlight border border-[var(--color-border)] rounded-lg text-text-secondary hover:bg-accent/10 hover:border-accent/50 hover:text-accent transition-colors"
                  >
                    Load Plan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--color-border)] text-center">
          <span className="text-[10px] text-text-muted font-display">
            {plans.length} {plans.length === 1 ? 'plan' : 'plans'} saved
          </span>
        </div>
      </div>
    </div>
  );
}
