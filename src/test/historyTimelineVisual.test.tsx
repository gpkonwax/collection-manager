import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { render, within } from '@testing-library/react';
import { HistoryTimeline } from '@/components/simpleassets/TradeHistorySection';
import type { TimelineEvent } from '@/lib/historyTimeline';
import { PACK_IMAGES } from '@/lib/gpkPackMeta';

// jsdom has no layout: force the 1036px detail-modal row width so the snake
// fits five cards per row and seven events wrap into a right-to-left row.
const realWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { value: 1036, configurable: true });
  (globalThis as Record<string, unknown>).ResizeObserver = RO;
});
afterAll(() => {
  if (realWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', realWidth);
});

const ev = (i: number, kind: TimelineEvent['kind'] = 'transfer'): TimelineEvent => ({
  chain: i % 2 ? 'sa' : 'aa',
  txid: `tx${i}`,
  kind,
  time: Date.UTC(2021, 0, i + 1),
  from: `from${i}.wam`,
  to: `to${i}.wam`,
} as TimelineEvent);

function renderSnake() {
  return render(
    <HistoryTimeline
      events={Array.from({ length: 7 }, (_, i) => ev(i))}
      opener="opener.wam"
      owner="owner.wamxx"
      packSymbol="GPKFIVE"
    />,
  );
}

describe('snake timeline visuals', () => {
  it('mirrors account info and arrows on right-to-left rows', () => {
    const { container } = renderSnake();
    const lists = container.querySelectorAll('ol');
    expect(lists.length).toBe(2);
    const rtlRow = lists[1];
    expect(rtlRow.className).toContain('flex-row-reverse');
    // Account lines inside the RTL row read to ← from with a leftward arrow.
    const accountLines = rtlRow.querySelectorAll('p.font-mono');
    expect(accountLines.length).toBeGreaterThan(0);
    accountLines.forEach((p) => {
      expect(p.className).toContain('flex-row-reverse');
      expect(p.textContent).toContain('←');
      expect(p.textContent).not.toContain('→');
    });
  });

  it('highlights the connector arrows in cheese', () => {
    const { container } = renderSnake();
    const arrows = [...container.querySelectorAll('li[aria-hidden], div[aria-hidden] span')];
    expect(arrows.length).toBeGreaterThan(0);
    arrows.forEach((a) => expect(a.className).toContain('text-cheese'));
  });

  it('uses the round SimpleAssets and AtomicAssets logos instead of text tags', () => {
    const { container } = renderSnake();
    const sa = container.querySelectorAll('img[alt="SimpleAssets"]');
    const aa = container.querySelectorAll('img[alt="AtomicAssets"]');
    expect(sa.length).toBeGreaterThan(0);
    expect(aa.length).toBeGreaterThan(0);
    [...sa, ...aa].forEach((img) => expect(img.className).toContain('rounded-full'));
    expect(within(container).queryByText('SA')).toBeNull();
    expect(within(container).queryByText('AA')).toBeNull();
  });

  it('shows the ripped pack thumbnail on the Pack opened card', () => {
    const { container } = renderSnake();
    const img = container.querySelector('img[alt="Pack this card was pulled from"]') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toContain(PACK_IMAGES.GPKFIVE.split('/').pop()!);
    expect(img.style.clipPath).toContain('polygon');
  });
});
