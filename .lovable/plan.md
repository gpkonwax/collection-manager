## Investigation result: Bernventures pack opening

Short answer: **this is not an indexer issue and our app did its job correctly.** The `burnieunpack` smart contract failed to process the random-number callback from the WAX RNG oracle, so cards were never minted. There is currently nothing the front-end can do to retroactively recover that pack — only the contract operator can.

## What actually happened on-chain

For your test pack (asset id `1099514688856`, account `guydgnjzgage`):

```text
11:43:59  atomicassets::transfer    guydgnjzgage -> burnieunpack  memo:"unbox"   OK (pack burned)
11:43:59  orng.wax::requestrand     burnieunpack asks for RNG               OK
11:44:13  orng.wax::randnotify      assoc_id=1099514688856                  OK (oracle returned)
   ---    burnieunpack::receiverand  NEVER FIRED                            MISSING
   ---    burnieunpack::logresult    NEVER FIRED                            MISSING
   ---    atomicassets::mintasset    NEVER FIRED                            MISSING
```

For comparison, a healthy `burnieunpack` open (historical example I verified) shows all of `receiverand → burnasset → logresult` in the same block as the transfer, followed seconds later by the user's `claimunboxed` mint.

Other checks I ran:
- `burnieunpack` `packs` table: pack_id 1 (template 48479) is properly configured with `roll_counter: 2` (i.e. a 2-card pack). Configuration is fine.
- `burnieunpack` `unboxassets` table for scope `1099514688856` and `guydgnjzgage`: empty. Nothing was queued.
- `burnieunpack` account: 860KB free RAM, plenty of CPU/NET, `eosio.code` permission present. Resources are not the problem.
- Our open flow in `src/lib/packOpenActions.ts` and `src/components/simpleassets/AtomicPackRevealDialog.tsx` is correct: `transfer` then later `claimunboxed` — same pattern as `gpkcrashpack`, which is working (verified your own successful Crash Gordon open on 2026-04-25 from the same account).

So the failure is **between `randnotify` and the contract's `receiverand` handler** — i.e. inside the `burnieunpack` contract itself. The oracle delivered the random value but the contract did not consume it. This typically means:
- the contract's `receiverand` action wasn't queued as an inline notification by the oracle (oracle/contract registration mismatch), or
- the contract was redeployed in a state where the inline call deferred and silently dropped.

This matches the original symptom: pack disappears, no cards, no on-chain `logresult` for the indexer to read, so the reveal dialog polls forever.

## What we should do

### 1. Tell the user (you) what to do about the lost pack

Only the `burnieunpack` contract operator can recover it. They have two normal options:
- Manually mint the two cards to `guydgnjzgage` from template 48479's roll table, or
- Refund a replacement pack NFT to the account.

If you don't own/operate `burnieunpack`, contact whoever does (Burnie / Bernventures team). Reference: pack asset id `1099514688856`, tx `cdc491cd0f9e0abbf2f1f2df3713a9ebb6539da3b5f2b8d06e8cdb29a13a19d7`, oracle assoc id `1099514688856`, randnotify tx `aabb10706949d2a0a19819a3b8232e2e34b4ccce0d60add359976f7b81040358`.

### 2. App-side hardening (the actual code changes)

These don't fix the lost pack but stop the same scenario from looking like an app bug next time.

**a. Detect "RNG returned but contract never processed it" and surface a useful error.**
In `src/components/simpleassets/AtomicPackRevealDialog.tsx`, alongside the existing 60s "show escape" timer, add a parallel check (every poll) that queries `orng.wax` history (or the contract's own `pendingrand`/`assocs` table if exposed) for an `assoc_id` matching the pack asset id. If we see a `randnotify` for our pack but `unboxassets` is still empty after, say, 90s, switch the dialog from generic "indexer is slow" to a clear **"Pack opening stalled on-chain"** state that:
- Tells the user the pack was burned but the contract did not deliver cards.
- Shows the asset id and both tx ids (transfer tx + randnotify tx) with copy buttons and links to `waxblock.io`.
- Provides a one-click "Report stuck pack" message template they can send to support / pack operator.

**b. Lengthen the auto-escape timer for `burnieunpack`/`gpkcrashpack`-style packs.**
Today the "Close & Check Later" button only appears at 60s. For these RNG packs, surface it sooner (30s) when we've already detected the `randnotify` so the user isn't trapped staring at a spinner.

**c. Record stuck packs locally.**
Store stuck `{packAssetId, contract, transferTxId, randnotifyTxId, timestamp}` in `localStorage` so we can show a "Stuck pack openings" list in the donation/help dropdown for follow-up — same pattern we already use for the "Collect Unclaimed" recovery tool for `pendingnft.a`.

**d. Disable Bernventures opening until the contract is confirmed healthy.**
Until you confirm the `burnieunpack` `receiverand` path works again (open a *fresh* pack and verify `logresult` fires), set Bernventures to disabled in `src/hooks/useGpkAtomicPacks.ts`:
```ts
'48479': { contract: 'burnieunpack', cards: 2, openMode: 'transfer',
  disabled: true,
  disabledReason: 'Opening temporarily disabled — investigating contract issue' },
```
Mittens (`51437`) is already disabled, so this just keeps both burnieunpack packs gated until the contract is verified.

### 3. Verification path before re-enabling

When the contract operator confirms the fix, before flipping `disabled` back to false:
1. Open one Bernventures pack from a non-production test account.
2. Confirm in the dev tools network tab that `unboxassets` returns 2 rows within ~15s.
3. Confirm `claimunboxed` succeeds and 2 cards appear in collection.
Only then re-enable Bernventures (and consider Mittens too, since it shares the same contract).

## Files that would change

- `src/components/simpleassets/AtomicPackRevealDialog.tsx` — add stuck-pack detection, better error UI, copyable tx ids, earlier escape button when randnotify is seen.
- `src/hooks/useGpkAtomicPacks.ts` — disable template `48479` with a clear `disabledReason`.
- `src/lib/stuckPackStorage.ts` (new) — small localStorage helper for tracked stuck packs.
- Optional: small entry in the info dropdown / help section in `src/pages/Index.tsx` that lists any stuck packs the local user has recorded, with the report template.

## What this plan does NOT do

- It does not recover the burned Bernventures test pack — that requires action from the `burnieunpack` operator.
- It does not change the Crash Gordon flow, which is verified working.
