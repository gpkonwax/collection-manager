import { getIpfsUrl } from '@/lib/ipfsGateways';

const SERIES_HASH: Record<string, string> = {
  five: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
  gpktwoeight: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo25: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo55: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
};

const GIF_VARIANTS = new Set(['prism', 'sketch', 'slime', 'raw']);

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
