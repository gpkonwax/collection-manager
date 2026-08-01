# Fix Series 2C (GPKTWOC) pack opening

Correction from your feedback: nothing was stuck. All 55 cards were claimed and landed in your collection. So this is a **display/matching** problem plus a **reveal count** problem — not a claiming problem.

## What went wrong

1. **Wrong expected card count for 2C.** The reveal dialog's table says `GPKTWOC: 35`; the pack card UI says `GPKTWOC: 55`. The reveal locks onto the first unboxing group that has "enough" rows and never re-checks, so it can render a partial batch while the contract is still minting the rest. That is why the reveal grid was short and the later rows were never part of the reveal.

2. **Blank tiles during the reveal.** The reveal builds its image URLs from the raw on-chain `variant` string — no `normalizeGpkVariant`, no URL encoding of path segments. Series 2 includes `tiger stripe` and `tiger claw`, and chain values vary in spacing/case, so those paths 404 on every mirror and gateway and the tile stays empty. Every other part of the app normalises the variant first; the reveal image builder is the one place that doesn't.

3. **"Couldn't be shown due to the indexer" was a false report.** That list comes from the pack audit, which pairs each pending row to a collection asset by an exact triple: `cardid` (after a per-boxtype offset), `side`, and normalised `variant`. When any leg of that triple disagrees — the `gpktwo*` card-id offset, or a variant spelling the collection stores differently — the card is declared missing even though it is sitting in your collection. That is exactly what you saw: 32 matched, the rest listed as missing, all 55 actually present.

4. **Deal animation didn't play** because it waits for *every* revealed card to resolve through the same matcher. Unresolvable rows meant the wait never satisfied, and you ended up with plain thumbnails.

## The fix

**Step 1 — verify the matching rule against your real pack (before changing matcher logic).**
Pull the `pendingnft.a` rows for that `unboxingid` and the corresponding SimpleAssets rows, and diff the three fields. This tells us definitively whether the mismatch is the `+42` card-id offset applied to all `gpktwo*` boxtypes, the variant spelling, or the side field. No matcher change lands until the diff names the cause.

**Step 2 — make the matcher forgiving instead of wrong.**
- Correct whatever the diff shows (per-boxtype card-id offset table rather than one blanket `+42`, and/or variant alias additions).
- Add a tiered fallback: exact triple, then triple with variant compared via alias-insensitive equality, then `cardid + side` only. A card is only reported "missing" after all tiers fail.
- Same tiering for the deal-animation matcher, so a single odd variant string can no longer block the whole animation.

**Step 3 — correct counts and settle before revealing.**
- One shared expected-cards table for both the pack card and the reveal dialog, with `GPKTWOC: 55`.
- The reveal waits for the unboxing group to stop growing (row count unchanged across two consecutive polls, or the expected count reached) before it starts flipping cards. This kills the partial-reveal bug for every pack type.

**Step 4 — fix the reveal image paths.**
- Run the variant through `normalizeGpkVariant` and URL-encode each path segment when building card front/back URLs.
- If a tile exhausts every mirror and gateway, show a labelled placeholder (card id, side, variant) instead of an empty frame, so a failure is legible rather than blank.

## Verification

- Extend `scripts/test-reveal-pipeline.mjs` with a simulated 55-card `gpktwo55` open covering `tiger stripe` / `tiger claw`, asserting 100% image resolution off the mirrors.
- Unit tests for the URL builder (normalised + encoded) and for the tiered matcher, including the exact rows from your 2C pack.

## Files

- `src/pages/Index.tsx` — tiered pack-audit matcher, card-id offset correction
- `src/lib/packReveal.ts` — tiered deal-animation matcher
- `src/lib/gpkCardImages.ts` — variant normalisation, path encoding, per-boxtype id offsets
- `src/components/simpleassets/PackRevealDialog.tsx` — shared counts, settle-before-reveal, placeholder tiles
- `src/components/simpleassets/GpkPackCard.tsx` — use the shared counts table
- `scripts/test-reveal-pipeline.mjs` — 2C coverage
