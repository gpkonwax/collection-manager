import { describe, expect, it } from 'vitest';
import { counterpartAssets, parseOffer, tradeOfferId } from '@/lib/tradeOffers';
import { mergeHistory } from '@/lib/historyTimeline';

const offer = parseOffer({
  offer_id: '182562074', sender_name: 'guydgnjzgage', recipient_name: 'm23qs.wam', state: 3,
  sender_assets: [{ asset_id: '1099527662062', name: 'Stinky Stan', template_mint: '154', data: { img: 'QmA' } }],
  recipient_assets: [{ asset_id: '1099877329715', name: 'Smelly Kelly', template_mint: '877', data: { img: 'QmB' } }],
})!;

describe('P2P trade offers', () => {
  it('reads the offer id from an accepted-offer memo between two collectors', () => {
    expect(tradeOfferId('Accepted Offer ID: 182562074', 'guydgnjzgage', 'm23qs.wam')).toBe('182562074');
  });
  it('never treats AtomicMarket listing offers as trades', () => {
    expect(tradeOfferId('Accepted Offer ID: 102950553', 'v1yqu.wam', 'atomicmarket')).toBe('');
  });
  it('ignores ordinary transfer memos', () => {
    expect(tradeOfferId('transfer', 'a', 'b')).toBe('');
  });
  it('returns the other side of the swap for either party', () => {
    expect(counterpartAssets(offer, '1099527662062').map((a) => a.name)).toEqual(['Smelly Kelly']);
    expect(counterpartAssets(offer, '1099877329715').map((a) => a.name)).toEqual(['Stinky Stan']);
  });
  it('rejects offers that were not accepted', () => {
    expect(parseOffer({ offer_id: '1', sender_name: 'a', recipient_name: 'b', state: 2 })).toBeNull();
  });
  it('tags the settling transfer in the timeline', () => {
    const out = mergeHistory([], { sales: [], transfers: [{ id: '', time: 1, from: 'guydgnjzgage', to: 'm23qs.wam', memo: 'Accepted Offer ID: 182562074', txid: 'x' }] });
    expect(out[0].offerId).toBe('182562074');
  });
});
