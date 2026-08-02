import { describe, it, expect } from 'vitest';
import {
  buildSaDeclineActions,
  buildSaAcceptActions,
  buildSaCancelActions,
  validateSaOffer,
  makeProposalName,
  MSIG_CONTRACT,
} from '@/lib/saTradeActions';
import { filterProposeActions } from '@/lib/saOffers';
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
