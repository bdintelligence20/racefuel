import React from 'react';
import { Zap } from 'lucide-react';

interface AutoGenerateButtonProps {
  onClick?: () => void;
}

export function AutoGenerateButton({ onClick }: AutoGenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center justify-center gap-3 bg-accent hover:bg-accent-light text-black px-6 py-4 rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-1"
      aria-label="Auto generate nutrition plan">

      <Zap className="w-5 h-5 fill-current" />
      <span>Auto Generate</span>
    </button>);

}