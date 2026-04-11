import { useRef, useCallback } from 'react';

const MAX_TILT = 12;
const PERSPECTIVE = 1200;

export function useCardTilt({ disabled = false }: { disabled?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);
  const active = useRef(false);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;
    const card = ref.current;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const rotateY = Math.round((x - 0.5) * MAX_TILT * 2 * 10) / 10;
      const rotateX = Math.round((0.5 - y) * MAX_TILT * 2 * 10) / 10;

      if (!active.current) {
        active.current = true;
        card.style.transition = 'none';
      }

      card.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
      card.style.backfaceVisibility = 'hidden';

      if (glareRef.current) {
        glareRef.current.style.opacity = '1';
        glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, hsla(0,0%,100%,0.10) 0%, transparent 50%)`;
      }
    });
  }, [disabled]);

  const onMouseLeave = useCallback(() => {
    if (!ref.current) return;
    cancelAnimationFrame(rafId.current);
    active.current = false;
    ref.current.style.transition = 'transform 0.3s ease';
    ref.current.style.transform = '';
    ref.current.style.backfaceVisibility = '';
    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
  }, []);

  return { ref, glareRef, onMouseMove, onMouseLeave };
}
