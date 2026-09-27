import { describe, it, expect } from 'vitest';
import { formatLastActive } from '../lib/activeWallets';

describe('formatLastActive', () => {
  it('formats minutes, hours, days, months', () => {
    const now = Date.now();
    expect(formatLastActive(now - 60_000)).toBe('1m ago');
    expect(formatLastActive(now - 5 * 60_000)).toBe('5m ago');
    expect(formatLastActive(now - 60 * 60_000)).toBe('1h ago');
    expect(formatLastActive(now - 3 * 60 * 60_000)).toBe('3h ago');
    expect(formatLastActive(now - 24 * 60 * 60_000)).toBe('1d ago');
    expect(formatLastActive(now - 10 * 24 * 60 * 60_000)).toBe('10d ago');
    expect(formatLastActive(now - 45 * 24 * 60 * 60_000)).toBe('1mo ago');
    expect(formatLastActive(now - 80 * 24 * 60 * 60_000)).toBe('2mo ago');
  });

  it('handles future timestamps', () => {
    expect(formatLastActive(Date.now() + 10_000)).toBe('just now');
  });
});
