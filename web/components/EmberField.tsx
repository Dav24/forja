const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 53) % 100}%`,
  size: 3 + (i % 3) * 2,
  duration: 9 + (i % 5) * 3,
  delay: (i * 1.7) % 12,
  color: ['#FDE68A', '#FBBF24', '#F97316'][i % 3],
}));

export function EmberField() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="ember-particle"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: e.color,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
