import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { extractIpfsHash, getIpfsUrl } from '@/lib/ipfsGateways';

// Accepted AtomicAssets trade offers: what a card was swapped for.

export interface OfferAsset { id: string; name: string; mint: string; image: string }
export interface TradeOffer { id: string; sender: string; recipient: string; senderAssets: OfferAsset[]; recipientAssets: OfferAsset[] }

/** Accounts that use offers as market plumbing (listings), never as P2P swaps. */
const MARKET_ACCOUNTS = new Set(['atomicmarket']);

/** Pure: the offer id behind a P2P swap transfer, '' when it isn't one. */
export function tradeOfferId(memo: string, from: string, to: string): string {
  if (MARKET_ACCOUNTS.has(from) || MARKET_ACCOUNTS.has(to)) return '';
  const m = /^Accepted Offer ID:\s*(\d+)\s*$/.exec(memo ?? '');
  return m ? m[1] : '';
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

function toImage(raw: string): string {
  if (!raw) return '';
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  return hash ? getIpfsUrl(hash) : getIpfsUrl(raw);
}

function parseAsset(raw: Record<string, unknown>): OfferAsset | null {
  const id = str(raw.asset_id);
  if (!/^\d+$/.test(id)) return null;
  const data = (raw.data ?? {}) as Record<string, unknown>;
  return { id, name: str(raw.name) || str(data.name) || `#${id}`, mint: str(raw.template_mint), image: toImage(str(data.img)) };
}

export function parseOffer(raw: Record<string, unknown>): TradeOffer | null {
  const id = str(raw.offer_id);
  const sender = str(raw.sender_name);
  const recipient = str(raw.recipient_name);
  if (!id || !sender || !recipient || Number(raw.state) !== 3) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []).map((a) => parseAsset(a as Record<string, unknown>)).filter((a): a is OfferAsset => !!a);
  return { id, sender, recipient, senderAssets: list(raw.sender_assets), recipientAssets: list(raw.recipient_assets) };
}

/** Pure: the cards given in exchange for `assetId` in this offer. */
export function counterpartAssets(offer: TradeOffer, assetId: string): OfferAsset[] {
  if (offer.senderAssets.some((a) => a.id === assetId)) return offer.recipientAssets;
  if (offer.recipientAssets.some((a) => a.id === assetId)) return offer.senderAssets;
  return [];
}

const cache = new Map<string, Promise<TradeOffer | null>>();

export function fetchTradeOffer(offerId: string): Promise<TradeOffer | null> {
  if (!/^\d+$/.test(offerId)) return Promise.resolve(null);
  const hit = cache.get(offerId);
  if (hit) return hit;
  const req = fetchWithFallback(ATOMIC_API.baseUrls, `/atomicassets/v1/offers/${offerId}`, undefined, 8000)
    .then((r) => r.json())
    .then((j) => (j?.success && j.data ? parseOffer(j.data) : null));
  req.catch(() => cache.delete(offerId));
  cache.set(offerId, req);
  return req;
}
