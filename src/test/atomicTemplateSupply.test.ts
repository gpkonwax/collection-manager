import { describe, it, expect } from 'vitest';
import { parseAtomicTemplateSupply } from '@/lib/atomicTemplateSupply';

describe('native AtomicAssets supply', () => {
  it('subtracts burned copies from total minted, not from the mint number', () => {
    expect(parseAtomicTemplateSupply({ assets: '100', burned: '17' })).toEqual({ minted: 100, burned: 17, circulating: 83 });
  });
  it('retains a verified zero burned count', () => {
    expect(parseAtomicTemplateSupply({ assets: '3', burned: '0' })).toEqual({ minted: 3, burned: 0, circulating: 3 });
  });
  it('never invents zero burns for missing or inconsistent data', () => {
    expect(() => parseAtomicTemplateSupply({ assets: '100' })).toThrow();
    expect(() => parseAtomicTemplateSupply({ assets: '10', burned: '11' })).toThrow();
  });
});