// Researched history write-ups for each GPK digital collection on WAX.
// Sources: GPKNews.com launch coverage, the Topps WAX shop/FAQ pages,
// the geepeekay.com digital release timeline, and on-chain print-run data
// already captured in src/lib/packSpecs.ts.
// Figures are best-effort community records — card totals in particular are
// estimates, because cards were minted on pack-open rather than up front.

import bonyJoanieMega from '@/assets/gpk-mega-bony-joanie.png';



export interface CollectionHistoryImage {
  /** Imported image URL. */
  src: string;
  /** Caption shown under the thumbnail and in the enlarged view. */
  caption: string;
}

export interface CollectionHistoryVideo {
  /** Human-readable title of the clip. */
  title: string;
  /** Privacy-friendly embed URL used for the in-app preview player. */
  embedUrl: string;
  /** Canonical watch URL for the "open on YouTube" link. */
  watchUrl: string;
  /** Where the video was found, shown as a source link. */
  sourceLabel: string;
  sourceUrl: string;
  /** Short note explaining why the clip matters. */
  note?: string;
}

export interface CollectionHistory {
  /** One-line description of the set. */
  tagline: string;
  /** When and where it dropped. */
  released: string;
  /** Print runs, pack counts, card totals. */
  dropSize: string;
  /** How fast it went, and what the secondary market did. */
  sellOut: string;
  /** How collectors reacted at the time. */
  reception: string;
  /** Fun facts, oddities, chases. */
  notes: string[];
  /** Optional supporting images shown with the notes, enlargeable on click. */
  images?: CollectionHistoryImage[];
  /** Optional supporting video, playable inline or on YouTube. */
  video?: CollectionHistoryVideo;
  /** Where the details came from. */
  sources: string[];
}


const GPKNEWS = 'GPKNews.com launch coverage';
const GEEPEEKAY = 'geepeekay.com digital release timeline';
const TOPPS_SHOP = 'Topps WAX shop pages & FAQ';
const ONCHAIN = 'On-chain template and pack data';

export const COLLECTION_HISTORY: Record<string, CollectionHistory> = {

  series1: {
    tagline:
      'The very first Garbage Pail Kids cards ever put on a blockchain — the Topps x WAX partnership starts here.',
    released:
      'May 12, 2020, 12:00 PM EST, sold directly by Topps at toppsgpk.io. Standard packs $4.99 (5 cards), Mega packs $24.99 (30 cards).',
    dropSize:
      '10,000 Standard packs and 2,000 Mega packs — roughly 110,000 cards in total. Cards were minted only when a pack was opened, so exact per-card counts vary slightly from the published odds.',
    sellOut:
      'A complete sell-out in 28 hours. Mega packs were gone within the first 7 hours; Standard packs held out until the following afternoon. Secondary market volume was on pace to pass $100,000 in the first week, with single cards and completed sets changing hands for hundreds and in some cases thousands of dollars.',
    reception:
      'Equal parts excitement and confusion. The WAX crypto community piled in immediately, while a lot of long-time GPK collectors were sceptical of the whole idea of a digital card. Topps VP of Digital Tobin Lent called the result "fantastic" and admitted they were not sure how it would go; WAX said the secondary-market activity surprised them more than the sell-out did.',
    notes: [
      'Base, Prism, Sketch, Collector\'s Edition and the ultra-rare Gold chase (0.2% in Standard packs, 1% in Mega).',
      'Every card exists in an "a" and "b" name version, exactly like the printed sets.',
      'Because minting happened on pack-open, the earliest openers effectively raced for the low mint numbers — a mechanic Topps later dropped.',
      'This set set the template every later WAX GPK drop followed: a storefront sale, pack odds published up front, and cards living on the SimpleAssets standard.',
      'An alternate Mega Pack wrapper turns up in some of the early Topps promo videos and pre-launch marketing: it shows Bony Joanie on the front and reads "25 CARDS" instead of the 30 the Mega Pack actually shipped with. No official explanation was ever published, and it never appeared in the store — the shipped Mega art and every GPKNews/Topps listing say 30 cards for $24.99. The most likely story is simply that it is a pre-launch mock-up made before the pack contents were locked; 25 was the count Topps went on to use for both the Exotic ($19.99) and Series 2 ($24.99) Mega Packs, so the artwork may have been drafted against an earlier plan or recycled from the same template. Treat it as an unverified collector curiosity rather than a documented error card.',
    ],
    images: [
      {
        src: bonyJoanieMega,
        caption:
          'The alternate Series 1 Mega Pack wrapper from the early Topps promo footage — Bony Joanie on the front, "25 DIGITAL CARDS • NO GUM". The shipped Mega Pack used different art and 30 cards. Unverified pre-launch mock-up.',
      },
    ],
    sources: [GPKNEWS, TOPPS_SHOP, GEEPEEKAY],

  },

  exotic: {
    tagline:
      'GPK Goes Exotic — the Tiger King parody set, riding the biggest streaming phenomenon of 2020.',
    released:
      'July 14, 2020 at toppsgpk.io. Standard packs $4.99 (5 cards), Mega packs $19.99 (25 cards), credit/debit only.',
    dropSize:
      '13,000 Standard and 7,000 Mega packs — around 240,000 cards, more than double the Series 1 run. 30 pieces of art (15 subjects with a/b versions), all drawn by GPK artist David Gross, carried over from the three online physical Exotic sets released earlier that year.',
    sellOut:
      'A much bigger run with no purchase limits, so it did not vanish the way Series 1 did — but demand was solid, helped by Series 1 secondary prices climbing steadily in the two months since May.',
    reception:
      'Warmly received. Collectors who missed Series 1 finally got a shot at packs, and the Tiger King tie-in pulled in buyers from well outside the usual GPK crowd. Telegram trading-group members were given early access to buy.',
    notes: [
      'Parallels: Prism, Tiger Stripe and Tiger Claw versions of all 30 cards.',
      'Six rare Collector Edition cards were randomly seeded through packs.',
      'Print-run figures were published as estimates because cards minted on pack-open — everyone from the first pack to the last had the same odds.',
    ],
    sources: [GPKNEWS, TOPPS_SHOP, GEEPEEKAY],
  },

  crashgordon: {
    tagline:
      'A small, strange Flash Gordon parody set that started life as a 7-day online-only physical release.',
    released:
      'August 28, 2020 on WAX, as the third Topps x WAX GPK drop. The physical version had been sold on Topps.com as a 7-day timed set ($19.99 a set, $179.99 for ten) with the print run only revealed after the sale closed.',
    dropSize:
      '5,000 packs of 5 cards. The set is 10 cards — 5 subjects with a/b versions — celebrating the 40th anniversary of Flash Gordon.',
    sellOut:
      'No original sale price was ever published for the WAX packs, and Topps never released detailed sell-out numbers. With only 5,000 packs it is one of the scarcer digital GPK sets.',
    reception:
      'A quiet, surprise-style launch rather than a headline event. Collectors treated it as a curiosity at first; the tiny checklist and small pack count have made it steadily harder to complete over time.',
    notes: [
      'Checklist: Crash Gordon, Flying Flash, Flush Gordon, Dethroned Ming, Merciless Ming, Noah Mercy, Revolting Vultan, Hawkman Hank, Doctoring Zarkov, Handy Hans.',
      'One of the first GPK sets to appear on the AtomicAssets standard rather than SimpleAssets.',
    ],
    sources: [GPKNEWS, GEEPEEKAY, ONCHAIN],
  },

  series2: {
    tagline:
      'The fourth Topps x WAX drop and the biggest digital GPK release yet — three pack tiers, each with its own exclusive parallel.',
    released:
      'September 30, 2020, 12:00 PM EST. Standard $9.99 (8 cards), Mega $24.99 (25 cards), Ultimate $49.99 (55 cards).',
    dropSize:
      '5,000 of each pack type — a possible 440,000 cards, the largest digital GPK run to that point. Topps deliberately withheld pack numbers, card inventory and odds until after launch.',
    sellOut:
      'The first release since Series 1 that did not sell out instantly. Standard packs were gone in about 5 minutes and the big Ultimate packs sold out later that evening, but over 1,500 mid-tier Mega packs were still sitting there two hours after launch.',
    reception:
      'Mixed. Demand was strong, but the launch was marred by errors — the first 10 minutes were unbuyable due to a credit-card processor failure, and plenty of collectors reported problems actually opening their packs afterwards. The set itself is well liked; the launch day is remembered as a mess.',
    notes: [
      'Each pack tier had an exclusive parallel: Slime (Standard), Gum (Mega), VHS (Ultimate).',
      'Topps slipped in unannounced "error" cards, including a badly miscut Spilt Kit and a censored, black-barred Schizo Fran.',
      'Returning cards brought subjects back from earlier sets; Collector\'s Edition odds scaled with pack size (1% / 4% / 10%).',
      'Complete the Messy Tessie puzzle from this set in the Puzzle Builder to unlock the full run of classic GPK puzzles.',
    ],
    sources: [GPKNEWS, TOPPS_SHOP, GEEPEEKAY],
  },

  bernventures: {
    tagline:
      'The Bernie Sanders mittens meme, turned into a GPK set less than a week after the photo went viral.',
    released:
      'January 26, 2021, 3:30 PM EST — a surprise launch at gpkbernventures.com. Packs cost $5 worth of WAX tokens and contained 2 cards. The sale ran for 3 days, closing Friday January 29 at 1:00 PM EST.',
    dropSize:
      'No hard cap — the print run was whatever sold in 3 days, which came out at roughly 8,976 packs. The set is 9 pieces of art by Topps artist Lars Kommienezuspadt, doubled to 18 cards with a/b names.',
    sellOut:
      'An open, timed sale rather than a race, with a live countdown and pack counter on the site. Burning immediately started eating into the supply, which makes surviving cards scarcer than the raw sale numbers suggest.',
    reception:
      'Fast, funny and very of-the-moment — collectors loved the speed of the turnaround. The launch was rough around the edges: at press time card and pack images were not displaying and the inventory sorting was broken.',
    notes: [
      'Pull rates: Base "a" 59.5%, Base "b", Artist Sketch 10.5%, Artist Raw 3%, Artist Signature 0.5%.',
      'The real hook was the burn event: Base b = 1 point, Base a = 2, Sketch = 5, Raw = 20, Signature = 150. Burning ran until February 1, 2021.',
      'Points earned in the burn event were exchanged for Mitten packs — see the Mittens collection.',
      'Sold in WAX tokens only, on the AtomicAssets standard.',
    ],
    sources: [GPKNEWS, GEEPEEKAY, ONCHAIN],
  },

  mittens: {
    tagline:
      'The reward set from the Bern 4 Golden Mittens burn event — you could not buy these, you had to destroy cards to earn them.',
    released:
      'February 4, 2021, distributed to collectors who burned Bernventures cards during the January 26 – February 1 event.',
    dropSize:
      'Never sold, so there was no print run in the usual sense: supply is purely a function of how many Bernventures cards collectors were willing to burn. Each 5-card Mitten pack cost 5 points of burned cards.',
    sellOut:
      'Not applicable — no packs were ever offered for sale. Every Mitten pack in existence was paid for with destroyed Bernventures cards, which is why both sets are thinner on the ground than their sale numbers imply.',
    reception:
      'One of the most talked-about mechanics of the whole WAX GPK run. Collectors enjoyed the tension of deciding what to burn, and the Golden Mittens became an instant status symbol.',
    notes: [
      'Contents: base Mitten cards, a chance at Golden Mitten cards, and rare animation cards.',
      'A genuinely deflationary event — the burned Bernventures cards are gone from the chain permanently.',
      'AtomicAssets standard.',
    ],
    sources: [GPKNEWS, ONCHAIN],
  },

  gamestonk: {
    tagline:
      'The GameStop short-squeeze set, launched at the absolute peak of the meme-stock frenzy.',
    released:
      'February 9, 2021, 6:00 PM EST, sold on AtomicHub for the equivalent of $10 in WAX per 3-card pack.',
    dropSize:
      '5,000 packs. The set is 12 cards — 4 pieces carried over from the physical online GameStonk set plus 2 brand-new pieces, all with a/b versions. New art by Lars Kommienezuspadt, coloured by Adam Mathison-Sward.',
    sellOut:
      'Sold out in 17 minutes — the fastest sell-out of any digital GPK release.',
    reception:
      'Frantic. The topical tie-in plus the tiny 5,000-pack run made it the hottest ticket of Topps\' 2021 digital run, and plenty of collectors missed out entirely.',
    notes: [
      'First GPK digital set with pre-minted cards — everyone had an equal shot at a low mint number regardless of when they opened.',
      'No burn mechanic for this one, unlike Bernventures.',
      'Rarities: Base (B Common / A Uncommon), Prismatic (B Rare / A Epic), Sketch (B Rare / A Epic), Raw (Epic), Gold (Legendary) and Signature (Legendary, only on the two new pieces).',
      'No numeric pull rates were ever published.',
    ],
    sources: [GPKNEWS, ONCHAIN],
  },

  foodfightb: {
    tagline:
      'The first GPK set that bridged physical and digital — a scratch-off code inside real 2021 Series 1 boxes redeemed for a WAX pack.',
    released:
      'February 23–24, 2021 via redemption at play.toppsapps.com, followed immediately by the virtual Topps Digital WinterCon on February 25–28, 2021.',
    dropSize:
      '11 all-new pieces of art by Nik Castaneda. Redemption packs held 3 "a" cards; the first 10,000 redemption packs were pre-minted, with anything beyond that minted on demand. WinterCon sold 3-card "b" name packs at $9.99, 2,500 packs per day across four days — all four days sold out.',
    sellOut:
      'Redemption supply was tied to physical box sales rather than a fixed run. The WinterCon daily packs, capped at 2,500 each, sold out for all four days of the convention.',
    reception:
      'Seen as a genuine step forward — Topps finally gave physical collectors a low-friction on-ramp to the blockchain, including account creation at the redemption site. The two-part split ("a" names from redemptions, "b" names only from WinterCon) was the sticking point: completing the set meant taking part in both.',
    notes: [
      'Redemption cards appeared one per Blaster, Retail Display and Collector Box, and roughly 1:4 in Fat Packs.',
      'Redemption card artwork was by Nik Castaneda, who also drew for the digital OS 2 set.',
      'Five rarities: Base, Prism, Sketch, Artist Autograph and Golden.',
      'WinterCon odds: 59.83% Base, 26.58% Prism, 11.67% Sketch, 1.83% Artist Signature, 0.08% Golden.',
      'The digital checklist is completely different art from the physical Food Fight cards.',
    ],
    sources: [GPKNEWS, GEEPEEKAY, ONCHAIN],
  },

  bonus: {
    tagline:
      'Not a release of its own — a catch-all for bonus cards handed out around the main WAX drops.',
    released:
      'Various dates across 2020–2021, alongside the sets they belong to.',
    dropSize:
      'Varies per card. Bonus cards were typically small, one-off mints rather than pack contents.',
    sellOut:
      'Never sold as packs — these were given out, awarded, or attached to other purchases.',
    reception:
      'Treated as collectables in their own right: because they never had a pack print run, supply is usually very small and hard to pin down.',
    notes: [
      'Grouped here so they stay browsable rather than being buried inside the parent series.',
      'Check the individual card details for its mint number and issuing set.',
    ],
    sources: [ONCHAIN, GEEPEEKAY],
  },

  promo: {
    tagline:
      'Promotional cards used to market the digital sets — giveaways, event drops and partnership cards.',
    released: 'Various dates across the WAX GPK run.',
    dropSize:
      'Small and inconsistent by design. Promos were minted to fit whatever campaign they supported.',
    sellOut:
      'Not sold in packs. Most were distributed free, through giveaways, Telegram events or launch promotions.',
    reception:
      'Popular with completists precisely because they were never for sale — several promos are far rarer than any pack-pulled chase card.',
    notes: [
      'Availability was usually announced only in the Telegram trading group or on Topps social channels.',
      'Mint counts are best read straight off the chain rather than from any published figure.',
    ],
    sources: [ONCHAIN, GEEPEEKAY],
  },

  originalart: {
    tagline:
      'One-of-one original artwork cards — the top of the digital GPK food chain.',
    released: 'Issued alongside the main WAX sets, chiefly around Series 2.',
    dropSize:
      'Extremely limited; many are literally 1/1. These represent the original art behind the printed cards rather than a parallel of them.',
    sellOut:
      'Never available in a normal pack sale at scale — they surfaced as ultra-rare pulls and event pieces, and trade almost entirely on the secondary market.',
    reception:
      'The most sought-after digital GPK material there is. Pulling one was a headline event in the trading groups.',
    notes: [
      'Because supply is measured in single digits, price history is thin and driven by individual sales.',
      'Grouped separately here so they do not disappear inside a series filter.',
    ],
    sources: [ONCHAIN, GEEPEEKAY],
  },
};

export function getCollectionHistory(key: string | undefined): CollectionHistory | undefined {
  return key ? COLLECTION_HISTORY[key] : undefined;
}
