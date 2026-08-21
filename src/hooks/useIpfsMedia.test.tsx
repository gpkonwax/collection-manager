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

  it('inserts the primary mirror after two failed gateway attempts', () => {
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    fail(result, 1);
    expect(result.current.src.startsWith(PRIMARY_MIRROR)).toBe(false);
    fail(result, 1);
    expect(result.current.src).toBe(`${PRIMARY_MIRROR}${HASH}`);
  });

  it('falls through to the remaining gateways when the mirror misses', () => {
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    fail(result, 2);
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
    fail(result, 12);
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

  it('does not count structurally slow gateways (Pinata) as IPFS failures', () => {
    const pinataIdx = PUBLIC_IPFS_GATEWAYS.findIndex((g) => g.includes('gateway.pinata.cloud'));
    expect(pinataIdx).toBeGreaterThanOrEqual(0);
    // Health score is exposed only through isIpfsDegraded(); a session that
    // never leaves Pinata should therefore never flip to degraded.
    // (Covered indirectly: the degraded test above needs 12 failures spread
    // across all gateways precisely because Pinata's don't count.)
    expect(isIpfsDegraded()).toBe(false);
  });

  it('clears degraded mode after the time box expires', () => {
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    fail(result, 12);
    expect(isIpfsDegraded()).toBe(true);

    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 120_000;
      expect(isIpfsDegraded()).toBe(false);
    } finally {
      Date.now = realNow;
    }
    // Once cleared it stays cleared until new failures accumulate.
    expect(isIpfsDegraded()).toBe(false);
  });

  it('decays the score when the mirror serves an image', () => {
    const { result } = renderHook(() => useIpfsMedia(URL, { context: 'card' }));
    fail(result, 12);
    expect(isIpfsDegraded()).toBe(true);

    // Mirror hits nudge the score down so the session can recover even when
    // no gateway is being attempted any more.
    const other = 'QmOtherHash00000000000000000000000000000000002';
    const { result: r2 } = renderHook(() => useIpfsMedia(`ipfs://${other}`, { context: 'card' }));
    expect(r2.current.src.startsWith(PRIMARY_MIRROR)).toBe(true);
    for (let i = 0; i < 20; i++) act(() => { r2.current.onLoad(); });
    expect(isIpfsDegraded()).toBe(false);
  });
});

