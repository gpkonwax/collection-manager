# Fix Series 2C (GPKTWOC) pack opening

Four separate bugs stacked up on that open. Each is confirmed in the code.

## What went wrong

1. **Wrong card count for 2C.** The reveal dialog's card table says `GPKTWOC: 35`, while the pack card UI says `GPKTWOC: 55`. The reveal locks onto the first unboxing group it sees with at least that many rows — so it can start on a partial batch while the contract is still minting the rest.
2. **The reveal snapshots rows once and never re-checks.** Whatever rows exist at that instant become the whole pack. Everything minted afterwards is invisible to the reveal.
3. **`getcards` only claims the snapshotted rows.** The remaining rows stay `done = 0` on chain — that is why the chain showed 55 delivered but only part of them arrived, and the rest had to be recovered later.
4. **Blank card images.** The image URL is built from the raw on-chain `variant` string with no normalisation and no URL encoding. Series 2 variants include `tiger stripe` and `tiger claw` (and chain values vary in spacing/case), so the mirror/IPFS path is wrong and the tile stays blank. Everywhere else in the app the variant is passed through `normalizeGpkVariant` first — the reveal path is the one place that skips it.

The "cards not shown due to indexer" list appeared because the deal-animation matcher looks for all revealed cards using normalised variants; the ones with mismatched paths/late mints never resolved, then a later refetch made them visible in the collection anyway.

## The fix

**Correct counts + settle before revealing**
- Single shared source of truth for expected cards per pack symbol, with `GPKTWOC: 55`, used by both the pack card and the reveal dialog.
- Reveal targeting waits for the unboxing group to *stop growing*: poll until the row count for that `unboxingid` is unchanged across two consecutive polls (or the expected count is reached), then reveal. This removes the "revealed a partial pack" class of bug for every pack type, not just 2C.

**Claim everything**
- Immediately before the `getcards` transaction, re-fetch the pending rows for that `unboxingid` and submit **all** of its `done = 0` row ids, not the snapshot taken at reveal time. If new rows appeared after the reveal started, they get claimed in the same transaction and appended to the reveal grid and the deal matchers.

**Fix the images**
- Normalise the variant with `normalizeGpkVariant` and URL-encode each path segment when building card image and card-back URLs, so `tiger stripe` resolves on the mirrors instead of 404ing.
- Card tiles that exhaust every candidate show a labelled placeholder (card id + variant) instead of an empty frame.

**Deal animation**
- With counts and variants correct, the matcher resolves all cards, so the animation runs for the full pack. The existing "skip" escape stays.

## Verification

- Extend `scripts/test-reveal-pipeline.mjs` to cover a simulated 55-card `gpktwo55` open, including the `tiger stripe` / `tiger claw` variants, and assert 100% image resolution off the mirrors.
- Unit test the normalised/encoded URL builder against known mirror paths.

## Files

- `src/components/simpleassets/PackRevealDialog.tsx` — expected counts, settle-before-reveal polling, re-fetch rows before `getcards`, placeholder tiles
- `src/components/simpleassets/GpkPackCard.tsx` — use the shared counts table
- `src/lib/gpkCardImages.ts` — variant normalisation + path encoding
- `scripts/test-reveal-pipeline.mjs` — 2C coverage
