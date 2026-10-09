import { describe, it, expect } from 'vitest';
import {
  buildBridgeToAaActions,
  buildBridgeToSaActions,
  isUnbridgeable,
  validateBridge,
  BRIDGE_CONTRACT,
  BRIDGE_TO_AA_MEMO,
  BRIDGE_TO_SA_MEMO,
  MAX_BRIDGE_PER_TX,
} from '@/lib/bridgeActions';

describe('buildBridgeToAaActions', () => {
  it('builds a simpleassets offer to the bridge with the swap memo', () => {
    const actions = buildBridgeToAaActions('abc12.wam', ['100000006630365', '100000006630366']);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      account: 'simpleassets',
      name: 'offer',
      authorization: [{ actor: 'abc12.wam', permission: 'active' }],
      data: {
        owner: 'abc12.wam',
        newowner: BRIDGE_CONTRACT,
        assetids: ['100000006630365', '100000006630366'],
        memo: BRIDGE_TO_AA_MEMO,
      },
    });
    expect(BRIDGE_TO_AA_MEMO).toBe('swap');
  });
});

describe('buildBridgeToSaActions', () => {
  it('builds an atomicassets transfer to the bridge', () => {
    const actions = buildBridgeToSaActions('abc12.wam', ['1099525011388']);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      account: 'atomicassets',
      name: 'transfer',
      authorization: [{ actor: 'abc12.wam', permission: 'active' }],
      data: {
        from: 'abc12.wam',
        to: BRIDGE_CONTRACT,
        asset_ids: ['1099525011388'],
        memo: BRIDGE_TO_SA_MEMO,
      },
    });
  });
});

describe('isUnbridgeable', () => {
  it('is true only when a numeric sassets_id is present', () => {
    expect(isUnbridgeable({ sassets_id: '100000006630384' })).toBe(true);
    expect(isUnbridgeable({ sassets_id: 100000006630384 })).toBe(true);
    expect(isUnbridgeable({})).toBe(false);
    expect(isUnbridgeable({ sassets_id: '' })).toBe(false);
    expect(isUnbridgeable({ sassets_id: 'abc' })).toBe(false);
  });
});

describe('validateBridge', () => {
  it('rejects an empty selection', () => {
    expect(validateBridge([]).ok).toBe(false);
  });
  it('rejects selections over the per-transaction cap', () => {
    const ids = Array.from({ length: MAX_BRIDGE_PER_TX + 1 }, (_, i) => String(i + 1));
    expect(validateBridge(ids).ok).toBe(false);
  });
  it('rejects duplicate and non-numeric IDs', () => {
    expect(validateBridge(['1', '1']).ok).toBe(false);
    expect(validateBridge(['x']).ok).toBe(false);
  });
  it('accepts a valid selection at the cap', () => {
    const ids = Array.from({ length: MAX_BRIDGE_PER_TX }, (_, i) => String(i + 1));
    expect(validateBridge(ids).ok).toBe(true);
  });
});
