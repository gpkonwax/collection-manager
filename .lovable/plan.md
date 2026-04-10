

## Disable user scrolling during card deal animation

### Change
Add a `useEffect` in `CardDealAnimation` that sets `overflow: hidden` on `document.body` when the component mounts (animation active) and restores it on unmount (animation complete/skipped). This blocks mouse wheel and manual scrollbar scrolling while preserving cursor interaction. The component's own programmatic `window.scrollTo()` calls still work because `scrollTo` bypasses `overflow: hidden` on the body.

### Technical details

**File: `src/components/simpleassets/CardDealAnimation.tsx`**

Add a `useEffect` near the top of the component:

```tsx
useEffect(() => {
  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = prev;
  };
}, []);
```

This runs on mount/unmount of the animation component, which naturally aligns with the animation lifecycle — the component renders when dealing starts and unmounts when complete or skipped.

### Files touched
- `src/components/simpleassets/CardDealAnimation.tsx`

