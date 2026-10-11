import { describe, it, expect } from 'vitest';
import { buildOpenPackActions } from '@/lib/packOpenActions';
import { matchPoolDelivery } from '@/lib/poolPackDelivery';
import { PACK_CONFIG } from '@/hooks/useGpkAtomicPacks';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';

const cfg = PACK_CONFIG['59072'];
const pack = { templateId: '59072', unpackContract: cfg.contract, packConfig: cfg, openMode: cfg.openMode } as AtomicPack;
const auth = [{ actor: 'me.wam', permission: 'active' }];

describe('Food Fight! opening', () => {
  it('is enabled', () => {
    expect(cfg.disabled).toBeFalsy();
  });

  it('sends the pack to gpkpoolunbox with memo "foodfight"', () => {
    const acts = buildOpenPackActions(pack, '1099519065963', 'me.wam', auth);
    expect(acts).toHaveLength(1);
    expect(acts[0].account).toBe('atomicassets');
    expect(acts[0].data).toEqual({ from: 'me.wam', to: 'gpkpoolunbox', asset_ids: ['1099519065963'], memo: 'foodfight' });
  });

  // Shape recorded from the 20 Sept 2026 opening by atrkwmxpkaip
  const actions = [
    { trx_id: '99f8', act: { account: 'gpkpools1111', name: 'claim', data: { claim_id: '1099519065963' } } },
    { trx_id: '99f8', act: { account: 'atomicassets', name: 'transfer', data: { from: 'gpkpools1111', to: 'atrkwmxpkaip', asset_ids: ['1100002111222', '1100002111223', '1100002111224'] } } },
    { trx_id: 'aa11', act: { account: 'atomicassets', name: 'transfer', data: { from: 'gpkpools1111', to: 'other.wam', asset_ids: ['1100002111999'] } } },
  ];

  it('finds the 3 delivered cards for the matching pack id', () => {
    expect(matchPoolDelivery(actions, '1099519065963', 'atrkwmxpkaip', 'gpkpools1111'))
      .toEqual(['1100002111222', '1100002111223', '1100002111224']);
  });

  it('ignores deliveries to other openers', () => {
    expect(matchPoolDelivery(actions, '1099519065963', 'other.wam', 'gpkpools1111')).toBeNull();
  });
});
