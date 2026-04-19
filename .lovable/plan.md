
Goal: make main-grid media reliable past ~150 cards, add automatic/manual retries for failed cards and grayscale AtomicHub placeholders, and remove the remaining Lovable placeholder paths.

1. Root cause to address
- The main page still accumulates too many mounted cards via `visibleCount` + “Show More”, so by ~150 cards the grid keeps far more media elements alive than the browser/IPFS gateways handle comfortably.
- `card` media is more fragile than `detail` media: lower priority, more contention, and failure is treated too permanently. The detail dialog succeeds because it mounts only 1–2 eager images with far less competition.
- Several asset/template resolvers still return `"/placeholder.svg"` directly, so fallback behavior is inconsistent across the app.
- Failed binder placeholders currently have no recovery action.

2. Implementation plan
- Stabilize the media hook in `src/hooks/useIpfsMedia.ts`
  - Add a real retry cycle instead of treating one failed pass as final.
  - Keep the last successfully loaded source visible when possible instead of immediately swapping to fallback after a later re-fetch miss.
  - Expose retry state + `retry()` callback from the hook so the UI can trigger a fresh attempt.
  - Separate “never loaded” failure from “loaded once, later re-fetch missed” so already-seen art is preserved better.
  - Make card retries use backoff and continue automatically while mounted.

- Add retry UI in `src/components/simpleassets/IpfsMedia.tsx`
  - Show a small retry overlay/button when a card truly fails.
  - Stop propagation on the retry button so clicking it does not open the card/detail dialog.
  - Show the same retry affordance for grayscale binder/AtomicHub placeholders because they also use `IpfsMedia`.
  - Keep skeleton/loading states distinct from failure states.

- Reduce grid pressure in `src/pages/Index.tsx`
  - Replace endless accumulation with true page-based rendering for Classic, Binder, and Saved views so off-screen cards unmount instead of stacking up forever.
  - Preserve the existing 36-items-per-page behavior from project memory, but switch the controls from “Show More” to bounded paging.
  - This is the key fix for “fails around 150”.

- Standardize all fallback sources away from Lovable placeholders
  - Update:
    - `src/hooks/useSimpleAssets.ts`
    - `src/hooks/useGpkAtomicAssets.ts`
    - `src/hooks/useBinderTemplates.ts`
    - `src/components/simpleassets/PriceAlertDialog.tsx`
    - any remaining `"/placeholder.svg"` media fallbacks found in the NFT flow
  - Use the neutral `card-fallback.svg` consistently.

3. Why detail works when the main page fails
- Detail view mounts only one or two images at a time, uses `context="detail"`, and avoids the massive grid contention.
- The main page is competing across many visible cards plus binder placeholders, so timeouts/rotation happen under load even though the underlying asset is still valid.
- After the paging change + stronger retry logic, main and detail behavior should become much more consistent.

4. Files likely involved
- `src/hooks/useIpfsMedia.ts`
- `src/components/simpleassets/IpfsMedia.tsx`
- `src/pages/Index.tsx`
- `src/hooks/useSimpleAssets.ts`
- `src/hooks/useGpkAtomicAssets.ts`
- `src/hooks/useBinderTemplates.ts`
- `src/components/simpleassets/PriceAlertDialog.tsx`

5. Expected result
- Scrolling past 150 cards no longer causes widespread card failures.
- Failed cards and grayscale AtomicHub placeholders show a retry button and also keep retrying automatically while mounted.
- Detail view and main-grid view behave consistently for the same asset.
- No Lovable-branded placeholder art appears anywhere in the NFT experience.

6. QA after implementation
- Load 200+ cards in Classic view, page forward/back, and confirm cards keep loading.
- Check Binder placeholders and puzzle placeholders: failed images should show retry and recover.
- Open an asset that failed in-grid and confirm it now either already works in-grid or can be retried there.
- Scroll away and back to verify previously loaded art does not regress to placeholder/fallback unnecessarily.
