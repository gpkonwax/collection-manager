import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PackArtworkDialog } from '@/components/simpleassets/PackArtworkDialog';
import { GpkPackCard } from '@/components/simpleassets/GpkPackCard';
import { AtomicPackCard } from '@/components/simpleassets/AtomicPackCard';

vi.mock('@/components/simpleassets/IpfsMedia', () => ({ IpfsMedia: ({ url, alt }: { url: string; alt: string }) => <img src={url} alt={alt} /> }));
vi.mock('@/hooks/useWaxTransaction', () => ({ useWaxTransaction: () => ({ executeTransaction: vi.fn() }) }));
vi.mock('@/components/simpleassets/PackRevealDialog', () => ({ PackRevealDialog: () => null }));
vi.mock('@/components/simpleassets/AtomicPackRevealDialog', () => ({ AtomicPackRevealDialog: () => null }));
vi.mock('@/components/simpleassets/PackBrowserDialog', () => ({ PackBrowserDialog: () => null }));
vi.mock('@/components/simpleassets/AtomicPackBrowserDialog', () => ({ AtomicPackBrowserDialog: () => null }));
vi.mock('@/components/simpleassets/PackInfoPopover', () => ({ PackInfoPopover: ({ children }: { children: React.ReactNode }) => children }));

// Canvas API and ResizeObserver are supplied by browsers, not jsdom.
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });

const atomicPack = {
  templateId: '13778', name: 'Crash Gordon Pack', image: '/test-pack.png', description: '', count: 0,
  assetIds: [], mints: [], unpackContract: 'gpkcrashpack', cardsPerPack: 5, openMode: 'transfer' as const,
  packConfig: { contract: 'gpkcrashpack', cards: 5, openMode: 'transfer' as const },
};

describe('pack artwork viewer', () => {
  it('opens local SimpleAssets artwork from its image, leaving Open Pack separate', () => {
    render(<GpkPackCard pack={{ symbol: 'GPKFIVE', label: 'GPK Series 1 Pack', amount: 1, precision: 0 }} session={null} accountName="test.wam" />);
    fireEvent.click(screen.getByRole('button', { name: /enlarge gpk series 1 pack artwork/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('GPK Series 1 Pack');
    expect(screen.getByRole('button', { name: '3D tilt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Pack', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent('Official Topps pack render');
    expect(screen.getByRole('dialog')).toHaveTextContent('Qmb8aENU2CemXz4daoW26eqFviSuYvV2NiA296GzDaKKs3/standard.jpg');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('IPFS (on-chain pack image reference)');
  });

  it('opens AtomicAssets artwork even when the pack is unowned', () => {
    render(<AtomicPackCard pack={atomicPack} session={null} accountName="test.wam" />);
    fireEvent.click(screen.getByRole('button', { name: /enlarge crash gordon pack artwork/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Crash Gordon Pack');
    expect(screen.getByRole('dialog')).toHaveTextContent('Template #13778');
    expect(screen.getByRole('dialog')).toHaveTextContent('Artwork source');
  });

  it('shows the original IPFS path and the available pack metadata rather than a gateway URL', () => {
    render(<PackArtworkDialog open name="Atomic pack" image="https://ipfs.io/ipfs/QmABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr/pack.png"
      source="atomicassets" templateId="123" imageReference="QmABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr/pack.png"
      immutableData={{ name: 'Atomic pack', img: 'QmABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr/pack.png' }} mutableData={{ rarity: 'Rare' }} onOpenChange={() => {}} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('IPFS (on-chain pack image reference)');
    expect(screen.getByLabelText('IPFS image path')).toHaveTextContent('QmABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqr/pack.png');
    fireEvent.click(screen.getByRole('button', { name: 'Show Raw JSON' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('immutable_data');
    expect(screen.getByRole('dialog')).toHaveTextContent('Rare');
  });

  it('offers magnifier and drawing and resets to tilt on reopening', () => {
    const { rerender } = render(<PackArtworkDialog open name="Test Pack" image="/test-pack.png" onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Magnifier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Draw on pack' }));
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    rerender(<PackArtworkDialog open={false} name="Test Pack" image="/test-pack.png" onOpenChange={() => {}} />);
    rerender(<PackArtworkDialog open name="Test Pack" image="/test-pack.png" onOpenChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3D tilt' })).toBeInTheDocument();
  });

  it('offers hybrid handwriting with six styles and typed fallback', () => {
    render(<PackArtworkDialog open name="Test Pack" image="/test-pack.png" onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw on pack' }));
    expect(screen.queryByRole('button', { name: 'Type text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rewrite scribble/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Handwriting replacement' }));
    expect(screen.queryByRole('button', { name: /Rewrite scribble/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Type text' }));
    expect(screen.getByLabelText('Handwriting text')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Handwriting style'));
    expect(screen.getByRole('option', { name: 'Cursive' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Neat print' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pencil' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Marker' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Childlike' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Messy scrawl' })).toBeInTheDocument();
  });
});

