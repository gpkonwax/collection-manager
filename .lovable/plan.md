
## Fix the persistent Food Fight unpack error

### Do I know what the issue is?
Yes.

The failing pack in your session is **template 59490** (Food Fight WinterCon Day 2). The app is still opening it with the **wrong flow**:

- current app: sends the pack to `atomicpacksx` with memo `unbox`
- official Topps flow: sends the pack to **`unbox.nft`** with memo **`open pack`**, then calls **`unbox.nft::unbox`** with the pack’s `box_id`

That mismatch is why you still get:

`The transferred asset's template does not belong to any pack`

I verified this from:
- your live inventory request showing template **59490**
- `toppsgpk.io`’s shipped unbox JS
- `sale-data.wdny.io/gpk.topps/unbox.json`, which lists **59489–59492** as Food Fight WinterCon boxes

## What to change

### 1) Replace the incorrect WinterCon Food Fight mapping
**File:** `src/hooks/useGpkAtomicPacks.ts`

Update pack config so **59489–59492** no longer use the generic `atomicpacksx` path.

Instead of only storing `contract` + `cards`, expand config to support a real **open strategy**, for example:

- direct-transfer packs (current Crash Gordon / Bernventures / Mittens behavior)
- `unbox.nft` packs (Food Fight WinterCon)

This avoids forcing all atomic packs through the same contract flow.

### 2) Update pack opening actions to support `unbox.nft`
**Files:**
- `src/components/simpleassets/AtomicPackCard.tsx`
- `src/components/simpleassets/AtomicPackBrowserDialog.tsx`

For Food Fight WinterCon packs, opening should become a **2-action transaction**:

1. `atomicassets::transfer`
   - `to: "unbox.nft"`
   - `memo: "open pack"`
2. `unbox.nft::unbox`
   - `collection_name: "gpk.topps"`
   - `from: actor`
   - `box_id: templateId`

Both the single-pack button and the multi-pack browser need to use the same strategy-specific open logic so they stay in sync.

### 3) Fix the reveal/claim path for `unbox.nft`
**File:** `src/components/simpleassets/AtomicPackRevealDialog.tsx`

Right now this dialog assumes the pack uses the `unboxassets` / `claimunboxed` flow. That is correct for some pack contracts, but not for the proven WinterCon Food Fight route.

I’ll update this to support **strategy-specific reveal handling**:
- keep the existing flow for packs that truly use `unboxassets`
- add the proper `unbox.nft` pending/claim flow for Food Fight WinterCon

If the cleanest implementation is a separate reveal adapter for `unbox.nft`, I’ll split that logic instead of overloading one code path.

### 4) Audit the remaining “Food Fight / GameStonk” templates while fixing this
**File:** `src/hooks/useGpkAtomicPacks.ts`

The proven failing pack is **59490**, so that gets fixed first.

While I’m in the config, I’ll also re-check:
- `59489`
- `59491`
- `59492`
- `59072`
- `53187`

If any of those are not confirmed with a valid open route, I’ll avoid leaving them on a broken path. If needed, I’ll temporarily disable their opener instead of letting users hit failing transactions.

### 5) Clean up the new pack browser dialog warnings
**Files:**
- `src/components/simpleassets/AtomicPackBrowserDialog.tsx`
- possibly `src/components/ui/dialog.tsx`

The console also shows:
- `Function components cannot be given refs` around `DialogHeader`
- missing dialog description / `aria-describedby`

While fixing the opener, I’ll clean those warnings so the dialog is accessible and quieter in dev.

## Technical approach
I’ll refactor atomic pack config from:

```text
template -> { contract, cards }
```

to something closer to:

```text
template -> {
  cards,
  openMode,
  openContract,
  transferMemo,
  boxId?,
  collectionName?,
  revealMode
}
```

That keeps all pack-specific blockchain behavior in one place and prevents more “wrong contract for this template” regressions.

## Expected result after implementation
For Food Fight WinterCon packs (like your Mint #2227 / template 59490):

1. Click Open
2. App sends pack to `unbox.nft` with `open pack`
3. App calls `unbox.nft::unbox`
4. Reveal/claim uses the correct backend flow
5. No more template assertion failure

## QA I’ll run after implementation
- Open a **Food Fight WinterCon** pack end-to-end from the multi-pack browser
- Verify no assertion error
- Verify reveal appears and claim works
- Verify mint labels still show correctly in “Open Packs”
- Verify Crash Gordon / Bernventures / Mittens still open normally
- Verify the plural “Open Packs” flow still works on desktop and mobile
