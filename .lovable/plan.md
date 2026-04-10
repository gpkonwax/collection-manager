

## Fix tear sound playing too early on series 2 pack opens

### Problem
When the dialog opens, two effects both react to `open` becoming `true`:
1. The dialog init effect sets `isShaking(true)` 
2. The tear audio effect checks `!isShaking` — but sees the **old** `false` value before the other effect's state update takes effect

Result: the tear sound fires immediately on dialog open instead of waiting for the shake to finish.

### Solution
Add a `hasShaken` ref to track whether shaking has actually started and completed. The tear should only play after `isShaking` has been `true` and then transitioned to `false`.

**File: `src/hooks/usePackRevealAudio.ts`**

1. Add a `hasStartedShakingRef` that gets set to `true` when shaking starts
2. Reset it when dialog closes
3. Change the tear condition to require `hasStartedShakingRef.current === true` (meaning shake already started) AND `!isShaking` (meaning shake finished)

```ts
const hasStartedShakingRef = useRef(false);

// In the reset effect (open === false):
hasStartedShakingRef.current = false;

// In the shake effect, when shaking starts:
if (open && phase === 'waiting' && isShaking) {
  hasStartedShakingRef.current = true;
  // ... play shake
}

// In the tear effect:
const shouldPlayTear = open && hasStartedShakingRef.current && !isShaking 
  && (phase === 'waiting' || (phase === 'revealing' && revealedCount === 0));
```

### Files touched
- `src/hooks/usePackRevealAudio.ts`

