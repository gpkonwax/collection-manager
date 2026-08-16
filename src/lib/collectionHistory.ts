// Researched history write-ups for each GPK digital collection on WAX.
// Sources: GPKNews.com launch coverage, the Topps WAX shop/FAQ pages,
// the geepeekay.com digital release timeline, and on-chain print-run data
// already captured in src/lib/packSpecs.ts.
// Figures are best-effort community records — card totals in particular are
// estimates, because cards were minted on pack-open rather than up front.

import bonyJoanieMega from '@/assets/gpk-mega-bony-joanie.png';
import promoSeries2Banner from '@/assets/promo-37.png.asset.json';
import promoFoodFight1 from '@/assets/promo-38.png.asset.json';
import promoFoodFight2 from '@/assets/promo-39.png.asset.json';
import promoGameStonk from '@/assets/promo-40.png.asset.json';
import promoBernventures from '@/assets/promo-41.png.asset.json';
import promoSeries2Soon from '@/assets/promo-42.png.asset.json';
import promoExoticNow from '@/assets/promo-43.png.asset.json';
import promoExoticJettin from '@/assets/promo-44.png.asset.json';
import promoExoticSoon from '@/assets/promo-45.png.asset.json';
import promoSeries1Now from '@/assets/promo-46.png.asset.json';
import promoSeries1Poster from '@/assets/promo-47.png.asset.json';
import promoSeries1Banner from '@/assets/promo-48.png.asset.json';
import promoSeries2Phone from '@/assets/promo-49.png.asset.json';
import promoDigicon from '@/assets/promo-51.png.asset.json';




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
  /** Poster frame shown before the player loads. */
  thumbnailUrl?: string;
  /** Where the video was found, shown as a source link. */
  sourceLabel: string;
  sourceUrl: string;
  /** Short note explaining why the clip matters. */
  note?: string;
}

export interface CollectionHistoryLink {
  /** Short human-readable title of the page. */
  label: string;
  /** Absolute URL. */
  url: string;
  /** Official = Topps/WAX-owned or an official press release. Coverage = hobby/news press. */
  kind: 'official' | 'coverage';
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
  /** WAX/Topps-specific pages for this collection, shown at the bottom of the story. */
  links?: CollectionHistoryLink[];
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
      'Estimated per-card counts published at the time: Base around 908 of each card (74,460 across 82 cards), Prism "b" 487 and Prism "a" 268, Sketch "b" 73 and Sketch "a" 36, and Collector\'s Edition just 5 of each — only 8 names, 40 cards in total.',
      '100 special Gold cards were randomly awarded to buyers, and there were no purchase limits on the sale.',
      'Launch day had odd random errors on the site, and there was no built-in marketplace yet — early trading happened on third-party markets, which had over 4,000 cards listed in the first week.',
      'Early secondary prices: Mega packs reselling for $100+, rare sketches around $600 and prisms $100+.',
      'Because minting happened on pack-open, the earliest openers effectively raced for the low mint numbers — a mechanic Topps later dropped.',
      'This set set the template every later WAX GPK drop followed: a storefront sale, pack odds published up front, and cards living on the SimpleAssets standard.',
      'An alternate Mega Pack wrapper turns up in the original Topps launch promo video: it shows Bony Joanie on the front and reads "25 DIGITAL CARDS • NO GUM" instead of the 30 the Mega Pack actually shipped with. In the same clip, the shop panel beside it lists the Mega Pack as 30 cards. No official explanation was ever published, and this wrapper never appeared in the store; the shipped Mega art and every GPKNews/Topps listing say 30 cards for $24.99.',
    ],
    images: [
      {
        src: bonyJoanieMega,
        caption:
          'The alternate Series 1 Mega Pack wrapper as it appears in the Topps launch promo video (around 0:26) — Bony Joanie on the front, "25 DIGITAL CARDS • NO GUM". The shipped Mega Pack used different art and 30 cards.',
      },
      {
        src: promoSeries1Now.url,
        caption: 'Topps x WAX "Available Now!" promotional art for Series 1.',
      },
      {
        src: promoSeries1Poster.url,
        caption: '"Packs Available Now!" poster for toppsgpk.io, showing the four Series 1 rarities: Base, Prism, Sketch and Collector\'s Edition.',
      },
      {
        src: promoSeries1Banner.url,
        caption: '"Topps cards to the Blockchain!" launch banner for the Topps x WAX partnership.',
      },
    ],
    video: {
      title: 'Topps Garbage Pail Kids NFTs are now available on the WAX Blockchain!',
      embedUrl: 'https://www.youtube.com/embed/7qXtHSYdm5s?start=20&rel=0&playsinline=1',
      thumbnailUrl: 'https://i.ytimg.com/vi/7qXtHSYdm5s/hqdefault.jpg',
      watchUrl: 'https://www.youtube.com/watch?v=7qXtHSYdm5s',
      sourceLabel: 'topps.wdny.io/faq',
      sourceUrl: 'https://topps.wdny.io/faq',
      note: 'The alternate Bony Joanie Mega wrapper is on screen around 0:26. Found embedded on the original Topps GPK FAQ page.',
    },
    links: [
      { label: 'WAX.io launch announcement', url: 'https://medium.com/wax-io/new-topps-garbage-pail-kids-nfts-are-now-available-on-wax-2de012783c60', kind: 'official' },
      { label: 'Topps GPK FAQ page', url: 'https://topps.wdny.io/faq', kind: 'official' },
      { label: 'Packs sell out, secondary market flourishes', url: 'https://gpknews.com/wax-x-topps-packs-sell-out-secondary-market-flourishes/', kind: 'coverage' },
      { label: 'Topps enters crypto collectibles', url: 'https://decrypt.co/28547/trading-card-giant-topps-is-now-offering-crypto-collectibles', kind: 'coverage' },
    ],
    sources: [GPKNEWS, TOPPS_SHOP, GEEPEEKAY],


  },

  exotic: {
    tagline:
      'GPK Goes Exotic — the Tiger King parody set, riding the biggest streaming phenomenon of 2020.',
    released:
      'July 14, 2020, 12:00 PM EST at toppsgpk.io. Standard packs $4.99 (5 cards), Mega packs $19.99 (25 cards), credit/debit only. It was originally scheduled for July 8 at 12:00 PM EST, but WAX announced a delay on Twitter with no reason given; it was later put down to a technical problem with a third-party shopping-cart provider, with a promise of 24 hours\' notice before the new date.',
    dropSize:
      '13,000 Standard and 7,000 Mega packs — around 240,000 cards, more than double the Series 1 run. 30 pieces of art (15 subjects with a/b versions), all drawn by GPK artist David Gross, carried over from the three online physical Exotic sets released earlier that year.',
    sellOut:
      'Gone in just over an hour. All 7,000 Mega packs sold in 24 minutes through an early-access window opened at 11:30 EST for Telegram trading-group members with a password, and all 13,000 Standard packs were gone by 12:37 EST.',
    reception:
      'Warmly received, but the checkout was a mess: credit and debit cards were declined en masse, payments took up to 30 minutes to process, and the backlog caused oversells so some orders were cancelled and refunded after the fact — which means the true sell-out was probably earlier than the 1:07 PM figure shown at the time. The Tiger King tie-in still pulled in buyers from well outside the usual GPK crowd.',
    notes: [
      'Parallels: Prism, Tiger Stripe and Tiger Claw versions of all 30 cards.',
      'Six rare Collector Edition cards were randomly seeded through packs.',
      'Estimated per-card counts: Prism "b" 2,386 each, Prism "a" 1,746 each, Tiger Stripe 160 each, Tiger Claw 16 each and Collector Edition 80 each.',
      'A burn event was announced that would let collectors burn Tiger King base "a" cards for rare sketch cards. It was pushed back to Q1 2021 alongside a new website and never ran.',
      'Print-run figures were published as estimates because cards minted on pack-open — everyone from the first pack to the last had the same odds.',
    ],
    images: [
      {
        src: promoExoticNow.url,
        caption: 'GPK Goes Exotic "Available Now!" promotional art.',
      },
      {
        src: promoExoticSoon.url,
        caption: 'The "Coming Soon!" teaser banner released ahead of the Exotic drop.',
      },
      {
        src: promoExoticJettin.url,
        caption: 'Jettin\' James single-card promotional art from the Exotic campaign.',
      },
    ],
    links: [
      { label: 'Press release: sold out in 67 minutes', url: 'https://www.globenewswire.com/news-release/2020/07/16/2062972/0/en/Topps-GPK-Goes-Exotic-Digital-Trading-Cards-Makes-Blockchain-History-on-WAX-Selling-Out-in-67-Minutes.html', kind: 'official' },
      { label: 'WAX.io announcement', url: 'https://medium.com/wax-io/topps-gpk-goes-exotic-trading-cards-are-now-on-the-wax-blockchain-e77f1356c627', kind: 'official' },
      { label: 'Launch coverage', url: 'https://gpknews.com/topps-x-wax-launch-gpk-goes-exotic-digital-set/', kind: 'coverage' },
      { label: 'Sell-out coverage', url: 'https://gpknews.com/topps-x-wax-gpk-goes-exotic-sells-out/', kind: 'coverage' },
    ],
    sources: [GPKNEWS, TOPPS_SHOP, GEEPEEKAY],
  },

  crashgordon: {
    tagline:
      'A small, strange Flash Gordon parody set that started life as a 7-day online-only physical release.',
    released:
      'August 2020 on WAX — a surprise launch announced live during the Topps DigiCon Twitch broadcast. 500 packs were given away free at 1:00 PM EST (one per account), then 3,000 packs went on sale at 3:00 PM EST on Atomic Hub for 220 WAX each (about $10), WAX-only, with another 1,500 released later. The physical version had been sold on Topps.com as a 7-day timed set ($19.99 a set, $179.99 for ten) with the print run only revealed after the sale closed.',
    dropSize:
      '5,000 packs of 5 cards — 25,000 cards in total. The set is 10 cards — 5 subjects with a/b versions — celebrating the 40th anniversary of Flash Gordon.',
    sellOut:
      'Very fast for a surprise drop: the first batch of 3,000 packs sold out in 3 minutes 18 seconds, and the follow-up batch of 1,200 went in 31 seconds.',
    reception:
      'A quiet, surprise-style launch rather than a headline event. Collectors treated it as a curiosity at first; the tiny checklist and small pack count have made it steadily harder to complete over time.',
    notes: [
      'Checklist: Crash Gordon, Flying Flash, Flush Gordon, Dethroned Ming, Merciless Ming, Noah Mercy, Revolting Vultan, Hawkman Hank, Doctoring Zarkov, Handy Hans.',
      'Only three card types — Base, Prism and Gold. Published pack odds: 50% "B" Name Base, 25% "A" Name Prism, 10% "B" Name Prism, 1% "A" Name Gold, 0.5% "B" Name Gold.',
      'The pack wrapper read "5 DIGITAL CARDS • NO GUM", and the store listing announced the packs would unlock at 3pm EST / 9pm CEST — no pack, including the 500 free ones, could be opened before then.',
      'First WAX GPK drop sold on Atomic Hub rather than a Topps storefront, and the first payable only in WAX (220 WAX a pack, roughly $10) — collectors had to top up their WAX wallet to buy in.',
      'Only 3,000 of the 5,000 packs went on sale at launch; the remaining 1,500 were scheduled to be minted later with no announced date.',
      'One of the first GPK sets to appear on the AtomicAssets standard rather than SimpleAssets.',
    ],
    images: [
      {
        src: promoDigicon.url,
        caption: 'Topps Digital DigiCon 2020 logo — Crash Gordon was announced live during the DigiCon Twitch broadcast.',
      },
    ],
    links: [

      { label: 'Topps announces Crash Gordon digital set', url: 'https://gpknews.com/topps-announces-wax-x-garbage-pail-kids-crash-gordon-digital-set/', kind: 'coverage' },
      { label: '40th anniversary checklist & details', url: 'https://www.beckett.com/news/2020-topps-garbage-pail-kids-crash-gordon-40th-anniversary-checklist-and-details/', kind: 'coverage' },
      { label: 'WAX archive on GPKNews', url: 'https://gpknews.com/category/wax/page/2/', kind: 'coverage' },
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
      'The release is an 84-card base set plus Chrome OS 2 "Returning Cards" (26) and Chrome "c" name variations (20). Parallels: Raw, Slime, Gum, VHS and Sketch, alongside new Animation and Relic cards and original-art pieces.',
      'New artists came on board — Nik Castaneda, Chenduz and Brent Scotchmer — with some cards animated and carrying digital autographs.',
      'Estimated per-card counts: Base a/b/c 2,454 each (104 cards), Returning "a" 2,211 and "b" 1,826, Raw 1,428, Slime 238, Gum 238, VHS 119, Sketch 255 and Collector\'s Edition 31 each across 24 cards.',
      'Topps slipped in unannounced "error" cards, including a badly miscut Spilt Kit and a censored, black-barred Schizo Fran.',
      'Ahead of launch, Tobin Lent said Topps had "tucked some surprises into the set" and revealed he had asked original GPK artist John Pound to do digital autographs — Pound declined, staying retired.',
      'Returning cards brought subjects back from earlier sets; Collector\'s Edition odds scaled with pack size (1% / 4% / 10%).',
      'A follow-up Burn 4 Gold event ran December 4–9, 2020: burning OS 2 base cards and opening packs put collectors in line for 80 OS 2 Gold cards across four tiers (40 / 25 / 10 / 5 golds, needing 5 / 10 / 30 / 100 cards burned).',
    ],
    images: [
      {
        src: promoSeries2Banner.url,
        caption: 'Topps x WAX Series 2 promotional banner.',
      },
      {
        src: promoSeries2Soon.url,
        caption: 'The "Coming Soon!" teaser banner released ahead of the Series 2 drop.',
      },
      {
        src: promoSeries2Phone.url,
        caption: 'Topps app promo showing Leaky Lindsay 45a with the Trade and Sell buttons.',
      },
    ],
    links: [
      { label: 'Initial details on the OS2 digital release', url: 'https://gpknews.com/initial-details-on-gpk-x-wax-os-2-digital-release/', kind: 'coverage' },
      { label: 'New art a highlight in the OS 2 set', url: 'https://gpknews.com/new-art-a-highlight-in-upcoming-garbage-pail-kids-x-wax-os-2-digital-set/', kind: 'coverage' },
      { label: 'Launch coverage', url: 'https://gpknews.com/topps-launches-garbage-pail-kids-x-wax-os-2-digital-set/', kind: 'coverage' },
      { label: 'Burn for Gold event announced', url: 'https://gpknews.com/topps-announces-burn-for-gold-wax-digital-event/', kind: 'coverage' },
      { label: 'Topps readies Burn4Gold', url: 'https://gpknews.com/topps-readies-burn4gold-digital-garbage-pail-kids-wax-event/', kind: 'coverage' },
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
    images: [
      {
        src: promoBernventures.url,
        caption: 'Bernventures promotional art from gpkbernventures.com.',
      },
    ],
    links: [
      { label: 'gpkbernventures.com — the original sale site', url: 'https://gpkbernventures.com/', kind: 'official' },
      { label: 'Launch coverage', url: 'https://gpknews.com/topps-digital-launches-garbage-pail-kids-bernventures-digital-wax-set/', kind: 'coverage' },
      { label: 'Bernie mitten memes become NFTs', url: 'https://cointelegraph.com/news/bernie-sanders-mitten-memes-immortalized-in-new-nft-collection', kind: 'coverage' },
      { label: 'The art behind Bernventures', url: 'https://ecency.com/@kommienezuspadt/bernie-as-a-garbage-pail-kid-the-art-behind-bernventures', kind: 'coverage' },
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
    images: [
      {
        src: promoGameStonk.url,
        caption: 'GameStonk! promotional banner from the February 2021 AtomicHub drop.',
      },
    ],
    links: [
      { label: 'Topps drop page on AtomicHub', url: 'https://topps.atomichub.io/drops/gpk.topps', kind: 'official' },
      { label: 'Launch coverage', url: 'https://gpknews.com/topps-digital-launching-garbage-pail-kids-gamestonk-on-wax/', kind: 'coverage' },
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
      'Redemption supply was tied to physical box sales rather than a fixed run. The WinterCon daily packs, capped at 2,500 each, sold out for all four days of the convention — the first day\'s allocation went in about 17 minutes.',
    reception:
      'Seen as a genuine step forward — Topps finally gave physical collectors a low-friction on-ramp to the blockchain, including account creation at the redemption site. The two-part split ("a" names from redemptions, "b" names only from WinterCon) was the sticking point: completing the set meant taking part in both.',
    notes: [
      'Redemption cards appeared one per Blaster, Retail Display and Collector Box, and roughly 1:4 in Fat Packs.',
      'Redemption card artwork was by Nik Castaneda, who also drew for the digital OS 2 set.',
      'Five rarities: Base, Prism, Sketch, Artist Autograph and Golden.',
      'WinterCon odds: 59.83% Base, 26.58% Prism, 11.67% Sketch, 1.83% Artist Signature, 0.08% Golden.',
      'The digital checklist is completely different art from the physical Food Fight cards.',
    ],
    images: [
      {
        src: promoFoodFight1.url,
        caption: 'Topps Digital "Available February 24th!" promo art for GPK Food Fight.',
      },
      {
        src: promoFoodFight2.url,
        caption: 'A second Food Fight promotional frame showing Bobby Wasabi and friends.',
      },
    ],
    links: [
      { label: 'Official site: toppsgpk.io', url: 'https://toppsgpk.io/', kind: 'official' },
      { label: 'Press release: coming to Walmart and Target', url: 'https://www.globenewswire.com/news-release/2021/02/22/2179668/0/en/Coming-to-Walmart-and-Target-WAX-Digital-Cards-from-Topps.html', kind: 'official' },
      { label: 'Retail launch coverage', url: 'https://news.bitcoin.com/topps-garbage-pail-kids-blockchain-collectibles-can-be-bought-at-target-and-walmarts/', kind: 'coverage' },
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
