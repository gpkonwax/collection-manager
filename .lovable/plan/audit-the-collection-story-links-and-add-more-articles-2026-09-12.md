# Audit the collection story links and add more articles

I checked every link in the collection stories by fetching each page. Results below, then the changes.

## What is actually broken

Only one link is genuinely dead:

- **Bernventures → "Bernie mitten memes become NFTs"** (Cointelegraph) — returns 404.

Two others looked broken to automated checks but are fine when opened normally (the sites block bots): both WAX.io Medium posts and both GlobeNewswire press releases all still show their full articles. They stay.

One link needs a judgement call:

- **Food Fight → "Official site: toppsgpk.io"** — the domain still loads, but it is no longer the Topps drop page; it now serves a generic NFT template with placeholder sample data. It is misleading to label it Official, so it gets removed.

Everything else (GPK News articles, Beckett, Decrypt, Ecency, news.bitcoin.com, gpkbernventures.com, AtomicHub drop page, topps.wdny.io/faq) is live and correct.

## Replacements and new links

**Series 1**
- Add: Topps x WAX launch digital GPK on blockchain (Coverage) — gpknews.com/topps-x-wax-launch-digital-garbage-pail-kids-on-blockchain/

**GPK Goes Exotic**
- Add: Details on the upcoming Goes Exotic set (Coverage) — gpknews.com/details-on-upcoming-topps-x-wax-gpk-goes-exotic-digital-set/

**Crash Gordon**
- Add: Topps talks the future of GPK x WAX (Coverage) — gpknews.com/topps-talks-wax-x-garbage-pail-kids-future/
- Replace the generic "WAX archive on GPKNews" page-2 link with the searchable WAX archive index — gpknews.com/category/wax/

**Bernventures**
- Remove the dead Cointelegraph link; replace with Coinspeaker's coverage of the same story (Coverage) — coinspeaker.com/sanders-inauguration-wax-blockchain/

**Mittens** (currently has no links)
- Add: Bernventures / Golden Mittens launch coverage, which is the only article covering the mitten burn event (Coverage) — gpknews.com/topps-digital-launches-garbage-pail-kids-bernventures-digital-wax-set/

**Food Fight**
- Remove the toppsgpk.io "Official site" link.
- Add: Food Fight redemptions in 2021 Series 1 (Coverage) — gpknews.com/2021s1-garbage-pail-kids-food-fight-to-include-redemptions-for-wax-digital-collectibles/
- Add: WinterCon pack launch details (Coverage) — gpknews.com/topps-digital-to-launch-wax-garbage-pail-kids-food-fight-packs-during-winter-con/
- Add: Redemption & WinterCon release info (Coverage) — gpknews.com/info-on-topps-digital-food-fight-redemption-winter-con-releases/

**Series 2** — already has five live links; no change.

**GameStonk** — both links live; no change.

Every URL above was fetched and confirmed to return the expected article before being listed.

## Technical notes

- All edits are inside the `links` arrays in `src/lib/collectionHistory.ts` (entries at lines 145, 188, 222, 267, 300, 351, 386, plus a new `links` array on the Mittens entry).
- `CollectionHistoryDialog.tsx` already renders the Links section and needs no change.
- No changes to filtering, data fetching, or blockchain logic.
