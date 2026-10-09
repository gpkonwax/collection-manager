import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BridgeDialog } from '@/components/simpleassets/BridgeDialog';
import {
  getBridgeEligibility,
  BRIDGE_MIXED_REASON,
  BRIDGE_NATIVE_AA_REASON,
  BRIDGE_CAP_REASON,
} from '@/lib/bridgeActions';
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
const nativeAa = makeAsset({ id: '1099999999999', name: 'Native AA Card', source: 'atomicassets', idata: {} });

describe('getBridgeEligibility', () => {
  it('all SimpleAssets bridges to AtomicAssets', () => {
    expect(getBridgeEligibility([saCard]).direction).toBe('to-aa');
  });
  it('all bridged AtomicAssets bridges back to SimpleAssets', () => {
    expect(getBridgeEligibility([bridgedAa]).direction).toBe('to-sa');
  });
  it('mixed SA and AA selection is blocked', () => {
    expect(getBridgeEligibility([saCard, bridgedAa])).toEqual({ direction: null, reason: BRIDGE_MIXED_REASON });
  });
  it('native AtomicAssets cards are blocked', () => {
    expect(getBridgeEligibility([bridgedAa, nativeAa])).toEqual({ direction: null, reason: BRIDGE_NATIVE_AA_REASON });
  });
  it('more than 20 cards is blocked', () => {
    const many = Array.from({ length: 21 }, (_, i) => makeAsset({ id: String(i + 1) }));
    expect(getBridgeEligibility(many)).toEqual({ direction: null, reason: BRIDGE_CAP_REASON });
    expect(getBridgeEligibility(many.slice(0, 20)).direction).toBe('to-aa');
  });
});

describe('BridgeDialog', () => {
  it('shows the selected cards and direction without any picker', () => {
    render(<BridgeDialog open onOpenChange={() => {}} selectedAssets={[bridgedAa]} onSuccess={() => {}} />);
    expect(screen.getByText('Bridged AA Card')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bridge 1 card to SimpleAssets/ })).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
  });
});
