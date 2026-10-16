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
    // from → to lines inside the RTL row read to ← from with a leftward arrow
    // (single-account cards like "Current owner" are just right-aligned).
    const accountLines = [...rtlRow.querySelectorAll('p.font-mono')].filter((p) => /[→←]/.test(p.textContent ?? ''));
    expect(accountLines.length).toBeGreaterThan(0);
    accountLines.forEach((p) => {
      expect(p.className).toContain('flex-row-reverse');
      expect(p.textContent).toContain('←');
      expect(p.textContent).not.toContain('→');
    });
  });

  it('highlights the connector arrows in cheese', () => {
    const { container } = renderSnake();
    const arrows = [...container.querySelectorAll('li[aria-hidden]')];
    const downGap = container.querySelector('div[aria-hidden]');
    expect(arrows.length).toBeGreaterThan(0);
    arrows.forEach((a) => expect(a.className).toContain('text-cheese'));
    // the down arrows inherit their colour from the shared gap container
    expect(downGap?.className).toContain('text-cheese');
  });

  it('spaces the two down arrows evenly in the gap between rows', () => {
    const { container } = renderSnake();
    // 9 milestones (opener + 7 events + owner) at 5 per row → 2 rows → 1 row gap.
    const gaps = [...container.querySelectorAll('div[aria-hidden]')];
    expect(gaps.length).toBe(1);
    const [gap] = gaps;
    expect(gap.textContent).toBe('↓↓');
    expect(gap.querySelectorAll(':scope > span').length).toBe(2);
    expect(gap.className).toContain('justify-evenly');
  });

  it('keeps the single small arrow on turns with no tall card leaving a gap', () => {
    // 12 events + opener + owner = 14 milestones → 3 rows; the turn after the
    // uniform middle row (no torn pack on it) must show one plain ↓ again.
    const { container } = render(
      <HistoryTimeline events={Array.from({ length: 12 }, (_, i) => ev(i))} opener="opener.wam" owner="owner.wamxx" packSymbol="GPKFIVE" />,
    );
    const gaps = [...container.querySelectorAll('div[aria-hidden]')];
    expect(gaps.length).toBe(2);
    expect(gaps[0].textContent).toBe('↓↓');
    expect(gaps[0].className).toContain('justify-evenly');
    expect(gaps[1].textContent).toBe('↓');
    expect(gaps[1].className).not.toContain('justify-evenly');
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
