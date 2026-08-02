// AtomicAssets offers — read-only fetching for Phase 1 of P2P trading.
// Endpoint: /atomicassets/v1/offers?account=NAME&state=0
//
// State codes (per AtomicAssets docs):
//   0 = pending, 1 = invalid, 2 = unknown, 3 = accepted, 4 = declined, 5 = canceled

import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash } from '@/lib/ipfsGateways';
import { normalizeGpkVariant } from '@/lib/gpkVariant';

export type OfferState = 0 | 1 | 2 | 3 | 4 | 5;

export interface OfferAsset {
  asset_id: string;
  name: string;
  image: string | null;
  collection_name: string;
  schema_name: string;
  template_id: string | null;
  mint: string | null;
  /** Normalized GPK variant (base, sketch, golden, ...) when available. */
  variant?: string;
  /** Card id within its series, when available. */
  cardid?: string;
}

export interface AtomicOffer {
  offer_id: string;
  sender_name: string;
  recipient_name: string;
  memo: string;
  state: OfferState;
  sender_assets: OfferAsset[];
  recipient_assets: OfferAsset[];
  is_sender_contract: boolean;
  is_recipient_contract: boolean;
  created_at_time: number; // ms epoch
  updated_at_time: number; // ms epoch
}

interface RawOfferAsset {
  asset_id: string;
  name?: string;
  collection?: { collection_name?: string };
  schema?: { schema_name?: string };
  template?: { template_id?: string; immutable_data?: Record<string, string> };
  template_mint?: string;
  immutable_data?: Record<string, string>;
  mutable_data?: Record<string, string>;
  data?: Record<string, string>;
}

interface RawOffer {
  offer_id: string;
  sender_name: string;
  recipient_name: string;
  memo?: string;
  state: number;
  sender_assets: RawOfferAsset[];
  recipient_assets: RawOfferAsset[];
  is_sender_contract?: boolean;
  is_recipient_contract?: boolean;
  created_at_time?: string;
  updated_at_time?: string;
}

function resolveImage(raw?: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return null;
}

function normalizeAsset(a: RawOfferAsset): OfferAsset {
  const tplData = a.template?.immutable_data || {};
  const combined = { ...tplData, ...a.immutable_data, ...a.mutable_data, ...a.data };
  const name = combined.name || a.name || `Asset #${a.asset_id}`;
  const img = combined.img || combined.image || combined.icon || null;
  return {
    asset_id: a.asset_id,
    name,
    image: resolveImage(img),
    collection_name: a.collection?.collection_name || '',
    schema_name: a.schema?.schema_name || '',
    template_id: a.template?.template_id || null,
    mint: a.template_mint || null,
  };
}

function normalizeOffer(o: RawOffer): AtomicOffer {
  return {
    offer_id: o.offer_id,
    sender_name: o.sender_name,
    recipient_name: o.recipient_name,
    memo: o.memo || '',
    state: (o.state as OfferState) ?? 0,
    sender_assets: (o.sender_assets || []).map(normalizeAsset),
    recipient_assets: (o.recipient_assets || []).map(normalizeAsset),
    is_sender_contract: !!o.is_sender_contract,
    is_recipient_contract: !!o.is_recipient_contract,
    created_at_time: Number(o.created_at_time || 0),
    updated_at_time: Number(o.updated_at_time || 0),
  };
}

/**
 * Verify that every asset in `assetIds` is currently owned by `owner`.
 * Uses a single /assets query filtered by owner + ids.
 */
async function verifyOwnership(owner: string, assetIds: string[]): Promise<boolean> {
  if (!owner || assetIds.length === 0) return true;
  const unique = Array.from(new Set(assetIds));
  const params = new URLSearchParams({
    ids: unique.join(','),
    owner,
    limit: String(Math.max(unique.length, 100)),
  });
  const path = `/atomicassets/v1/assets?${params.toString()}`;
  try {
    const resp = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
    const json = await resp.json();
    if (!json?.success || !Array.isArray(json.data)) return false;
    const foundIds = new Set(json.data.map((a: { asset_id: string }) => a.asset_id));
    return unique.every((id) => foundIds.has(id));
  } catch {
    // If we can't verify, treat as invalid to match AtomicHub's stricter behavior.
    return false;
  }
}

/**
 * Fetch pending offers (state=0) where `account` is either sender or recipient.
 * Filters out "invalid" offers (assets no longer owned by sender/recipient),
 * matching AtomicHub's active-offer view. Returns most-recent first.
 */
export async function fetchPendingOffers(account: string): Promise<AtomicOffer[]> {
  if (!account) return [];
  const all: RawOffer[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore && page <= 20) {
    const params = new URLSearchParams({
      account,
      state: '0',
      limit: '100',
      page: String(page),
      order: 'desc',
      sort: 'created',
      hide_contract_offers: 'true',
    });
    const path = `/atomicassets/v1/offers?${params.toString()}`;
    const resp = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
    const json = await resp.json();
    if (!json?.success || !Array.isArray(json.data)) break;
    all.push(...(json.data as RawOffer[]));
    hasMore = json.data.length === 100;
    page++;
  }

  // Drop marketplace / contract offers (e.g. atomicmarket sale listings use an
  // atomicassets offer to the atomicmarket contract as escrow). The Trades tab
  // is for true P2P asset-for-asset offers only.
  const p2pOnly = all
    .map(normalizeOffer)
    .filter((o) => !o.is_sender_contract && !o.is_recipient_contract)
    .filter((o) => o.sender_assets.length > 0 || o.recipient_assets.length > 0);

  // Validate every offer's asset ownership in parallel; drop stale ones.
  const checks = await Promise.all(
    p2pOnly.map(async (o) => {
      const senderIds = o.sender_assets.map((a) => a.asset_id);
      const recipientIds = o.recipient_assets.map((a) => a.asset_id);
      const [senderOk, recipientOk] = await Promise.all([
        verifyOwnership(o.sender_name, senderIds),
        verifyOwnership(o.recipient_name, recipientIds),
      ]);
      return senderOk && recipientOk ? o : null;
    }),
  );

  return checks.filter((o): o is AtomicOffer => o !== null);
}
