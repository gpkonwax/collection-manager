import { describe, it, expect } from 'vitest';
import { formatSaMint } from '../saMintResolver';

describe('formatSaMint', () => {
  it('shows fraction for normal data (real series1 Green Jean)', () => {
    expect(formatSaMint('284', '425')).toBe('#284 / 425');
  });
  it('shows fraction for real series1 Drippy Dan', () => {
    expect(formatSaMint('518', '781')).toBe('#518 / 781');
  });
  it('drops nonsense denominator when mint > total (real series2 row)', () => {
    expect(formatSaMint('1427', '1335')).toBe('#1427');
  });
  it('returns null when unresolved so UI falls back to #--', () => {
    expect(formatSaMint(undefined, undefined)).toBeNull();
    expect(formatSaMint('', '425')).toBeNull();
    expect(formatSaMint(null, '425')).toBeNull();
  });
  it('shows mint alone when total missing', () => {
    expect(formatSaMint('153', undefined)).toBe('#153');
  });
  it('allows mint === total', () => {
    expect(formatSaMint('218', '218')).toBe('#218 / 218');
  });
  it('handles zero/garbage total', () => {
    expect(formatSaMint('5', '0')).toBe('#5');
    expect(formatSaMint('5', 'abc')).toBe('#5');
  });
});
