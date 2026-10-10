import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { YAY_VOLUME, playPackYay } from '@/lib/packYay';

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  volume = 1;
  currentTime = 0;
  played = 0;
  paused = 0;
  ended: (() => void) | null = null;

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  play() {
    this.played++;
    return Promise.resolve();
  }
  pause() {
    this.paused++;
  }
  addEventListener(type: string, fn: () => void) {
    if (type === 'ended') this.ended = fn;
  }
}

const realAudio = globalThis.Audio;

beforeEach(() => {
  FakeAudio.instances = [];
  (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
});

afterEach(() => {
  (globalThis as unknown as { Audio: unknown }).Audio = realAudio;
});

describe('yay sound', () => {
  it('plays at half the original full volume', () => {
    expect(YAY_VOLUME).toBe(0.5);
  });

  it('plays the yay clip once at the halved volume', () => {
    playPackYay();
    expect(FakeAudio.instances).toHaveLength(1);
    const yay = FakeAudio.instances[0];
    expect(yay.src).toBeTruthy();
    expect(yay.volume).toBe(YAY_VOLUME);
    expect(yay.played).toBe(1);
  });

  it('stops a yay that is still running when a new one starts', () => {
    playPackYay();
    playPackYay();
    const first = FakeAudio.instances[0];
    expect(first.paused).toBe(1);
    expect(first.currentTime).toBe(0);
    expect(FakeAudio.instances[1].played).toBe(1);
  });
});
