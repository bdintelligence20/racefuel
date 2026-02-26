import React from 'react';
import { Zap } from 'lucide-react';

interface AutoGenerateButtonProps {
  onClick?: () => void;
}

export function AutoGenerateButton({ onClick }: AutoGenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center justify-center gap-3 bg-neon-orange hover:bg-white text-black px-6 py-4 font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(255,107,0,0.4)] hover:shadow-[0_0_30px_rgba(255,107,0,0.6)] hover:-translate-y-1 clip-corner"
      aria-label="Auto generate nutrition plan">

      <Zap className="w-5 h-5 fill-current group-hover:text-neon-orange transition-colors" />
      <span className="group-hover:text-neon-orange transition-colors">
        Auto Generate
      </span>

      {/* Tech decoration */}
      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-black border border-neon-orange"></div>
    </button>);

}