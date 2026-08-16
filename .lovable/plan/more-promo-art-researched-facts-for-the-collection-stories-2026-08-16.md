# More promo art + researched facts for the collection stories

Three new promo images go into the Series 1 and Series 2 stories, and the write-ups get expanded with facts pulled from GPK News' WAX archive (pages 1–3 plus the individual articles).

## Images

Uploaded art is published as CDN assets (like the existing promo art) and added as click-to-enlarge thumbnails:

- Series 1: the "Packs Available Now!" toppsgpk.io poster (rarity line-up: Base, Prism, Sketch, Collector's Edition) and the "Topps cards to the Blockchain!" banner.
- Series 2: the Topps phone mock-up showing Leaky Lindsay 45a with Trade / Sell buttons.

## Story updates (facts only, each traceable to a GPK News article)

**Series 1** — add published per-card estimates (Base ~908 each across 82 cards / 74,460 total; Prism b 487, Prism a 268; Sketch b 73, Sketch a 36; Collector's Edition 5 each across 8 names) and the 100 randomly awarded Gold cards. Add the launch quotes from Topps VP Tobin Lent and WAX's Evan Vandenberg, secondary-market prices in week one (Mega packs $100+, sketches ~$600), and the launch-day site errors with no built-in marketplace at the time.

**GPK Goes Exotic** — add the delay: originally scheduled for July 8, 12:00 PM EST, pulled with no reason given, later attributed to a third-party shopping-cart/technical issue, then rescheduled to July 14. Correct the sell-out section: all 7,000 Mega packs went in 24 minutes to Telegram members given early access at 11:30 EST, and all 13,000 Standard packs were gone by 12:37 EST — just over an hour total. Add the payment problems (cards declined, up to 30-minute delays, some orders cancelled/refunded from oversells), the per-card counts (Prism b 2,386, Prism a 1,746, Tiger Stripe 160, Tiger Claw 16, Collector Edition 80 each), and the announced Tiger King burn event that was pushed to Q1 2021 and never ran.

**Crash Gordon** — replace the "no numbers published" wording with the real ones: surprise launch during Topps DigiCon, 500 free packs at 1:00 PM EST (one per account), 3,000 packs at 3:00 PM on Atomic Hub at 220 WAX (~$10), plus 1,500 more later — 5,000 packs / 25,000 cards. First batch sold out in 3 min 18 sec, the second in 31 seconds. Odds: 50% b Base, 25% a Prism, 10% b Prism, 1% a Gold, 0.5% b Gold.

**Series 2** — add the per-card counts (Base a/b/c 2,454 each across 104 cards; Returning a 2,211 / b 1,826; Raw 1,428; Slime 238; Gum 238; VHS 119; Sketch 255; Collector's Edition 31 each across 24 cards), the set structure (84-card base plus 26 Chrome Returning and 20 Chrome "c" names, new artists Nik Castaneda, Chenduz and Brent Scotchmer with animated cards and digital autographs), Lent's pre-launch note that John Pound declined to sign, and the December 2020 Burn 4 Gold event (Dec 4–9, 80 Gold cards across four tiers).

**Bernventures** — add the launch-day bug detail already partly noted, plus the confirmed ~$5-in-WAX / 2-card / unlimited-supply structure and the Mitten pack point tiers (already present) with the GPK News source link.

**GameStonk** — add the pre-minted-cards change as the first WAX GPK set with equal low-mint odds (already noted) and confirm no burn mechanic, with the source link.

**Food Fight** — add that the paid WAX Food Fight packs sold out in 17 minutes, and that WinterCon packs were 2,450 per day, credit-card only, not pre-minted.

**Nifty Kids** — new entry only if a matching collection key exists in the app; otherwise skipped rather than invented.

New source links added per collection (Exotic details article, OS2 launch and Burn4Gold articles, Food Fight redemption article, Crash Gordon coverage, Nifty Kids article).

## Technical notes

- `lovable-assets create` for the three uploads, pointers in `src/assets/`, imported in `src/lib/collectionHistory.ts` like the existing `promo-*.png.asset.json` entries.
- All text changes are data edits inside `COLLECTION_HISTORY` in `src/lib/collectionHistory.ts`; no component changes needed — the dialog already renders images, notes and links.
- Only facts stated in the cited articles are used; nothing inferred or estimated beyond what the sources label as estimates.
