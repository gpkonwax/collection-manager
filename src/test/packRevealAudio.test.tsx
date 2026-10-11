import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePackRevealAudio } from '@/hooks/usePackRevealAudio';

const audios: { play: ReturnType<typeof vi.fn>; volume: number }[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  audios.length = 0;
  vi.stubGlobal('Audio', class {
    currentTime = 0;
    volume = 1;
    play = vi.fn().mockResolvedValue(undefined);
    pause = vi.fn();
    constructor() { audios.push(this); }
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const initial = { open: true, phase: 'revealing', isShaking: false, revealedCount: 2, totalCards: 3 };
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('reveal celebration timing', () => {
  it('waits for the 600ms final flip plus one second, at half volume', () => {
    const { rerender } = renderHook(usePackRevealAudio, { initialProps: initial });
    advance(3000);
    expect(audios[2].play).not.toHaveBeenCalled();
    rerender({ ...initial, revealedCount: 3 });
    advance(1599);
    expect(audios[2].play).not.toHaveBeenCalled();
    advance(1);
    expect(audios[2].play).toHaveBeenCalledTimes(1);
    expect(audios[2].volume).toBe(0.5);
  });

  it('keeps the delay through collection and plays only once', () => {
    const { rerender } = renderHook(usePackRevealAudio, { initialProps: { ...initial, revealedCount: 3 } });
    advance(600);
    rerender({ ...initial, revealedCount: 3, phase: 'collect' });
    advance(1000);
    expect(audios[2].play).toHaveBeenCalledTimes(1);
    rerender({ ...initial, revealedCount: 3, phase: 'collecting' });
    advance(5000);
    expect(audios[2].play).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending celebration when the dialog closes', () => {
    const { rerender } = renderHook(usePackRevealAudio, { initialProps: { ...initial, revealedCount: 3 } });
    advance(600);
    rerender({ ...initial, revealedCount: 3, open: false });
    advance(2000);
    expect(audios[2].play).not.toHaveBeenCalled();
  });

  it('resets the delayed celebration for a new opening', () => {
    const { rerender } = renderHook(usePackRevealAudio, { initialProps: { ...initial, revealedCount: 3 } });
    advance(1600);
    rerender({ ...initial, open: false });
    rerender(initial);
    rerender({ ...initial, revealedCount: 3 });
    advance(1599);
    expect(audios[2].play).toHaveBeenCalledTimes(1);
    advance(1);
    expect(audios[2].play).toHaveBeenCalledTimes(2);
  });
});