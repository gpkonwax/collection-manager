# Fix replay dealing only some cards

## What's actually wrong

Replay reveals every card correctly (it renders straight from the saved history entry), but the deal step only animates cards it can match back to assets you currently own. For SimpleAssets openings that matching is using the wrong fields, so most cards fail to match and are silently dropped — which is why 8 revealed cards dealt 1, and 8 dealt 3.

Confirmed cause, from reading the code:

- The live collection reader (`useSimpleAssets`) maps SimpleAssets metadata as: `side` = `quality` field (lowercased), `variant` = the `variant` field (normalised).
- The chain history rebuilder (`packOpenHistoryChain`) maps it as: `side` = a `side` field (which SimpleAssets GPK cards do not have, so it ends up empty), and `variant` = `variant` **or falls back to `quality`** — i.e. the side value gets stored as the variant.
- Replay then matches on the triple `cardid` + `side` + `variant`, so nearly every card mismatches. Only the few cards where the values coincidentally lined up got dealt.

AtomicAssets openings match on real asset ids, which is why this shows up on Series 2A/2B (SimpleAssets) packs.

## The fix

1. **Match by asset id first.** Each rebuilt SimpleAssets card already carries the real minted `assetid` from the chain log. Replay should first try to find each card by that exact id in your current collection, and only fall back to attribute matching for cards with no stored id (older, locally-recorded openings). This alone makes every card deal, and it also repairs history JSONs you have already downloaded — no re-download needed.

2. **Correct the SimpleAssets field mapping in the rebuilder**, so newly rebuilt history stores `side` and `variant` the same way the collection reader does. This keeps the attribute fallback accurate.

3. **Make the attribute fallback tiered** rather than all-or-nothing: exact `cardid` + `side` + `variant`, then `cardid` + `side`, then `cardid`. A card is only treated as "no longer in this wallet" after all tiers fail.

4. **Keep the honest reporting.** Cards genuinely traded or burned since the opening still can't be dealt; the existing "N cards are no longer in this wallet" notice stays, but it will now only fire for cards you really don't own.

## Verification

Replay a Series 2A pack (8 cards) and a Series 2B pack: all cards you still own should fly into the grid, and the leftover notice should only mention cards actually gone from the wallet.

## Files

- `src/pages/Index.tsx` — replay collect handler: id-first matching, then tiered fallback
- `src/lib/packReveal.ts` — tiered SimpleAssets matcher, optional asset-id matcher kind
- `src/lib/packOpenHistoryChain.ts` — correct `side`/`variant` mapping for SimpleAssets cards and matchers
