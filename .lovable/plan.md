# Standalone SA→AA Bridge: Open-Source Contract + Deployment Guide

## Goal
Deliver a self-contained, open-source SimpleAssets→AtomicAssets bridge that your friend can deploy on **his own WAX account** to migrate his existing SA collection into a new AtomicAssets collection he controls. The original SA creator account is **not required**.

Deliverable lives in a new `bridge-contract/` folder (no changes to the React app):

```
bridge-contract/
  src/sabridge.cpp        # the eosio C++ contract
  src/sabridge.hpp        # tables + actions
  README.md               # step-by-step deploy guide for a first-timer
  mapping-template.csv    # SA asset -> AA template import format
  scripts/build-mapping.mjs  # generate the mapping table rows from his SA collection
```

## Why the creator account isn't needed (verified)
- SimpleAssets `transfer` is authorized by the **asset owner**, not the author/creator. Our codebase confirms: `simpleassets::transfer(from, to, assetids)` with `authorization: from`. So every holder can move their own cards into the bridge escrow.
- The AA side is a **brand-new collection** his new account creates → his new account is the collection author and adds itself to `authorized_accounts`. The old SA creator is never touched.
- The only thing lost without the old creator account is the ability to **mint new SA assets** / edit SA metadata — irrelevant to migrating assets that already exist.

## Contract design (`sabridge.cpp`)

Tables:
- `mapping` (i64, scope by SA author): `sacategory` (name), `assetid_or_cardid` (uint64), `aa_template_id` (int64), `aa_schema` (name). Lookup key = SA author + category + card id.
- `config`: `aacollection` (name), `ram_payer` (name), `mode` (uint8: 0=escrow-reversible, 1=burn-one-way), `bridge_account` (name = self).
- `escrowed` (i64, scope by owner): `sa_assetid` (uint64), `aa_assetid` (uint64), `owner` (name), `sa_author` (name). Tracks reversible swaps for swap-back.

Actions:
- `init(aacollection, mode)`: set config. Admin only (self/active).
- `addmapping(sacategory, cardid, aa_schema, aa_template_id)`: admin. One row per card variant. Bulk variant supported via `addmaps` taking a vector.
- `ontransfer` (`[[eosio::on_notify("simpleassets::transfer")]]`): when an SA asset lands in the bridge account:
  1. Read the incoming `assetids` + `from` (the new owner).
  2. For each, read SA asset row (`author`, `category`, `id` via `require_find` on `simpleassets`'s `assets` table scoped by author).
  3. Look up `mapping` by (author, category, cardid). If no mapping → fail the transfer (revert) so users don't lose cards to an unmapped variant.
  4. Inline action `atomicassets::mintasset(permission_level{_self,"active"}, _self, aacollection, aa_schema, aa_template_id, from, immutable_data, mutable_data, {})`.
     - `immutable_data`: carry the original SA mint number so the AA card keeps its provenance (read SA `idata`/`mdata` mint).
  5. If `mode==0` (reversible): insert `escrowed` row (sa_assetid, aa_assetid, owner=from, sa_author). SA card stays in bridge account = escrowed.
  6. If `mode==1` (one-way): inline `simpleassets::burn` is **not** bridge-authorizable (burn needs owner). So one-way mode instead keeps cards escrowed but disables swap-back — document this honestly. (True burn-one-way would require holders to burn themselves first then claim an AA mint via a separate `claim` action; offer that as `mode==2` if desired.)
- `swapback(aa_assetid)`: user transfers their AA asset to the bridge account first (so bridge owns it), then calls `swapback`. Bridge: `atomicassets::burnasset(_self, aa_assetid)` (bridge is now owner → authorized), looks up `escrowed`, `simpleassets::transfer(_self, owner, [sa_assetid])` to return the SA original, delete escrow row. RAM refunded to bridge.
- `setmode(mode)`, `setcol(aacollection)`: admin.
- `cleanup`/`withdraw` for admin to recover misrouted SA assets in edge cases (documented, audited use only).

Security:
- `on_notify` strictly checks `get_first_receiver()==simpleassets` and `to==_self` to prevent fake-transfer spoofing.
- All `mintasset`/`burnasset`/`transfer` inline actions use `permission_level{_self,"active"}` only.
- The bridge account must be the **only** signer on its own `active` permission (no giving keys to a frontend).

## Mapping population (the real work for the friend)
The friend must produce one `mapping` row per distinct card variant in his SA collection:
`scripts/build-mapping.mjs` reads his SA collection (via AtomicAssets API / Hyperion) → lists every distinct `(category, cardid, side, variant)` → outputs a CSV. He then:
1. Creates the AA collection + schema whose templates mirror exactly those variants.
2. Creates one AA template per variant (image, name, cardid, side, variant in immutable data).
3. Pastes template_ids back into the CSV → runs a bulk `addmaps` action.

`mapping-template.csv` columns: `sa_author, sacategory, cardid, aa_schema, aa_template_id`.

## Deployment guide (README.md, first-timer friendly)
1. Create a new WAX account for the bridge (e.g. `friendbridge`), fund it with WAX + ~RAM for AA minting (estimate bytes per mint).
2. Install eosio.cdt v3.0+ / use a Docker build image; `eosio-cpp src/sabridge.cpp -o sabridge.wasm`.
3. Set contract: `cleos set contract friendbridge bridge-contract/ -p friendbridge@active`.
4. Create the AA collection on his **owner** account (`createcol`), add `friendbridge` to `authorized_accounts`, set `notify_accounts` to include the bridge.
5. Create schemas + templates mirroring the SA variants (use AtomicHub UI or `createschema`/`createtempl`).
6. `init(aacollection, mode=0)` then bulk `addmaps` from the CSV.
7. Test: bridge a cheap/test SA card to itself, confirm AA mint lands, then `swapback` to confirm reversibility.
8. Open the flow to holders: they just `simpleassets::transfer` their cards to `friendbridge`; the AA equivalent mints automatically to them.

## Caveats to state in the guide
- This is **not** the pink.gg bridge; pink.gg's contract is closed-source. This is a clean-room reimplementation against the open AtomicAssets standard.
- Reversible escrow (mode 0) is the default and recommended — mirrors pink.gg's trust model. The bridge holds the SA originals; swap-back is always available to the holder.
- RAM for AA minting is paid by the bridge account. Budget for it.
- Only **existing** SA assets can be migrated. If a holder wants new SA cards minted, that needs the old creator account (which is lost) — out of scope.
- Before going live, the friend should verify no SA-side attribute lock blocks transfers for any holder.
- A security audit of the C++ contract is recommended before escrowing real value.

## What this does NOT change
- No edits to the React app or existing hooks. `bridge-contract/` is fully standalone and can be its own repo later.
