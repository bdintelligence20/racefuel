import { useEffect, useRef, useState } from 'react';
import { Check, X, ChevronDown, Pencil } from 'lucide-react';
import { useProducts } from '../data/products';

type EditorKind =
  | { type: 'number'; min: number; max: number; unit?: string; current: number; onCommit: (v: number) => void }
  | { type: 'numberNullable'; min: number; max: number; unit?: string; current: number | undefined; onCommit: (v: number | undefined) => void; autoLabel?: string }
  | { type: 'choice'; options: { value: string; label: string }[]; current: string; onCommit: (v: string) => void }
  | { type: 'brands'; current: string[]; onCommit: (v: string[]) => void }
  | { type: 'categories'; current: string[]; onCommit: (v: string[]) => void }
  | { type: 'acclim'; acclimatised: boolean; earlySeason: boolean; onCommit: (acclim: boolean, early: boolean) => void };

interface Props {
  label: string;
  icon: React.ElementType;
  /** Display value rendered in the read-only state. */
  displayValue: string;
  displayUnit?: string;
  editor: EditorKind;
}

/**
 * A sidebar stat row that expands in place when tapped to reveal a
 * field-appropriate editor. Saves commit to the profile and collapse the row.
 * No modal hop for single-field changes — the Edit button on the profile
 * header is still there for bulk edits.
 */
export function EditableStatRow({ label, icon: Icon, displayValue, displayUnit, editor }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group w-full flex items-center justify-between py-1.5 px-2 rounded-md transition-all ${
          open
            ? 'bg-warm/10 ring-1 ring-warm/30'
            : 'bg-surfaceHighlight/40 hover:bg-accent/[0.06] hover:ring-1 hover:ring-warm/20'
        }`}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 text-text-secondary min-w-0">
          <Icon className="w-3 h-3 text-warm flex-shrink-0" />
          <span className="text-[10px] uppercase tracking-wider font-display font-medium truncate">
            {label}
          </span>
        </div>
        <div className="font-display text-text-primary flex items-center gap-1 flex-shrink-0 pl-2">
          <span className="text-xs font-bold tabular-nums truncate max-w-[7rem]">{displayValue}</span>
          {displayUnit && <span className="text-[9px] text-text-muted">{displayUnit}</span>}
          {/* Edit affordance — chevron when collapsed (rotates open), pencil-on-hover
              desktop-only cue. Removed when editor is open so the warm ring carries
              the "active" state. */}
          {open ? (
            <ChevronDown className="w-3 h-3 text-warm flex-shrink-0 ml-0.5" />
          ) : (
            <>
              <Pencil className="w-2.5 h-2.5 text-text-muted/40 group-hover:text-warm flex-shrink-0 ml-0.5 hidden sm:block transition-colors" />
              <ChevronDown className="w-3 h-3 text-text-muted/40 group-hover:text-warm flex-shrink-0 ml-0.5 sm:hidden transition-colors" />
            </>
          )}
        </div>
      </button>
      {open && (
        <div className="mt-1 mb-1 mx-2 p-2.5 rounded-md bg-surfaceHighlight border border-[var(--color-border)]">
          <EditorBody editor={editor} onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function EditorBody({ editor, onDone }: { editor: EditorKind; onDone: () => void }) {
  if (editor.type === 'number') {
    return (
      <NumberEditor
        min={editor.min}
        max={editor.max}
        unit={editor.unit}
        current={editor.current}
        onCommit={(v) => {
          editor.onCommit(v);
          onDone();
        }}
      />
    );
  }
  if (editor.type === 'numberNullable') {
    return (
      <NumberEditor
        min={editor.min}
        max={editor.max}
        unit={editor.unit}
        current={editor.current ?? 0}
        autoLabel={editor.autoLabel ?? 'Auto'}
        allowAuto
        onCommit={(v) => {
          editor.onCommit(v === 0 ? undefined : v);
          onDone();
        }}
      />
    );
  }
  if (editor.type === 'choice') {
    return (
      <div className="grid grid-cols-2 gap-1">
        {editor.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              editor.onCommit(o.value);
              onDone();
            }}
            className={`py-1.5 rounded-md text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${
              editor.current === o.value
                ? 'bg-warm text-white'
                : 'bg-surface border border-[var(--color-border)] text-text-secondary hover:bg-accent/[0.06] hover:text-text-primary'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  if (editor.type === 'categories') {
    return <CategoriesEditor current={editor.current} onCommit={(v) => { editor.onCommit(v); onDone(); }} />;
  }
  if (editor.type === 'brands') {
    return <BrandsEditor current={editor.current} onCommit={(v) => { editor.onCommit(v); onDone(); }} />;
  }
  return <AcclimEditor acclim={editor.acclimatised} early={editor.earlySeason} onCommit={(a, e) => { editor.onCommit(a, e); onDone(); }} />;
}

function NumberEditor({
  min, max, unit, current, onCommit, allowAuto = false, autoLabel = 'Auto',
}: {
  min: number; max: number; unit?: string; current: number;
  onCommit: (v: number) => void;
  allowAuto?: boolean;
  autoLabel?: string;
}) {
  const [value, setValue] = useState<number>(current);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setValue((v) => Math.max(min, v - 1))}
        className="w-7 h-7 rounded-md bg-surface border border-[var(--color-border)] text-text-primary hover:bg-accent/[0.06] flex items-center justify-center text-sm font-bold"
        aria-label="Decrease"
      >−</button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => setValue(parseInt(e.target.value || '0', 10))}
        className="flex-1 h-7 bg-surface border border-[var(--color-border)] rounded-md text-center text-sm font-display font-bold tabular-nums text-text-primary focus:outline-none focus:border-warm"
      />
      {unit && <span className="text-[10px] text-text-muted font-display w-6">{unit}</span>}
      <button
        type="button"
        onClick={() => setValue((v) => Math.min(max, v + 1))}
        className="w-7 h-7 rounded-md bg-surface border border-[var(--color-border)] text-text-primary hover:bg-accent/[0.06] flex items-center justify-center text-sm font-bold"
        aria-label="Increase"
      >+</button>
      {allowAuto && (
        <button
          type="button"
          onClick={() => onCommit(0)}
          className="px-2 h-7 rounded-md text-[10px] font-display font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
        >
          {autoLabel}
        </button>
      )}
      <button
        type="button"
        onClick={() => onCommit(Math.max(min, Math.min(max, value)))}
        className="w-7 h-7 rounded-md bg-warm text-white hover:bg-warm-light flex items-center justify-center"
        aria-label="Save"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CategoriesEditor({ current, onCommit }: { current: string[]; onCommit: (v: string[]) => void }) {
  const [sel, setSel] = useState<string[]>(current);
  const all = ['gel', 'drink', 'bar', 'chew'];
  const toggle = (v: string) =>
    setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-1">
        {all.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            className={`py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
              sel.includes(c)
                ? 'bg-warm text-white'
                : 'bg-surface border border-[var(--color-border)] text-text-secondary hover:bg-accent/[0.06]'
            }`}
          >
            {c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onCommit([])}
          className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface transition-colors"
        >
          Any
        </button>
        <button
          type="button"
          onClick={() => onCommit(sel)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-warm text-white text-[10px] font-display font-bold uppercase tracking-wider hover:bg-warm-light transition-colors"
        >
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
}

function BrandsEditor({ current, onCommit }: { current: string[]; onCommit: (v: string[]) => void }) {
  const products = useProducts();
  const brands = Array.from(new Set(products.map((p) => p.brand))).sort((a, b) => a.localeCompare(b));
  const [sel, setSel] = useState<string[]>(current);
  const toggle = (b: string) =>
    setSel((s) => (s.map((x) => x.toLowerCase()).includes(b.toLowerCase())
      ? s.filter((x) => x.toLowerCase() !== b.toLowerCase())
      : [...s, b]));
  const selLower = new Set(sel.map((s) => s.toLowerCase()));
  return (
    <div className="space-y-2">
      {brands.length === 0 ? (
        <div className="text-[10px] text-text-muted italic">Loading brands…</div>
      ) : (
        <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => toggle(b)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-display font-semibold transition-colors ${
                selLower.has(b.toLowerCase())
                  ? 'bg-warm/20 border border-warm/50 text-warm'
                  : 'bg-surface border border-[var(--color-border)] text-text-muted hover:text-text-primary hover:border-warm/40'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => onCommit([])}
          className="text-[10px] font-display font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => onCommit(sel)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-warm text-white text-[10px] font-display font-bold uppercase tracking-wider hover:bg-warm-light transition-colors"
        >
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
}

function AcclimEditor({
  acclim, early, onCommit,
}: {
  acclim: boolean; early: boolean;
  onCommit: (acclim: boolean, early: boolean) => void;
}) {
  const [a, setA] = useState(acclim);
  const [e, setE] = useState(early);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => { setA((v) => !v); if (!a) setE(false); }}
          className={`py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
            a ? 'bg-warm text-white' : 'bg-surface border border-[var(--color-border)] text-text-secondary hover:bg-accent/[0.06]'
          }`}
        >
          Acclimatised
        </button>
        <button
          type="button"
          onClick={() => { setE((v) => !v); if (!e) setA(false); }}
          className={`py-1.5 rounded-md text-[10px] font-display font-bold uppercase tracking-wider transition-colors ${
            e ? 'bg-warm text-white' : 'bg-surface border border-[var(--color-border)] text-text-secondary hover:bg-accent/[0.06]'
          }`}
        >
          Early season
        </button>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onCommit(a, e)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-warm text-white text-[10px] font-display font-bold uppercase tracking-wider hover:bg-warm-light transition-colors"
        >
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </div>
  );
}

// Unused import silencer — X reserved for future cancel-button style.
void X;
