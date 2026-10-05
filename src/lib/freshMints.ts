/**
 * Freshly minted (newly collected) asset tracking.
 *
 * When cards are collected from a pack open or stuck-card recovery, their true
 * SimpleAssets mint numbers are not available yet — they only appear after the
 * next self-hosted mint backup index tick (up to a few hours later) or from
 * the live AtomicHub endpoint once browsers can reach it. The grid shows a
 * "New Mint (Syncing)" pill instead of `#--` for these assets.
 *
 * The pill only ever displays while the mint is still unresolved, so a long
 * TTL is harmless: as soon as the mint resolves, the pill disappears. Stored
 * in localStorage so a page reload keeps freshly collected cards labelled.
 */

const KEY = 'gpk_fresh_mints_v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type FreshMap = Record<string, number>;

function readMap(): FreshMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FreshMap;
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const out: FreshMap = {};
    for (const [id, ts] of Object.entries(parsed)) {
      if (typeof ts === 'number' && now - ts < TTL_MS) out[id] = ts;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: FreshMap): void {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* quota */ }
}

/** Record asset ids as freshly minted (called when collected from a pack). */
export function recordFreshMints(ids: string[]): void {
  const fresh = ids.filter((id) => !!id);
  if (fresh.length === 0) return;
  const map = readMap();
  const now = Date.now();
  for (const id of fresh) map[id] = now;
  writeMap(map);
}

/** All currently-fresh asset ids. */
export function getFreshMintIds(): string[] {
  return Object.keys(readMap());
}

/** True when the asset was freshly minted/collected and may still be syncing. */
export function isFreshMintId(id: string): boolean {
  if (!id) return false;
  const map = readMap();
  const ts = map[id];
  return typeof ts === 'number' && Date.now() - ts < TTL_MS;
}

/** Test-only: clear all recorded fresh mints. */
export function __resetFreshMintsForTests(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
