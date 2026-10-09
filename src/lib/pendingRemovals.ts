/**
 * Optimistic removal of assets/packs that just left the wallet (transfer,
 * burn, bridge, donation). Indexers lag several seconds behind the chain, so a
 * plain refetch can still return what was sent. These helpers hide sent IDs
 * and cap token-pack balances until the fetched data catches up.
 */

/** How long a token-pack cap may hold before we trust the fetched balance again. */
export const PACK_CAP_TTL_MS = 5 * 60 * 1000;

export interface PackCap {
  /** Highest balance we expect to see after the send. */
  expected: number;
  expiresAt: number;
}

export function hideRemoved<T extends { id: string }>(items: T[], removed: Set<string>): T[] {
  if (removed.size === 0) return items;
  return items.filter(i => !removed.has(i.id));
}

/** IDs still worth hiding: those the fetched list still contains. */
export function pruneRemoved(removed: Set<string>, fetchedIds: Iterable<string>): Set<string> {
  const still = new Set<string>();
  for (const id of fetchedIds) if (removed.has(id)) still.add(id);
  return still;
}

/** Record a token-pack send: new cap = current displayed balance minus qty. */
export function addPackCap(caps: Map<string, PackCap>, symbol: string, currentBalance: number, qty: number, now: number): Map<string, PackCap> {
  const next = new Map(caps);
  next.set(symbol, { expected: Math.max(0, currentBalance - qty), expiresAt: now + PACK_CAP_TTL_MS });
  return next;
}

export function applyPackCaps<T extends { symbol: string; amount: number }>(packs: T[], caps: Map<string, PackCap>, now: number): T[] {
  if (caps.size === 0) return packs;
  return packs.map(p => {
    const cap = caps.get(p.symbol);
    if (!cap || cap.expiresAt <= now || p.amount <= cap.expected) return p;
    return { ...p, amount: cap.expected };
  });
}

/** Caps still needed: not expired and the fetched balance hasn't dropped yet. */
export function prunePackCaps<T extends { symbol: string; amount: number }>(caps: Map<string, PackCap>, fetched: T[], now: number): Map<string, PackCap> {
  const next = new Map<string, PackCap>();
  caps.forEach((cap, sym) => {
    const p = fetched.find(x => x.symbol === sym);
    if (cap.expiresAt > now && p && p.amount > cap.expected) next.set(sym, cap);
  });
  return next;
}

/** Remove sent asset IDs from AtomicAssets pack groups, keeping mints aligned. */
export function hideRemovedAtomicPacks<T extends { assetIds: string[]; mints: number[]; count: number }>(packs: T[], removed: Set<string>): T[] {
  if (removed.size === 0) return packs;
  return packs.map(p => {
    if (!p.assetIds.some(id => removed.has(id))) return p;
    const keep = p.assetIds.map((id, i) => ({ id, m: p.mints[i] })).filter(x => !removed.has(x.id));
    return { ...p, assetIds: keep.map(x => x.id), mints: keep.map(x => x.m), count: keep.length };
  });
}
