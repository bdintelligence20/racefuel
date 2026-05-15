import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X, Tag, Trash2, Percent, Coins, Truck } from 'lucide-react';
import {
  adminListCoupons,
  adminUpsertCoupon,
  adminDeleteCoupon,
  type AdminCouponRow,
  type CouponType,
} from '../../services/firebase/admin';

interface FormState {
  code: string;
  type: CouponType;
  value: string;
  active: boolean;
  usageLimit: string;
  minSubtotalZAR: string;
  startsAt: string;
  expiresAt: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  code: '',
  type: 'percent',
  value: '10',
  active: true,
  usageLimit: '',
  minSubtotalZAR: '',
  startsAt: '',
  expiresAt: '',
  description: '',
};

function formatDate(ms: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateInputValue(ms: number | null): string {
  if (!ms) return '';
  // YYYY-MM-DD in the user's local TZ — matches what <input type="date"> expects.
  const d = new Date(ms);
  const tzOffset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

function dateInputToMillis(s: string): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

function describeDiscount(row: AdminCouponRow): string {
  if (row.type === 'percent') return `${row.value}% off`;
  if (row.type === 'fixed') return `R${row.value} off`;
  return 'Free shipping';
}

function rowToForm(row: AdminCouponRow): FormState {
  return {
    code: row.code,
    type: row.type,
    value: row.type === 'freeShipping' ? '' : String(row.value),
    active: row.active,
    usageLimit: row.usageLimit != null ? String(row.usageLimit) : '',
    minSubtotalZAR: row.minSubtotalZAR != null ? String(row.minSubtotalZAR) : '',
    startsAt: dateInputValue(row.startsAt),
    expiresAt: dateInputValue(row.expiresAt),
    description: row.description ?? '',
  };
}

export function CouponsTab() {
  const [rows, setRows] = useState<AdminCouponRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const refresh = async () => {
    try {
      const res = await adminListCoupons();
      setRows(res.rows);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load coupons.');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    if (filter === 'all') return rows;
    return rows.filter((r) => (filter === 'active' ? r.active : !r.active));
  }, [rows, filter]);

  const openCreate = () => {
    setEditingCode(null);
    setEditing({ ...EMPTY_FORM });
  };

  const openEdit = (row: AdminCouponRow) => {
    setEditingCode(row.code);
    setEditing(rowToForm(row));
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErr(null);
    try {
      await adminUpsertCoupon({
        code: editing.code.trim(),
        type: editing.type,
        value: editing.type === 'freeShipping' ? undefined : Number(editing.value),
        active: editing.active,
        usageLimit: editing.usageLimit.trim() === '' ? null : Number(editing.usageLimit),
        minSubtotalZAR: editing.minSubtotalZAR.trim() === '' ? null : Number(editing.minSubtotalZAR),
        startsAt: dateInputToMillis(editing.startsAt),
        expiresAt: dateInputToMillis(editing.expiresAt),
        description: editing.description.trim() || null,
      });
      setEditing(null);
      setEditingCode(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save coupon.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (code: string) => {
    if (!confirm(`Delete coupon "${code}"? Audit trail of past redemptions stays in Firestore.`)) return;
    setErr(null);
    try {
      await adminDeleteCoupon({ code });
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete coupon.');
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-display font-black text-[#3D2152] tracking-tight">Coupons</h1>
        <button
          onClick={openCreate}
          className="ml-auto px-4 py-2 rounded-xl bg-[#3D2152] text-white text-[11.5px] font-display font-bold hover:bg-[#3D2152]/90 transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> New coupon
        </button>
      </div>

      {err && (
        <div className="bg-[#E8671A]/[0.08] border border-[#E8671A]/20 rounded-xl px-4 py-3 text-[12.5px] text-[#E8671A]">{err}</div>
      )}

      <div className="flex gap-1.5">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${
              filter === f
                ? 'bg-[#3D2152] text-white'
                : 'bg-white border border-[#3D2152]/10 text-[#6B5A7A] hover:bg-[#FFF9F0]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="bg-white border border-[#3D2152]/10 rounded-2xl shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)] overflow-hidden">
        {!filtered ? (
          <div className="px-5 py-8 text-[12px] text-[#A0929E] flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Tag className="w-10 h-10 text-[#A0929E] mx-auto mb-2" />
            <p className="text-[12.5px] text-[#6B5A7A] font-display">No coupons {filter !== 'all' ? `(${filter})` : 'yet'}.</p>
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-[#FFF9F0] text-[10px] uppercase tracking-[0.16em] text-[#A0929E] font-display font-bold">
              <tr>
                <th className="text-left px-4 py-2.5">Code</th>
                <th className="text-left px-4 py-2.5">Discount</th>
                <th className="text-left px-4 py-2.5">Usage</th>
                <th className="text-left px-4 py-2.5">Expires</th>
                <th className="text-left px-4 py-2.5">Min cart</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.code} className="border-t border-[#3D2152]/[0.06] hover:bg-[#FFF9F0]/60">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openEdit(r)}
                      className="font-mono font-bold text-[#3D2152] hover:text-[#F5A020] transition-colors"
                    >
                      {r.code}
                    </button>
                    {!r.active && (
                      <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-[#A0929E] bg-[#3D2152]/[0.06] px-1.5 py-0.5 rounded">Off</span>
                    )}
                    {r.description && (
                      <div className="text-[10.5px] text-[#A0929E] mt-0.5 truncate max-w-[200px]">{r.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[#3D2152] font-display font-semibold">
                      {r.type === 'percent' && <Percent className="w-3 h-3 text-[#F5A020]" />}
                      {r.type === 'fixed' && <Coins className="w-3 h-3 text-[#F5A020]" />}
                      {r.type === 'freeShipping' && <Truck className="w-3 h-3 text-[#F5A020]" />}
                      {describeDiscount(r)}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#6B5A7A]">
                    {r.usedCount}
                    {r.usageLimit != null && <span className="text-[#A0929E]"> / {r.usageLimit}</span>}
                  </td>
                  <td className="px-4 py-3 text-[#6B5A7A]">{formatDate(r.expiresAt)}</td>
                  <td className="px-4 py-3 tabular-nums text-[#6B5A7A]">
                    {r.minSubtotalZAR != null ? `R${r.minSubtotalZAR.toFixed(0)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onDelete(r.code)}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-[#E8671A]/10 text-[#A0929E] hover:text-[#E8671A] transition-colors"
                      aria-label={`Delete ${r.code}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editing && (
        <EditorModal
          form={editing}
          editingCode={editingCode}
          saving={saving}
          onChange={setEditing}
          onClose={() => { setEditing(null); setEditingCode(null); }}
          onSubmit={onSave}
        />
      )}
    </div>
  );
}

function EditorModal({
  form,
  editingCode,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: FormState;
  editingCode: string | null;
  saving: boolean;
  onChange: (f: FormState) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const patch = (k: keyof FormState, v: FormState[keyof FormState]) =>
    onChange({ ...form, [k]: v } as FormState);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={onSubmit}
        className="relative bg-white border border-[#3D2152]/10 rounded-2xl w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3D2152]/10">
          <h2 className="text-[15px] font-display font-bold text-[#3D2152]">
            {editingCode ? `Edit ${editingCode}` : 'New coupon'}
          </h2>
          <button type="button" onClick={onClose} className="text-[#A0929E] hover:text-[#3D2152]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <Field label="Code">
            <input
              value={form.code}
              onChange={(e) => patch('code', e.target.value.toUpperCase())}
              placeholder="LAUNCH20"
              disabled={!!editingCode}
              required
              className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] font-mono font-bold uppercase tracking-wider text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50 disabled:opacity-60"
            />
            <p className="text-[10.5px] text-[#A0929E] mt-1">2-32 chars, A-Z 0-9 _ - only.</p>
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-3 gap-1.5">
              {(['percent', 'fixed', 'freeShipping'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patch('type', t)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-display font-bold uppercase tracking-wider transition-colors ${
                    form.type === t
                      ? 'bg-[#3D2152] text-white'
                      : 'bg-[#FFF9F0] border border-[#3D2152]/10 text-[#6B5A7A]'
                  }`}
                >
                  {t === 'percent' ? '% off' : t === 'fixed' ? 'R off' : 'Free ship'}
                </button>
              ))}
            </div>
          </Field>

          {form.type !== 'freeShipping' && (
            <Field label={form.type === 'percent' ? 'Percent off' : 'Rand off'}>
              <input
                type="number"
                min="0"
                step={form.type === 'percent' ? '1' : '0.01'}
                max={form.type === 'percent' ? '100' : undefined}
                value={form.value}
                onChange={(e) => patch('value', e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] tabular-nums text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Usage limit (total)">
              <input
                type="number"
                min="1"
                value={form.usageLimit}
                onChange={(e) => patch('usageLimit', e.target.value)}
                placeholder="Unlimited"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] tabular-nums text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
            <Field label="Min cart subtotal (R)">
              <input
                type="number"
                min="0"
                step="1"
                value={form.minSubtotalZAR}
                onChange={(e) => patch('minSubtotalZAR', e.target.value)}
                placeholder="No minimum"
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] tabular-nums text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => patch('startsAt', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
            <Field label="Expires">
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => patch('expiresAt', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
              />
            </Field>
          </div>

          <Field label="Description (shown in cart)">
            <input
              value={form.description}
              onChange={(e) => patch('description', e.target.value)}
              placeholder="e.g. Launch week — 20% off everything"
              maxLength={120}
              className="w-full px-3 py-2 rounded-xl border border-[#3D2152]/10 bg-[#FFF9F0] text-[12.5px] text-[#3D2152] focus:outline-none focus:border-[#F5A020]/50"
            />
          </Field>

          <label className="flex items-center gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => patch('active', e.target.checked)}
              className="w-4 h-4 accent-[#F5A020]"
            />
            <span className="text-[12.5px] font-display font-semibold text-[#3D2152]">Active</span>
            <span className="text-[10.5px] text-[#A0929E]">— inactive codes are rejected at the cart.</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FFF9F0] border-t border-[#3D2152]/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[11.5px] font-display font-bold text-[#6B5A7A] hover:text-[#3D2152]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#F5A020] text-white text-[11.5px] font-display font-bold hover:bg-[#F5A020]/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {editingCode ? 'Save changes' : 'Create coupon'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-display uppercase tracking-[0.16em] font-bold text-[#A0929E] mb-1.5">{label}</div>
      {children}
    </label>
  );
}
