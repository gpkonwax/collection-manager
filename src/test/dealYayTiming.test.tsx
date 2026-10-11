import { act, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { CardDealAnimation, DEAL_YAY_DELAY_MS } from '@/components/simpleassets/CardDealAnimation';

// Records every sound the deal animation creates, tagged with the fake-clock
// time of its creation, so we can measure the gap between the final landing
// thud and the celebration.
interface LoggedAudio {
  src: string;
  t: number;
}

class FakeAudio {
  static log: LoggedAudio[] = [];
  src: string;
  volume = 1;
  currentTime = 0;

  constructor(src: string) {
    this.src = src;
    FakeAudio.log.push({ src, t: Date.now() });
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
  addEventListener() {}
}

// The card artwork inside the deal animation watches the viewport before
// loading; jsdom has no such observer, so give it one that simply never fires.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const realAudio = globalThis.Audio;
const realObserver = (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
const realRaf = globalThis.requestAnimationFrame;

// jsdom only runs animation frames when something drives them; route them
// through timers so the fake clock advances the deal animation's layout waits.
const rafStub = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number;

const CARD = { id: 'asset-1', name: 'Card One', category: 'series1' } as never;

// A grid cell sitting comfortably inside the viewport, so no scrolling is needed.
const cell = {
  getBoundingClientRect: () => ({
    top: 300,
    left: 100,
    width: 160,
    height: 224,
    right: 260,
    bottom: 524,
    x: 100,
    y: 300,
    toJSON: () => ({}),
  }),
  scrollIntoView: () => {},
} as unknown as HTMLElement;

function renderDeal() {
  const gridCellRefs = { current: new Map<string, HTMLElement | null>([['asset-1', cell]]) };
  return render(
    <CardDealAnimation
      cards={[CARD]}
      gridCellRefs={gridCellRefs as never}
      onCardDealt={() => {}}
      onComplete={() => {}}
    />,
  );
}

beforeEach(() => {
  FakeAudio.log = [];
  (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeIntersectionObserver;
  globalThis.requestAnimationFrame = rafStub;
});

afterEach(() => {
  (globalThis as unknown as { Audio: unknown }).Audio = realAudio;
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = realObserver;
  globalThis.requestAnimationFrame = realRaf;
});

describe('deal animation celebration', () => {
  it('plays the yay two seconds after the final card lands', async () => {
    vi.useFakeTimers();
    try {
      // React flushes queued work at await boundaries, so the clock has to move
      // in small steps: one big jump would leave the celebration timer unscheduled
      // until long after the card actually landed.
      await act(async () => {
        renderDeal();
      });
      for (let slice = 0; slice < 600; slice++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(20);
        });
      }
    } finally {
      vi.useRealTimers();
    }

    const lands = FakeAudio.log.filter(a => a.src.includes('card-land'));
    const yays = FakeAudio.log.filter(a => a.src.includes('pack-reveal-complete'));

    // The card is dealt with exactly one landing thud and celebrated exactly once.
    expect(lands).toHaveLength(1);
    expect(yays).toHaveLength(1);

    const gap = yays[0].t - lands[0].t;
    expect(gap).toBeGreaterThanOrEqual(DEAL_YAY_DELAY_MS);
    // Allow the slop of one 20 ms clock step plus React's flush at the boundary.
    expect(gap).toBeLessThan(DEAL_YAY_DELAY_MS + 100);
    expect(DEAL_YAY_DELAY_MS).toBe(2000);
  });
});
