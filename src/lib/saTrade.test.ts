import { describe, it, expect } from 'vitest';
import {
  buildSaDeclineActions,
  buildSaAcceptActions,
  buildSaCancelActions,
  validateSaOffer,
  makeProposalName,
  MSIG_CONTRACT,
  SA_MAX_MEMO_LENGTH,
  withCounterRef,
  parseCounterRef,
  stripCounterRef,
  formatPackQuantity,
  parsePackQuantity,
  buildPackTransferAction,
  PACKS_CONTRACT,
} from '@/lib/saTradeActions';
import { filterProposeActions, applySupersession } from '@/lib/saOffers';
import type { AtomicOffer } from '@/lib/atomicOffers';
import { describeResourceProblem } from '@/lib/accountResources';

describe('saTradeActions (no dust beacon)', () => {
  it('decline without a prior approval requires no signature', () => {
    expect(buildSaDeclineActions('me', 'them', 'gabc', false)).toEqual([]);
  });

  it('decline after approving unapproves on eosio.msig', () => {
    const [a] = buildSaDeclineActions('me', 'them', 'gabc', true);
    expect(a.account).toBe(MSIG_CONTRACT);
    expect(a.name).toBe('unapprove');
    expect(a.data).toMatchObject({ proposer: 'them', proposal_name: 'gabc' });
  });

  it('accept approves then executes, and never touches eosio.token', () => {
    const actions = buildSaAcceptActions('me', 'them', 'gabc');
    expect(actions.map((a) => a.name)).toEqual(['approve', 'exec']);
    expect(actions.every((a) => a.account === MSIG_CONTRACT)).toBe(true);
  });

  it('cancel is proposer-scoped', () => {
    expect(buildSaCancelActions('me', 'gabc')[0].data).toMatchObject({
      proposer: 'me', canceler: 'me',
    });
  });

  it('validates offers', () => {
    expect(validateSaOffer('me', 'me', ['1'], ['2']).ok).toBe(false);
    expect(validateSaOffer('me', 'you', [], ['2']).ok).toBe(false);
    expect(validateSaOffer('me', 'you', ['1'], ['1']).ok).toBe(false);
    expect(validateSaOffer('me', 'you', ['1'], ['2']).ok).toBe(true);
  });

  it('makes legal 12-char eosio names', () => {
    const n = makeProposalName(1_700_000_000_000, 0.42);
    expect(n).toHaveLength(12);
    expect(n).toMatch(/^[a-z1-5.]{1,12}$/);
  });
});

describe('propose-action discovery', () => {
  const mk = (proposer: string, requested: string[], name = 'gabc') => ({
    timestamp: '2026-08-02T07:00:00.000',
    act: {
      account: 'eosio.msig',
      name: 'propose',
      data: { proposer, proposal_name: name, requested: requested.map((actor) => ({ actor, permission: 'active' })) },
    },
  });

  it('keeps proposals where I am proposer or requested', () => {
    const refs = filterProposeActions(
      [mk('them', ['them', 'me'], 'g1'), mk('me', ['me', 'them'], 'g2'), mk('x', ['x', 'y'], 'g3')],
      'me',
    );
    expect(refs.map((r) => r.name)).toEqual(['g1', 'g2']);
    expect(refs[0].createdAt).toBeGreaterThan(0);
  });

  it('ignores non-msig actions', () => {
    const bad = { act: { account: 'eosio.token', name: 'transfer', data: {} } };
    expect(filterProposeActions([bad], 'me')).toEqual([]);
  });
});

describe('resource preflight', () => {
  const base = { cpuAvailableUs: 50_000, netAvailableBytes: 50_000, ramFreeBytes: 50_000, liquidWax: 0 };
  it('passes a healthy account with no WAX requirement', () => {
    expect(describeResourceProblem(base)).toBeNull();
  });
  it('flags low CPU', () => {
    expect(describeResourceProblem({ ...base, cpuAvailableUs: 10 })).toMatch(/CPU/);
  });
  it('flags missing liquid WAX only when required', () => {
    expect(describeResourceProblem(base, { requiresWax: 1 })).toMatch(/liquid/);
  });
  it('is silent when the check could not run', () => {
    expect(describeResourceProblem(null)).toBeNull();
  });
});

describe('counter-offer supersession', () => {
  it('memo carries the re: marker and round-trips', () => {
    const memo = withCounterRef('trade me this', 'gabc123');
    expect(memo).toBe('trade me this re:gabc123');
    expect(parseCounterRef(memo)).toBe('gabc123');
    expect(stripCounterRef(memo)).toBe('trade me this');
    expect(parseCounterRef('plain memo')).toBeNull();
  });

  it('keeps the marker even when the memo is at the length limit', () => {
    const memo = withCounterRef('x'.repeat(SA_MAX_MEMO_LENGTH), 'gabc123');
    expect(memo.length).toBeLessThanOrEqual(SA_MAX_MEMO_LENGTH);
    expect(parseCounterRef(memo)).toBe('gabc123');
  });

  const offer = (
    name: string,
    sender: string,
    recipient: string,
    memo = '',
  ): AtomicOffer => ({
    offer_id: `sa:${sender}:${name}`,
    sender_name: sender,
    recipient_name: recipient,
    memo,
    state: 0,
    sender_assets: [],
    recipient_assets: [],
    is_sender_contract: false,
    is_recipient_contract: false,
    created_at_time: 0,
    updated_at_time: 0,
    protocol: 'simpleassets',
    proposal: { proposer: sender, name, expiresAt: 0, approvedBy: [] },
  });

  it('drops a countered proposal from the counterer view and flags it for its proposer', () => {
    const original = offer('gorig', 'them', 'me');
    const counter = offer('gnew', 'me', 'them', 'here you go re:gorig');

    const mine = applySupersession([original, counter], 'me');
    expect(mine.map((o) => o.proposal?.name)).toEqual(['gnew']);

    const theirs = applySupersession([original, counter], 'them');
    const flagged = theirs.find((o) => o.proposal?.name === 'gorig');
    expect(flagged?.proposal?.supersededBy).toBe('gnew');
    expect(theirs.find((o) => o.proposal?.name === 'gnew')?.memo).toBe('here you go');
  });

  it('leaves unrelated proposals untouched', () => {
    const a = offer('gone', 'them', 'me');
    expect(applySupersession([a], 'me')).toHaveLength(1);
  });
});

describe('pack trading', () => {
  it('formats and parses pack quantities', () => {
    expect(formatPackQuantity(3, 'GPKMEGA')).toBe('3 GPKMEGA');
    expect(parsePackQuantity('3 GPKMEGA')).toEqual({ symbol: 'GPKMEGA', amount: 3, precision: 0 });
    expect(parsePackQuantity('nonsense')).toBeNull();
  });

  it('builds a packs.topps transfer action', () => {
    const action = buildPackTransferAction('me', 'them', { symbol: 'GPKTWOA', amount: 2, precision: 0 }, 'swap');
    expect(action.account).toBe(PACKS_CONTRACT);
    expect(action.name).toBe('transfer');
    expect(action.authorization[0].actor).toBe('me');
    expect(action.data).toMatchObject({ from: 'me', to: 'them', quantity: '2 GPKTWOA' });
  });

  it('accepts a packs-only swap on both sides', () => {
    const res = validateSaOffer('me', 'them', [], [],
      [{ symbol: 'GPKMEGA', amount: 1, precision: 0 }],
      [{ symbol: 'GPKFIVE', amount: 2, precision: 0 }]);
    expect(res.ok).toBe(true);
  });

  it('accepts a mixed card + pack swap', () => {
    const res = validateSaOffer('me', 'them', ['1'], [],
      [], [{ symbol: 'GPKFIVE', amount: 2, precision: 0 }]);
    expect(res.ok).toBe(true);
  });

  it('rejects an empty side even when the other has packs', () => {
    const res = validateSaOffer('me', 'them', [], [], [{ symbol: 'GPKMEGA', amount: 1, precision: 0 }], []);
    expect(res.ok).toBe(false);
  });

  it('rejects zero or duplicate pack quantities', () => {
    expect(validateSaOffer('me', 'them', ['1'], [], [], [{ symbol: 'GPKMEGA', amount: 0, precision: 0 }]).ok).toBe(false);
    expect(validateSaOffer('me', 'them', ['1'], [], [], [
      { symbol: 'GPKMEGA', amount: 1, precision: 0 },
      { symbol: 'GPKMEGA', amount: 2, precision: 0 },
    ]).ok).toBe(false);
  });
});
