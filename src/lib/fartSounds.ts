import bellSfx from '@/assets/card-bell.mp3';

export function playCardRevealSound() {
  const audio = new Audio(bellSfx);
  audio.play().catch(() => {});
}
