import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
const INITIAL_SHUFFLE_DELAY = 2200; // ms — let card-shuffle.mp3 play before first card flies
const FLY_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function CardDealAnimation({ cards, gridCellRefs, onCardDealt, onComplete }: CardDealAnimationProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Play shuffle sound as we scroll up to the card pile
    const shuffleAudio = new Audio(shuffleSfx);
    shuffleAudio.play().catch(() => {});

    return () => {
      document.body.style.overflow = prev;
      shuffleAudio.pause();
      shuffleAudio.currentTime = 0;
    };
  }, []);

  // Sort cards bottom-up based on actual grid cell positions (deepest scroll position first)
  const [orderedCards, setOrderedCards] = useState<SimpleAsset[]>(cards);
  const orderedReadyRef = useRef(false);

  useEffect(() => {
    if (orderedReadyRef.current) return;
    // Wait briefly for grid cells to mount, then sort by absolute Y position descending
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
      positions.sort((a, b) => b.y - a.y); // bottom (largest y) first
      setOrderedCards(positions.map(p => p.card));
      orderedReadyRef.current = true;
    };
    tryOrder(0);
  }, [cards, gridCellRefs]);

  const [dealIndex, setDealIndex] = useState(0);
  const [phase, setPhase] = useState<'sitting' | 'scrolling' | 'flying' | 'landed' | 'idle'>('idle');
  const [flyTarget, setFlyTarget] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const hasCompletedRef = useRef(false);
  const isFirstCardRef = useRef(true);

  const handleSkip = useCallback(() => {
    orderedCards.slice(dealIndex).forEach(c => onCardDealt(c.id));
    hasCompletedRef.current = true;
    onComplete();
  }, [orderedCards, dealIndex, onCardDealt, onComplete]);

  const getCardSize = useCallback(() => {
    for (const el of gridCellRefs.current.values()) {
      if (el) {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }
    }
    return { width: 160, height: 160 };
  }, [gridCellRefs]);

  const [cardSize, setCardSize] = useState({ width: 160, height: 160 });

  useEffect(() => {
    setCardSize(getCardSize());
  }, [getCardSize]);

  const stackX = typeof window !== 'undefined' ? window.innerWidth / 2 - cardSize.width / 2 : 0;

  const scrollToElement = useCallback((absoluteTop: number, height: number) => {
    const viewportH = window.innerHeight;
    const targetCenter = absoluteTop + height / 2;
    const scrollTarget = targetCenter - viewportH / 2;
    window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (dealIndex >= orderedCards.length) {
      if (!hasCompletedRef.current && orderedReadyRef.current) {
        hasCompletedRef.current = true;
        const t = setTimeout(onComplete, 400);
        return () => clearTimeout(t);
      }
      return;
    }

    if (phase === 'idle') {
      if (isFirstCardRef.current) {
        isFirstCardRef.current = false;
        // Scroll to the bottom-most card position once, then start dealing
        const firstCard = orderedCards[0];
        const targetEl = firstCard ? gridCellRefs.current.get(firstCard.id) : null;
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          scrollToElement(rect.top + window.scrollY, rect.height);
        }
        let elapsed = 0;
        let lastY = -1;
        let stableCount = 0;
        const interval = setInterval(() => {
          elapsed += 50;
          const y = window.scrollY;
          if (Math.abs(y - lastY) < 2) stableCount++;
          else stableCount = 0;
          lastY = y;
          if (stableCount >= 3 || elapsed > 3000) {
            clearInterval(interval);
            setPhase('sitting');
          }
        }, 50);
        return () => clearInterval(interval);
      } else {
        setPhase('sitting');
      }
      return;
    }

    if (phase === 'sitting') {
      const timer = setTimeout(() => setPhase('scrolling'), SIT_DURATION);
      return () => clearTimeout(timer);
    }

    if (phase === 'scrolling') {
      const card = orderedCards[dealIndex];
      let cancelled = false;

      // Measure target — already sorted bottom-up, so each subsequent card is above previous
      const rafTimer = setTimeout(() => {
        if (cancelled) return;
        const targetEl = gridCellRefs.current.get(card.id);
        if (!targetEl) {
          onCardDealt(card.id);
          setPhase('idle');
          setDealIndex(i => i + 1);
          return;
        }

        const rect = targetEl.getBoundingClientRect();
        const viewportH = window.innerHeight;
        const cardCenter = rect.top + rect.height / 2;

        // Only scroll if card is outside the comfortable middle band of the viewport
        const margin = viewportH * 0.25;
        const needsScroll = cardCenter < margin || cardCenter > viewportH - margin;

        const beginFly = () => {
          requestAnimationFrame(() => {
            if (cancelled) return;
            const el = gridCellRefs.current.get(card.id);
            if (!el) {
              onCardDealt(card.id);
              setPhase('idle');
              setDealIndex(i => i + 1);
              return;
            }
            const freshRect = el.getBoundingClientRect();
            setFlyTarget({ left: freshRect.left, top: freshRect.top, width: freshRect.width, height: freshRect.height });
            setPhase('flying');
          });
        };

        if (!needsScroll) {
          beginFly();
          return;
        }

        const absTop = rect.top + window.scrollY;
        scrollToElement(absTop, rect.height);

        let lastY = -1;
        let stableCount = 0;
        let elapsed = 0;
        const pollInterval = setInterval(() => {
          if (cancelled) { clearInterval(pollInterval); return; }
          const y = window.scrollY;
          if (Math.abs(y - lastY) < 2) stableCount++;
          else stableCount = 0;
          lastY = y;
          elapsed += 50;
          if (stableCount >= 2 || elapsed > 1500) {
            clearInterval(pollInterval);
            beginFly();
          }
        }, 50);

        return () => clearInterval(pollInterval);
      }, 80);

      return () => {
        cancelled = true;
        clearTimeout(rafTimer);
      };
    }

    if (phase === 'flying') {
      const timer = setTimeout(() => setPhase('landed'), FLY_DURATION + 80);
      return () => clearTimeout(timer);
    }

    if (phase === 'landed') {
      const timer = setTimeout(() => {
        const landAudio = new Audio(landSfx);
        landAudio.volume = 0.75;
        landAudio.play().catch(() => {});
        onCardDealt(orderedCards[dealIndex].id);
        setFlyTarget(null);
        setDealIndex(i => i + 1);
        setPhase('idle');
      }, LAND_PAUSE);
      return () => clearTimeout(timer);
    }
  }, [dealIndex, phase, orderedCards, gridCellRefs, onCardDealt, onComplete, scrollToElement]);

  if (orderedCards.length === 0 || (dealIndex >= orderedCards.length && hasCompletedRef.current)) return null;

  const remaining = orderedCards.slice(dealIndex);
  if (remaining.length === 0) return null;

  const stackCards = remaining.slice(0, 4);
  const currentCard = orderedCards[dealIndex];
  const isFlying = phase === 'flying' && flyTarget;
  const isLanded = phase === 'landed' && flyTarget;

  return (
    <>
      {/* Semi-transparent backdrop during flight */}
      {(isFlying || isLanded) && (
        <div className="fixed inset-0 z-40 bg-black/30 pointer-events-none" />
      )}

      <div className="fixed inset-0 z-50 pointer-events-none">
        {/* Stack */}
        {stackCards.reverse().map((card, reverseIdx, arr) => {
          const stackIdx = arr.length - 1 - reverseIdx;
          const isTop = stackIdx === 0;
          const cardMoving = isTop && (isFlying || isLanded);

          const offset = stackIdx * 4;
          const baseLeft = stackX - offset;
          const baseTop = STACK_Y - offset;

          // Animate via transform (GPU) instead of left/top/width/height (layout)
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

        {/* Counter badge */}
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

        {/* Card name when sitting */}
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

        {/* Skip Animation button */}
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
