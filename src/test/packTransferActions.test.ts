import { describe, it, expect } from 'vitest';
import { buildPackTransferActions, formatPackQuantity, canSelect, getSelectionKind } from '@/lib/packTransferActions';

const base = { actor: 'alice', auth: [{ actor: 'alice', permission: 'active' }], to: 'bob', memo: 'hi' };
const balances = [{ symbol: 'GPKFIVE', amount: 5, precision: 0 }, { symbol: 'GPKMEGA', amount: 2, precision: 4 }];

describe('pack transfers', () => {
  it('sends token packs through packs.topps by quantity', () => {
    const a = buildPackTransferActions({ ...base, tokenQtys: new Map([['GPKFIVE', 3]]), balances, atomicIds: [], ownedAtomicIds: new Set() });
    expect(a).toEqual([{ account: 'packs.topps', name: 'transfer', authorization: base.auth, data: { from: 'alice', to: 'bob', quantity: '3 GPKFIVE', memo: 'hi' } }]);
  });

  it('formats quantity with the token precision', () => {
    expect(formatPackQuantity(2, 4, 'GPKMEGA')).toBe('2.0000 GPKMEGA');
  });

  it('sends AtomicAssets packs by exact asset IDs', () => {
    const a = buildPackTransferActions({ ...base, tokenQtys: new Map(), balances, atomicIds: ['111', '222'], ownedAtomicIds: new Set(['111', '222', '333']) });
    expect(a).toEqual([{ account: 'atomicassets', name: 'transfer', authorization: base.auth, data: { from: 'alice', to: 'bob', asset_ids: ['111', '222'], memo: 'hi' } }]);
  });

  it('mixes both kinds in one transaction as two actions', () => {
    const a = buildPackTransferActions({ ...base, tokenQtys: new Map([['GPKMEGA', 1]]), balances, atomicIds: ['111'], ownedAtomicIds: new Set(['111']) });
    expect(a.map(x => x.account)).toEqual(['packs.topps', 'atomicassets']);
    expect(a[0].data.quantity).toBe('1.0000 GPKMEGA');
  });

  it('rejects quantity above balance', () => {
    expect(() => buildPackTransferActions({ ...base, tokenQtys: new Map([['GPKMEGA', 3]]), balances, atomicIds: [], ownedAtomicIds: new Set() })).toThrow();
  });

  it('rejects pack IDs not owned', () => {
    expect(() => buildPackTransferActions({ ...base, tokenQtys: new Map(), balances, atomicIds: ['999'], ownedAtomicIds: new Set(['111']) })).toThrow();
  });

  it('cards and packs cannot both be selected', () => {
    expect(canSelect('cards', getSelectionKind(0, 1))).toBe(false);
    expect(canSelect('packs', getSelectionKind(2, 0))).toBe(false);
    expect(canSelect('packs', getSelectionKind(0, 0))).toBe(true);
  });
});
