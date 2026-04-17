
import { useState } from 'react';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { X, FileText, Table, MapPin, Download, Image, Share2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadGpx } from '../../services/export/gpxExporter';
import { downloadCsv } from '../../services/export/csvExporter';
import { downloadPdf } from '../../services/export/pdfExporter';
import { exportMapImage } from '../../services/export/mapImageExporter';
import { ShareModal } from '../ShareModal';
import { toast } from 'sonner';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  action: () => void;
  color: string;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const { routeData } = useApp();
  const [shareOpen, setShareOpen] = useState(false);
  useModalBehavior(isOpen, onClose);


  if (!isOpen) return null;

  const formats: ExportFormat[] = [
    {
      id: 'gpx',
      name: 'GPX File',
      description: 'Route with nutrition waypoints. Works with Garmin, Wahoo, and mapping apps.',
      icon: MapPin,
      color: 'text-accent',
      action: () => {
        downloadGpx(routeData);
        toast.success('GPX exported successfully');
        onClose();
      },
    },
    {
      id: 'pdf',
      name: 'PDF Race Sheet',
      description: 'Print-ready race day sheet with timeline, packing list, and targets.',
      icon: FileText,
      color: 'text-warm',
      action: () => {
        downloadPdf(routeData);
        toast.success('PDF exported successfully');
        onClose();
      },
    },
    {
      id: 'csv',
      name: 'CSV Spreadsheet',
      description: 'Nutrition data in spreadsheet format for coaches and dietitians.',
      icon: Table,
      color: 'text-accent-light',
      action: () => {
        downloadCsv(routeData);
        toast.success('CSV exported successfully');
        onClose();
      },
    },
    {
      id: 'map-image',
      name: 'Map Image (PNG)',
      description: 'High-res map screenshot with route stats overlay. Great for social sharing.',
      icon: Image,
      color: 'text-yellow-400',
      action: async () => {
        try {
          await exportMapImage(routeData, 'landscape');
          toast.success('Map image exported');
          onClose();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to export map image');
        }
      },
    },
    {
      id: 'social-share',
      name: 'Share for Social',
      description: 'Branded image with nutrition overlay. Choose format and share directly.',
      icon: Share2,
      color: 'text-purple-400',
      action: () => {
        setShareOpen(true);
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet on mobile, centered card on desktop */}
      <div className="relative bg-surface border-t sm:border border-[var(--color-border)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90dvh] sm:max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:fade-in sm:zoom-in-95 duration-200">
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-display font-bold text-text-primary leading-tight">
                Export Plan
              </h2>
              <div className="text-xs text-text-muted font-display truncate">
                {routeData.nutritionPoints.length} nutrition points
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-accent/[0.08] active:bg-accent/[0.12] transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Route summary */}
        <div className="px-4 py-3 bg-surfaceHighlight border-b border-[var(--color-border)] flex-shrink-0">
          <div className="text-sm font-display font-bold text-text-primary truncate">{routeData.name || 'Untitled route'}</div>
          <div className="text-xs text-text-muted font-display mt-0.5 tabular-nums">
            {routeData.distanceKm.toFixed(1)}km · {routeData.elevationGain}m · {routeData.estimatedTime}
          </div>
        </div>

        {/* Format options — scrollable on mobile */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 sm:space-y-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {formats.map((format) => {
            const Icon = format.icon;
            return (
              <button
                key={format.id}
                onClick={format.action}
                className="w-full flex items-center gap-3 p-3 sm:p-4 bg-surfaceHighlight border border-[var(--color-border)] rounded-xl hover:border-accent/40 hover:bg-accent/[0.03] active:scale-[0.99] transition-all text-left"
              >
                <div className={`w-10 h-10 rounded-lg bg-surface flex items-center justify-center flex-shrink-0 ${format.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display font-bold text-text-primary leading-tight">
                    {format.name}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5 leading-snug line-clamp-2 sm:line-clamp-none">
                    {format.description}
                  </div>
                </div>
                <Download className="w-4 h-4 text-text-muted flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
