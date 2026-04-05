import { useState, useEffect, useCallback, useRef } from 'react';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface CardDealAnimationProps {
  cards: SimpleAsset[];
  gridCellRefs: React.MutableRefObject<Map<string, HTMLElement | null>>;
  onCardDealt: (id: string) => void;
  onComplete: () => void;
}

const STACK_Y = 60;
const SIT_DURATION = 4000;     // card sits on stack for 4 seconds
const FLY_DURATION = 4000;     // flight takes 4 seconds
const LAND_PAUSE = 2000;       // pause at destination so user can see it
// Total ~10s per card

export function CardDealAnimation({ cards, gridCellRefs, onCardDealt, onComplete }: CardDealAnimationProps) {
  const [dealIndex, setDealIndex] = useState(0);
  const [phase, setPhase] = useState<'sitting' | 'flying' | 'landed' | 'idle'>('idle');
  const [flyTarget, setFlyTarget] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const hasCompletedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute card size to match the grid cards
  const getCardSize = useCallback(() => {
    // Try to measure from an existing grid cell
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
    const size = getCardSize();
    setCardSize(size);
  }, [getCardSize]);

  const stackX = typeof window !== 'undefined' ? window.innerWidth / 2 - cardSize.width / 2 : 0;

  // Auto-scroll to follow the card
  const scrollToElement = useCallback((top: number, height: number) => {
    const viewportH = window.innerHeight;
    const targetCenter = top + height / 2;
    const scrollTarget = window.scrollY + targetCenter - viewportH / 2;
    window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, []);

  // Main deal loop
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
      // Start sitting phase - scroll to top to see the stack first
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const delay = dealIndex === 0 ? 1500 : 300;
      const timer = setTimeout(() => setPhase('sitting'), delay);
      return () => clearTimeout(timer);
    }

    if (phase === 'sitting') {
      // Card sits on top of stack for SIT_DURATION
      const timer = setTimeout(() => {
        const card = cards[dealIndex];
        const targetEl = gridCellRefs.current.get(card.id);
        if (!targetEl) {
          // No target found, skip
          onCardDealt(card.id);
          setPhase('idle');
          setDealIndex(i => i + 1);
          return;
        }
        const rect = targetEl.getBoundingClientRect();
        setFlyTarget({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });

        // Scroll to destination so user can see the card land
        scrollToElement(rect.top, rect.height);

        // Small delay to let scroll start, then fly
        setTimeout(() => setPhase('flying'), 600);
      }, SIT_DURATION);
      return () => clearTimeout(timer);
    }

    if (phase === 'flying') {
      // Wait for CSS transition to finish, then mark as landed
      const timer = setTimeout(() => {
        setPhase('landed');
      }, FLY_DURATION + 200);
      return () => clearTimeout(timer);
    }

    if (phase === 'landed') {
      // Pause at destination so user gets a good look
      const timer = setTimeout(() => {
        onCardDealt(cards[dealIndex].id);
        setFlyTarget(null);
        setPhase('idle');
        setDealIndex(i => i + 1);
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
    <div ref={containerRef} className="fixed inset-0 z-50 pointer-events-none">
      {/* Stack of upcoming cards */}
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
              transition: `left ${FLY_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${FLY_DURATION}ms cubic-bezier(0.25, 0.1, 0.25, 1), width ${FLY_DURATION}ms ease, height ${FLY_DURATION}ms ease`,
            }
          : {
              position: 'fixed' as const,
              left: baseLeft,
              top: baseTop,
              width: cardSize.width,
              height: cardSize.height,
              zIndex: 100 - stackIdx,
              transition: 'none',
            };

        return (
          <div
            key={card.id}
            className="rounded-lg overflow-hidden border border-border bg-card shadow-xl"
            style={style}
          >
            <IpfsMedia url={card.image} alt={card.name} className="w-full h-full" context="card" />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <p className="text-xs font-semibold truncate" style={{ color: 'white' }}>{card.name}</p>
            </div>
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

      {/* Card name overlay when sitting */}
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
    </div>
  );
}
