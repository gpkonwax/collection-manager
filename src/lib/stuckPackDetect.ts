/**
 * Detect packs whose unbox stalled mid-flow:
 * the WAX RNG oracle (`orng.wax`) has already delivered `randnotify` for the
 * pack, but the unbox contract never produced a `logresult` and never wrote
 * `unboxassets` rows. This means the pack is burned and unrecoverable from the
 * client side — only the contract operator can fix it.
 */

const HYPERION_ENDPOINTS = [
  'https://wax.api.eosnation.io',
  'https://wax.eosphere.io',
  'https://api.hivebp.io',
  'https://wax.eosdac.io',
  'https://wax.pink.gg',
  'https://wax.eosusa.io',
  'https://api.wax.alohaeos.com',
];

interface HyperionAction {
  '@timestamp'?: string;
  timestamp?: string;
  trx_id?: string;
  act?: { account?: string; name?: string; data?: Record<string, unknown> };
}

/**
 * Look up a `randnotify` event on the given unbox contract for a specific
 * pack asset id (used as `assoc_id`). Returns the trx id if found.
 */
export async function findRandnotifyForPack(
  contract: string,
  packAssetId: string,
  timeout = 6000,
): Promise<{ trxId: string; timestamp: string } | null> {
  for (const baseUrl of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      // Hyperion: actions on `contract` filtered to orng.wax::randnotify, recent
      const url =
        `${baseUrl}/v2/history/get_actions` +
        `?account=${encodeURIComponent(contract)}` +
        `&filter=orng.wax%3Arandnotify&limit=50&sort=desc`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { actions?: HyperionAction[] };
      const actions = json.actions || [];
      for (const a of actions) {
        const data = a.act?.data as { assoc_id?: string | number; dapp?: string } | undefined;
        if (!data) continue;
        const assoc = String(data.assoc_id ?? '');
        if (assoc === packAssetId) {
          return {
            trxId: a.trx_id || '',
            timestamp: a['@timestamp'] || a.timestamp || '',
          };
        }
      }
      // First reachable Hyperion answered — don't try the others
      return null;
    } catch {
      // try next endpoint
    }
  }
  return null;
}
