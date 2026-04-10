import { useRef, useCallback } from 'react';

const MAX_TILT = 15;

export function useCardTilt({ disabled = false }: { disabled?: boolean } = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number>(0);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;
    const card = ref.current;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const rotateY = (x - 0.5) * MAX_TILT * 2;
      const rotateX = (0.5 - y) * MAX_TILT * 2;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
      if (glareRef.current) {
        glareRef.current.style.opacity = '1';
        glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, hsla(0,0%,100%,0.12) 0%, transparent 50%)`;
      }
    });
  }, [disabled]);

  const onMouseLeave = useCallback(() => {
    if (!ref.current) return;
    cancelAnimationFrame(rafId.current);
    ref.current.style.transform = '';
    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }
  }, []);

  return { ref, glareRef, onMouseMove, onMouseLeave };
}
