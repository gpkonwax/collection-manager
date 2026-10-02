# One mint number on every card ribbon

## What will change

- In the main card grid, display only the mint number (for example, `#1524`) on Series 1, Series 2, and Tiger King/Exotic cards, whether they are SimpleAssets or bridged AtomicAssets. Never show `/ total` on the ribbon. Keep `#--` where the true mint has not resolved; do not mistake the bridge-order mint for the original mint.
- Remove the separate Bridge Mint count from those grid cards so no second mint number appears there. Keep bridge-order information available in the card details, clearly labelled as distinct from the original mint.
- Put supply context in the ribbon tooltip and the card details instead: total ever minted = surviving + burned; show surviving and burned counts when available, along with whether the mint came from the saved backup or live AtomicHub. Never label the surviving count as the total print run. For assets without a recorded burn count, show only supply figures the source actually provides.
- Keep other card interactions, artwork, and pack flows unchanged.

## Technical notes

- The existing mint resolver returns `mint`, `total` (surviving), and `burned`, but the asset hooks currently retain only mint and `total`. Carry the burn/surviving breakdown through both SimpleAssets and bridged AtomicAssets assets without changing the backup format or lookup order.
- Update `SimpleAssetCard` to format the ribbon as a single `#<mint>` and expose supply/source in its tooltip; update `SimpleAssetDetailDialog` to show a separate, labelled supply breakdown. Ensure memoized cards refresh when mint and supply information arrives.
- Add focused tests for both asset types, burned Series 2 cards, Series 1/Tiger King cards with zero burns, and unresolved bridged cards. Verify the grid and detail display without changing the underlying mint number.
