import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { describeMintSource } from '@/lib/saMintResolver';

const BRIDGED_SCHEMAS = new Set(['series1', 'series2', 'exotic']);
const MINT_KEYS = ['edition', 'mint', 'serial', 'num', 'mint_num'];

export function isBridgedAsset(asset: SimpleAsset): boolean {
  return asset.source === 'atomicassets' && BRIDGED_SCHEMAS.has(asset.category.toLowerCase());
}

export function getMintLabel(asset: SimpleAsset): string {
  if (asset.mintNumber !== undefined && Number.isFinite(asset.mintNumber)) return `#${asset.mintNumber}`;
  if (isBridgedAsset(asset)) return '#--';
  const data = { ...asset.idata, ...asset.mdata };
  const fallback = asset.source === 'atomicassets'
    ? asset.idata.bridge_mint
    : MINT_KEYS.map((key) => data[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== '');
  const number = String(fallback ?? '').split('/')[0].replace(/^#/, '').trim();
  return /^\d+$/.test(number) ? `#${number}` : '#--';
}

export function getMintSupplyLines(asset: SimpleAsset): string[] {
  const lines: string[] = [];
  if (getMintLabel(asset) === '#--') return lines;
  if (asset.mintSurviving !== undefined) {
    if (asset.mintBurned !== undefined) {
      lines.push(`Total ever minted: ${(asset.mintSurviving + asset.mintBurned).toLocaleString()}`);
      lines.push(`In circulation: ${asset.mintSurviving.toLocaleString()}`);
      lines.push(`Burned: ${asset.mintBurned.toLocaleString()}`);
    } else {
      lines.push(`In circulation: ${asset.mintSurviving.toLocaleString()}`);
    }
  } else {
    const data = { ...asset.idata, ...asset.mdata };
    const supply = data.maxsupply ?? data.max_supply ?? data.supply;
    if (supply !== undefined && supply !== null && String(supply).trim()) {
      lines.push(`Reported supply: ${String(supply)}`);
    }
  }
  if (asset.mintSource) lines.push(describeMintSource(asset.mintSource, asset.mintBackupDate));
  return lines;
}