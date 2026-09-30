import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PackBrowserDialog } from '@/components/simpleassets/PackBrowserDialog';
import { AtomicPackBrowserDialog } from '@/components/simpleassets/AtomicPackBrowserDialog';

vi.mock('@/components/simpleassets/IpfsMedia', () => ({ IpfsMedia: ({ url, alt }: { url: string; alt: string }) => <img src={url} alt={alt} /> }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: vi.fn() }) }));
vi.mock('@/components/simpleassets/PackRevealDialog', () => ({ PackRevealDialog: () => null }));
vi.mock('@/components/simpleassets/AtomicPackRevealDialog', () => ({ AtomicPackRevealDialog: () => null }));

vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });

const atomicPack = {
  templateId: '13778', name: 'Crash Gordon Pack', image: '/test-pack.png', description: '', count: 2,
  assetIds: ['1', '2'], mints: [1, 2], unpackContract: 'gpkcrashpack', cardsPerPack: 5, openMode: 'transfer' as const,
  packConfig: { contract: 'gpkcrashpack', cards: 5, openMode: 'transfer' as const },
};

describe('multiple-pack artwork', () => {
  it('opens a SimpleAssets thumbnail without unboxing a pack', () => {
    render(<PackBrowserDialog open onOpenChange={() => {}} pack={{ symbol: 'GPKFIVE', label: 'GPK Series 1 Pack', amount: 2, precision: 0 }} packImage="/test-pack.png" session={null} accountName="test.wam" snapshotUnboxingIds={async () => new Set()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /enlarge gpk series 1 pack artwork/i })[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Magnifier' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open', hidden: true })).toHaveLength(2);
  });

  it('opens an AtomicAssets thumbnail without unboxing a pack', () => {
    render(<AtomicPackBrowserDialog open onOpenChange={() => {}} pack={atomicPack} session={null} accountName="test.wam" />);
    fireEvent.click(screen.getAllByRole('button', { name: /enlarge crash gordon pack artwork/i })[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Draw on pack' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Open', hidden: true })).toHaveLength(2);
  });
});
