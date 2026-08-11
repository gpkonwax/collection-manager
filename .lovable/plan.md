# Fix SimpleAssets entries in loaded pack history

Only the SimpleAssets openings are wrong; the AtomicAssets ones are fine.

## What's actually wrong

Verified against a real claim transaction on WAX (`d3498d2f…`, your Jul 31 Series 2 pack):

- That transaction contains **55 `create` actions and 55 `createlog` actions** — the same 55 cards logged twice. The rebuild counts both, so the pack shows **110 cards**. Same doubling turns a 25-card Tiger King Mega into "50 cards".
- The card details live in **`mdata`**, not `idata` (`idata` is literally `{}`). The rebuild reads `idata`, so every card ends up with no name, no `cardid`, and **no image** — that's the blank thumbnails.
- Chain-rebuilt SimpleAssets entries never get a pack image assigned, so the pack tile is blank too.

## The fix

1. **Count each card once** — read only `createlog` actions (they carry the `assetid`, `create` does not).
2. **Read `mdata`** for `name`, `img`, `cardid`, `side`, `variant`, `mint`, falling back to `idata` for any older assets that used it.
3. **One entry per pack, not per transaction** — each `gpk.topps:getcards` action carries its own `cardids` list, so when several packs are claimed in one transaction the cards get split by those counts instead of lumped into one giant "pack".
4. **Correct pack naming by size**, matching the real specs: Series 1 → 5 / 30, Series 2 → 8 (2A) / 25 (2B) / 55 (2C), Exotic → 5 / 25 (Mega).
5. **Attach the pack artwork** for rebuilt entries by mapping the resolved pack to its symbol (GPKFIVE, GPKMEGA, GPKTWOA/B/C, EXOFIVE, EXOMEGA) and reusing the existing pack image map.
6. Card images resolve through the usual mirror-first IPFS path, so thumbnails will load the same way they do in the grid.

## Technical notes

- All changes are in `src/lib/packOpenHistoryChain.ts` (`reconstructSaOpening`, `guessSaPackName`), plus a small import of `packImage`/pack-symbol mapping from `src/lib/gpkPackMeta.ts`.
- Matchers keep using `cardid`/`side`/`variant` from `mdata`, so replay still lines up with the reveal animation.
- Existing JSONs already downloaded will still contain the bad SimpleAssets entries; re-running "Download pack history JSON" after this fix regenerates them correctly.
