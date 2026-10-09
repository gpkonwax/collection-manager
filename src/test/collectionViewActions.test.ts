import { describe, expect, it } from 'vitest';
import { allowsCollectionSelection } from '@/lib/collectionViewActions';

describe('collection selection availability', () => {
  it('disallows selection and its transfer, burn and bridge actions in Collector Binder', () => {
    expect(allowsCollectionSelection('binder')).toBe(false);
  });

  it('preserves selection in Classic View and Saved Collection', () => {
    expect(allowsCollectionSelection('classic')).toBe(true);
    expect(allowsCollectionSelection('saved')).toBe(true);
  });
});