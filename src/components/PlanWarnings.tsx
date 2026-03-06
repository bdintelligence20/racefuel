import React from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { PlanWarning, WarningSeverity } from '../services/nutrition/planValidator';

interface PlanWarningsProps {
  warnings: PlanWarning[];
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

const severityConfig: Record<WarningSeverity, {
  icon: React.ElementType;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
}> = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    iconColor: 'text-yellow-500',
  },
  info: {
    icon: Info,
    bg: 'bg-warm/10',
    border: 'border-warm/30',
    text: 'text-warm',
    iconColor: 'text-warm',
  },
};

export function PlanWarnings({ warnings, onDismiss, compact }: PlanWarningsProps) {
  if (warnings.length === 0) return null;

  // Sort by severity
  const sorted = [...warnings].sort((a, b) => {
    const order: Record<WarningSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {sorted.map((w) => {
          const config = severityConfig[w.severity];
          const Icon = config.icon;
          return (
            <div
              key={w.id}
              className={`flex items-center gap-1 px-2 py-1 rounded-md ${config.bg} border ${config.border} text-[10px] ${config.text}`}
              title={w.detail}
            >
              <Icon className="w-3 h-3" />
              {w.message}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((w) => {
        const config = severityConfig[w.severity];
        const Icon = config.icon;
        return (
          <div
            key={w.id}
            className={`flex items-start gap-3 p-3 rounded-lg ${config.bg} border ${config.border}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-bold ${config.text}`}>{w.message}</div>
              <div className="text-[11px] text-text-secondary mt-0.5">{w.detail}</div>
            </div>
            {onDismiss && (
              <button
                onClick={() => onDismiss(w.id)}
                className="text-text-muted hover:text-white p-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
