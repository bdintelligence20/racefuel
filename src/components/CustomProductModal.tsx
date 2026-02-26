import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { ProductProps, ProductCategory } from './NutritionCard';
import { nanoid } from 'nanoid';

interface CustomProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: ProductProps) => void;
}

const categoryOptions: { value: ProductCategory; label: string }[] = [
  { value: 'gel', label: 'Gel' },
  { value: 'drink', label: 'Drink' },
  { value: 'bar', label: 'Bar' },
  { value: 'chew', label: 'Chew' },
];

const colorOptions: { value: ProductProps['color']; label: string }[] = [
  { value: 'orange', label: 'Orange' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'yellow', label: 'Yellow' },
];

const CUSTOM_PRODUCTS_KEY = 'racefuel_custom_products';

export function loadCustomProducts(): ProductProps[] {
  try {
    const stored = localStorage.getItem(CUSTOM_PRODUCTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveCustomProduct(product: ProductProps): void {
  const existing = loadCustomProducts();
  existing.push(product);
  localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(existing));
}

export function removeCustomProduct(id: string): void {
  const existing = loadCustomProducts().filter(p => p.id !== id);
  localStorage.setItem(CUSTOM_PRODUCTS_KEY, JSON.stringify(existing));
}

export function CustomProductModal({ isOpen, onClose, onAdd }: CustomProductModalProps) {
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('100');
  const [carbs, setCarbs] = useState('25');
  const [sodium, setSodium] = useState('50');
  const [caffeine, setCaffeine] = useState('0');
  const [price, setPrice] = useState('30');
  const [category, setCategory] = useState<ProductCategory>('gel');
  const [color, setColor] = useState<ProductProps['color']>('orange');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !name.trim()) return;

    const product: ProductProps = {
      id: `custom-${nanoid(8)}`,
      brand: brand.trim(),
      name: name.trim(),
      calories: parseInt(calories) || 0,
      carbs: parseInt(carbs) || 0,
      sodium: parseInt(sodium) || 0,
      caffeine: parseInt(caffeine) || 0,
      priceZAR: parseFloat(price) || 0,
      category,
      color,
      image: `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100" rx="10"/><text x="50" y="45" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${encodeURIComponent(brand.trim().substring(0, 6).toUpperCase())}</text><text x="50" y="65" text-anchor="middle" fill="%23999" font-size="8">${encodeURIComponent(name.trim().substring(0, 8))}</text></svg>`,
    };

    saveCustomProduct(product);
    onAdd(product);

    // Reset form
    setBrand('');
    setName('');
    setCalories('100');
    setCarbs('25');
    setSodium('50');
    setCaffeine('0');
    setPrice('30');
    setCategory('gel');
    setColor('orange');
    onClose();
  };

  if (!isOpen) return null;

  const inputClass = 'w-full bg-black/50 border border-white/10 text-white text-xs font-mono p-2.5 focus:outline-none focus:border-neon-orange transition-colors';
  const labelClass = 'text-[10px] text-text-secondary uppercase tracking-wider mb-1 block';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-white/10 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-neon-orange" />
            <h2 className="text-lg font-bold text-white">Custom Product</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Brand & Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Brand *</label>
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="e.g. Hammer"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Product Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Gel"
                className={inputClass}
                required
              />
            </div>
          </div>

          {/* Category & Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as ProductCategory)}
                className={inputClass}
              >
                {categoryOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <select
                value={color}
                onChange={e => setColor(e.target.value as ProductProps['color'])}
                className={inputClass}
              >
                {colorOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nutrition */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelClass}>Carbs (g)</label>
              <input
                type="number"
                value={carbs}
                onChange={e => setCarbs(e.target.value)}
                className={inputClass}
                min="0"
              />
            </div>
            <div>
              <label className={labelClass}>Calories</label>
              <input
                type="number"
                value={calories}
                onChange={e => setCalories(e.target.value)}
                className={inputClass}
                min="0"
              />
            </div>
            <div>
              <label className={labelClass}>Sodium (mg)</label>
              <input
                type="number"
                value={sodium}
                onChange={e => setSodium(e.target.value)}
                className={inputClass}
                min="0"
              />
            </div>
            <div>
              <label className={labelClass}>Caffeine (mg)</label>
              <input
                type="number"
                value={caffeine}
                onChange={e => setCaffeine(e.target.value)}
                className={inputClass}
                min="0"
              />
            </div>
          </div>

          {/* Price */}
          <div className="w-1/2">
            <label className={labelClass}>Price (ZAR)</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className={inputClass}
              min="0"
              step="0.01"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-neon-orange text-black font-bold uppercase tracking-wider hover:bg-neon-orange/90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </form>
      </div>
    </div>
  );
}
