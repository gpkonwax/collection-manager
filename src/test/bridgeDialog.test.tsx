import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BridgeDialog } from '@/components/simpleassets/BridgeDialog';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

vi.mock('@/components/simpleassets/IpfsMedia', () => ({
  IpfsMedia: ({ url, alt }: { url: string; alt: string }) => <img src={url} alt={alt} />,
}));
vi.mock('@/context/WaxContext', () => ({
  useWax: () => ({ session: null }),
}));

function makeAsset(overrides: Partial<SimpleAsset>): SimpleAsset {
  return {
    id: '1', owner: 'abc12.wam', author: 'gpk.topps', category: 'series1',
    name: 'Card', image: '/placeholder.svg', images: ['/placeholder.svg'],
    cardid: '1', quality: 'Base', side: 'a',
    idata: {}, mdata: {}, container: [], containerf: [],
    source: 'simpleassets',
    ...overrides,
  };
}

const saCard = makeAsset({ id: '100000006630365', name: 'SA Card' });
const bridgedAa = makeAsset({
  id: '1099525011388', name: 'Bridged AA Card', source: 'atomicassets',
  idata: { sassets_id: '100000006630365' },
});
const nativeAa = makeAsset({
  id: '1099999999999', name: 'Native AA Card', source: 'atomicassets',
  idata: {},
});

function renderDialog(assets: SimpleAsset[]) {
  return render(
    <BridgeDialog open onOpenChange={() => {}} assets={assets} onSuccess={() => {}} />,
  );
}

describe('BridgeDialog', () => {
  it('lists SimpleAssets cards on the To AtomicAssets tab', () => {
    renderDialog([saCard, bridgedAa, nativeAa]);
    expect(screen.getByText('SA Card')).toBeTruthy();
    expect(screen.queryByText('Bridged AA Card')).toBeNull();
    expect(screen.queryByText('Native AA Card')).toBeNull();
  });

  it('lists only bridged AtomicAssets cards on the To SimpleAssets tab', () => {
    renderDialog([saCard, bridgedAa, nativeAa]);
    fireEvent.click(screen.getByRole('tab', { name: /To SimpleAssets/ }));
    expect(screen.getByText('Bridged AA Card')).toBeTruthy();
    expect(screen.queryByText('SA Card')).toBeNull();
    // Native AtomicAssets cards were never bridged from SA, so they cannot go back.
    expect(screen.queryByText('Native AA Card')).toBeNull();
  });

  it('keeps the bridge button disabled until a card is selected', () => {
    renderDialog([saCard]);
    const button = screen.getByRole('button', { name: /Bridge 0 cards/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('SA Card'));
    const armed = screen.getByRole('button', { name: /Bridge 1 card to AtomicAssets/ });
    expect((armed as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows tab counts for each direction', () => {
    renderDialog([saCard, bridgedAa, nativeAa]);
    expect(screen.getByRole('tab', { name: 'To AtomicAssets (1)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'To SimpleAssets (1)' })).toBeTruthy();
  });
});
