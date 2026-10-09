# Bridge from the main grid selection bar

Replace the separate Bridge window (with its own tabs, filters and card picker) with a Bridge button in the existing selection bar, next to Transfer and Burn.

## What you will see

1. **No more standalone "Bridge" button** beside Select. You bridge the same way you transfer: press Select, click cards in the grid (any view, using the normal filters), then use the bar at the bottom.
2. **Third button in the bottom bar: "Bridge"**, alongside Transfer and Burn.
   - **Pressable** when every selected card is SimpleAssets (bridges to AtomicAssets) or every selected card is AtomicAssets (bridges back to SimpleAssets). The button label says the direction, e.g. "Bridge to AA" / "Bridge to SA".
   - **Faded and unpressable** when the selection mixes both. Hovering shows: "Select only SimpleAssets or only AtomicAssets cards to bridge."
   - Also faded, with its own hover message, in the two other cases that would fail on-chain:
     - an AtomicAssets card that was never bridged from SimpleAssets (nothing waiting in the bridge to return) — "Only cards originally bridged from SimpleAssets can go back."
     - more than 20 cards selected — "The bridge handles at most 20 cards per transaction."
3. **Simple Bridge window** (like the Transfer window): shows the selected cards, the direction ("SimpleAssets → AtomicAssets" or the reverse), a one-line explanation that cards are never burned and the bridge holds custody, and a single confirm button. No tabs, filters or selection inside it.
4. **Larger Transfer and Bridge windows**: both widen from the current narrow box to a roomy window (about 2x wide), and the selected-card preview area grows so more selected cards are visible before scrolling.
5. After a successful bridge: selection clears, both inventories refresh, and the existing success dialog with transaction link appears (unchanged).

## Technical details

- `src/pages/Index.tsx`
  - Remove the Bridge button from `renderSelectButton`.
  - In the bottom selection bar, compute from `selectedAssets`: `allSa`, `allAa`, `mixed`, `hasNonBridgedAa` (AA without `isUnbridgeable(idata)`), `overCap` (> `MAX_BRIDGE_PER_TX`). Derive `bridgeDirection` and a `disabledReason`.
  - Render the Bridge button wrapped in a shadcn `Tooltip` (trigger is a `span` so the tooltip works on a disabled button); `opacity-50 cursor-not-allowed` when disabled.
  - Pass `selectedAssets` + direction to `BridgeDialog`; onSuccess calls `clearSelection()`, refetches, shows success dialog.
- `src/components/simpleassets/BridgeDialog.tsx`: rewrite as a confirm dialog taking `selectedAssets` and `direction`; reuse `buildBridgeToAaActions` / `buildBridgeToSaActions` / `validateBridge` unchanged; remove tabs, category/variant filters, select-all.
- Shared pure helper `getBridgeEligibility(assets)` in `src/lib/bridgeActions.ts` returning `{ direction | null, reason }` so the bar and dialog agree.
- `TransferDialog.tsx`: `sm:max-w-md` -> roughly `sm:max-w-3xl`, preview area `max-h-40` -> larger; same sizing for BridgeDialog.
- Tests: replace `src/test/bridgeDialog.test.tsx` filter/select-all cases with eligibility tests (all SA -> to-aa, all bridged AA -> to-sa, mixed -> disabled, native AA -> disabled, 21 cards -> disabled) and a dialog test that confirm builds the right action. `bridgeActions.test.ts` kept.
- Update AGENTS.md bridge rule and the bridge-controls memory (old enlarged window / filters / Series 1 default no longer apply); update roadmap.md.
