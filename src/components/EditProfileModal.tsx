import { useState, useEffect, useMemo } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, User, Zap, Wind, Ruler, RefreshCw } from 'lucide-react';
import { useApp, UserProfile } from '../context/AppContext';
import { NumberField } from './ui/NumberField';
import { useProducts } from '../data/products';

function PreferredBrandsPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const products = useProducts();
  const brands = useMemo(() => {
    const set = new Set(products.map((p) => p.brand));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const selected = new Set(value.map((b) => b.toLowerCase()));
  const toggle = (brand: string) => {
    const lower = brand.toLowerCase();
    if (selected.has(lower)) {
      onChange(value.filter((b) => b.toLowerCase() !== lower));
    } else {
      onChange([...value, brand]);
    }
  };

  if (brands.length === 0) {
    return <div className="text-[11px] text-text-muted italic">Loading brands…</div>;
  }
  return (
    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
      {brands.map((brand) => {
        const on = selected.has(brand.toLowerCase());
        return (
          <button
            key={brand}
            type="button"
            onClick={() => toggle(brand)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-display font-semibold transition-colors ${
              on
                ? 'bg-accent/20 border border-accent/50 text-accent'
                : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
            }`}
          >
            {brand}
          </button>
        );
      })}
    </div>
  );
}

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
  useModalBehavior(isOpen, onClose);


  if (!isOpen) return null;

  const handleChange = (field: keyof UserProfile, value: string | number | string[] | boolean | undefined) => {
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
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — flex column with a scrollable middle so the profile body
          can scroll when it grows past the viewport. Previously the body
          overflowed and everything below "Sweat Rate" was unreachable. */}
      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-md max-h-[90dvh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text-primary">Edit Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary"
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
                <div className="text-sm text-text-primary">
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
        <div className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
          {/* Weight */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <User className="w-3 h-3 text-accent" />
              Weight
            </label>
            <div className="flex items-center gap-2">
              <NumberField
                value={formData.weight}
                onChange={(v) => handleChange('weight', v)}
                min={30}
                max={200}
                ariaLabel="Weight in kilograms"
                commitOnBlur
                className="flex-1 bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-lg font-display p-3 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-text-muted font-display text-sm w-12">kg</span>
            </div>
          </div>

          {/* Height */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Ruler className="w-3 h-3 text-accent" />
              Height
            </label>
            <div className="flex items-center gap-2">
              <NumberField
                value={formData.height}
                onChange={(v) => handleChange('height', v)}
                min={120}
                max={230}
                ariaLabel="Height in centimetres"
                commitOnBlur
                className="flex-1 bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-lg font-display p-3 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-text-muted font-display text-sm w-12">cm</span>
            </div>
          </div>

          {/* FTP */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Zap className="w-3 h-3 text-accent" />
              FTP (Functional Threshold Power)
            </label>
            <div className="flex items-center gap-2">
              <NumberField
                value={formData.ftp}
                onChange={(v) => handleChange('ftp', v)}
                min={50}
                max={600}
                ariaLabel="FTP in watts"
                commitOnBlur
                className="flex-1 bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-lg font-display p-3 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-text-muted font-display text-sm w-12">W</span>
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
                      : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
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

          {/* Sport */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Zap className="w-3 h-3 text-accent" />
              Sport
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['running', 'cycling'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleChange('sport', s)}
                  className={`py-3 rounded-lg text-sm font-bold uppercase transition-colors ${
                    (formData.sport ?? 'running') === s
                      ? 'bg-accent/20 border border-accent/50 text-accent'
                      : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              Drives baseline sweat rate and intensity coefficients.
            </p>
          </div>

          {/* Gut tolerance */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Zap className="w-3 h-3 text-accent" />
              Gut Training
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['beginner', 'trained', 'elite'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => handleChange('gutTolerance', g)}
                  className={`py-3 rounded-lg text-xs font-bold uppercase transition-colors ${
                    (formData.gutTolerance ?? 'trained') === g
                      ? 'bg-accent/20 border border-accent/50 text-accent'
                      : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
                  }`}
                >
                  {g === 'beginner' ? '≤60 g/h' : g === 'trained' ? '≤90 g/h' : '≤120 g/h'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              Hard cap on auto-planned carbs. Raise only after gradual gut training.
            </p>
          </div>

          {/* Sweat sodium bucket */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Wind className="w-3 h-3 text-accent" />
              Sweat Sodium
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'unknown'] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => handleChange('sweatSodiumBucket', b)}
                  className={`py-3 rounded-lg text-[11px] font-bold uppercase transition-colors ${
                    (formData.sweatSodiumBucket ?? 'unknown') === b
                      ? 'bg-accent/20 border border-accent/50 text-accent'
                      : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              Self-report or sweat-test. Low ≤30 mmol/L · Medium 30–50 · High ≥50. Unknown defaults to Medium.
            </p>
          </div>

          {/* Acclimatisation */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Wind className="w-3 h-3 text-accent" />
              Heat Acclimatisation
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleChange('heatAcclimatised', !formData.heatAcclimatised)}
                className={`py-3 rounded-lg text-xs font-bold uppercase transition-colors ${
                  formData.heatAcclimatised
                    ? 'bg-accent/20 border border-accent/50 text-accent'
                    : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
                }`}
              >
                Acclimatised
              </button>
              <button
                onClick={() => handleChange('earlySeasonHeat', !formData.earlySeasonHeat)}
                className={`py-3 rounded-lg text-xs font-bold uppercase transition-colors ${
                  formData.earlySeasonHeat
                    ? 'bg-accent/20 border border-accent/50 text-accent'
                    : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
                }`}
              >
                Early Season
              </button>
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              Acclimatised athletes conserve sodium; first 10–14 days of heat season run slightly high.
            </p>
          </div>

          {/* Custom carb target — overrides the spec tier */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Zap className="w-3 h-3 text-accent" />
              Carb Target Override
            </label>
            <div className="flex items-center gap-2">
              <NumberField
                value={formData.carbTargetGPerHour ?? 0}
                onChange={(v) => handleChange('carbTargetGPerHour', v > 0 ? v : 0)}
                min={0}
                max={120}
                ariaLabel="Carb target override in grams per hour"
                commitOnBlur
                className="flex-1 bg-surface border border-[var(--color-border)] rounded-lg text-text-primary text-lg font-display p-3 focus:outline-none focus:border-accent transition-colors"
              />
              <span className="text-text-muted font-display text-sm w-20">g/h</span>
              {formData.carbTargetGPerHour ? (
                <button
                  type="button"
                  onClick={() => handleChange('carbTargetGPerHour', 0)}
                  className="text-[11px] text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surfaceHighlight transition-colors"
                >
                  Reset
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              Leave at 0 to use spec tiers. If you&apos;ve gut-trained to a specific rate (e.g. 90 g/h), set it here — the planner will target that and raise the gut ceiling to match.
            </p>
          </div>

          {/* Preferred brands */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Zap className="w-3 h-3 text-accent" />
              Preferred Brands
            </label>
            <PreferredBrandsPicker
              value={formData.preferredBrands ?? []}
              onChange={(next) => handleChange('preferredBrands', next)}
            />
            <p className="mt-2 text-[10px] text-text-muted">
              Soft bias — preferred brands get a small edge when the planner picks between similar products, but every placement can still be any brand to keep variety. Leave empty for no preference.
            </p>
          </div>

          {/* Preferred fuel categories */}
          <div>
            <label className="flex items-center gap-2 text-xs text-text-secondary uppercase tracking-wider mb-2">
              <Zap className="w-3 h-3 text-accent" />
              Preferred Fuel
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['gel', 'drink', 'bar', 'chew'] as const).map((cat) => {
                const selected = (formData.preferredCategories ?? []).includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      const current = formData.preferredCategories ?? [];
                      const next = selected ? current.filter((c) => c !== cat) : [...current, cat];
                      handleChange('preferredCategories', next);
                    }}
                    className={`py-3 rounded-lg text-xs font-bold uppercase transition-colors ${
                      selected
                        ? 'bg-accent/20 border border-accent/50 text-accent'
                        : 'bg-surfaceHighlight border border-[var(--color-border)] text-text-muted hover:bg-accent/[0.08] hover:text-text-primary'
                    }`}
                  >
                    {cat === 'gel' ? 'Gels' : cat === 'drink' ? 'Drinks' : cat === 'bar' ? 'Bars' : 'Chews'}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-text-muted">
              Auto-generate biases toward what you tick. Leave all off for no preference.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[var(--color-border)] bg-surfaceHighlight flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-surfaceHighlight border border-[var(--color-border)] rounded-lg text-text-primary text-sm font-bold uppercase tracking-wider hover:bg-accent/[0.08] transition-colors"
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
