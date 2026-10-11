import { describe, it, expect } from 'vitest';
import { buildOpenPackActions } from '@/lib/packOpenActions';
import { matchPoolDelivery } from '@/lib/poolPackDelivery';
import { PACK_CONFIG } from '@/hooks/useGpkAtomicPacks';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';

const cfg = PACK_CONFIG['53187'];
const pack = { templateId: '53187', unpackContract: cfg.contract, packConfig: cfg, openMode: cfg.openMode } as AtomicPack;
const auth = [{ actor: 'me.wam', permission: 'active' }];

describe('GameStonk! opening', () => {
  it('is enabled', () => {
    expect(cfg.disabled).toBeFalsy();
  });

  it('sends the pack to gpkpoolunbox with memo "gamestonk"', () => {
    const acts = buildOpenPackActions(pack, '1099515161979', 'me.wam', auth);
    expect(acts).toHaveLength(1);
    expect(acts[0].account).toBe('atomicassets');
    expect(acts[0].data).toEqual({ from: 'me.wam', to: 'gpkpoolunbox', asset_ids: ['1099515161979'], memo: 'gamestonk' });
  });

  // Shape recorded from the 18 Sept 2026 opening (trx f6ae5cb381…)
  const actions = [
    { trx_id: 'f6ae', act: { account: 'gpkpools1111', name: 'claim', data: { claim_id: '1099515161979', claimable_indices: [0, 1, 2] } } },
    { trx_id: 'f6ae', act: { account: 'atomicassets', name: 'transfer', data: { from: 'gpkpools1111', to: 'ujsbe.wam', asset_ids: ['1099515152109', '1099515150416', '1099515151315'] } } },
    { trx_id: 'fea3', act: { account: 'atomicassets', name: 'transfer', data: { from: 'premint.nft', to: 'ujsbe.wam', asset_ids: ['1099524514869'] } } },
  ];

  it('finds the 3 delivered cards for the matching pack id', () => {
    expect(matchPoolDelivery(actions, '1099515161979', 'ujsbe.wam', 'gpkpools1111'))
      .toEqual(['1099515152109', '1099515150416', '1099515151315']);
  });

  it('ignores deliveries for other packs', () => {
    expect(matchPoolDelivery(actions, '1099515164072', 'ujsbe.wam', 'gpkpools1111')).toBeNull();
  });
});
