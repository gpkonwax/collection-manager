

## Fix: Better Card Back Design for Pack Reveals

### Problem
The card back shown before reveal is a gold/cheese gradient with a 🧀 emoji — looks cheap and placeholder-like.

### Approach
Replace the card back with a darkened, semi-transparent stencil of the pack image being opened. This gives each pack type a unique, contextual card back.

### Changes

**Both `PackRevealDialog.tsx` and `AtomicPackRevealDialog.tsx`**:

1. Pass `packImage` into the `RevealCardImage` / `AtomicRevealCardImage` component as a prop.

2. Replace the current card back div (the cheese emoji gradient) with a styled card back that uses the pack image as a centered, semi-transparent silhouette:

```tsx
<div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 
  flex items-center justify-center shadow-md border border-zinc-700/50 rounded-sm"
  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
  {packImage ? (
    <img src={packImage} alt="card back" 
      className="w-3/4 h-3/4 object-contain opacity-15 grayscale contrast-150"
      style={{ filter: 'grayscale(1) contrast(1.5) brightness(0.8)' }} />
  ) : (
    <span className="text-4xl opacity-20">🃏</span>
  )}
  <div className="absolute inset-0 border border-zinc-600/30 rounded-sm" />
</div>
```

This creates a dark card back with a ghosted stencil outline of the pack wrapper — subtle, thematic, and unique per pack type. The `grayscale + contrast + low opacity` combination produces a stencil/silhouette effect.

### Result
- Each pack type gets a distinctive card back showing a faint outline of its pack art
- Dark background looks premium instead of the garish gold/cheese gradient
- Falls back to a subtle card emoji if no pack image is available

