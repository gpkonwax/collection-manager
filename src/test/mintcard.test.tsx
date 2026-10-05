import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import { SimpleAssetDetailDialog } from '@/components/simpleassets/SimpleAssetDetailDialog';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { formatPackLabel } from '@/lib/provenance';
import { recordFreshMints, getFreshMintIds, isFreshMintId, __resetFreshMintsForTests } from '@/lib/freshMints';

const bridgeLookup = vi.hoisted(() => vi.fn(async (id: string) => (id === '77' ? '3ngqu.wam' : null)));
vi.mock('@/lib/bridgeAccount', () => ({ fetchBridgeAccount: bridgeLookup, getCachedBridgeAccount: () => undefined }));
const provenanceLookup = vi.hoisted(() => vi.fn(async (id: string) => {
  if (id === '100000004390402') return { o: 'dk2au.wam', t: Date.UTC(2020, 4, 12, 13, 54), p: 'series1', n: 5 };
  if (id === '88') return { b: 'saved.wam' };
  return null;
}));
vi.mock('@/lib/provenance', async (orig) => ({ ...(await orig<typeof import('@/lib/provenance')>()), getProvenance: provenanceLookup }));
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
  it('shows precise pack codes only when the saved opening size identifies a pack', () => {
    expect(formatPackLabel('series1', 5)).toBe('GPKFIVE (5 card pack)');
    expect(formatPackLabel('series1', 30)).toBe('GPKMEGA (30 card pack)');
    expect(formatPackLabel('series2', 8)).toBe('GPKTWOA (8 card pack)');
    expect(formatPackLabel('series2', 25)).toBe('GPKTWOB (25 card pack)');
    expect(formatPackLabel('series2', 55)).toBe('GPKTWOC (55 card pack)');
    expect(formatPackLabel('exotic', 5)).toBe('EXOFIVE (5 card pack)');
    expect(formatPackLabel('exotic', 25)).toBe('EXOMEGA (25 card pack)');
    expect(formatPackLabel('series1', 3)).toBe('Series 1 (3-card pack)');
  });
  it('shows #-- for bridged AA before resolution', () => {
    render(<SimpleAssetCard asset={{ ...base, idata: { mint: '203', bridge_mint: '203' } }} onClick={() => {}} />);
    expect(screen.getByText('#--')).toBeInTheDocument();
    expect(screen.getByText('Bridge Mint #203')).toBeInTheDocument();
  });
  it('shows the real mint for bridged AA after resolution (mintNumber set)', () => {
    render(<SimpleAssetCard asset={{ ...base, mintNumber: 356, mintSurviving: 398, mintBurned: 0, mintSource: 'backup', idata: { mint: '356', bridge_mint: '203' } }} onClick={() => {}} />);
    expect(screen.getByText('#356')).toBeInTheDocument();
    expect(screen.getByText('Bridge Mint #203')).toBeInTheDocument();
    expect(screen.getByTitle(/Total ever minted: 398/)).toHaveAttribute('title', expect.stringContaining('Burned: 0'));
  });
  it('shows the real mint for plain SimpleAssets via idata.mint', () => {
    render(<SimpleAssetCard asset={{ ...base, source: 'simpleassets', idata: { mint: '42', maxsupply: '100', bridge_mint: '203' } }} onClick={() => {}} />);
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.queryByText('#42 / 100')).not.toBeInTheDocument();
    expect(screen.queryByText(/Bridge Mint/)).not.toBeInTheDocument();
  });
  it('shows only the mint on burned Series 2 SA and bridged AA cards', () => {
    const asset = { ...base, category: 'series2', mintNumber: 1524, mintSurviving: 1281, mintBurned: 246, idata: { mint: '1524', maxsupply: '1281', bridge_mint: '39' } };
    const { rerender } = render(<SimpleAssetCard asset={{ ...asset, source: 'simpleassets' }} onClick={() => {}} />);
    expect(screen.getByText('#1524')).toBeInTheDocument();
    expect(screen.getByTitle(/Total ever minted: 1,527/)).toHaveAttribute('title', expect.stringContaining('Burned: 246'));
    rerender(<SimpleAssetCard asset={{ ...asset, source: 'atomicassets' }} onClick={() => {}} />);
    expect(screen.getByText('#1524')).toBeInTheDocument();
    expect(screen.getByText('Bridge Mint #39')).toBeInTheDocument();
  });
  it('keeps bridge order below the artwork with its total, but never for native AA cards', () => {
    const { rerender } = render(<SimpleAssetCard asset={{ ...base, mintNumber: 356, idata: { bridge_mint: '203', bridge_total: '500' } }} onClick={() => {}} />);
    const bridge = screen.getByText('Bridge Mint #203 / 500');
    expect(bridge).toBeInTheDocument();
    expect(bridge.closest('.p-3')).toContainElement(bridge);
    expect(screen.getByText('#356')).toBeInTheDocument();
    rerender(<SimpleAssetCard asset={{ ...base, category: 'foodfight', mintNumber: 203, idata: { bridge_mint: '203', bridge_total: '500' } }} onClick={() => {}} />);
    expect(screen.queryByText(/Bridge Mint/)).not.toBeInTheDocument();
    expect(screen.getByText('#203')).toBeInTheDocument();
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
    render(<SimpleAssetDetailDialog asset={{ ...base, category: 'series2', mintNumber: 1524, mintSurviving: 1281, mintBurned: 246, mintSource: 'backup', mintBackupDate: '2026-10-02T00:00:00Z', bridgedAt: Date.UTC(2026, 8, 22, 13), idata: { bridge_mint: '39' } }} open onOpenChange={() => {}} />);
    expect(screen.getByText('Mint number:')).toBeInTheDocument();
    expect(screen.getAllByText('#1524').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total ever minted: 1,527')).toBeInTheDocument();
    expect(screen.getByText('In circulation: 1,281')).toBeInTheDocument();
    expect(screen.getByText('Burned: 246')).toBeInTheDocument();
    expect(screen.queryByText(/Mint number — saved backup/)).not.toBeInTheDocument();
    const mintHeading = screen.getByText('Mint information');
    const bridgeHeading = screen.getByText('Bridge Information');
    // Each heading sits in a flush-left wrapper inside its column; columns share one grid.
    expect(mintHeading.parentElement).toHaveClass('text-left');
    expect(bridgeHeading.parentElement).toHaveClass('text-left');
    expect(mintHeading.parentElement?.parentElement?.parentElement).toBe(bridgeHeading.parentElement?.parentElement?.parentElement);
    expect(mintHeading.parentElement?.parentElement?.parentElement).toHaveClass('sm:grid-cols-4');
    expect(mintHeading.parentElement?.parentElement).toHaveClass('sm:col-start-2', 'sm:col-span-2', 'sm:items-center');
    expect(bridgeHeading.parentElement?.parentElement).toHaveClass('sm:col-start-3', 'sm:col-span-2', 'sm:items-center');
    expect(screen.getByText('Bridge Mint:')).toBeInTheDocument();
    expect(screen.getByText('#39')).toBeInTheDocument();
    expect(screen.getByText('Bridged on: 22 Sept 2026')).toBeInTheDocument();
  });
  it('keeps the bridge mint when no valid bridge date is available', () => {
    render(<SimpleAssetDetailDialog asset={{ ...base, mintNumber: 356, bridgedAt: Number.NaN, idata: { bridge_mint: '203' } }} open onOpenChange={() => {}} />);
    expect(screen.getByText('Bridge Information')).toBeInTheDocument();
    expect(screen.getByText('#203')).toBeInTheDocument();
    expect(screen.queryByText(/Bridged on:/)).not.toBeInTheDocument();
  });
  it('does not show bridge information for native AtomicAssets or SimpleAssets', () => {
    const { rerender } = render(<SimpleAssetDetailDialog asset={{ ...base, category: 'foodfight', mintNumber: 22, bridgedAt: Date.UTC(2026, 8, 22), idata: { bridge_mint: '203' } }} open onOpenChange={() => {}} />);
    expect(screen.queryByText('Bridge Information')).not.toBeInTheDocument();
    rerender(<SimpleAssetDetailDialog asset={{ ...base, source: 'simpleassets', mintNumber: 22, bridgedAt: Date.UTC(2026, 8, 22), idata: { bridge_mint: '203' } }} open onOpenChange={() => {}} />);
    expect(screen.queryByText('Bridge Information')).not.toBeInTheDocument();
  });
  it('shows linked Information before mint and bridge information, with template ID only for AtomicAssets', async () => {
    const { rerender } = render(<SimpleAssetDetailDialog asset={{ ...base, id: '1099535105066', mintNumber: 9, idata: { _template_id: '363', bridge_mint: '7', bridge_total: '90' } }} open onOpenChange={() => {}} />);
    const infoColumn = screen.getByText('Information').closest('[class*="sm:col-start-1"]');
    const columns = infoColumn?.parentElement;
    expect(columns?.children[0]).toBe(infoColumn);
    expect(columns?.children[1]).toContainElement(screen.getByText('Mint information'));
    expect(columns?.children[2]).toContainElement(screen.getByText('Bridge Information'));
    expect(screen.getByText('Total bridged (AtomicAssets): 90')).toBeInTheDocument();
    const checkLink = async (name: string, url: string) => {
      fireEvent.click(screen.getByRole('button', { name }));
      expect(await screen.findByText(url)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByText(url)).not.toBeInTheDocument());
    };
    await checkLink('1099535105066', 'https://atomichub.io/explorer/asset/wax-mainnet/1099535105066');
    await checkLink('363', 'https://atomichub.io/explorer/template/wax-mainnet/gpk.topps/363');
    await checkLink('gpk.topps', 'https://atomichub.io/explorer/collection/wax-mainnet/gpk.topps');
    await checkLink('Series 1', 'https://atomichub.io/explorer/schema/wax-mainnet/gpk.topps/series1');
    rerender(<SimpleAssetDetailDialog asset={{ ...base, source: 'simpleassets', id: '123', category: 'five', idata: {} }} open onOpenChange={() => {}} />);
    expect(screen.queryByText('Template ID:')).not.toBeInTheDocument();
    expect(screen.queryByText('Bridge Information')).not.toBeInTheDocument();
    expect(screen.getByText('Information').parentElement).toHaveClass('text-left');
    // Two-column layout: Information and Mint information hang at the third points (33.3% / 66.7%).
    expect(screen.getByText('Information').parentElement?.parentElement?.parentElement).toHaveClass('sm:grid-cols-6');
    expect(screen.getByText('Information').parentElement?.parentElement).toHaveClass('sm:col-start-1', 'sm:col-span-4', 'sm:items-center');
    expect(screen.getByText('Mint information').parentElement?.parentElement).toHaveClass('sm:col-start-3', 'sm:col-span-4', 'sm:items-center');
    await checkLink('123', 'https://waxblock.io/account/simpleassets?loadContract=true&tab=Tables&table=sassets&scope=x&lower_bound=123&upper_bound=123');
    await checkLink('Series 1', 'https://atomichub.io/explorer/schema/wax-mainnet/gpk.topps/series1');
  });
  it('shows the bridging account from the mint log, and omits it when unknown', async () => {
    const { rerender } = render(<SimpleAssetDetailDialog asset={{ ...base, id: '77', mintNumber: 5, idata: { bridge_mint: '9' } }} open onOpenChange={() => {}} />);
    expect(await screen.findByText('3ngqu.wam')).toBeInTheDocument();
    expect(screen.getByText(/Bridged by:/)).toBeInTheDocument();
    rerender(<SimpleAssetDetailDialog asset={{ ...base, id: '78', mintNumber: 5, idata: { bridge_mint: '9' } }} open onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.queryByText(/Bridged by:/)).not.toBeInTheDocument());
  });
  it('never looks up a bridger for native AtomicAssets cards', () => {
    bridgeLookup.mockClear();
    render(<SimpleAssetDetailDialog asset={{ ...base, id: '77', category: 'foodfight', idata: { bridge_mint: '9' } }} open onOpenChange={() => {}} />);
    expect(bridgeLookup).not.toHaveBeenCalled();
  });
  it('shows pack opener, mint date and pack from saved records, keyed by the original SA id', async () => {
    render(<SimpleAssetDetailDialog open onOpenChange={() => {}} asset={{ ...base, id: '1100001811339', mintNumber: 1, idata: { bridge_mint: '5', sassets_id: '100000004390402' } }} />);
    expect(await screen.findByText('dk2au.wam')).toBeInTheDocument();
    expect(screen.getByText('Opened by:')).toBeInTheDocument();
    expect(screen.getByText('Minted on: 12 May 2020')).toBeInTheDocument();
    expect(screen.getByText('Pack: GPKFIVE (5 card pack)')).toBeInTheDocument();
  });
  it('hides pack lines when no record exists', async () => {
    render(<SimpleAssetDetailDialog open onOpenChange={() => {}} asset={{ ...base, source: 'simpleassets', id: '999', mintNumber: 3 }} />);
    await waitFor(() => expect(provenanceLookup).toHaveBeenCalledWith('999'));
    expect(screen.queryByText('Opened by:')).not.toBeInTheDocument();
    expect(screen.queryByText(/Minted on:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pack:/)).not.toBeInTheDocument();
  });
  it('uses a saved bridging account before the live lookup', async () => {
    bridgeLookup.mockClear();
    render(<SimpleAssetDetailDialog open onOpenChange={() => {}} asset={{ ...base, id: '88', idata: { bridge_mint: '7', sassets_id: '100000000000001' } }} />);
    expect(await screen.findByText('saved.wam')).toBeInTheDocument();
    expect(bridgeLookup).not.toHaveBeenCalled();
  });
});

describe('fresh mint syncing pill', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetFreshMintsForTests();
  });

  it('shows "New Mint (Syncing)" instead of #-- for a freshly collected unresolved card', () => {
    render(<SimpleAssetCard asset={{ ...base, source: 'simpleassets' }} freshMint onClick={() => {}} />);
    expect(screen.getByText('New Mint (Syncing)')).toBeInTheDocument();
    expect(screen.queryByText('#--')).not.toBeInTheDocument();
    // The pill explains why the mint number is missing.
    expect(screen.getByTitle('Newly minted — the mint number appears after the next mint backup index tick')).toBeInTheDocument();
  });

  it('shows the real mint, not the pill, once the index tick resolves it', () => {
    render(<SimpleAssetCard asset={{ ...base, source: 'simpleassets', mintNumber: 356, mintSurviving: 398, mintBurned: 0, mintSource: 'backup' }} freshMint onClick={() => {}} />);
    expect(screen.getByText('#356')).toBeInTheDocument();
    expect(screen.queryByText('New Mint (Syncing)')).not.toBeInTheDocument();
  });

  it('never shows the pill for cards that were not freshly collected', () => {
    render(<SimpleAssetCard asset={{ ...base, source: 'simpleassets' }} onClick={() => {}} />);
    expect(screen.getByText('#--')).toBeInTheDocument();
    expect(screen.queryByText('New Mint (Syncing)')).not.toBeInTheDocument();
  });

  it('keeps the pill while a freshly collected card re-renders after resolution arrives', () => {
    const { rerender } = render(<SimpleAssetCard asset={{ ...base, source: 'simpleassets' }} freshMint onClick={() => {}} />);
    expect(screen.getByText('New Mint (Syncing)')).toBeInTheDocument();
    rerender(<SimpleAssetCard asset={{ ...base, source: 'simpleassets', mintNumber: 1524, mintSurviving: 1281, mintBurned: 246 }} freshMint onClick={() => {}} />);
    expect(screen.getByText('#1524')).toBeInTheDocument();
    expect(screen.queryByText('New Mint (Syncing)')).not.toBeInTheDocument();
  });

  it('records freshly collected ids and expires them after the TTL', () => {
    expect(isFreshMintId('100000004478015')).toBe(false);
    recordFreshMints(['100000004478015', '100000004478016']);
    expect(isFreshMintId('100000004478015')).toBe(true);
    expect(getFreshMintIds()).toContain('100000004478016');
    // Re-recording is idempotent and empty calls are ignored.
    recordFreshMints(['100000004478015']);
    recordFreshMints([]);
    expect(getFreshMintIds().length).toBe(2);
    // Simulate expiry: backdate the stored timestamp beyond the TTL.
    const raw = localStorage.getItem('gpk_fresh_mints_v1')!;
    const map = JSON.parse(raw) as Record<string, number>;
    map['100000004478015'] = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem('gpk_fresh_mints_v1', JSON.stringify(map));
    expect(isFreshMintId('100000004478015')).toBe(false);
    expect(isFreshMintId('100000004478016')).toBe(true);
  });
});
