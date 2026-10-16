import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { compareByOriginalMint } from '@/lib/cardGridSort';

/**
 * Stacks in the Saved Collection layout.
 *
 * A saved-layout slot normally holds one asset ID. A stacked slot holds the
 * duplicate copies of one card joined with a comma (asset IDs are numeric, so
 * the separator is safe). Everything downstream — localStorage persistence,
 * JSON export/import and the shared layout files — stores these slot strings
 * as-is, so stacks survive round-trips without a format change.
 */

export const STACK_SEPARATOR = ',';

/** Split a slot string into its asset IDs. EMPTY slots are handled by the caller. */
export function parseSlotIds(slot: string): string[] {
  if (!slot) return [];
  return slot.split(STACK_SEPARATOR);
}

/** Encode a stack (or single-card) slot from its asset IDs. */
export function encodeStackSlot(ids: string[]): string {
  return ids.join(STACK_SEPARATOR);
}

/** Only existing orthogonally adjacent empty slots qualify; never wrap rows. */
export function findUnstackDestination(order: readonly string[], index: number, columns: number, empty = '__empty__'): number | null {
  if (!Number.isInteger(columns) || columns < 1 || index < 0 || index >= order.length) return null;
  const column = index % columns;
  const neighbours = [column < columns - 1 ? index + 1 : -1, column > 0 ? index - 1 : -1, index + columns, index - columns];
  return neighbours.find(i => i >= 0 && i < order.length && order[i] === empty) ?? null;
}

/** Move exactly one selected copy without changing the order of the rest. */
export function unstackSavedSlot(order: readonly string[], index: number, columns: number, assetId: string, empty = '__empty__'): string[] | null {
  const destination = findUnstackDestination(order, index, columns, empty);
  if (destination === null) return null;
  const ids = parseSlotIds(order[index]);
  if (ids.length < 2 || !ids.includes(assetId)) return null;
  const next = [...order];
  next[index] = encodeStackSlot(ids.filter(id => id !== assetId));
  next[destination] = assetId;
  return next;
}

function cardIdentity(a: SimpleAsset): string {
  return `${a.cardid.toLowerCase()}|${(a.side || '').toLowerCase()}|${a.quality.toLowerCase()}`;
}

/** The SimpleAssets original an AtomicAssets bridged copy links back to, if any. */
function bridgedOriginalId(a: SimpleAsset): string {
  return String((a.idata as Record<string, unknown> | undefined)?.sassets_id ?? '');
}

/**
 * True when two cards are duplicates of each other: same card number, side and
 * variant — either on the same contract, or across contracts when one is the
 * bridged copy of the other (matched by the sassets_id link, never by name).
 */
export function areDuplicateCards(a: SimpleAsset, b: SimpleAsset): boolean {
  if (cardIdentity(a) !== cardIdentity(b)) return false;
  if (a.category.toLowerCase() === b.category.toLowerCase()) return true;

  // Bridged twins: the AA copy's sassets_id points at its SA original's asset ID.
  const saA = bridgedOriginalId(a);
  const saB = bridgedOriginalId(b);
  if (saA && saA === saB) return true;
  if (saA && saA === String(b.id)) return true;
  if (saB && saB === String(a.id)) return true;
  return false;
}

/**
 * Merge two stack slots into one, deduplicated and ordered by original mint
 * (unresolved mints last), so a stack's top card always leads with its lowest
 * mint — the same rule the binder stack uses.
 */
export function mergeStackIds(
  target: string[],
  incoming: string[],
  resolve: (id: string) => SimpleAsset | undefined
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...target, ...incoming]) {
    if (!seen.has(id)) { seen.add(id); merged.push(id); }
  }
  return merged.sort((x, y) => {
    const ax = resolve(x);
    const ay = resolve(y);
    if (ax && ay) return compareByOriginalMint(ax, ay);
    if (ax) return -1;
    if (ay) return 1;
    return 0;
  });
}
