/**
 * GameStonk!-style "pool delivery" pack openings.
 *
 * The opener transfers the pack to the unbox contract (gpkpoolunbox) which
 * burns it and registers a claim keyed by the pack asset id. Shortly after,
 * an automated account calls `<pool>::claim` and, in the same transaction,
 * the pool transfers the pre-minted cards to the opener.
 */
import { HYPERION_ENDPOINTS } from '@/lib/waxRpcFallback';

export interface PoolHyperionAction {
  trx_id?: string;
  act?: { account?: string; name?: string; data?: Record<string, unknown> };
}

/** Find the card asset ids the pool delivered for `packAssetId`, or null. */
export function matchPoolDelivery(
  actions: PoolHyperionAction[],
  packAssetId: string,
  opener: string,
  poolAccount: string,
): string[] | null {
  const claim = actions.find((a) =>
    a.act?.account === poolAccount && a.act?.name === 'claim' &&
    String(a.act?.data?.claim_id ?? '') === String(packAssetId));
  if (!claim?.trx_id) return null;
  const ids: string[] = [];
  for (const a of actions) {
    if (a.trx_id !== claim.trx_id) continue;
    if (a.act?.account !== 'atomicassets' || a.act?.name !== 'transfer') continue;
    const d = a.act.data as { from?: string; to?: string; asset_ids?: unknown[] } | undefined;
    if (d?.from !== poolAccount || d?.to !== opener) continue;
    for (const id of d.asset_ids ?? []) ids.push(String(id));
  }
  return ids.length > 0 ? ids : null;
}

export async function findPoolDelivery(
  opener: string,
  packAssetId: string,
  poolAccount: string,
  timeout = 6000,
): Promise<string[] | null> {
  const filter = encodeURIComponent(`${poolAccount}:claim,atomicassets:transfer`);
  for (const base of HYPERION_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const url = `${base}/v2/history/get_actions?account=${encodeURIComponent(opener)}&filter=${filter}&limit=100&sort=desc`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = (await res.json()) as { actions?: PoolHyperionAction[] };
      return matchPoolDelivery(json.actions ?? [], packAssetId, opener, poolAccount);
    } catch { /* try next endpoint */ }
  }
  return null;
}
