import { describe, it, expect } from 'vitest';
import { timelineEvents } from '@/lib/historyTimeline';
import type { SaEvent } from '@/lib/saHistory';

const ev = (time: number, kind: SaEvent['kind']): SaEvent => ({ time, kind, from: 'a', to: 'b', amount: '', token: '', market: '', txid: '' });

describe('history timeline', () => {
  const events = [ev(3, 'sale'), ev(1, 'list'), ev(2, 'cancel'), ev(4, 'transfer'), ev(5, 'offer'), ev(6, 'claim'), ev(7, 'bridge')];
  it('defaults to ownership milestones, oldest first', () => {
    expect(timelineEvents(events, false).map((e) => e.kind)).toEqual(['sale', 'transfer', 'claim', 'bridge']);
  });
  it('shows listings and cancellations when toggled', () => {
    expect(timelineEvents(events, true).map((e) => e.time)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
