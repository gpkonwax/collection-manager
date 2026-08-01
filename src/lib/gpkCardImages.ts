import { getIpfsUrl } from '@/lib/ipfsGateways';

const SERIES_HASH: Record<string, string> = {
  five: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
  thirty: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
  gpktwoeight: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo25: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo55: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  exotic5: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
  exotic25: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
};

export function getGpkCategoryForBoxtype(boxtype: string): string | null {
  if (boxtype === 'five' || boxtype === 'thirty') return 'series1';
  if (boxtype.startsWith('gpktwo')) return 'series2';
  if (boxtype.startsWith('exotic')) return 'exotic';
  return null;
}

/** Cards contained in each pack symbol (verified against on-chain unboxings). */
export const EXPECTED_CARDS: Record<string, number> = {
  GPKFIVE: 5, GPKMEGA: 30, GPKTWOA: 8, GPKTWOB: 25, GPKTWOC: 55,
  EXOFIVE: 5, EXOMEGA: 25,
};



const GIF_VARIANTS = new Set([
  'prism', 'sketch', 'slime', 'gum', 'vhs', 'collector', 'returning',
  'tiger stripe', 'tiger claw', 'tigerscratch', 'tigerborder', 'originalart', 'relic',
]);

/** Variants whose artwork has no a/b side suffix in the path (single image per card). */
const SIDELESS_VARIANTS = new Set(['raw']);

/** Variants that share one generic back image (`<variant>/back.jpg`). */
const SHARED_BACK_VARIANTS = new Set(['raw', 'returning']);

const PLUS_ONE_PENDING_BOXES = new Set(['five', 'thirty', 'exotic5', 'exotic25']);

/**
 * Series 2 "c" side (third artwork) cards, in pending-row index order.
 * Verified on-chain: a pending row with quality `c` and cardid N mints the
 * asset whose cardid is SERIES2_C_CARD_IDS[N].
 */
export const SERIES2_C_CARD_IDS = [
  44, 45, 48, 50, 51, 52, 55, 56, 57, 58,
  59, 60, 63, 64, 65, 66, 69, 70, 71, 73,
];

export function normalizePendingGpkCardId(
  boxtype: string,
  cardid: number | string,
  quality?: string,
  variant?: string,
): string {
  const raw = String(cardid).trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return raw;
  if (PLUS_ONE_PENDING_BOXES.has(boxtype)) {
    return String(parsed + 1);
  }
  if (boxtype.startsWith('gpktwo')) {
    const v = String(variant ?? '').trim().toLowerCase();
    const q = String(quality ?? '').trim().toLowerCase();
    // Series 2 "returning" cards mint as R1..R13 (pending index + 1).
    if (v === 'returning') return `R${parsed + 1}`;
    // Series 2 "c" side cards use their own 20-card lookup table.
    if (q === 'c') return String(SERIES2_C_CARD_IDS[parsed] ?? parsed + 42);
    return String(parsed + 42);
  }
  return raw;
}

/** The `quality`/side value the minted asset carries for a pending row. */
export function normalizePendingGpkSide(variant: string, quality: string): string {
  const v = String(variant ?? '').trim().toLowerCase();
  if (SIDELESS_VARIANTS.has(v)) return '';
  return String(quality ?? '').trim().toLowerCase();
}

export type ResolvedPendingCard = {
  /** Card id as minted on-chain (e.g. "54", "R6"). */
  cardid: string;
  /** Side as minted on-chain ("a" | "b" | "c" | ""). */
  side: string;
  /** Raw chain variant, lowercased (used for image paths). */
  variant: string;
  /** Resolved artwork URL, or null when the box type is unknown. */
  image: string | null;
  /** Resolved card-back URL, or null when the box type is unknown. */
  back: string | null;
};

/** Single source of truth for turning a pendingnft.a row into card identity + artwork. */
export function resolvePendingGpkCard(
  boxtype: string,
  cardid: number | string,
  quality: string,
  variant: string,
): ResolvedPendingCard {
  const v = String(variant ?? '').trim().toLowerCase();
  const resolvedId = normalizePendingGpkCardId(boxtype, cardid, quality, v);
  const side = normalizePendingGpkSide(v, quality);
  return {
    cardid: resolvedId,
    side,
    variant: v,
    image: buildGpkCardImageUrl(boxtype, v, resolvedId, side),
    back: buildGpkCardBackUrl(boxtype, resolvedId, v),
  };
}

/** Path segment used for the artwork file name, e.g. "54a", "65", "6b". */
function buildImageFileStem(variant: string, cardid: number | string, quality: string): string {
  const v = String(variant ?? '').trim().toLowerCase();
  const id = String(cardid).trim();
  // "returning" cards are stored by their numeric index: R6 -> returning/6b.gif
  const stem = v === 'returning' ? id.replace(/^r/i, '') : id;
  if (SIDELESS_VARIANTS.has(v)) return stem;
  return `${stem}${String(quality ?? '').trim().toLowerCase()}`;
}

export function buildGpkCardImageUrl(
  boxtype: string,
  variant: string,
  cardid: number | string,
  quality: string,
): string | null {
  const hash = SERIES_HASH[boxtype];
  if (!hash) return null;
  const v = String(variant ?? '').trim().toLowerCase();
  const ext = GIF_VARIANTS.has(v) ? 'gif' : 'jpg';
  const file = `${buildImageFileStem(v, cardid, quality)}.${ext}`;
  return getIpfsUrl(`${hash}/${encodeURIComponent(v)}/${encodeURIComponent(file)}`);
}

export function buildGpkCardBackUrl(
  boxtype: string,
  cardid: number | string,
  variant?: string,
): string | null {
  const hash = SERIES_HASH[boxtype];
  if (!hash) return null;
  const v = String(variant ?? '').trim().toLowerCase();
  if (SHARED_BACK_VARIANTS.has(v)) {
    return getIpfsUrl(`${hash}/${encodeURIComponent(v)}/back.jpg`);
  }
  const id = String(cardid).trim().replace(/^r/i, '');
  return getIpfsUrl(`${hash}/back/${encodeURIComponent(id)}.jpg`);
}
