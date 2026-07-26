// AtomicAssets P2P trading action builders (Phase 2, AA↔AA only).
//
// Contract: atomicassets
//   createoffer(sender, recipient, sender_asset_ids, recipient_asset_ids, memo)
//   acceptoffer(offer_id)                    [recipient auth]
//   declineoffer(offer_id)                   [recipient auth]
//   canceloffer(offer_id)                    [sender auth]
//
// All actions use the caller's `active` permission.

export const ATOMICASSETS_CONTRACT = 'atomicassets';

// Chain-side cap on assets per side per offer (AtomicAssets contract config).
// AtomicHub itself enforces 30 per side in the UI; we mirror that soft cap.
export const MAX_ASSETS_PER_SIDE = 30;

// Memos are stored on-chain — keep them short & aligned with AtomicHub.
export const MAX_MEMO_LENGTH = 256;

export interface CreateOfferParams {
  sender: string;
  recipient: string;
  senderAssetIds: string[];
  recipientAssetIds: string[];
  memo?: string;
}

export interface WaxAction {
  account: string;
  name: string;
  authorization: Array<{ actor: string; permission: string }>;
  data: Record<string, unknown>;
}

function auth(actor: string): Array<{ actor: string; permission: string }> {
  return [{ actor, permission: 'active' }];
}

export function buildCreateOfferAction(p: CreateOfferParams): WaxAction {
  return {
    account: ATOMICASSETS_CONTRACT,
    name: 'createoffer',
    authorization: auth(p.sender),
    data: {
      sender: p.sender,
      recipient: p.recipient,
      sender_asset_ids: p.senderAssetIds,
      recipient_asset_ids: p.recipientAssetIds,
      memo: (p.memo || '').slice(0, MAX_MEMO_LENGTH),
    },
  };
}

export function buildAcceptOfferAction(recipient: string, offerId: string): WaxAction {
  return {
    account: ATOMICASSETS_CONTRACT,
    name: 'acceptoffer',
    authorization: auth(recipient),
    data: { offer_id: offerId },
  };
}

export function buildDeclineOfferAction(recipient: string, offerId: string): WaxAction {
  return {
    account: ATOMICASSETS_CONTRACT,
    name: 'declineoffer',
    authorization: auth(recipient),
    data: { offer_id: offerId },
  };
}

export function buildCancelOfferAction(sender: string, offerId: string): WaxAction {
  return {
    account: ATOMICASSETS_CONTRACT,
    name: 'canceloffer',
    authorization: auth(sender),
    data: { offer_id: offerId },
  };
}

/**
 * Counter-offer: decline the incoming offer AND create a fresh one from the
 * declining party back to the original sender. Both actions signed in a single
 * transaction so it's atomic.
 */
export function buildCounterOfferActions(params: {
  originalOfferId: string;
  me: string;                // was the recipient of the original offer
  originalSender: string;    // becomes the new recipient
  senderAssetIds: string[];  // assets I offer
  recipientAssetIds: string[]; // assets I want from them
  memo?: string;
}): WaxAction[] {
  return [
    buildDeclineOfferAction(params.me, params.originalOfferId),
    buildCreateOfferAction({
      sender: params.me,
      recipient: params.originalSender,
      senderAssetIds: params.senderAssetIds,
      recipientAssetIds: params.recipientAssetIds,
      memo: params.memo,
    }),
  ];
}

export interface OfferValidation {
  ok: boolean;
  reason?: string;
}

export function validateOffer(sender: string, recipient: string, senderIds: string[], recipientIds: string[]): OfferValidation {
  if (!sender || !recipient) return { ok: false, reason: 'Missing account' };
  if (sender === recipient) return { ok: false, reason: "You can't trade with yourself" };
  if (senderIds.length === 0 && recipientIds.length === 0) {
    return { ok: false, reason: 'Add at least one asset to either side' };
  }
  if (senderIds.length > MAX_ASSETS_PER_SIDE || recipientIds.length > MAX_ASSETS_PER_SIDE) {
    return { ok: false, reason: `Max ${MAX_ASSETS_PER_SIDE} assets per side` };
  }
  if (new Set(senderIds).size !== senderIds.length || new Set(recipientIds).size !== recipientIds.length) {
    return { ok: false, reason: 'Duplicate asset in selection' };
  }
  return { ok: true };
}
