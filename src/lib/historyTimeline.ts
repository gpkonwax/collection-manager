import type { SaEvent, SaEventKind } from './saHistory';

/** Market chatter hidden by default; everything else changes hands or status. */
export const MARKET_ONLY_KINDS: ReadonlySet<SaEventKind> = new Set(['list', 'cancel', 'refund', 'reprice', 'offer', 'unoffer']);

/** Pure: oldest-first events for the left-to-right timeline. */
export function timelineEvents(events: SaEvent[], showAll: boolean): SaEvent[] {
  const sorted = [...events].sort((a, b) => a.time - b.time);
  return showAll ? sorted : sorted.filter((e) => !MARKET_ONLY_KINDS.has(e.kind));
}
