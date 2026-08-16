# WAX-specific links at the bottom of each collection story

Add a **Links** section at the end of each collection's story dialog, listing the WAX/Topps-specific pages for that collection only. Series 1 links appear in the Series 1 story, Series 2 links in the Series 2 story, and so on.

Every link is labelled as **Official** (Topps, WAX.io, official press release, official drop page) or **Coverage** (GPKNews, hobby/news press) so nothing is presented as official when it is not. Only links verified in research are included — nothing invented.

## What the user sees

Below "Notes & oddities" (and the promo video where one exists), a new section:

**🔗 Links** — a short list of titled links, each opening in a new tab, with a small Official / Coverage tag and an external-link icon. Same cheese-yellow heading style as the other sections, works in both skins. Collections with no verified links simply do not show the section.

## Links per collection

**Series 1**
- WAX.io launch announcement (Official) — medium.com/wax-io/new-topps-garbage-pail-kids-nfts-are-now-available-on-wax-2de012783c60
- Topps GPK FAQ page (Official) — topps.wdny.io/faq
- Packs sell out, secondary market flourishes (Coverage) — gpknews.com/wax-x-topps-packs-sell-out-secondary-market-flourishes/
- Topps enters crypto collectibles (Coverage) — decrypt.co/28547/trading-card-giant-topps-is-now-offering-crypto-collectibles

**GPK Goes Exotic**
- "Sold out in 67 minutes" press release (Official) — globenewswire.com/news-release/2020/07/16/2062972/0/en/Topps-GPK-Goes-Exotic-Digital-Trading-Cards-Makes-Blockchain-History-on-WAX-Selling-Out-in-67-Minutes.html
- WAX.io announcement (Official) — medium.com/wax-io/topps-gpk-goes-exotic-trading-cards-are-now-on-the-wax-blockchain-e77f1356c627
- Launch coverage (Coverage) — gpknews.com/topps-x-wax-launch-gpk-goes-exotic-digital-set/
- Sell-out coverage (Coverage) — gpknews.com/topps-x-wax-gpk-goes-exotic-sells-out/

**Crash Gordon**
- 40th anniversary checklist & details (Coverage) — beckett.com/news/2020-topps-garbage-pail-kids-crash-gordon-40th-anniversary-checklist-and-details/

**Series 2**
- Initial details on the OS2 digital release (Coverage) — gpknews.com/initial-details-on-gpk-x-wax-os-2-digital-release/
- Launch coverage (Coverage) — gpknews.com/topps-launches-garbage-pail-kids-x-wax-os-2-digital-set/

**Bernventures**
- gpkbernventures.com — the original sale site (Official)
- Launch coverage (Coverage) — gpknews.com/topps-digital-launches-garbage-pail-kids-bernventures-digital-wax-set/
- Bernie mitten memes become NFTs (Coverage) — cointelegraph.com/news/bernie-sanders-mitten-memes-immortalized-in-new-nft-collection
- The art behind Bernventures (Coverage) — ecency.com/@kommienezuspadt/bernie-as-a-garbage-pail-kid-the-art-behind-bernventures

**Mittens** — no verified WAX-specific page exists; section omitted.

**GameStonk**
- Topps drop page on AtomicHub (Official) — topps.atomichub.io/drops/gpk.topps
- Launch coverage (Coverage) — gpknews.com/topps-digital-launching-garbage-pail-kids-gamestonk-on-wax/

**Food Fight**
- Official site (Official) — toppsgpk.io
- "Coming to Walmart and Target" press release (Official) — globenewswire.com/news-release/2021/02/22/2179668/0/en/Coming-to-Walmart-and-Target-WAX-Digital-Cards-from-Topps.html
- Walmart/Target retail coverage (Coverage) — news.bitcoin.com/topps-garbage-pail-kids-blockchain-collectibles-can-be-bought-at-target-and-walmarts/

## Research note

A separate search of the WAX Blockchain and Topps official YouTube/Vimeo channels found **no official promo video for any collection other than the Series 1 clip already embedded**. Nothing new is added there.

## Technical notes

- `src/lib/collectionHistory.ts`: add a `CollectionHistoryLink` interface (`label`, `url`, `kind: 'official' | 'coverage'`) and an optional `links?: CollectionHistoryLink[]` field on `CollectionHistory`; populate it for the collections listed above.
- `src/components/simpleassets/CollectionHistoryDialog.tsx`: render a `🔗 Links` `Section` after the video block when `history.links?.length`, each entry an `<a target="_blank" rel="noopener noreferrer">` with the existing `ExternalLink` icon and a small muted Official / Coverage tag — matching the styling already used for the video's "Watch on YouTube" / source links.
- No changes to filtering, data fetching, or blockchain logic.
