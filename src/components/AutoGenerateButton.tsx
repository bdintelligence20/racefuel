interface AutoGenerateButtonProps {
  onClick?: () => void;
}

export function AutoGenerateButton({ onClick }: AutoGenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-light text-white px-4 py-2 rounded-lg font-display font-bold uppercase text-[11px] tracking-wider transition-colors shadow-sm"
      aria-label="Build nutrition plan">
      Build plan
    </button>);

}
