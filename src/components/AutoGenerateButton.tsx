
import { Zap } from 'lucide-react';

interface AutoGenerateButtonProps {
  onClick?: () => void;
}

export function AutoGenerateButton({ onClick }: AutoGenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center justify-center gap-1.5 bg-warm hover:bg-warm-light text-white px-4 py-2 rounded-lg font-display font-bold uppercase text-[11px] tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(245,160,32,0.25)] hover:shadow-[0_0_20px_rgba(245,160,32,0.4)]"
      aria-label="Auto generate nutrition plan">

      <Zap className="w-3.5 h-3.5 fill-current" />
      <span>Auto Generate</span>
    </button>);

}
