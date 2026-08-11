# Pack Info Popups for the Remaining Packs

Extend the existing hover spec sheet (currently Series 1 and Series 2 only) to every other pack the app shows: the two Exotic packs and all nine AtomicAssets packs. Only verifiable, sourced facts go in — anything unknown is simply omitted rather than guessed.

## What each popup will say

Exotic Series 1 Pack (EXOFIVE) — Standard Pack, originally priced $4.99, GPK Goes Exotic, July 14, 2020, 5 cards.
Includes: ~0.6 "B" Name Prism per pack; ~0.4 "A" Name Prism per pack; 10% chance at a Tiger Stripe; 1% chance at a Tiger Claw; 1% chance at a Collector's Edition. Print run: 13,000 packs.

Exotic Mega Pack (EXOMEGA) — Mega Pack, originally priced $19.99, GPK Goes Exotic, July 14, 2020, 25 cards.
Includes: 4 "B" Name Prism Cards; 3 "A" Name Prism Cards; 50% chance at a Tiger Stripe; 5% chance at a Tiger Claw; 5% chance at a Collector's Edition. Print run: 7,000 packs.

Crash Gordon Pack (13778) — Crash Gordon, August 28, 2020, 5 cards, 5,000 packs minted. No price published, so the price line is left out.

Bernventures Pack (48479) — originally priced $5 in WAX, Bernventures, January 26, 2021, 2 cards, 8,976 packs minted.
Includes: Base "a" / Base "b" cards; 10.5% chance at an Artist Sketch; 3% chance at an Artist Raw; 0.5% chance at an Artist Signature.

Mitten Pack (51437) — Bern 4 Golden Mittens Event, February 4, 2021, 5 cards. Not sold: earned by burning 5 points of Bernventures cards.
Includes: Base Mitten Cards; chance at Golden Mitten Cards; chance at rare Animation Cards.

GameStonk! Pack (53187) — originally priced $10 in WAX, GameStonk!, February 9, 2021, 3 cards, 5,000 packs (sold out in 17 minutes).
Includes: Base ("B" Common / "A" Uncommon); Prismatic ("B" Rare / "A" Epic); Sketch ("B" Rare / "A" Epic); Raw (Epic); Gold (Legendary); Signature (Legendary). No numeric odds were ever published.

Food Fight! Pack (59072) — Food Fight! Series 1, February 23, 2021, 3 cards. Free via redemption code from physical 2021 Series 1 boxes.
Includes: 3 "a" cards from the 11-piece digital set; card types Base, Prism, Sketch, Artist Autograph, Golden.

Food Fight! WinterCon Day 1-4 (59489-59492) — WinterCon 2021 Exclusive, February 25-28 2021 (one date per day), 3 cards, 2,450 packs per day.
Includes: 3 "b" cards; card types Base, Prism, Sketch, Artist Autograph, Golden. Sold by credit card during Winter Con; price never published, so no price line.

## Popup layout changes

The current popup has fixed rows (Pack / Series / Release Date / Contains) plus an Includes list. To fit these packs it becomes tolerant of missing data:

- The "(Originally Priced ...)" line renders only when a price exists.
- A new optional "Note" line for how a pack was obtained (redemption code, burn reward, Winter Con credit-card sale) and an optional "Print Run" line (e.g. "5,000 packs").
- "Includes" stays a bulleted list; when only card types are known the bullets list types rather than odds.

## Technical notes

- Extend `src/lib/packSpecs.ts`: make `price` optional, add optional `note` and `printRun` fields, and add the 11 new entries keyed by SA symbol (`EXOFIVE`, `EXOMEGA`) and AA template id (`13778`, `48479`, `51437`, `53187`, `59072`, `59489`, `59490`, `59491`, `59492`).
- Update `src/components/simpleassets/PackInfoPopover.tsx` to skip empty fields and render the new optional lines. No changes to the trigger, wiring, or pack-open logic — `GpkPackCard.tsx` and `AtomicPackCard.tsx` already pass the right lookup keys.

## Sources

Pack facts come from GPKNews.com launch articles, the GeePeeKay WAX release timeline, and on-chain AtomicAssets template records (mint counts and creation timestamps). Facts that could not be verified — Crash Gordon's price, GameStonk's numeric odds, Mitten pull rates, WinterCon prices — are omitted rather than estimated.
