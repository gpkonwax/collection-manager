import { describe, it, expect } from 'vitest';
import type { AtomicOffer } from '@/lib/atomicOffers';
import {
  classifyAaOutcome, classifySaOutcome, emptyStore, markSelf, reconcileSent,
  resolvePending, vanished, COUNTER_GRACE_MS,
} from '@/lib/tradeReplies';

const ME = 'alice';
const now = 1_800_000_000_000;

function offer(id: string, extra: Partial<AtomicOffer> = {}): AtomicOffer {
  return {
    offer_id: id, sender_name: ME, recipient_name: 'bob', memo: '', state: 0,
    sender_assets: [], recipient_assets: [], is_sender_contract: false,
    is_recipient_contract: false, created_at_time: now - 1000, updated_at_time: now - 1000,
    ...extra,
  };
}

describe('AtomicAssets reply outcomes', () => {
  it('state 3 is accepted', () => {
    expect(classifyAaOutcome({ state: 3, recipient_name: 'bob', updated_at_time: now }, [], now))
      .toMatchObject({ kind: 'reply', outcome: 'accepted' });
  });
  it('state 4 with a quick offer back from the same trader is countered', () => {
    const c = classifyAaOutcome({ state: 4, recipient_name: 'bob', updated_at_time: now },
      [{ offer_id: '99', sender_name: 'bob', created_at_time: now + 2000 }], now);
    expect(c).toEqual({ kind: 'reply', outcome: 'countered', at: now, counterOfferId: '99' });
  });
  it('state 4 with no offer back is declined after the grace period', () => {
    expect(classifyAaOutcome({ state: 4, recipient_name: 'bob', updated_at_time: now }, [], now + 1000))
      .toEqual({ kind: 'wait' });
    expect(classifyAaOutcome({ state: 4, recipient_name: 'bob', updated_at_time: now }, [], now + COUNTER_GRACE_MS + 1))
      .toMatchObject({ kind: 'reply', outcome: 'declined' });
  });
  it('my own cancel (state 5) never notifies', () => {
    expect(classifyAaOutcome({ state: 5, recipient_name: 'bob', updated_at_time: now }, [], now))
      .toEqual({ kind: 'silent' });
  });
});

describe('SimpleAssets reply outcomes', () => {
  it('executed proposal is accepted', () => {
    expect(classifySaOutcome({ type: 'executed', at: now }, ME, now + 1e9, now))
      .toMatchObject({ kind: 'reply', outcome: 'accepted' });
  });
  it('cancelled by the other trader is declined, by me is silent', () => {
    expect(classifySaOutcome({ type: 'cancelled', by: 'bob', at: now }, ME, 0, now))
      .toMatchObject({ kind: 'reply', outcome: 'declined' });
    expect(classifySaOutcome({ type: 'cancelled', by: ME, at: now }, ME, 0, now)).toEqual({ kind: 'silent' });
  });
  it('unreachable history waits instead of guessing', () => {
    expect(classifySaOutcome({ type: 'unknown' }, ME, now - 1, now)).toEqual({ kind: 'wait' });
    expect(classifySaOutcome({ type: 'none' }, ME, now + 1000, now)).toEqual({ kind: 'wait' });
  });
  it('expired proposal with no exec/cancel is declined', () => {
    expect(classifySaOutcome({ type: 'none' }, ME, now - 1, now))
      .toMatchObject({ kind: 'reply', outcome: 'declined' });
  });
  it('a superseded proposal immediately becomes a countered reply', () => {
    const o = offer('sa:alice:p1', {
      protocol: 'simpleassets',
      proposal: { proposer: ME, name: 'p1', expiresAt: now + 1e9, approvedBy: [ME], supersededBy: 'p2' },
    });
    const s = reconcileSent(emptyStore(), 'simpleassets', [o], now, (p, n) => `sa:${p}:${n}`);
    expect(s.replies).toHaveLength(1);
    expect(s.replies[0]).toMatchObject({ outcome: 'countered', counterOfferId: 'sa:bob:p2' });
  });
});

describe('sent-offer tracking', () => {
  it('flags offers that leave the pending list and turns them into replies', () => {
    let s = reconcileSent(emptyStore(), 'atomicassets', [offer('1'), offer('2')], now);
    expect(vanished(s, 'atomicassets')).toHaveLength(0);
    s = reconcileSent(s, 'atomicassets', [offer('2')], now + 60_000);
    expect(vanished(s, 'atomicassets').map((p) => p.id)).toEqual(['1']);
    s = resolvePending(s, '1', 'accepted', now + 60_000);
    expect(s.replies.map((r) => [r.id, r.outcome, r.seen])).toEqual([['1', 'accepted', false]]);
  });
  it('an offer I cancelled myself never becomes a reply', () => {
    let s = reconcileSent(emptyStore(), 'atomicassets', [offer('1')], now);
    s = markSelf(s, '1');
    s = reconcileSent(s, 'atomicassets', [], now + 60_000);
    expect(vanished(s, 'atomicassets')).toHaveLength(0);
    expect(s.replies).toHaveLength(0);
  });
});
