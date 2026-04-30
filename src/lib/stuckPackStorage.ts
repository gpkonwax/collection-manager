/**
 * Local storage helper for tracking pack openings that stalled on-chain.
 *
 * A pack is considered "stuck" when the unbox contract burned the pack and the
 * RNG oracle returned a random value (randnotify), but the contract never
 * processed it (no logresult / no unboxassets row), so cards were never minted.
 * This is a contract-side failure that the front-end cannot fix; we record it
 * so the user has a paper trail for support / the pack operator.
 */

const STORAGE_KEY = 'gpk:stuckPacks:v1';
const MAX_ENTRIES = 50;

export interface StuckPackEntry {
  packAssetId: string;
  contract: string;
  packName: string;
  account: string;
  transferTxId?: string | null;
  randnotifyTxId?: string | null;
  timestamp: number;
}

function safeRead(): StuckPackEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(list: StuckPackEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export function getStuckPacks(account?: string): StuckPackEntry[] {
  const all = safeRead().sort((a, b) => b.timestamp - a.timestamp);
  return account ? all.filter((e) => e.account === account) : all;
}

export function recordStuckPack(entry: StuckPackEntry): void {
  const list = safeRead();
  // De-dupe by packAssetId — keep latest
  const filtered = list.filter((e) => e.packAssetId !== entry.packAssetId);
  filtered.unshift(entry);
  safeWrite(filtered);
}

export function clearStuckPack(packAssetId: string): void {
  safeWrite(safeRead().filter((e) => e.packAssetId !== packAssetId));
}

export function clearAllStuckPacks(account?: string): void {
  if (!account) {
    safeWrite([]);
    return;
  }
  safeWrite(safeRead().filter((e) => e.account !== account));
}

export function buildStuckPackReportText(entry: StuckPackEntry): string {
  const lines = [
    `Stuck pack opening report`,
    `------------------------`,
    `Pack: ${entry.packName}`,
    `Pack asset id: ${entry.packAssetId}`,
    `Contract: ${entry.contract}`,
    `Account: ${entry.account}`,
    entry.transferTxId ? `Transfer tx: ${entry.transferTxId}` : null,
    entry.randnotifyTxId ? `RNG randnotify tx: ${entry.randnotifyTxId}` : null,
    `Timestamp: ${new Date(entry.timestamp).toISOString()}`,
    ``,
    `The pack was burned and the WAX RNG oracle returned a random value, but the`,
    `contract did not process it (no logresult, no unboxassets row, no mintasset).`,
    `Cards were never minted to the account. Please investigate / refund.`,
  ].filter(Boolean) as string[];
  return lines.join('\n');
}
