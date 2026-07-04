export function Wordmark({ className = 'text-4xl' }: { className?: string }) {
  return (
    <span className={`font-display tracking-wider ${className}`}>
      F
      <span className="bg-gradient-to-b from-amber-bright to-ember bg-clip-text text-transparent">
        O
      </span>
      RJA
    </span>
  );
}
