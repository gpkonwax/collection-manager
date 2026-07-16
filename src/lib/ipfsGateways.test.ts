import { describe, it, expect } from 'vitest';
import {
  IPFS_GATEWAYS,
  PUBLIC_IPFS_GATEWAYS,
  PRIMARY_MIRROR,
  RACE_GATEWAY_COUNT,
  getPublicGatewayCount,
  extractIpfsHash,
} from './ipfsGateways';

describe('ipfsGateways rotation list', () => {
  it('appends the primary mirror after every public gateway', () => {
    const list = Array.from(IPFS_GATEWAYS);
    for (const gw of PUBLIC_IPFS_GATEWAYS) expect(list).toContain(gw);
    const idx = list.indexOf(PRIMARY_MIRROR);
    expect(idx).toBeGreaterThanOrEqual(PUBLIC_IPFS_GATEWAYS.length);
  });

  it('only contains public gateways plus the primary mirror by default', () => {
    expect(IPFS_GATEWAYS.length).toBe(PUBLIC_IPFS_GATEWAYS.length + 1);
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
