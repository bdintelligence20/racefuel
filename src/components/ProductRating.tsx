import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({ value, onChange, size = 16, readonly = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const displayValue = hoverValue || value;

  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHoverValue(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onClick={() => onChange?.(star)}
        >
          <Star
            size={size}
            className={displayValue >= star ? 'text-warm fill-warm' : 'text-text-muted'}
          />
        </button>
      ))}
    </div>
  );
}

interface ProductRatingDisplayProps {
  average: number;
  count: number;
}

export function ProductRatingDisplay({ average, count }: ProductRatingDisplayProps) {
  return (
    <div className="flex items-center gap-1.5">
      <StarRating value={Math.round(average)} readonly size={12} />
      <span className="text-[10px] font-display text-text-muted">
        {average.toFixed(1)} ({count})
      </span>
    </div>
  );
}

interface ProductRatingFormProps {
  onSubmit: (data: { rating: number; gutComfort: number; taste: number; notes?: string }) => void;
  onCancel: () => void;
}

export function ProductRatingForm({ onSubmit, onCancel }: ProductRatingFormProps) {
  const [rating, setRating] = useState(0);
  const [gutComfort, setGutComfort] = useState(0);
  const [taste, setTaste] = useState(0);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (rating === 0) return;
    onSubmit({ rating, gutComfort, taste, notes: notes.trim() || undefined });
  };

  return (
    <div className="space-y-3 p-3 bg-surfaceHighlight rounded-xl">
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">Rate this product</div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Overall</span>
          <StarRating value={rating} onChange={setRating} size={18} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Gut comfort</span>
          <StarRating value={gutComfort} onChange={setGutComfort} size={14} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">Taste</span>
          <StarRating value={taste} onChange={setTaste} size={14} />
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full bg-surface border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted resize-none h-16 focus:outline-none focus:border-accent/50"
      />

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors rounded-lg border border-[var(--color-border)]"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="flex-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg disabled:opacity-40 hover:bg-accent-light transition-colors"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
