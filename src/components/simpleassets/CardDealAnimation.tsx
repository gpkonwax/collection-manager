import { useState, useEffect, useCallback, useRef } from 'react';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface CardDealAnimationProps {
  cards: SimpleAsset[];
  gridCellRefs: React.MutableRefObject<Map<string, HTMLElement | null>>;
  onCardDealt: (id: string) => void;
  onComplete: () => void;
}

const CARD_SIZE = 120;
const STACK_Y = 80;
const DEAL_DELAY = 800;

export function CardDealAnimation({ cards, gridCellRefs, onCardDealt, onComplete }: CardDealAnimationProps) {
  const [dealIndex, setDealIndex] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [flyTarget, setFlyTarget] = useState<DOMRect | null>(null);
  const hasCompletedRef = useRef(false);

  const stackX = typeof window !== 'undefined' ? window.innerWidth / 2 - CARD_SIZE / 2 : 0;

  useEffect(() => {
    if (dealIndex >= cards.length) {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        const t = setTimeout(onComplete, 400);
        return () => clearTimeout(t);
      }
      return;
    }
    if (isFlying) return;

    const delay = dealIndex === 0 ? 1000 : DEAL_DELAY;
    const timer = setTimeout(() => {
      const card = cards[dealIndex];
      const targetEl = gridCellRefs.current.get(card.id);
      if (!targetEl) {
        onCardDealt(card.id);
        setDealIndex(i => i + 1);
        return;
      }
      const rect = targetEl.getBoundingClientRect();
      setFlyTarget(rect);
      setIsFlying(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [dealIndex, isFlying, cards, gridCellRefs, onCardDealt, onComplete]);

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (e.propertyName !== 'left') return;
    if (isFlying && dealIndex < cards.length) {
      onCardDealt(cards[dealIndex].id);
      setIsFlying(false);
      setFlyTarget(null);
      setDealIndex(i => i + 1);
    }
  }, [isFlying, dealIndex, cards, onCardDealt]);

  if (cards.length === 0) return null;

  const remaining = cards.slice(dealIndex);
  if (remaining.length === 0) return null;

  const stackCards = remaining.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {stackCards.reverse().map((card, reverseIdx, arr) => {
        const stackIdx = arr.length - 1 - reverseIdx;
        const isTop = stackIdx === 0;
        const cardIsFlying = isTop && isFlying && flyTarget;

        const offset = stackIdx * 4;
        const baseLeft = stackX - offset;
        const baseTop = STACK_Y - offset;

        const style: React.CSSProperties = cardIsFlying
          ? {
              position: 'absolute' as const,
              left: flyTarget.left,
              top: flyTarget.top,
              width: flyTarget.width,
              height: flyTarget.height,
              zIndex: 200,
              transition: 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1), width 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }
          : {
              position: 'absolute' as const,
              left: baseLeft,
              top: baseTop,
              width: CARD_SIZE,
              height: CARD_SIZE,
              zIndex: 100 - stackIdx,
            };

        return (
          <div
            key={card.id}
            className="rounded-lg overflow-hidden border border-border bg-card shadow-xl"
            style={style}
            onTransitionEnd={cardIsFlying ? handleTransitionEnd : undefined}
          >
            <IpfsMedia url={card.image} alt={card.name} className="w-full h-full" context="card" />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1">
              <p className="text-[8px] font-medium truncate" style={{ color: 'white' }}>{card.name}</p>
            </div>
          </div>
        );
      })}

      <div
        className="absolute flex items-center justify-center rounded-full bg-cheese text-cheese-foreground text-xs font-bold"
        style={{
          left: stackX + CARD_SIZE - 8,
          top: STACK_Y - 8,
          width: 28,
          height: 28,
          zIndex: 201,
        }}
      >
        {remaining.length}
      </div>
    </div>
  );
}
