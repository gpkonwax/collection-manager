import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const realAudio = globalThis.Audio;

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

const realObserver = (globalThis as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;

// jsdom only runs animation frames when something drives them; route them
// through timers so the fake clock advances the deal animation's layout waits.
const realRaf = globalThis.requestAnimationFrame;
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
      renderDeal();
      // Shuffle settle + sit + fly + land pause leaves well under 10s; the yay
      // lands two seconds after that, so 20s of fake time covers the whole run.
      await vi.advanceTimersByTimeAsync(20_000);
    } finally {
      vi.useRealTimers();
    }

    console.log('AUDIO_LOG', JSON.stringify(FakeAudio.log.map(a => ({src: String(a.src).slice(0,60), t: a.t}))));
    const lands = FakeAudio.log.filter(a => a.src.includes('card-land'));
    const yays = FakeAudio.log.filter(a => a.src.includes('pack-reveal-complete'));

    // The card must have been dealt (one landing thud) and celebrated exactly once.
    expect(lands).toHaveLength(1);
    expect(yays).toHaveLength(1);

    expect(yays[0].t - lands[0].t).toBe(DEAL_YAY_DELAY_MS);
    expect(DEAL_YAY_DELAY_MS).toBe(2000);
  });
});
