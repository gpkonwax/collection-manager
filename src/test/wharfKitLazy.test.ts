import { describe, it, expect, beforeEach } from 'vitest';
import { hasStoredWharfSession } from '@/lib/wharfKit';

describe('wallet kit start-up loading', () => {
  beforeEach(() => localStorage.clear());

  it('skips loading for a visitor with no saved wallet session', () => {
    expect(hasStoredWharfSession()).toBe(false);
  });

  it('loads when a single saved session exists', () => {
    localStorage.setItem('wharf--session', '{}');
    expect(hasStoredWharfSession()).toBe(true);
  });

  it('loads when only the saved accounts list exists', () => {
    localStorage.setItem('wharf--sessions', '[]');
    expect(hasStoredWharfSession()).toBe(true);
  });
});
