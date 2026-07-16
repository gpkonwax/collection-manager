import { describe, it, expect, beforeEach } from 'vitest';
import {
  IPFS_GATEWAYS,
  PUBLIC_IPFS_GATEWAYS,
  TRUSTED_MIRRORS,
  RACE_GATEWAY_COUNT,
  getCommunityMirrorUrl,
  setCommunityMirrorUrl,
  getPublicGatewayCount,
  extractIpfsHash,
} from './ipfsGateways';

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

describe('ipfsGateways rotation list', () => {
  it('appends trusted mirrors after every public gateway', () => {
    const list = Array.from(IPFS_GATEWAYS);
    for (const gw of PUBLIC_IPFS_GATEWAYS) expect(list).toContain(gw);
    for (const m of TRUSTED_MIRRORS) {
      const idx = list.indexOf(m);
      expect(idx).toBeGreaterThanOrEqual(PUBLIC_IPFS_GATEWAYS.length);
    }
  });

  it('does not include the community URL until one is set', () => {
    expect(IPFS_GATEWAYS.length).toBe(PUBLIC_IPFS_GATEWAYS.length + TRUSTED_MIRRORS.length);
  });

  it('appends the community URL after trusted mirrors when set', () => {
    setCommunityMirrorUrl('https://alice.example.com/gpk');
    const list = Array.from(IPFS_GATEWAYS);
    expect(list[list.length - 1]).toBe('https://alice.example.com/gpk/');
    expect(list.length).toBe(PUBLIC_IPFS_GATEWAYS.length + TRUSTED_MIRRORS.length + 1);
  });

  it('rejects non-https community URLs', () => {
    setCommunityMirrorUrl('http://evil.example.com/');
    expect(getCommunityMirrorUrl()).toBeNull();
    expect(Array.from(IPFS_GATEWAYS).length).toBe(PUBLIC_IPFS_GATEWAYS.length + TRUSTED_MIRRORS.length);
  });

  it('race count is capped at the number of public gateways so mirrors are never raced', () => {
    expect(RACE_GATEWAY_COUNT).toBeLessThanOrEqual(getPublicGatewayCount());
  });
});

describe('extractIpfsHash', () => {
  it('captures the path tail alongside the CID', () => {
    expect(extractIpfsHash('ipfs://Qm123abc/foo/bar.jpg')).toBe('Qm123abc');
    expect(
      extractIpfsHash('https://gateway.pinata.cloud/ipfs/QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/prism/42a.gif')
    ).toBe('QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/prism/42a.gif');
  });
});
