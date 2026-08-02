# Trade buttons on packs when viewing a wallet

Cards already show a "Trade" button while you're viewing someone else's wallet. The pack tiles at the top of the page don't. This adds the same button to both pack types.

## What changes for the user

While viewing another wallet (not your own), each pack tile that the viewed wallet actually holds gets a "Trade" button in place of / alongside the current "View Only" button.

- **AtomicAssets pack** — clicking Trade opens the trade composer locked to AtomicAssets, with one of their packs of that type preselected on the "They send back" side.
- **SimpleAssets pack** — clicking Trade opens the composer locked to SimpleAssets, with the "They send back" side switched to the Packs category and quantity 1 of that pack symbol already selected.

From there the flow is the normal composer: pick what you send, adjust quantities, submit.

Packs with a zero balance keep showing the existing disabled state (no Trade button), and nothing changes when you're on your own wallet.

## Technical notes

- `src/components/simpleassets/GpkPackCard.tsx` and `src/components/simpleassets/AtomicPackCard.tsx`: add an optional `onTradeClick` prop. Render a Trade button (same cheese-pill styling and `ArrowLeftRight` icon as `SimpleAssetCard`) in the read-only branch when `onTradeClick` is set and the pack count/amount is greater than zero.
- `src/pages/Index.tsx`: add `handleTradeFromPack`, mirroring `handleTradeFromCard` — guards on connected wallet and a viewed account different from yours, sets `composerCounterparty` to the viewed account, clears counter-offer state, and opens the composer. For AA it sets `composerProtocol='atomicassets'` and `composerInitialTheirIds=[pack.assetIds[0]]`; for SA it sets `composerProtocol='simpleassets'` and a new `composerInitialTheirPackQty={ [pack.symbol]: 1 }` state. Pass the handler into both pack cards at lines ~2722/2726, gated by `isViewing`.
- `src/components/TradeComposerDialog.tsx`: add optional `initialTheirPackQty` / `initialMyPackQty` props; the open-reset effect seeds `theirPackQty` / `myPackQty` from them instead of always `{}`, and includes them in the effect deps. The `AssetPicker` for a side already exposes the Packs category, so it also defaults its category to `packs` when it receives a non-empty initial pack quantity map.

No on-chain or offer-decoding changes — pack trading itself already works on both protocols.
