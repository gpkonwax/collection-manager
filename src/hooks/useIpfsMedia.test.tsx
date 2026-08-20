import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useIpfsMedia,
  clearIpfsUrlCache,
  resetIpfsHealthState,
  isIpfsDegraded,
} from './useIpfsMedia';
import { PRIMARY_MIRROR, PUBLIC_IPFS_GATEWAYS } from '@/lib/ipfsGateways';

vi.mock('@/lib/thumbCache', () => ({
  peekThumb: () => null,
  getThumb: async () => null,
  putThumb: async () => {},
  isKnownThumbMiss: () => true,
}));

const HASH = 'QmTestHash000000000000000000000000000000000001';
const URL = `ipfs://${HASH}`;

function fail(result: { current: { onError: () => void } }, times: number) {
  for (let i = 0; i < times; i++) {
    act(() => { result.current.onError(); });
  }
}

describe('useIpfsMedia adaptive mirror fallback', () => {
  beforeEach(() => {
    clearIpfsUrlCache();
    resetIpfsHealthState();
  });

  it('starts on a public gateway for card context', () => {
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    expect(result.current.src.startsWith(PUBLIC_IPFS_GATEWAYS[0])).toBe(true);
  });

  it('inserts the primary mirror after the first failed gateway attempt', () => {
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    fail(result, 1);
    expect(result.current.src).toBe(`${PRIMARY_MIRROR}${HASH}`);
  });

  it('falls through to the remaining gateways when the mirror misses', () => {
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    fail(result, 1);
    expect(result.current.src).toBe(`${PRIMARY_MIRROR}${HASH}`);
    fail(result, 1); // mirror 404
    expect(result.current.src.startsWith(PRIMARY_MIRROR)).toBe(false);
    expect(result.current.src.includes(HASH)).toBe(true);
    // The mirror shortcut is not re-entered for this hash; the rotation
    // continues through the remaining public gateways.
    fail(result, 1);
    expect(result.current.src.startsWith(PRIMARY_MIRROR)).toBe(false);
    expect(
      PUBLIC_IPFS_GATEWAYS.some((gw) => result.current.src.startsWith(gw)),
    ).toBe(true);
  });

  it('marks IPFS degraded after enough gateway failures and decays on success', () => {
    expect(isIpfsDegraded()).toBe(false);
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    fail(result, 1);
    fail(result, 1); // leave mirror phase
    fail(result, 8); // keep burning gateways
    expect(isIpfsDegraded()).toBe(true);

    // A fresh hash mounts straight into the mirror while degraded.
    const other = 'QmOtherHash00000000000000000000000000000000002';
    const { result: r2 } = renderHook(() => useIpfsMedia(`ipfs://${other}`, { context: 'card' }));
    expect(r2.current.src).toBe(`${PRIMARY_MIRROR}${other}`);

    // Successful gateway loads decay the score back to healthy.
    const third = 'QmThirdHash00000000000000000000000000000000003';
    const { result: r3 } = renderHook(() => useIpfsMedia(`ipfs://${third}`, { context: 'card' }));
    for (let i = 0; i < 8; i++) act(() => { r3.current.onLoad(); });
    expect(isIpfsDegraded()).toBe(false);
  });
});
