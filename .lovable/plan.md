# Cryptotwerpz SA→AA Bridge: Findings + Mapping Plan

## What I found on-chain

**The SimpleAssets collection exists and is well-structured.**

| Fact | Value |
|---|---|
| SA author account | `cryptotwerpz` |
| Category | `serieszero` (only one seen) |
| Total mints ever | **40,286** |
| Distinct cards (from 10,000 most recent mints) | **310** |
| Distinct character names | 83 |
| Variants | `x`, `y`, `z` |
| Rarity tiers | 6 |

Rarity breakdown (of the 10,000 sampled): Common 6,694 · Simple Re-Fracture 2,559 · Black Death Re-Fracture 658 · Nuclear Re-Fracture 62 · Twerp-O-Mation 15 · Tripped-Out-Twerp 12.

The card data is **clean and perfectly regular** — every asset looks like:

```text
idata: {"name":"Baggy Eilish","cardnumber":"22","variant":"y","Rarity":"Common"}
mdata: {"artist":"Mugen","site":"https://...","img":"Qmdx...1sz"}
```

That regularity is the single best news here: mapping can be **fully automated**, not hand-typed.

## The authorization question — RESOLVED

The existing AtomicAssets collection `cryptotwerpz` (created Jan 2021) is the *real, recognised* collection. Its author is `cryptotwerpz`, and you've confirmed your friend **controls the keys to that author account**.

That is the best possible outcome. As author he can do everything directly, with no dependency on any other account:

- Create the new `serieszero` schema.
- Create one template per distinct card.
- **Authorize the bridge contract as a minter** on the collection — so the contract itself can mint bridged cards into the authentic collection, no proxy account needed.
- Grant or revoke any other authorizations later.

Bridged cards therefore land in the *real* `cryptotwerpz` AA collection under a proper `serieszero` schema. No unofficial "ctwerpzbrdg" fallback, no recognition/market-value penalty. The Path B caveat no longer applies.

The one thing still worth confirming before writing code (Step 0 below): whether he wants the bridge contract to mint under its own authorized-minter account, or to mint by signing as the `cryptotwerpz` author directly. Both work; the first is cleaner for a live service.

## Is the mapping population difficult? No — it's the easy part

I expected this to be the painful step. It isn't, because the data is machine-readable.

- **Volume is modest.** ~310 confirmed distinct cards; because the distinct-count curve was still creeping up ~6 per 1,000 mints when the history API capped out at 10,000 rows, the realistic full total is **roughly 350–450 templates**. That is a normal-sized collection, not a mega one.
- **No manual data entry.** Card name, number, variant, rarity, artist and image hash all come straight out of `idata`/`mdata`. A script enumerates every distinct `(cardnumber, variant, Rarity, img)` tuple and emits the template list directly.
- **Template creation is scriptable.** ~400 `createtempl` actions, batched ~50 per transaction, is roughly 8 transactions. Minutes of work, not weeks.

The genuinely effortful parts are elsewhere: funding RAM for ~40k mints, and getting holders to actually use the bridge.

## Revised plan

### Step 0 — Minter setup decision (non-blocking, but do early)
Since he controls the `cryptotwerpz` author account, decide the minting model: authorize a dedicated bridge account as a collection minter (recommended for a live service — the contract mints autonomously on transfer), or have the contract act with the author's permission inline. Either is supported; this choice only affects the contract's `mintasset` authorization path and the deploy guide.

### Step 1 — Complete the card census
`scripts/twerpz-census.mjs`: walk the full `simpleassets::create` history for `cryptotwerpz` using **month-sized time windows** (the history API caps any single query at 10,000 rows, so windowing is required to get past 40k). Output `twerpz-cards.json` — every distinct card with number, variant, rarity, name, artist, image hash, and observed mint count.

Also produce a live-supply count by rarity, since some of the 40,286 minted assets have since been burned and only existing assets can be bridged.

### Step 2 — Build the AA target
`scripts/twerpz-create-templates.mjs`: from the census, create the `serieszero` schema (fields: name, cardnumber, variant, rarity, artist, img, plus `sa_mint` to preserve original mint numbers) and batch-create one template per distinct card. Writes back `twerpz-mapping.json` pairing each SA card key to its new `template_id`.

### Step 3 — The bridge contract
`bridge-contract/src/sabridge.cpp`, as previously planned, with the mapping keyed on `(category, cardnumber, variant, rarity)`:

- `on_notify("simpleassets::transfer")` — validates sender is `simpleassets` and `to == _self`, looks up the mapping, and mints the AA equivalent to the original sender via `atomicassets::mintasset`, carrying the original SA mint number into immutable data.
- Unmapped card → transaction reverts, so nobody can lose a card to a missing template.
- Escrow-reversible by default: SA originals are held, never burned, and `swapback` returns them.
- Guard rails and admin actions as previously specified.

### Step 4 — RAM budget
AtomicAssets charges the collection ~151 bytes per mint plus 112 bytes per new owner scope. For ~40k assets that is a real, quantifiable WAX cost that must be funded up front on the bridge account. Step 1's census gives the exact number to budget against, and this should be priced before committing.

### Step 5 — Deploy guide
`bridge-contract/README.md` — first-timer walkthrough covering account setup, eosio.cdt build, contract deploy, collection/schema/template creation, mapping load, a reversible end-to-end test on a single cheap card, and the holder-facing instructions.

## Honest caveats

- This is a clean-room build. The pink.gg AtomicBridge is **not** open source — there is no `bridge` repo under `pinknetworkx` and GitHub search returns zero results. Only the AtomicAssets/AtomicMarket/AtomicPacks contracts are public (MIT).
- The 310 distinct-card figure is a floor measured from 10,000 of 40,286 mints; Step 1 replaces it with an exact number.
- Escrowing real holder value warrants a security review of the C++ contract before launch.

## Scope

`bridge-contract/` and `scripts/twerpz-*.mjs` are standalone. No changes to the React app.
