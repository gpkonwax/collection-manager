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

const GIF_VARIANTS = new Set(['prism', 'sketch', 'slime', 'raw', 'gum', 'vhs', 'collector', 'tiger stripe', 'tiger claw', 'originalart', 'relic']);

const SERIES1_ZERO_BASED_BOXES = new Set(['five', 'thirty']);

export function normalizePendingGpkCardId(boxtype: string, cardid: number | string): string {
  const raw = String(cardid).trim();
  const parsed = Number.parseInt(raw, 10);
  if (SERIES1_ZERO_BASED_BOXES.has(boxtype) && Number.isFinite(parsed)) {
    return String(parsed + 1);
  }
  return raw;
}

export function getGpkCategoryForBoxtype(boxtype: string): string | null {
  if (boxtype === 'five' || boxtype === 'thirty') return 'series1';
  if (boxtype.startsWith('gpktwo')) return 'series2';
  if (boxtype.startsWith('exotic')) return 'exotic';
  return null;
}

export function buildGpkCardImageUrl(
  boxtype: string,
  variant: string,
  cardid: number | string,
  quality: string,
): string | null {
  const hash = SERIES_HASH[boxtype];
  if (!hash) return null;
  const ext = GIF_VARIANTS.has(variant) ? 'gif' : 'jpg';
  return getIpfsUrl(`${hash}/${variant}/${cardid}${quality}.${ext}`);
}

export function buildGpkCardBackUrl(
  boxtype: string,
  cardid: number | string,
): string | null {
  const hash = SERIES_HASH[boxtype];
  if (!hash) return null;
  return getIpfsUrl(`${hash}/back/${cardid}.jpg`);
}
