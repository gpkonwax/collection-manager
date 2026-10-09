# Bridge frontend in the collection manager

The on-chain `atomicbridge` contract already supports both directions — AtomicHub's site just never exposed the return path. Verified on-chain: sending a bridged AtomicAssets card to `atomicbridge` with the memo `unbridge` triggers an inline `simpleassets::transfer` back to the sender, and the original SimpleAssets card is still held in the bridge's custody. No card is ever burned.

## What you will see

1. **New "Bridge" dialog in the collection manager** (button next to the existing transfer/burn actions, visible when a wallet is loaded).
2. **Two tabs inside the dialog:**
   - **To AtomicAssets** — lists your unbridged SimpleAssets cards; select any number and sign one transaction to bridge them across.
   - **To SimpleAssets** — lists only your *bridged* AtomicAssets cards (the ones with an original SimpleAssets card waiting in the bridge); select and sign one transaction to bring them back. Cards that were never bridged are excluded, since the bridge has nothing to return for them.
3. **Selection works like the existing batch tools** — click cards to toggle, with a count and a per-transaction limit, plus a short explanation of what each direction does.
4. **Transaction feedback:** the existing success dialog with transaction ID and explorer link; failures cancel cleanly with the usual stuck-modal cleanup. After a successful bridge, both inventories refresh so the cards appear on their new side.

## How it works (technical)

- **SA → AA:** one `simpleassets::offer` action per card to `atomicbridge` (memo per the bridge's existing convention), batched into a single transaction via the existing `useWaxTransaction` hook.
- **AA → SA:** one `atomicassets::transfer` action to `atomicbridge` with memo `unbridge` and the selected asset IDs — the contract's transfer handler looks up each asset's swap record and inline-returns the original SimpleAssets card. Verified against the contract ABI/wasm and real mainnet history.
- **Bridged-card detection:** an AtomicAssets card is unbridgeable only if its immutable data carries `sassets_id` (same check the contract makes); the dialog filters on this so the on-chain "No swap record was found" error can't be hit from the UI.
- New files: `src/lib/bridgeActions.ts` (action builders + validation, mirroring `atomicTradeActions.ts` style) and `src/components/simpleassets/BridgeDialog.tsx`; wired into `src/pages/Index.tsx` alongside the existing batch actions.
- Memo conventions and the exact `unbridge` memo string are confirmed against the contract before wiring; if the return path expects a different memo, the dialog uses whatever the contract actually checks.

## Verification

- Unit tests for the action builders (correct contract, auth, memo, asset ID lists; per-side limits; duplicate rejection).
- Typecheck + build clean.
- Playwright check of the dialog on a wallet holding both bridged AA and unbridged SA cards: both tabs list the right cards, selection and signing flow render correctly.
- One real small-value bridge transaction each way on mainnet to confirm cards land on the expected side (only with your go-ahead, since it moves real cards).
