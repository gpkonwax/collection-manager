import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import { SimpleAssetDetailDialog } from '@/components/simpleassets/SimpleAssetDetailDialog';
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
    render(<SimpleAssetCard asset={{ ...base, mintNumber: 356, mintSurviving: 398, mintBurned: 0, mintSource: 'backup', idata: { mint: '356', bridge_mint: '203' } }} onClick={() => {}} />);
    expect(screen.getByText('#356')).toBeInTheDocument();
    expect(screen.queryByText(/Bridge Mint/)).not.toBeInTheDocument();
    expect(screen.getByTitle(/Total ever minted: 398/)).toHaveAttribute('title', expect.stringContaining('Burned: 0'));
  });
  it('shows the real mint for plain SimpleAssets via idata.mint', () => {
    render(<SimpleAssetCard asset={{ ...base, source: 'simpleassets', idata: { mint: '42', maxsupply: '100' } }} onClick={() => {}} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.queryByText('#42 / 100')).not.toBeInTheDocument();
  });
  it('shows only the mint on burned Series 2 SA and bridged AA cards', () => {
    const asset = { ...base, category: 'series2', mintNumber: 1524, mintSurviving: 1281, mintBurned: 246, idata: { mint: '1524', maxsupply: '1281', bridge_mint: '39' } };
    const { rerender } = render(<SimpleAssetCard asset={{ ...asset, source: 'simpleassets' }} onClick={() => {}} />);
    expect(screen.getByText('#1524')).toBeInTheDocument();
    expect(screen.getByTitle(/Total ever minted: 1,527/)).toHaveAttribute('title', expect.stringContaining('Burned: 246'));
    rerender(<SimpleAssetCard asset={{ ...asset, source: 'atomicassets' }} onClick={() => {}} />);
    expect(screen.getByText('#1524')).toBeInTheDocument();
    expect(screen.queryByText(/Bridge Mint/)).not.toBeInTheDocument();
  });
  it('keeps the ribbon mint-only for Exotic cards', () => {
    render(<SimpleAssetCard asset={{ ...base, category: 'exotic', source: 'simpleassets', mintNumber: 1118, mintSurviving: 1507, mintBurned: 0 }} onClick={() => {}} />);
    expect(screen.getByText('#1118')).toBeInTheDocument();
  });
  it('updates memoized ribbon and tooltip when mint resolution arrives', () => {
    const { rerender } = render(<SimpleAssetCard asset={{ ...base, idata: { bridge_mint: '203' } }} onClick={() => {}} />);
    expect(screen.getByText('#--')).toBeInTheDocument();
    rerender(<SimpleAssetCard asset={{ ...base, idata: { bridge_mint: '203' }, mintNumber: 1524, mintSurviving: 1281, mintBurned: 246 }} onClick={() => {}} />);
    expect(screen.getByText('#1524')).toBeInTheDocument();
    expect(screen.getByTitle(/Total ever minted: 1,527/)).toBeInTheDocument();
  });
  it('shows a separate supply breakdown in the details', () => {
    render(<SimpleAssetDetailDialog asset={{ ...base, category: 'series2', mintNumber: 1524, mintSurviving: 1281, mintBurned: 246, mintSource: 'backup', idata: { bridge_mint: '39' } }} open onOpenChange={() => {}} />);
    expect(screen.getByText('Total ever minted: 1,527')).toBeInTheDocument();
    expect(screen.getByText('In circulation: 1,281')).toBeInTheDocument();
    expect(screen.getByText('Burned: 246')).toBeInTheDocument();
    expect(screen.getByText('Bridge Mint')).toBeInTheDocument();
  });
});
