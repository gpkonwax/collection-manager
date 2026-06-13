import { useState, useEffect, useCallback, useRef } from 'react';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import shuffleSfx from '@/assets/card-shuffle.mp3';
import landSfx from '@/assets/card-land.mp3';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface CardDealAnimationProps {
  cards: SimpleAsset[];
  gridCellRefs: React.MutableRefObject<Map<string, HTMLElement | null>>;
  onCardDealt: (id: string) => void;
  onComplete: () => void;
}

const STACK_Y = 60;
const SIT_DURATION = 1600;
const FLY_DURATION = 1100;
const LAND_PAUSE = 700;
const INITIAL_SHUFFLE_DELAY = 2200;
const FLY_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SCROLL_TIMEOUT = 1500;

// Wait for window scroll to settle. Uses `scrollend` when available; otherwise
// polls for stability. Resolves immediately if already at target (±2 px).
function waitForScrollEnd(targetY: number | null): Promise<void> {
  return new Promise<void>((resolve) => {
    if (targetY !== null && Math.abs(window.scrollY - targetY) < 2) {
      resolve();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('scrollend', finish);
      clearTimeout(timeout);
      clearInterval(poll);
      resolve();
    };

    const supportsScrollEnd = 'onscrollend' in window;
    if (supportsScrollEnd) {
      window.addEventListener('scrollend', finish, { once: true });
    }

    // Fallback stability polling (covers Safari + the "already done" case).
    let lastY = window.scrollY;
    let stable = 0;
    const poll = setInterval(() => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 1) stable++;
      else stable = 0;
      lastY = y;
      if (stable >= 4) finish(); // ~200ms stable
    }, 50);

    // Hard timeout — never wait longer than this.
    const timeout = setTimeout(finish, SCROLL_TIMEOUT);
  });
}

// Two RAFs ensure layout & paint have committed before reading rects.
function nextLayoutFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function CardDealAnimation({ cards, gridCellRefs, onCardDealt, onComplete }: CardDealAnimationProps) {
  const shuffleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const shuffleAudio = new Audio(shuffleSfx);
    shuffleAudioRef.current = shuffleAudio;
    shuffleAudio.play().catch(() => {});

    return () => {
      shuffleAudio.pause();
      shuffleAudio.currentTime = 0;
      shuffleAudioRef.current = null;
    };
  }, []);

  // Sort cards bottom-up based on actual grid cell positions.
  const [orderedCards, setOrderedCards] = useState<SimpleAsset[]>(cards);
  const orderedReadyRef = useRef(false);

  useEffect(() => {
    if (orderedReadyRef.current) return;
    const tryOrder = (attempt: number) => {
      const positions = cards.map(c => {
        const el = gridCellRefs.current.get(c.id);
        if (!el) return { card: c, y: -Infinity };
        const r = el.getBoundingClientRect();
        return { card: c, y: r.top + window.scrollY };
      });
      const measured = positions.filter(p => p.y !== -Infinity).length;
      if (measured < cards.length && attempt < 10) {
        setTimeout(() => tryOrder(attempt + 1), 100);
        return;
      }
      positions.sort((a, b) => b.y - a.y);
      setOrderedCards(positions.map(p => p.card));
      orderedReadyRef.current = true;
    };
    tryOrder(0);
  }, [cards, gridCellRefs]);

  const [dealIndex, setDealIndex] = useState(0);
  const [phase, setPhase] = useState<'sitting' | 'scrolling' | 'flying' | 'landed' | 'idle'>('idle');
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const [flyTarget, setFlyTarget] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const hasCompletedRef = useRef(false);
  const isFirstCardRef = useRef(true);

  // Soft scroll lock: block user wheel/touch/key scrolling ONLY during flight.
  useEffect(() => {
    const blockIfFlying = (e: Event) => {
      const p = phaseRef.current;
      if (p === 'flying' || p === 'landed') {
        e.preventDefault();
      }
    };
    const blockKeysIfFlying = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (p !== 'flying' && p !== 'landed') return;
      const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
      if (scrollKeys.includes(e.key)) e.preventDefault();
    };
    window.addEventListener('wheel', blockIfFlying, { passive: false });
    window.addEventListener('touchmove', blockIfFlying, { passive: false });
    window.addEventListener('keydown', blockKeysIfFlying);
    return () => {
      window.removeEventListener('wheel', blockIfFlying);
      window.removeEventListener('touchmove', blockIfFlying);
      window.removeEventListener('keydown', blockKeysIfFlying);
    };
  }, []);

  const handleSkip = useCallback(() => {
    if (shuffleAudioRef.current) {
      shuffleAudioRef.current.pause();
      shuffleAudioRef.current.currentTime = 0;
    }
    orderedCards.slice(dealIndex).forEach(c => onCardDealt(c.id));
    hasCompletedRef.current = true;
    onComplete();
  }, [orderedCards, dealIndex, onCardDealt, onComplete]);

  const getCardSize = useCallback(() => {
    for (const el of gridCellRefs.current.values()) {
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { width: rect.width, height: rect.height };
        }
      }
    }
    return { width: 160, height: 160 };
  }, [gridCellRefs]);

  const [cardSize, setCardSize] = useState({ width: 160, height: 160 });
  const cardSizeRef = useRef(cardSize);
  useEffect(() => { cardSizeRef.current = cardSize; }, [cardSize]);

  useEffect(() => {
    setCardSize(getCardSize());
  }, [getCardSize]);

  const stackX = typeof window !== 'undefined' ? window.innerWidth / 2 - cardSize.width / 2 : 0;

  // Returns scroll Y that centers the element in the viewport.
  const computeScrollTarget = useCallback((absoluteTop: number, height: number) => {
    const viewportH = window.innerHeight;
    const targetCenter = absoluteTop + height / 2;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportH);
    return Math.max(0, Math.min(maxScroll, targetCenter - viewportH / 2));
  }, []);

  // Drive the dealing state machine with async/await for clarity.
  useEffect(() => {
    if (dealIndex >= orderedCards.length) {
      if (!hasCompletedRef.current && orderedReadyRef.current) {
        hasCompletedRef.current = true;
        const t = setTimeout(onComplete, 400);
        return () => clearTimeout(t);
      }
      return;
    }

    let cancelled = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(t);
      return t;
    };

    const run = async () => {
      if (phase === 'idle') {
        // Refresh card size if it's still the fallback.
        if (cardSizeRef.current.width === 160 && cardSizeRef.current.height === 160) {
          const fresh = getCardSize();
          if (fresh.width !== 160 || fresh.height !== 160) setCardSize(fresh);
        }

        if (isFirstCardRef.current) {
          isFirstCardRef.current = false;
          const firstCard = orderedCards[0];
          const targetEl = firstCard ? gridCellRefs.current.get(firstCard.id) : null;
          if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const targetY = computeScrollTarget(rect.top + window.scrollY, rect.height);
            window.scrollTo({ top: targetY, behavior: 'smooth' });
            await waitForScrollEnd(targetY);
          }
          if (cancelled) return;
          schedule(() => setPhase('sitting'), INITIAL_SHUFFLE_DELAY);
        } else {
          setPhase('sitting');
        }
        return;
      }

      if (phase === 'sitting') {
        schedule(() => setPhase('scrolling'), SIT_DURATION);
        return;
      }

      if (phase === 'scrolling') {
        const card = orderedCards[dealIndex];

        const measure = () => {
          const el = gridCellRefs.current.get(card.id);
          if (!el) return null;
          return el.getBoundingClientRect();
        };

        let rect = measure();
        if (!rect) {
          // Brief retry — cell may not be mounted yet.
          await new Promise(r => setTimeout(r, 120));
          if (cancelled) return;
          rect = measure();
        }
        if (!rect) {
          onCardDealt(card.id);
          setDealIndex(i => i + 1);
          setPhase('idle');
          return;
        }

        const viewportH = window.innerHeight;
        const cardCenter = rect.top + rect.height / 2;
        const margin = viewportH * 0.25;
        const needsScroll = cardCenter < margin || cardCenter > viewportH - margin;

        if (needsScroll) {
          const targetY = computeScrollTarget(rect.top + window.scrollY, rect.height);
          window.scrollTo({ top: targetY, behavior: 'smooth' });
          await waitForScrollEnd(targetY);
          if (cancelled) return;
        }

        // Wait for layout to commit, then re-measure.
        await nextLayoutFrame();
        if (cancelled) return;

        let freshRect = measure();
        if (freshRect) {
          const freshCenter = freshRect.top + freshRect.height / 2;
          const stillOff = freshCenter < 0 || freshCenter > viewportH;
          if (stillOff) {
            const el = gridCellRefs.current.get(card.id);
            if (el) {
              el.scrollIntoView({ block: 'center', behavior: 'smooth' });
              await waitForScrollEnd(null);
              if (cancelled) return;
              await nextLayoutFrame();
              if (cancelled) return;
              freshRect = measure();
            }
          }
        }

        if (!freshRect) {
          onCardDealt(card.id);
          setDealIndex(i => i + 1);
          setPhase('idle');
          return;
        }

        setFlyTarget({ left: freshRect.left, top: freshRect.top, width: freshRect.width, height: freshRect.height });
        setPhase('flying');
        return;
      }

      if (phase === 'flying') {
        schedule(() => setPhase('landed'), FLY_DURATION + 80);
        return;
      }

      if (phase === 'landed') {
        schedule(() => {
          const landAudio = new Audio(landSfx);
          landAudio.volume = 0.75;
          landAudio.play().catch(() => {});
          onCardDealt(orderedCards[dealIndex].id);
          setFlyTarget(null);
          setDealIndex(i => i + 1);
          setPhase('idle');
        }, LAND_PAUSE);
        return;
      }
    };

    run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [dealIndex, phase, orderedCards, gridCellRefs, onCardDealt, onComplete, computeScrollTarget, getCardSize]);

  if (orderedCards.length === 0 || (dealIndex >= orderedCards.length && hasCompletedRef.current)) return null;

  const remaining = orderedCards.slice(dealIndex);
  if (remaining.length === 0) return null;

  const stackCards = remaining.slice(0, 4);
  const currentCard = orderedCards[dealIndex];
  const isFlying = phase === 'flying' && flyTarget;
  const isLanded = phase === 'landed' && flyTarget;

  return (
    <>
      {(isFlying || isLanded) && (
        <div className="fixed inset-0 z-40 bg-black/30 pointer-events-none" />
      )}

      <div className="fixed inset-0 z-50 pointer-events-none">
        {stackCards.reverse().map((card, reverseIdx, arr) => {
          const stackIdx = arr.length - 1 - reverseIdx;
          const isTop = stackIdx === 0;
          const cardMoving = isTop && (isFlying || isLanded);

          const offset = stackIdx * 4;
          const baseLeft = stackX - offset;
          const baseTop = STACK_Y - offset;

          let style: React.CSSProperties;

          if (cardMoving && flyTarget) {
            const dx = flyTarget.left - baseLeft;
            const dy = flyTarget.top - baseTop;
            const sx = flyTarget.width / cardSize.width;
            const sy = flyTarget.height / (cardSize.height + 8);
            style = {
              position: 'fixed',
              left: baseLeft,
              top: baseTop,
              width: cardSize.width,
              height: cardSize.height + 8,
              zIndex: 200,
              transformOrigin: 'top left',
              transform: `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`,
              transition: `transform ${FLY_DURATION}ms ${FLY_EASING}`,
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            };
          } else {
            style = {
              position: 'fixed',
              left: baseLeft,
              top: baseTop,
              width: cardSize.width,
              height: cardSize.height + 8,
              zIndex: 100 - stackIdx,
              transform: 'translate3d(0, 0, 0)',
              transition: 'none',
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            };
          }

          return (
            <div
              key={card.id}
              className="rounded-lg overflow-hidden border border-border bg-card shadow-xl"
              style={style}
            >
              <IpfsMedia url={card.image} alt={card.name} className="w-full h-full object-cover" context="card" />
            </div>
          );
        })}

        <div
          className="fixed flex items-center justify-center rounded-full bg-cheese text-cheese-foreground text-sm font-bold shadow-lg"
          style={{
            left: stackX + cardSize.width - 12,
            top: STACK_Y - 12,
            width: 32,
            height: 32,
            zIndex: 201,
          }}
        >
          {remaining.length}
        </div>

        {phase === 'sitting' && (
          <div
            className="fixed flex items-center justify-center pointer-events-none"
            style={{
              left: stackX,
              top: STACK_Y + cardSize.height + 8,
              width: cardSize.width,
              zIndex: 201,
            }}
          >
            <p className="text-sm font-bold text-foreground text-center bg-card/90 rounded-md px-3 py-1.5 border border-border shadow-md truncate max-w-[200px]">
              {currentCard?.name}
            </p>
          </div>
        )}

        <button
          onClick={handleSkip}
          className="fixed pointer-events-auto bg-card/90 hover:bg-card text-foreground text-xs font-semibold px-3 py-1.5 rounded-md border border-border shadow-md transition-colors"
          style={{
            left: stackX,
            top: STACK_Y + cardSize.height + 44,
            width: cardSize.width,
            zIndex: 201,
          }}
        >
          Skip Animation
        </button>
      </div>
    </>
  );
}
