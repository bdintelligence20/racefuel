import React from 'react';
import { X, FileText, Table, MapPin, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { downloadGpx } from '../../services/export/gpxExporter';
import { downloadCsv } from '../../services/export/csvExporter';
import { downloadPdf } from '../../services/export/pdfExporter';
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

  if (!isOpen) return null;

  const formats: ExportFormat[] = [
    {
      id: 'gpx',
      name: 'GPX File',
      description: 'Route with nutrition waypoints. Works with Garmin, Wahoo, and mapping apps.',
      icon: MapPin,
      color: 'text-neon-orange',
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
      color: 'text-neon-blue',
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
      color: 'text-neon-green',
      action: () => {
        downloadCsv(routeData);
        toast.success('CSV exported successfully');
        onClose();
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-white/10 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surfaceHighlight">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-neon-orange" />
            <div>
              <h2 className="text-lg font-bold text-white">Export Plan</h2>
              <div className="text-xs text-text-muted font-mono">
                {routeData.nutritionPoints.length} nutrition points
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 transition-colors text-text-muted hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Route Summary */}
        <div className="px-4 py-3 bg-black/30 border-b border-white/10">
          <div className="text-sm font-bold text-white">{routeData.name}</div>
          <div className="text-xs text-text-muted font-mono">
            {routeData.distanceKm.toFixed(1)}km | {routeData.elevationGain}m gain | Est. {routeData.estimatedTime}
          </div>
        </div>

        {/* Format Options */}
        <div className="p-4 space-y-3">
          {formats.map((format) => {
            const Icon = format.icon;
            return (
              <button
                key={format.id}
                onClick={format.action}
                className="w-full flex items-start gap-4 p-4 bg-surfaceHighlight border border-white/5 hover:border-neon-orange/50 hover:bg-white/5 transition-all text-left group"
              >
                <div className={`mt-0.5 ${format.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-white group-hover:text-neon-orange transition-colors">
                    {format.name}
                  </div>
                  <div className="text-xs text-text-secondary mt-1">
                    {format.description}
                  </div>
                </div>
                <Download className="w-4 h-4 text-text-muted group-hover:text-neon-orange transition-colors mt-1" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
