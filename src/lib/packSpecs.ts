// Original Topps shop spec sheets for GPK packs (topps.wdny.io FAQ + /shop).
// Used for the hover info popup on pack tiles.

export interface PackSpec {
  packType: string;
  price: string;
  series: string;
  releaseDate: string;
  contains: string;
  includes: string[];
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
};

export function getPackSpec(key: string | undefined): PackSpec | undefined {
  return key ? PACK_SPECS[key] : undefined;
}
