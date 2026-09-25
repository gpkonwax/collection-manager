import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

vi.mock('@/components/simpleassets/IpfsMedia', () => ({ IpfsMedia: () => null }));
vi.mock('@/hooks/useIpfsMedia', () => ({ prefetchIpfsImage: vi.fn() }));
vi.mock('@/hooks/useCardTilt', () => ({ useCardTilt: () => ({ ref: { current: null }, glareRef: { current: null }, onMouseMove: vi.fn(), onMouseLeave: vi.fn() }) }));
vi.mock('@/hooks/usePriceAlerts', () => ({ usePriceAlerts: () => ({ getAlert: () => undefined }) }));
vi.mock('@/components/simpleassets/PriceAlertDialog', () => ({ PriceAlertDialog: () => null }));

const base: SimpleAsset = {
  id: '1', owner: 'x', author: 'gpk.topps', category: 'series1', name: 'Adam Bomb',
  image: '', images: [], cardid: '1', quality: 'base', side: 'a',
  idata: {}, mdata: {}, container: [], containerf: [], source: 'atomicassets',
};

describe('mint ribbon', () => {
  it('shows #-- for bridged AA before resolution', () => {
    render(<SimpleAssetCard asset={{ ...base, idata: { mint: '203', bridge_mint: '203' } }} onClick={() => {}} />);
    expect(screen.getByText('#--')).toBeInTheDocument();
  });
  it('shows the real mint for bridged AA after resolution (mintNumber set)', () => {
    render(<SimpleAssetCard asset={{ ...base, mintNumber: 356, idata: { mint: '356', bridge_mint: '203' } }} onClick={() => {}} />);
    expect(screen.getByText('#356')).toBeInTheDocument();
  });
  it('shows the real mint for plain SimpleAssets via idata.mint', () => {
    render(<SimpleAssetCard asset={{ ...base, source: 'simpleassets', idata: { mint: '42', maxsupply: '100' } }} onClick={() => {}} />);
    expect(screen.getByText('#42 / 100')).toBeInTheDocument();
  });
});
