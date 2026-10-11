# Enable GameStonk! pack opening + refresh login page and Info window

## What the chain shows (verified today)
- Every successful GameStonk! opening in the last two years (most recent 18–20 Sept 2026) is a single transfer of the pack to **gpkpoolunbox** with memo **`gamestonk`**. The current app sends it to `atomicpacksx` with memo `unbox`, which is why it is disabled.
- In the same transaction the pack is burned and a claim is registered under the pack's asset ID.
- About 15 seconds later an automated account calls **gpkpools1111::claim** for that pack ID and transfers **3 pre-minted cards** to the opener with memo "GameStonk! Pack Opening". The opener signs nothing extra.
- There is no `unboxassets` table or random-number callback in this flow, so the current reveal window (which waits for those) would never find the cards. GameStonk needs its own way of spotting the delivered cards.

## 1. GameStonk! opening
- Template 53187: contract `gpkpoolunbox`, memo `gamestonk`, 3 cards, opening enabled.
- New opening mode "pool delivery": after the pack is sent, the reveal window checks history for the `gpkpools1111` delivery of that exact pack ID (claim_id = pack asset ID) to the opener. It loads those 3 cards and plays the normal reveal, yay, deal animation and pack-history entry.
- Progress text reads "Waiting for the GameStonk pool to deliver your cards…". If nothing arrives within about 3 minutes, the stalled panel explains that the pack is already burned and the cards will arrive in the wallet automatically when the delivery bot runs. It shows the pack ID and a link to check, and never offers a retry that could send a second pack.
- Pack card, history replay and demo opening work the same as other AtomicAssets packs. Bernventures and Mittens stay disabled, with their reason updated to say that opening would currently freeze the pack.

## 2. Pack Openings section on the login page
- "Supported now" adds **GameStonk!**. The pack fan already shows its front, so the picture stays the same.

## 3. Thorough update of the Info window
Fix outdated lines and add recent features in the existing style:
- **Collection Views**: Classic View is no longer read-only. It supports Select with transfer, bridge and burn. Its grid scrolls endlessly instead of using pages. Binder groups duplicates into one stack that opens every copy, sorted by lowest original mint. Saved Collection asks Stack or Swap when you drop a duplicate onto its twin. Ribbons show the original mint number only, with total and burned counts in details.
- **Bridge (new section)**: two-way SimpleAssets to AtomicAssets bridging from the selection bar, up to 20 cards per transaction. Cards are held by the bridge and never burned. Only cards that started as SimpleAssets can go back.
- **Card details**: shows the original mint, the creation date of the bridged copy, and pack-opening provenance (opener, pack, date). Adds full on-chain SimpleAssets trading history and correct supply numbers for native AtomicAssets cards. Explorer links go to AtomicHub or WAX Explorer depending on the card's source.
- **Pack Openings**: adds GameStonk! to supported packs, plus the official watermark-free Topps pack renders, the yay at the end of the reveal and at the end of the deal, and pack transfers (token packs by quantity, AtomicAssets packs by ID).
- **Trading**: reply notifications on the Trades button (accepted, declined, countered), a "Replies to your offers" panel, and per-copy Trade buttons for stacked duplicates when viewing another wallet.
- **View Any Wallet**: favourite accounts (starred, with export and import), a live 90-day active traders list, and full-width account names.
- **Draw & Write**: Type text in six bundled handwriting styles with active ink colour and undo. Works offline on cards and packs.
- **Built-in Resistance / Import-Export**: adds the Records ZIP (holders, mints, provenance) loaded before network sources, and favourites to the exportable files.
- **Flexibility**: the Bright skin now uses the bubblegum candyland background with defined soft-blue windows.

## Technical details
- `useGpkAtomicPacks.ts`: add `'pool_claim'` to `PackOpenMode`. 53187 becomes `{ contract: 'gpkpoolunbox', cards: 3, openMode: 'pool_claim', transferMemo: 'gamestonk', poolAccount: 'gpkpools1111' }`. Update the Bernventures and Mittens disabled reasons.
- `packOpenActions.ts`: a `pool_claim` branch builds one `atomicassets::transfer` to `config.contract` with `config.transferMemo`. Add a unit test that asserts recipient `gpkpoolunbox`, memo `gamestonk` and the single asset ID.
- `AtomicPackRevealDialog.tsx`: in `pool_claim` mode, skip the randnotify, `unboxassets` and claimunboxed paths. Poll Hyperion `get_actions?account=<opener>&filter=gpkpools1111:claim` (endpoint fallback list) for `claim_id === packAssetId`, read the companion transfer's `asset_ids` from that transaction, and fetch the assets from the AtomicAssets API. Use a 3-minute stall threshold. Add a unit test for the delivery matcher using the recorded 18 Sept transaction shape.
- `Index.tsx`: edit landing "Supported now" text and the Info dialog block (~2915–3075) only.
- Food Fight packs on-chain also open via `gpkpoolunbox` (memo `foodfight`). This plan does not touch Food Fight; flag it as a follow-up.
- Verify: tests, build log, a demo GameStonk opening in the browser, and both skins for the login and Info text. A real opening can't be signed from the sandbox, so live opening is checked only against recorded chain data.
