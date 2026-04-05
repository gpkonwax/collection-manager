import bellSfx from '@/assets/card-bell.mp3';

export function playRandomFart() {
  const audio = new Audio(bellSfx);
  audio.play().catch(() => {});
}
