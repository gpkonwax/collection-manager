import { useEffect, useRef } from 'react';
import packShakeSrc from '@/assets/pack-shake.mp3';
import packTearSrc from '@/assets/pack-tear.mp3';
import packCompleteSrc from '@/assets/pack-reveal-complete.mp3';
import { YAY_VOLUME } from '@/lib/packYay';

interface UsePackRevealAudioOptions {
  open: boolean;
  phase: string;
  isShaking: boolean;
  revealedCount: number;
  totalCards: number;
}

function stopAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

export function usePackRevealAudio({ open, phase, isShaking, revealedCount, totalCards }: UsePackRevealAudioOptions) {
  const shakeAudioRef = useRef<HTMLAudioElement | null>(null);
  const tearAudioRef = useRef<HTMLAudioElement | null>(null);
  const completeAudioRef = useRef<HTMLAudioElement | null>(null);
  const tearPlayedRef = useRef(false);
  const completePlayedRef = useRef(false);
  const hasStartedShakingRef = useRef(false);

  useEffect(() => {
    const shakeAudio = new Audio(packShakeSrc);
    shakeAudio.preload = 'auto';
    shakeAudioRef.current = shakeAudio;

    const tearAudio = new Audio(packTearSrc);
    tearAudio.preload = 'auto';
    tearAudio.loop = false;
    tearAudioRef.current = tearAudio;

    const completeAudio = new Audio(packCompleteSrc);
    completeAudio.preload = 'auto';
    completeAudio.volume = YAY_VOLUME;
    completeAudioRef.current = completeAudio;

    return () => {
      stopAudio(shakeAudioRef.current);
      stopAudio(tearAudioRef.current);
      stopAudio(completeAudioRef.current);
      shakeAudioRef.current = null;
      tearAudioRef.current = null;
      completeAudioRef.current = null;
    };
  }, []);

  // Reset per-open flags when dialog opens/closes
  useEffect(() => {
    if (!open) {
      stopAudio(shakeAudioRef.current);
      stopAudio(tearAudioRef.current);
      stopAudio(completeAudioRef.current);
      tearPlayedRef.current = false;
      completePlayedRef.current = false;
      hasStartedShakingRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    const shakeAudio = shakeAudioRef.current;
    if (!shakeAudio) return;

    if (open && phase === 'waiting' && isShaking) {
      hasStartedShakingRef.current = true;
      shakeAudio.currentTime = 0;
      shakeAudio.play().catch(() => {});
      return () => stopAudio(shakeAudio);
    }

    stopAudio(shakeAudio);
  }, [open, phase, isShaking]);

  useEffect(() => {
    const tearAudio = tearAudioRef.current;
    if (!tearAudio) return;

    // Only play tear once per dialog open
    if (tearPlayedRef.current) return;

    const shouldPlayTear = open && hasStartedShakingRef.current && !isShaking && (phase === 'waiting' || (phase === 'revealing' && revealedCount === 0));

    if (shouldPlayTear) {
      tearPlayedRef.current = true;
      tearAudio.currentTime = 0;
      tearAudio.play().catch(() => {});
    }
  }, [open, phase, isShaking, revealedCount]);

  // Play the celebration sound once per opening, when the final card is revealed.
  useEffect(() => {
    const completeAudio = completeAudioRef.current;
    if (!completeAudio) return;
    if (completePlayedRef.current) return;

    const allRevealed = open && phase === 'revealing' && totalCards > 0 && revealedCount >= totalCards;
    if (allRevealed) {
      completePlayedRef.current = true;
      completeAudio.currentTime = 0;
      completeAudio.play().catch(() => {});
    }
  }, [open, phase, revealedCount, totalCards]);
}
