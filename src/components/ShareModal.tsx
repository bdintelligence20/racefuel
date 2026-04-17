import { useState, useEffect, useRef } from 'react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { X, Download, Share2, Copy, Check, Image } from 'lucide-react';
import { useApp, NutritionPoint } from '../context/AppContext';
import { getMapCanvas, ImageDimension, dimensionMap } from '../services/export/mapImageExporter';
import { toast } from 'sonner';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function generateShareImage(
  mapCanvas: HTMLCanvasElement,
  routeData: { name: string; distanceKm: number; elevationGain: number; nutritionPoints: NutritionPoint[]; estimatedTime: string },
  dimension: ImageDimension
): HTMLCanvasElement {
  const outputCanvas = document.createElement('canvas');
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) return outputCanvas;

  const baseWidth = 1920;
  let width: number, height: number;
  switch (dimension) {
    case 'square': width = baseWidth; height = baseWidth; break;
    case 'portrait': width = 1080; height = 1920; break;
    default: width = baseWidth; height = 1080;
  }

  outputCanvas.width = width;
  outputCanvas.height = height;

  // Draw map
  ctx.drawImage(mapCanvas, 0, 0, width, height);

  // Dark overlay
  const gradient = ctx.createLinearGradient(0, height * 0.5, 0, height);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Top gradient
  const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.15);
  topGradient.addColorStop(0, 'rgba(0,0,0,0.7)');
  topGradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, height * 0.15);

  // Branding
  ctx.fillStyle = '#FFCD6B';
  ctx.font = 'bold 32px Montserrat, Inter, system-ui, sans-serif';
  ctx.fillText('fuelcue', 30, 50);

  // Route name
  const bottomY = height - 30;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.fillText(routeData.name || 'My Route', 30, bottomY - 110);

  // Stats
  const totalCarbs = routeData.nutritionPoints.reduce((s, p) => s + p.product.carbs, 0);
  const totalSodium = routeData.nutritionPoints.reduce((s, p) => s + p.product.sodium, 0);

  ctx.fillStyle = '#F5A020';
  ctx.font = 'bold 22px Montserrat, sans-serif';
  ctx.fillText(
    `${routeData.distanceKm.toFixed(1)}km  ·  ${routeData.elevationGain}m  ·  ${routeData.estimatedTime}`,
    30,
    bottomY - 70
  );

  ctx.fillStyle = '#f59e0b';
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.fillText(
    `${routeData.nutritionPoints.length} stops  ·  ${totalCarbs}g carbs  ·  ${totalSodium}mg Na`,
    30,
    bottomY - 40
  );

  // Product list
  ctx.fillStyle = '#a0a0a0';
  ctx.font = '14px "JetBrains Mono", monospace';
  const productNames = routeData.nutritionPoints
    .slice(0, 8)
    .map((p) => `${p.product.brand} ${p.product.name}`)
    .join('  ·  ');
  ctx.fillText(productNames + (routeData.nutritionPoints.length > 8 ? '  ...' : ''), 30, bottomY - 10);

  return outputCanvas;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { routeData } = useApp();
  const [dimension, setDimension] = useState<ImageDimension>('landscape');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const mapCanvas = getMapCanvas();
    if (!mapCanvas) return;

    const outputCanvas = generateShareImage(mapCanvas, routeData, dimension);
    canvasRef.current = outputCanvas;

    const url = outputCanvas.toDataURL('image/png');
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [isOpen, dimension, routeData]);
  useModalBehavior(isOpen, onClose);


  if (!isOpen) return null;

  const handleDownload = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(routeData.name || 'fuelcue').replace(/\s+/g, '_')}_share_${dimension}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
    toast.success('Image downloaded');
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob((b) => b ? resolve(b) : reject(), 'image/png');
      });

      if (navigator.share) {
        const file = new File([blob], 'fuelcue-plan.png', { type: 'image/png' });
        await navigator.share({
          title: `${routeData.name} — FuelCue`,
          text: `My nutrition plan for ${routeData.distanceKm.toFixed(1)}km`,
          files: [file],
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Image copied to clipboard');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('Share failed — try downloading instead');
      }
    }
  };

  const handleCopyToClipboard = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvasRef.current?.toBlob((b) => b ? resolve(b) : reject(), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-surface border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-surfaceHighlight">
          <div>
            <div className="text-[10px] text-accent uppercase tracking-wider font-bold">Social</div>
            <h2 className="text-lg font-bold text-text-primary">Share Your Plan</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent/[0.08] transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dimension Selector */}
        <div className="px-4 pt-3 flex gap-2">
          {(Object.entries(dimensionMap) as [ImageDimension, { label: string }][]).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setDimension(key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                dimension === key
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'bg-surfaceHighlight text-text-muted border border-[var(--color-border)] hover:text-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Share preview"
              className="max-w-full max-h-[50dvh] rounded-lg border border-[var(--color-border)] shadow-lg"
            />
          ) : (
            <div className="text-center text-text-muted">
              <Image className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Generating preview...</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[var(--color-border)] bg-surfaceHighlight flex gap-2">
          <button
            onClick={handleCopyToClipboard}
            className="flex-1 py-3 rounded-xl border border-[var(--color-border)] text-text-secondary text-sm font-medium hover:bg-surfaceHighlight transition-colors flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 py-3 rounded-xl border border-[var(--color-border)] text-text-secondary text-sm font-medium hover:bg-surfaceHighlight transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={handleShare}
            className="flex-1 py-3 rounded-xl bg-accent text-black text-sm font-bold hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
