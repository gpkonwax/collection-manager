// GPK bridge action builders (SimpleAssets <-> AtomicAssets via atomicbridge).
//
// Verified on-chain behaviour of the atomicbridge contract:
//   SA -> AA: simpleassets::offer(owner -> atomicbridge, memo "swap").
//     The contract claims the offer inline and sends back (or freshly mints)
//     the AtomicAssets copies with memo "AtomicBridge Transfer".
//   AA -> SA: atomicassets::transfer(from -> atomicbridge, memo ignored).
//     The transfer notification handler looks up each asset's swap record and
//     inline-returns the original SimpleAssets card. Assets without a swap
//     record (never bridged from SA) fail with
//     "No swap record was found for the following asset id:".
//
// Cards are never burned in either direction; the bridge holds custody.

export const BRIDGE_CONTRACT = 'atomicbridge';
export const SIMPLEASSETS_CONTRACT = 'simpleassets';
export const ATOMICASSETS_CONTRACT = 'atomicassets';

// Memo the bridge expects on the SimpleAssets offer (from real mainnet txs).
export const BRIDGE_TO_AA_MEMO = 'swap';
// The AA->SA handler ignores the memo; this is descriptive only.
export const BRIDGE_TO_SA_MEMO = 'unbridge';

// Conservative per-transaction cap. Real bridge txs batched 5-10 cards per
// offer; the inline claim + return transfers add CPU per card.
export const MAX_BRIDGE_PER_TX = 20;

export interface WaxAction {
  account: string;
  name: string;
  authorization: Array<{ actor: string; permission: string }>;
  data: Record<string, unknown>;
}

function auth(actor: string): Array<{ actor: string; permission: string }> {
  return [{ actor, permission: 'active' }];
}

/** SimpleAssets -> AtomicAssets: one offer action per batch of asset IDs. */
export function buildBridgeToAaActions(owner: string, saAssetIds: string[]): WaxAction[] {
  return [{
    account: SIMPLEASSETS_CONTRACT,
    name: 'offer',
    authorization: auth(owner),
    data: {
      owner,
      newowner: BRIDGE_CONTRACT,
      assetids: saAssetIds,
      memo: BRIDGE_TO_AA_MEMO,
    },
  }];
}

/** AtomicAssets -> SimpleAssets: transfer the bridged copies to the bridge. */
export function buildBridgeToSaActions(owner: string, aaAssetIds: string[]): WaxAction[] {
  return [{
    account: ATOMICASSETS_CONTRACT,
    name: 'transfer',
    authorization: auth(owner),
    data: {
      from: owner,
      to: BRIDGE_CONTRACT,
      asset_ids: aaAssetIds,
      memo: BRIDGE_TO_SA_MEMO,
    },
  }];
}

/**
 * An AtomicAssets card can only go back to SimpleAssets if it was bridged
 * from SimpleAssets in the first place — i.e. it carries the original
 * SimpleAssets ID in its immutable data (same lookup the contract makes).
 */
export function isUnbridgeable(idata: Record<string, unknown>): boolean {
  const raw = idata?.sassets_id;
  const id = String(raw ?? '').trim();
  return /^\d+$/.test(id);
}

export interface BridgeValidation {
  ok: boolean;
  reason?: string;
}

export function validateBridge(assetIds: string[]): BridgeValidation {
  if (assetIds.length === 0) return { ok: false, reason: 'Select at least one card' };
  if (assetIds.length > MAX_BRIDGE_PER_TX) {
    return { ok: false, reason: `Max ${MAX_BRIDGE_PER_TX} cards per transaction` };
  }
  if (new Set(assetIds).size !== assetIds.length) {
    return { ok: false, reason: 'Duplicate card in selection' };
  }
  if (!assetIds.every((id) => /^\d+$/.test(id))) {
    return { ok: false, reason: 'Invalid asset ID in selection' };
  }
  return { ok: true };
}
