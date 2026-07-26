

export function BackgroundDecorations() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 decorations-layer">
      {/* Gradient orbs - warm cheese tones */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/[var(--orb-1-opacity)] rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/[var(--orb-2-opacity)] rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--brown)/var(--orb-3-opacity))] rounded-full blur-3xl" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[var(--grid-opacity)]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--cream)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--cream)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

    </div>
  );
}
