import { useEffect, useRef } from 'react';
import packShakeSrc from '@/assets/pack-shake.mp3';
import packTearSrc from '@/assets/pack-tear.mp3';

interface UsePackRevealAudioOptions {
  open: boolean;
  phase: string;
  isShaking: boolean;
  revealedCount: number;
}

function stopAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

export function usePackRevealAudio({ open, phase, isShaking, revealedCount }: UsePackRevealAudioOptions) {
  const shakeAudioRef = useRef<HTMLAudioElement | null>(null);
  const tearAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const shakeAudio = new Audio(packShakeSrc);
    shakeAudio.preload = 'auto';
    shakeAudioRef.current = shakeAudio;

    const tearAudio = new Audio(packTearSrc);
    tearAudio.preload = 'auto';
    tearAudio.loop = false;
    tearAudioRef.current = tearAudio;

    return () => {
      stopAudio(shakeAudioRef.current);
      stopAudio(tearAudioRef.current);
      shakeAudioRef.current = null;
      tearAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      stopAudio(shakeAudioRef.current);
      stopAudio(tearAudioRef.current);
    }
  }, [open]);

  useEffect(() => {
    const shakeAudio = shakeAudioRef.current;
    if (!shakeAudio) return;

    if (open && phase === 'waiting' && isShaking) {
      shakeAudio.currentTime = 0;
      shakeAudio.play().catch(() => {});
      return () => stopAudio(shakeAudio);
    }

    stopAudio(shakeAudio);
  }, [open, phase, isShaking]);

  useEffect(() => {
    const tearAudio = tearAudioRef.current;
    if (!tearAudio) return;

    const shouldPlayTear = open && !isShaking && (phase === 'waiting' || (phase === 'revealing' && revealedCount === 0));

    if (shouldPlayTear) {
      if (tearAudio.paused) {
        tearAudio.currentTime = 0;
        tearAudio.play().catch(() => {});
      }
      return () => stopAudio(tearAudio);
    }

    stopAudio(tearAudio);
  }, [open, phase, isShaking, revealedCount]);
}
