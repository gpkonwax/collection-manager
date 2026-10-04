import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import type { PackHistoryEntry } from '@/lib/packOpenHistory';
import { getMintLabel } from '@/lib/mintPresentation';
import { resolveSaMintsForAssets } from '@/lib/saMintResolver';

/** Resolve by the original asset identity, never by card title or bridge order. */
export async function resolveReplayMintLabels(entry: PackHistoryEntry, owned: SimpleAsset[]): Promise<string[]> {
  const byId = new Map(owned.filter((asset) => asset.source === entry.source).map((asset) => [asset.id, asset]));
  const labels = entry.cards.map((card) => card.id ? getMintLabel(byId.get(String(card.id)) as SimpleAsset) : '#--');
  // A card can have left the wallet since opening; its original SA id is still
  // enough to find the saved mint number without relying on a current owner.
  const missingSa = entry.source === 'simpleassets'
    ? entry.cards.flatMap((card, i) => card.id && labels[i] === '#--' ? [{ assetId: String(i), sassetsId: String(card.id) }] : [])
    : [];
  if (missingSa.length) {
    const results = await resolveSaMintsForAssets(missingSa);
    for (const [index, info] of results) labels[Number(index)] = `#${info.mint}`;
  }
  return labels;
}