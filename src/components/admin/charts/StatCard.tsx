import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: 'warm' | 'plum' | 'green' | 'rust';
}

const ACCENTS: Record<NonNullable<StatCardProps['accent']>, { dot: string; label: string }> = {
  warm: { dot: 'bg-[#F5A020]', label: 'text-[#F5A020]' },
  plum: { dot: 'bg-[#3D2152]', label: 'text-[#3D2152]' },
  green: { dot: 'bg-[#0F8B47]', label: 'text-[#0F8B47]' },
  rust: { dot: 'bg-[#E8671A]', label: 'text-[#E8671A]' },
};

export function StatCard({ label, value, hint, icon: Icon, accent = 'warm' }: StatCardProps) {
  const a = ACCENTS[accent];
  return (
    <div className="bg-white border border-[#3D2152]/10 rounded-2xl p-4 flex flex-col gap-2 shadow-[0_2px_8px_-4px_rgba(61,33,82,0.08)]">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
        <span className={`text-[9.5px] font-display uppercase tracking-[0.18em] font-bold ${a.label}`}>
          {label}
        </span>
        {Icon && <Icon className="w-3.5 h-3.5 text-[#A0929E] ml-auto" />}
      </div>
      <div className="text-2xl font-display font-black text-[#3D2152] tabular-nums tracking-tight">
        {value}
      </div>
      {hint && <div className="text-[10.5px] text-[#A0929E]">{hint}</div>}
    </div>
  );
}
