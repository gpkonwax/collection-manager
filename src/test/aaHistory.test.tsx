import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { parseAaCard, combineAaHistory, openingFromMint } from '@/lib/aaHistory';
import { HistoryTimeline } from '@/components/simpleassets/TradeHistorySection';
import { PACK_DEFAULTS } from '@/hooks/useGpkAtomicPacks';

beforeAll(() => {
  (globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const TX = 'a'.repeat(64);
// Barbecue Billy #972 (asset 1099984984103): opened from a WinterCon Day 2 pack on 10 Apr 2026.
const BILLY = {
  m: ['open', 1775869570500, 'guydgnjzgage', 'premint.nft', '59490', TX],
  t: [[1791538237000, 'guydgnjzgage', 'bum.gpk', '', 'b'.repeat(64)]],
};

describe('saved AtomicAssets history', () => {
  it('reads the opening, opener and pack', () => {
    const c = parseAaCard(BILLY);
    expect(c.opening).toEqual({ kind: 'open', time: 1775869570500, account: 'guydgnjzgage', minter: 'premint.nft', packTemplate: '59490', txid: TX });
    expect(c.transfers).toHaveLength(1);
  });

  it('merges saved and live transfers once', () => {
    const c = parseAaCard(BILLY);
    const live = { sales: [], transfers: [{ id: '9', time: 1791538237000, from: 'guydgnjzgage', to: 'bum.gpk', memo: '', txid: 'b'.repeat(64) }] };
    expect(combineAaHistory(c, live)!.transfers).toHaveLength(1);
  });

  it('a live mint log from the pool opens on delivery', () => {
    const o = openingFromMint({ time: 1, owner: 'gpkpools1111', minter: 'gpkpools1111', txid: '' }, 'gamestonk',
      [{ id: '1', time: 5, from: 'gpkpools1111', to: 'me.wam', memo: '', txid: TX }]);
    expect(o).toMatchObject({ kind: 'open', account: 'me.wam', packTemplate: '53187', time: 5 });
  });

  it('a bridge mint is never an opening', () => {
    expect(openingFromMint({ time: 1, owner: 'x.wam', minter: 'atomicbridge', txid: '' }, 'series1', [])).toBeNull();
  });

  it('shows the Pack opened box with the WinterCon pack art', () => {
    render(<HistoryTimeline events={[]} opener="guydgnjzgage" owner="bum.gpk" packArt={PACK_DEFAULTS['59490'].image} origin="aa" originDate={1775869570500} />);
    expect(screen.getByText('Pack opened')).toBeInTheDocument();
    expect(screen.getByText('guydgnjzgage')).toBeInTheDocument();
    expect(screen.getByAltText('Pack this card was pulled from')).toBeTruthy();
  });
});
