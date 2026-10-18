/**
 * WAX ExpressTrade (contract account `trade`, 2020). Cards were deposited into
 * `trade` and handed on as ExpressTrade gifts via trade::creategift, whose memo
 * often carries off-market provenance (e.g. eBay fulfilment). History rows don't
 * store that memo, so it is read once from the transaction on the full node.
 */
export const EXPRESS_TRADE = 'trade';
const FULL_NODE = 'https://wax.eosdac.io';
const TIMEOUT_MS = 10000;

export interface ExpressTradeGift { memo: string; to: string }

export function isExpressTrade(e: { chain?: string; from: string; to: string }): boolean {
  return e.chain !== 'aa' && (e.from === EXPRESS_TRADE || e.to === EXPRESS_TRADE);
}

/** Pure: the trade::creategift (memo + recipient) in a transaction's actions, or null. */
export function parseExpressTradeGift(actions: unknown): ExpressTradeGift | null {
  if (!Array.isArray(actions)) return null;
  for (const a of actions as Record<string, any>[]) {
    const act = a?.act;
    if (act?.account !== EXPRESS_TRADE || act?.name !== 'creategift') continue;
    const d = act.data ?? {};
    const memo = typeof d.memo === 'string' ? d.memo.replace(/\s+/g, ' ').trim() : '';
    const to = typeof d.account_to === 'string' && /^[a-z1-5.]{1,12}$/.test(d.account_to) ? d.account_to : '';
    return { memo, to };
  }
  return null;
}

const cache = new Map<string, Promise<ExpressTradeGift | null>>();
export function fetchExpressTradeGift(txid: string): Promise<ExpressTradeGift | null> {
  if (!/^[0-9a-f]{64}$/.test(txid)) return Promise.resolve(null);
  let p = cache.get(txid);
  if (!p) {
    p = (async () => {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${FULL_NODE}/v2/history/get_transaction?id=${txid}`, { signal: c.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseExpressTradeGift((await res.json())?.actions);
      } finally { clearTimeout(t); }
    })().catch(() => { cache.delete(txid); return null; });
    cache.set(txid, p);
  }
  return p;
}
