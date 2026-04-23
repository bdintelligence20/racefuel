import { useState } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, Package, Tag, ChevronRight, Check } from 'lucide-react';
import { bundles, ProductBundle, BundleTier } from '../data/bundles';
import { useProducts } from '../data/products';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { FlavourPicker, loadStoredFlavours, saveStoredFlavours } from './FlavourPicker';

interface BundlePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

const tierConfig: Record<BundleTier, { label: string; color: string; bg: string }> = {
  starter: { label: 'Starter', color: 'text-accent', bg: 'bg-accent/10 border-accent/20' },
  standard: { label: 'Standard', color: 'text-warm', bg: 'bg-warm/10 border-warm/20' },
  premium: { label: 'Premium', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
};

function BundleCard({
  bundle,
  onSelect,
  isSelected,
}: {
  bundle: ProductBundle;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const products = useProducts();
  const tier = tierConfig[bundle.tier];
  const savings = Math.round(((bundle.retailPriceZAR - bundle.priceZAR) / bundle.retailPriceZAR) * 100);

  const bundleProducts = bundle.products
    .map((bp) => {
      const product = products.find((p) => p.id === bp.productId);
      return product ? { ...product, quantity: bp.quantity } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const totalCarbs = bundleProducts.reduce((s, p) => s + (p.carbs * p.quantity), 0);

  return (
    <div className={`rounded-xl border bg-surfaceHighlight overflow-hidden transition-colors ${isSelected ? 'border-accent ring-1 ring-accent/30' : 'border-[var(--color-border)]'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-start gap-3 hover:bg-surfaceHighlight transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-surfaceHighlight flex items-center justify-center flex-shrink-0">
          <Package className={`w-5 h-5 ${tier.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-text-primary">{bundle.name}</span>
            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${tier.bg} ${tier.color}`}>
              {tier.label}
            </span>
          </div>
          <p className="text-[10px] text-text-muted">{bundle.description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-sm font-display font-bold text-accent">R{bundle.priceZAR}</span>
            <span className="text-[10px] font-display text-text-muted line-through">R{bundle.retailPriceZAR.toFixed(0)}</span>
            <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
              Save {savings}%
            </span>
            <span className="text-[9px] text-text-muted">{bundle.targetDistance}</span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border)] pt-3">
          {/* Products in bundle */}
          <div className="space-y-1.5">
            {bundleProducts.map((p) => p && (
              <div key={p.id} className="flex items-center gap-2 text-[10px]">
                <div className="w-6 h-6 rounded-full bg-white overflow-hidden flex-shrink-0">
                  <img src={p.image} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
                <span className="text-text-secondary flex-1 truncate">{p.brand} {p.name}</span>
                <span className="text-text-muted font-display">x{p.quantity}</span>
                <span className="text-text-muted font-display">{p.carbs * p.quantity}g carbs</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-text-muted border-t border-[var(--color-border)] pt-2">
            <span>Total: {totalCarbs}g carbs</span>
            <span>{bundleProducts.reduce((s, p) => s + p.quantity, 0)} items</span>
          </div>

          <button
            onClick={onSelect}
            className={`w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors ${
              isSelected
                ? 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/15'
                : 'bg-accent text-white hover:bg-accent-light'
            }`}
          >
            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
            {isSelected ? 'Selected — tap to deselect' : 'Use this bundle'}
          </button>
        </div>
      )}
    </div>
  );
}

export function BundlePicker({ isOpen, onClose }: BundlePickerProps) {
  const { selectedBundleId, selectBundle } = useApp();
  const [selectedTier, setSelectedTier] = useState<BundleTier | 'all'>('all');
  // Two-step flow: "list" lets the user browse kits, "flavour" captures their
  // flavour preference for each product in the chosen kit before we commit.
  const [step, setStep] = useState<{ kind: 'list' } | { kind: 'flavour'; bundle: ProductBundle }>({ kind: 'list' });
  useModalBehavior(isOpen, onClose);


  if (!isOpen) return null;

  const filtered = selectedTier === 'all' ? bundles : bundles.filter((b) => b.tier === selectedTier);
  const selectedBundle = selectedBundleId ? bundles.find((b) => b.id === selectedBundleId) : null;

  const handleSelectBundle = (bundle: ProductBundle) => {
    if (selectedBundleId === bundle.id) {
      // Tap-to-deselect when already selected.
      selectBundle(null);
      toast.success('Bundle deselected — auto-generate will use the full catalog');
      return;
    }
    // Jump to flavour-picker step; only commit the bundle once flavours chosen.
    setStep({ kind: 'flavour', bundle });
  };

  const handleFlavoursConfirmed = (bundle: ProductBundle, selections: Record<string, string>) => {
    saveStoredFlavours(bundle.id, selections);
    selectBundle(bundle.id);
    toast.success(`Selected "${bundle.name}" — flavours saved and auto-generate will use these products`);
    setStep({ kind: 'list' });
    onClose();
  };

  if (step.kind === 'flavour') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden">
          <FlavourPicker
            bundle={step.bundle}
            initialSelections={loadStoredFlavours(step.bundle.id)}
            onBack={() => setStep({ kind: 'list' })}
            onConfirm={(sel) => handleFlavoursConfirmed(step.bundle, sel)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-lg max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div>
            <div className="text-[10px] text-accent uppercase tracking-wider font-bold">Shop</div>
            <h2 className="text-lg font-bold text-text-primary">Nutrition Bundles</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currently-selected bundle banner */}
        {selectedBundle && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-accent/10 border border-accent/30 flex items-center gap-2">
            <Check className="w-4 h-4 text-accent flex-shrink-0" />
            <div className="flex-1 text-xs font-display text-text-primary truncate">
              Active: <span className="font-semibold">{selectedBundle.name}</span>
              <span className="text-text-muted"> · R{selectedBundle.priceZAR}</span>
            </div>
            <button
              onClick={() => { selectBundle(null); toast.success('Bundle cleared'); }}
              className="text-[10px] font-display font-bold uppercase tracking-wider text-accent hover:text-accent-light px-2 py-1 rounded"
            >
              Clear
            </button>
          </div>
        )}

        {/* Tier Filter */}
        <div className="px-4 pt-3 flex gap-2">
          {(['all', 'starter', 'standard', 'premium'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                selectedTier === tier
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'bg-surfaceHighlight text-text-muted border border-[var(--color-border)] hover:text-text-secondary'
              }`}
            >
              {tier === 'all' ? 'All' : tierConfig[tier].label}
            </button>
          ))}
        </div>

        {/* Bundles */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          {filtered.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              isSelected={bundle.id === selectedBundleId}
              onSelect={() => handleSelectBundle(bundle)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
