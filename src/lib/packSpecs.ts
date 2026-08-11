// Original Topps shop spec sheets for GPK packs (topps.wdny.io FAQ + /shop),
// plus researched details for the Exotic and AtomicAssets packs
// (GPKNews.com launch articles, geepeekay.com WAX timeline, on-chain templates).
// Used for the hover info popup on pack tiles.

export interface PackSpec {
  packType: string;
  /** Original sale price, when one was ever published. */
  price?: string;
  series: string;
  releaseDate: string;
  contains: string;
  /** Total packs minted / made available. */
  printRun?: string;
  /** How the pack was obtained, when it wasn't a plain storefront sale. */
  note?: string;
  includes: string[];
}

const FOOD_FIGHT_TYPES = [
  'Base Cards',
  'Prism Cards',
  'Sketch Cards',
  'Artist Autograph Cards',
  'Golden Cards',
];

const WINTERCON_ODDS = [
  '59.83% chance at a Base Card',
  '26.58% chance at a Prism Card',
  '11.67% chance at a Sketch Card',
  '1.83% chance at an Artist Signature Card',
  '0.08% chance at a Golden Card',
];

function winterConDay(day: number, date: string): PackSpec {
  return {
    packType: `WinterCon Day ${day} Pack`,
    price: '$9.99 USD',
    series: 'Food Fight! — WinterCon 2021 Exclusive',
    releaseDate: date,
    contains: '3 Cards',
    printRun: '2,500 packs (sold out)',
    note: 'WinterCon 2021 exclusive; 3 "b" cards from the Food Fight! digital set',
    includes: WINTERCON_ODDS,
  };
}


export const PACK_SPECS: Record<string, PackSpec> = {
  GPKFIVE: {
    packType: 'Standard Pack',
    price: '$4.99',
    series: 'Series 1',
    releaseDate: 'May 12, 2020',
    contains: '5 Cards',
    includes: [
      '1 "B" Name Prism',
      '50% chance at an "A" Name Prism',
      '10% chance at a "B" Name Sketch',
      '5% chance at an "A" Name Sketch',
      '0.2% chance at a Chase card',
    ],
  },
  GPKMEGA: {
    packType: 'Mega Pack',
    price: '$24.99',
    series: 'Series 1',
    releaseDate: 'May 12, 2020',
    contains: '30 Cards',
    includes: [
      '5 "B" Name Prism Cards',
      '3 "A" Name Prism Cards',
      '1 "B" Name Sketch Card',
      '50% chance at an "A" Name Sketch Card',
      '1% chance at a Chase card',
    ],
  },
  GPKTWOA: {
    packType: 'Standard Pack',
    price: '$9.99',
    series: 'Series 2',
    releaseDate: 'Sept 30, 2020',
    contains: '8 Cards',
    includes: [
      '4 Slime Cards',
      '1 Raw Card',
      '50% chance at a Returning Card',
      '30% chance at a Sketch Card',
      "1% chance at a Collector's Edition",
    ],
  },
  GPKTWOB: {
    packType: 'Mega Pack',
    price: '$24.99',
    series: 'Series 2',
    releaseDate: 'Sept 30, 2020',
    contains: '25 Cards',
    includes: [
      '4 Gum Cards',
      '3 Raw Cards',
      '2 Returning Cards',
      '1 Returning "A" Name Card',
      '1 Sketch Card',
      "4% chance at a Collector's Edition",
    ],
  },
  GPKTWOC: {
    packType: 'Ultimate Pack',
    price: '$49.99',
    series: 'Series 2',
    releaseDate: 'Sept 30, 2020',
    contains: '55 Cards',
    includes: [
      '8 Raw Cards',
      '7 Returning Cards',
      '3 Sketch Cards',
      '2 VHS Cards',
      "10% chance at a Collector's Edition",
    ],
  },

  // --- Exotic (SimpleAssets) ---
  EXOFIVE: {
    packType: 'Standard Pack',
    price: '$4.99',
    series: 'GPK Goes Exotic',
    releaseDate: 'July 14, 2020',
    contains: '5 Cards',
    printRun: '13,000 packs',
    includes: [
      '~0.6 "B" Name Prism per pack',
      '~0.4 "A" Name Prism per pack',
      '10% chance at a Tiger Stripe',
      '1% chance at a Tiger Claw',
      "1% chance at a Collector's Edition",
    ],
  },
  EXOMEGA: {
    packType: 'Mega Pack',
    price: '$19.99',
    series: 'GPK Goes Exotic',
    releaseDate: 'July 14, 2020',
    contains: '25 Cards',
    printRun: '7,000 packs',
    includes: [
      '4 "B" Name Prism Cards',
      '3 "A" Name Prism Cards',
      '50% chance at a Tiger Stripe',
      '5% chance at a Tiger Claw',
      "5% chance at a Collector's Edition",
    ],
  },

  // --- AtomicAssets packs (keyed by template id) ---
  '13778': {
    packType: 'Crash Gordon Pack',
    series: 'Crash Gordon',
    releaseDate: 'August 28, 2020',
    contains: '5 Cards',
    printRun: '5,000 packs',
    note: 'No original sale price was ever published',
    includes: ['5 digital cards from the Crash Gordon series'],
  },
  '48479': {
    packType: 'Bernventures Pack',
    price: '$5 in WAX',
    series: 'Bernventures',
    releaseDate: 'January 26, 2021',
    contains: '2 Cards',
    printRun: '8,976 packs',
    includes: [
      'Base "a" and Base "b" Cards',
      '10.5% chance at an Artist Sketch',
      '3% chance at an Artist Raw',
      '0.5% chance at an Artist Signature',
    ],
  },
  '51437': {
    packType: 'Mitten Pack',
    series: 'Bern 4 Golden Mittens Event',
    releaseDate: 'February 4, 2021',
    contains: '5 Cards',
    note: 'Not sold — earned by burning 5 points of Bernventures cards',
    includes: [
      'Base Mitten Cards',
      'Chance at Golden Mitten Cards',
      'Chance at rare Animation Cards',
    ],
  },
  '53187': {
    packType: 'GameStonk! Pack',
    price: '$10 in WAX',
    series: 'GameStonk!',
    releaseDate: 'February 9, 2021',
    contains: '3 Cards',
    printRun: '5,000 packs (sold out in 17 minutes)',
    note: 'No numeric pull rates were ever published',
    includes: [
      'Base — "B" Common / "A" Uncommon',
      'Prismatic — "B" Rare / "A" Epic',
      'Sketch — "B" Rare / "A" Epic',
      'Raw — Epic',
      'Gold — Legendary',
      'Signature — Legendary',
    ],
  },
  '59072': {
    packType: 'Food Fight! Pack',
    series: 'Food Fight! Series 1',
    releaseDate: 'February 23, 2021',
    contains: '3 Cards',
    note: 'Free via redemption code from physical 2021 Series 1 boxes',
    includes: ['3 "a" cards from the 11-piece digital set', ...FOOD_FIGHT_TYPES],
  },
  '59489': winterConDay(1, 'February 25, 2021'),
  '59490': winterConDay(2, 'February 26, 2021'),
  '59491': winterConDay(3, 'February 27, 2021'),
  '59492': winterConDay(4, 'February 28, 2021'),
};

export function getPackSpec(key: string | undefined): PackSpec | undefined {
  return key ? PACK_SPECS[key] : undefined;
}
