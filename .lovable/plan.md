## Fix ALL SimpleAssets pack openings — not just Series 2c

You're right — every fix here lives in shared SA code (`PackRevealDialog` + the SA branch of `handlePackOpened`), so it automatically covers every SA pack: Series 1 five/mega (`GPKFIVE`, `GPKMEGA`), Series 2 a/b/c (`GPKTWOA`, `GPKTWOB`, `GPKTWOC`), and Exotic five/mega (`EXOFIVE`, `EXOMEGA`). The 2c report just made the problem visible because 35 simultaneous image requests overwhelm a single gateway more often than 5 do — but Series 1 mega (30 cards) and Exotic mega (25 cards) hit the same wall and use the same code paths.

Guiding principle from you: **quality over speed**. Never start revealing until every image is loaded; never start the deal animation until it can play cleanly end‑to‑end. Long "preparing…" waits are acceptable.

## Root causes (all shared across every SA pack)

1. **Wrong expected count for Series 2c.** `EXPECTED_CARDS.GPKTWOC = 55` in `PackRevealDialog.tsx` — Series 2c mega is actually **35** cards. Polling never hit the primary boxtype-match branch, so the reveal only fired via the fallback loop, late, after image loads had already been in flight too long.
2. **Reveal starts before images are loaded (every SA pack).** `RevealCardImage` uses `<img loading="lazy">` and only rotates gateways on a hard `onError`. All N tiles hit the same Pinata directory at once — some hang, no error fires, cards render blank. The 1.6s staggered reveal advances regardless.
3. **Deal animation never plays; grid "resets" repeatedly; cards land as thumbnails (every SA pack).** `handlePackOpened` in `src/pages/Index.tsx` requires **all** matchers to resolve before calling `setDealingCards`. While polling it fires `Promise.all([refetchSa(), refetchAa()])` per attempt — each refetch replaces the whole `assets` array and re-renders the virtualized grid (the "glitch/reset"). If any matcher is still missing at the 45s deadline it falls through to `focusCollectionView(...)` + `reconstructLatestPackOpen({ silent: true })` — the "Show Received Cards" thumbnail path.

## Fix plan

### A. Correct the pack sizes (`src/components/simpleassets/PackRevealDialog.tsx`)

- `EXPECTED_CARDS.GPKTWOC = 35` (was 55).
- Leave the other entries unchanged — they aren't in evidence of being wrong; if a future report contradicts them the same map is where to fix it.
- The `SYMBOL_TO_BOXTYPE.GPKTWOC = 'gpktwo55'` mapping stays — that's the on-chain `boxtype` string, unrelated to the card count.

### B. Preload every reveal image before any card is shown — for ALL SA packs (`PackRevealDialog.tsx`)

Applies uniformly to `GPKFIVE`, `GPKMEGA`, `GPKTWOA`, `GPKTWOB`, `GPKTWOC`, `EXOFIVE`, `EXOMEGA`:

1. After the poll builds `cards[]` and before `setPhase('revealing')`, enter a new intermediate phase `'preloading'` — keep the shaking pack visible and show a progress line: "Loading card X of N…".
2. For each card image, race it through every gateway in `IPFS_GATEWAYS` sequentially via `new Image()` + a per-attempt ~4s hang timer. First gateway that decodes wins; store the winning URL back onto the card so `RevealCardImage` starts from a known-good source.
3. **No overall time cap.** Wait until every image resolves to *some* gateway. If a single card exhausts all gateways it's marked unreachable and rendered with the existing 🃏 fallback rather than blocking the whole reveal.
4. Only after the preload loop finishes → `setPhase('revealing')`. The existing 1.6s staggered reveal then plays against browser-cached images.
5. In `RevealCardImage`, drop `loading="lazy"` and add a 4s per-gateway hang swap so a mid-reveal gateway blip still self-heals.

### C. Deal animation always plays cleanly — for ALL SA packs (`src/pages/Index.tsx` + `src/lib/packReveal.ts`)

The SA branch of `handlePackOpened` is shared across every SA pack — every change here applies to all of them:

1. **Wait for the full set before dealing.** Keep the "all matchers resolved" gate — but remove the 45s deadline and the fallback-to-thumbnails path for confirmed opens. Poll for as long as needed with a visible "Preparing deal animation… (X/N cards ready)" indicator over the collection area, backing off 2s → 4s → 8s.
2. **Stop the render storm during polling.** Replace `Promise.all([refetchSa(), refetchAa()])` inside the loop with a single scoped refetch — `refetchSa()` for `reveal.source === 'simpleassets'` (which is every SA pack), `refetchAa()` for atomic. Wrap it in an `isPollingRefetchInFlight` guard so refetches never stack. This eliminates the "site glitched/reset" behavior on every SA pack, not just 2c.
3. **Preload all deal-card images before the animation starts.** After matchers resolve, run the same warmup loop from step B against the resolved `SimpleAsset[]` images, then call `setDealingCards(matched)`. This is the "20-second pause is fine as long as it plays right" you described.
4. **Only surface the manual fallback if the user chooses to bail out.** Add a small "Skip and just show my cards" button to the preparing indicator; clicking it (and only clicking it) runs the current `focusCollectionView` + `reconstructLatestPackOpen` path.
5. `matchRevealedAssets` in `src/lib/packReveal.ts` already returns `{ matched, unresolved }` — no signature change; the page just uses those counts to drive the progress indicator.

### D. Verification

- Manually open a Series 1 mega (30), a Series 2c mega (35), and an Exotic mega (25); each should show console lines like `[pack-reveal] targeting <N>-card unboxing`, preload progress, then a full-image reveal followed by the deal animation with no grid flashes.
- Sanity: replay demo mega (uses `PackRevealDialog`, `isDemo` skips polling/preload branches) to confirm no demo-path regressions.
- No changes to `AtomicPackRevealDialog`, `useSimpleAssets`, or the atomic branch of `handlePackOpened`.

## Files touched

- `src/components/simpleassets/PackRevealDialog.tsx` — GPKTWOC=35; new `preloading` phase + image warmup; `RevealCardImage` hang-swap; drop `loading="lazy"`.
- `src/pages/Index.tsx` — remove 45s deadline + reconstruct fallback for confirmed SA opens; scope + guard the poll refetch; add deal-image preload; add "preparing" UI with manual-skip button.
- `src/lib/packReveal.ts` — no change.

No backend, schema, or atomic-path changes.
