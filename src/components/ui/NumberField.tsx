import { useEffect, useState } from 'react';

interface NumberFieldProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  id?: string;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /**
   * If true (default), writes the parsed number back to `onChange` on every keystroke.
   * If false, only writes on blur. For forms with a Save button, `commitOnBlur={true}`
   * is usually the right choice — it avoids propagating partial values.
   */
  commitOnBlur?: boolean;
}

/**
 * A number input that doesn't get stuck with a ghost "0" when you backspace.
 *
 * The trick: keep the user's draft as a *string* in local state while they're typing.
 * Only commit to the parent when the draft parses to a valid number. On blur, if the
 * draft is empty or invalid, snap back to the last known good value.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  id,
  className = '',
  inputClassName = '',
  ariaLabel,
  disabled,
  commitOnBlur = false,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string>(() =>
    Number.isFinite(value) ? String(value) : ''
  );

  // Sync local draft when parent value changes from the outside (e.g. Strava sync).
  useEffect(() => {
    if (Number.isFinite(value) && value !== parseFloat(draft)) {
      setDraft(String(value));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setDraft(next);

    if (!commitOnBlur) {
      if (next === '' || next === '-') return; // don't commit empty/partial
      const parsed = parseFloat(next);
      if (Number.isFinite(parsed)) onChange(parsed);
    }
  };

  const handleBlur = () => {
    if (draft === '' || draft === '-') {
      // Snap back to the last known good value
      setDraft(Number.isFinite(value) ? String(value) : '');
      return;
    }
    const parsed = parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(Number.isFinite(value) ? String(value) : '');
      return;
    }
    let clamped = parsed;
    if (typeof min === 'number') clamped = Math.max(min, clamped);
    if (typeof max === 'number') clamped = Math.min(max, clamped);
    setDraft(String(clamped));
    onChange(clamped);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      id={id}
      aria-label={ariaLabel}
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      className={`${className} ${inputClassName}`.trim()}
    />
  );
}
