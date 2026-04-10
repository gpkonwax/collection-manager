export function BackgroundDecorations() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Gradient orbs - warm cheese tones */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--brown)/0.2)] rounded-full blur-3xl" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--cream)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--cream)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating cheese emojis */}
      <span className="absolute top-20 left-20 text-3xl opacity-20 animate-float select-none">🧀</span>
      <span className="absolute top-40 right-32 text-2xl opacity-15 animate-float select-none" style={{ animationDelay: '2s' }}>🧀</span>
      <span className="absolute bottom-32 left-40 text-4xl opacity-10 animate-float select-none" style={{ animationDelay: '4s' }}>🧀</span>
      <span className="absolute bottom-60 right-20 text-xl opacity-15 animate-float select-none" style={{ animationDelay: '6s' }}>🧀</span>
    </div>
  );
}
