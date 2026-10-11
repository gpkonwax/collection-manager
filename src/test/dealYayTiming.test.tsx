import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
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

const probes: string[] = [];

const CARD = { id: 'asset-1', name: 'Card One', category: 'series1' } as never;

// A grid cell sitting comfortably inside the viewport, so no scrolling is needed.
const cell = {
  getBoundingClientRect: () => {
    probes.push('rect');
    return {
      top: 300,
      left: 100,
      width: 160,
      height: 224,
      right: 260,
      bottom: 524,
      x: 100,
      y: 300,
      toJSON: () => ({}),
    };
  },
  scrollIntoView: () => {
    probes.push('scrollIntoView');
  },
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
  probes.length = 0;
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
      // React schedules its work through the scheduler queue, so give it a
      // chance to flush after every slice of the fake clock rather than
      // jumping 20 seconds in one go.
      await act(async () => {
        renderDeal();
      });
      for (let slice = 0; slice < 40; slice++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });
      }
    } finally {
      vi.useRealTimers();
    }

    console.log('PROBES', probes.length, JSON.stringify(probes.slice(0, 10)));
    console.log('AUDIO_LOG', JSON.stringify(FakeAudio.log.map(a => ({ src: String(a.src).slice(0, 40), t: a.t }))));

    const lands = FakeAudio.log.filter(a => a.src.includes('card-land'));
    const yays = FakeAudio.log.filter(a => a.src.includes('pack-reveal-complete'));

    expect(lands).toHaveLength(1);
    expect(yays).toHaveLength(1);
    expect(yays[0].t - lands[0].t).toBe(DEAL_YAY_DELAY_MS);
    expect(DEAL_YAY_DELAY_MS).toBe(2000);
  });
});
