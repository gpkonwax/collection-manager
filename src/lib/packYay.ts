import yaySfx from '@/assets/pack-reveal-complete.mp3';

// The yay sound is shared by two moments: the final card flipping over in the
// reveal window, and the last card landing in the grid at the end of the deal.
// It was originally played at full volume and was too loud, so both moments use
// this halved value — keep them in sync by importing it rather than hardcoding.
export const YAY_VOLUME = 0.5;

// The deal animation is unmounted by its parent the moment the deal finishes,
// so an element created inside it would be garbage collected mid-play. Holding
// it at module scope lets the sound play through, and a new opening replaces a
// yay that is still running.
let activeYayAudio: HTMLAudioElement | null = null;

export function playPackYay() {
  if (activeYayAudio) {
    activeYayAudio.pause();
    activeYayAudio.currentTime = 0;
  }
  const yay = new Audio(yaySfx);
  yay.volume = YAY_VOLUME;
  activeYayAudio = yay;
  yay.addEventListener('ended', () => {
    if (activeYayAudio === yay) activeYayAudio = null;
  });
  yay.play().catch(() => {});
}
