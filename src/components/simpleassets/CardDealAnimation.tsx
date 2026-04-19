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
  /** Map a card id to its absolute index in the rendered virtualized list. Return null if not present. */
  getCardIndex?: (id: string) => number | null;
  /** Ask the virtualizer to bring a card index into view. */
  scrollToCard?: (cardIndex: number) => void;
}

const STACK_Y = 60;
const SIT_DURATION = 2800;
const FLY_DURATION = 2800;
const LAND_PAUSE = 1400;

export function CardDealAnimation({ cards, gridCellRefs, onCardDealt, onComplete, getCardIndex, scrollToCard }: CardDealAnimationProps) {
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

  const [dealIndex, setDealIndex] = useState(0);
  const [phase, setPhase] = useState<'sitting' | 'scrolling' | 'flying' | 'landed' | 'idle'>('idle');
  const [flyTarget, setFlyTarget] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const hasCompletedRef = useRef(false);
  const isFirstCardRef = useRef(true);

  const handleSkip = useCallback(() => {
    cards.slice(dealIndex).forEach(c => onCardDealt(c.id));
    hasCompletedRef.current = true;
    onComplete();
  }, [cards, dealIndex, onCardDealt, onComplete]);

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
    if (dealIndex >= cards.length) {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        const t = setTimeout(onComplete, 600);
        return () => clearTimeout(t);
      }
      return;
    }

    if (phase === 'idle') {
      if (isFirstCardRef.current) {
        isFirstCardRef.current = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        let elapsed = 0;
        const interval = setInterval(() => {
          elapsed += 50;
          if (window.scrollY <= 1 || elapsed > 3000) {
            clearInterval(interval);
            setPhase('sitting');
          }
        }, 50);
        return () => clearInterval(interval);
      } else {
        // Go straight to sitting, no scroll to top
        setPhase('sitting');
      }
      return;
    }

    if (phase === 'sitting') {
      const timer = setTimeout(() => setPhase('scrolling'), SIT_DURATION);
      return () => clearTimeout(timer);
    }

    if (phase === 'scrolling') {
      const card = cards[dealIndex];
      let cancelled = false;
      let pollInterval: ReturnType<typeof setInterval> | null = null;

      const rafTimer = setTimeout(() => {
        if (cancelled) return;
        const targetEl = gridCellRefs.current.get(card.id);
        if (!targetEl) {
          onCardDealt(card.id);
          setPhase('idle');
          setDealIndex(i => i + 1);
          return;
        }

        // Scroll to destination using absolute page coordinates
        const roughRect = targetEl.getBoundingClientRect();
        const absTop = roughRect.top + window.scrollY;
        scrollToElement(absTop, roughRect.height);

        // Poll scrollY until stable instead of fixed timeout
        let lastY = -1;
        let stableCount = 0;
        let elapsed = 0;
        pollInterval = setInterval(() => {
          if (cancelled) { clearInterval(pollInterval!); return; }
          const y = window.scrollY;
          if (Math.abs(y - lastY) < 2) stableCount++;
          else stableCount = 0;
          lastY = y;
          elapsed += 50;
          if (stableCount >= 2 || elapsed > 2000) {
            clearInterval(pollInterval!);
            pollInterval = null;
            // Use rAF to ensure layout is painted before measuring
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
          }
        }, 50);
      }, 200);

      return () => {
        cancelled = true;
        clearTimeout(rafTimer);
        if (pollInterval) clearInterval(pollInterval);
      };
    }

    if (phase === 'flying') {
      const timer = setTimeout(() => setPhase('landed'), FLY_DURATION + 200);
      return () => clearTimeout(timer);
    }

    if (phase === 'landed') {
      const timer = setTimeout(() => {
        const landAudio = new Audio(landSfx);
        landAudio.play().catch(() => {});
        onCardDealt(cards[dealIndex].id);
        setFlyTarget(null);
        setDealIndex(i => i + 1);
        setPhase('idle');
      }, LAND_PAUSE);
      return () => clearTimeout(timer);
    }
  }, [dealIndex, phase, cards, gridCellRefs, onCardDealt, onComplete, scrollToElement]);

  if (cards.length === 0 || (dealIndex >= cards.length && hasCompletedRef.current)) return null;

  const remaining = cards.slice(dealIndex);
  if (remaining.length === 0) return null;

  const stackCards = remaining.slice(0, 4);
  const currentCard = cards[dealIndex];
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

          const style: React.CSSProperties = cardMoving && flyTarget
            ? {
                position: 'fixed' as const,
                left: flyTarget.left,
                top: flyTarget.top,
                width: flyTarget.width,
                height: flyTarget.height,
                zIndex: 200,
                willChange: 'transform, left, top, width, height',
                transition: `left ${FLY_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${FLY_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1), width ${FLY_DURATION}ms ease, height ${FLY_DURATION}ms ease`,
              }
            : {
                position: 'fixed' as const,
                left: baseLeft,
                top: baseTop,
                width: cardSize.width,
                height: cardSize.height + 8,
                zIndex: 100 - stackIdx,
                transition: 'none',
              };

          return (
            <div
              key={card.id}
              className="relative rounded-lg overflow-hidden border border-border bg-card shadow-xl"
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
