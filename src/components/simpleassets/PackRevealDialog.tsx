import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download } from 'lucide-react';
import { playRandomFart } from '@/lib/fartSounds';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { buildGpkCardImageUrl } from '@/lib/gpkCardImages';
import { IPFS_GATEWAYS, extractIpfsHash } from '@/lib/ipfsGateways';
import { Session } from '@wharfkit/session';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { usePackRevealAudio } from '@/hooks/usePackRevealAudio';

const EXPECTED_CARDS: Record<string, number> = {
  GPKFIVE: 5, GPKTWOA: 8, GPKTWOB: 25, GPKTWOC: 55,
};

const SYMBOL_TO_BOXTYPE: Record<string, string> = {
  GPKFIVE: 'five', GPKTWOA: 'gpktwoeight', GPKTWOB: 'gpktwo25', GPKTWOC: 'gpktwo55',
};

export interface RevealCard {
  asset_id: string;
  name: string;
  image: string | null;
  rarity: string;
}

interface PendingNftRow {
  id: number;
  unboxingid: number;
  draw: number;
  boxtype: string;
  user: string;
  variant: string;
  quality: string;
  done: number;
  cardid: number;
}

interface PackRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packSymbol: string;
  packLabel: string;
  packImage?: string;
  accountName: string;
  preOpenUnboxingIds: Set<number>;
  onComplete: (txId?: string | null) => void;
  onDemoCollect?: () => void;
  demoCards?: RevealCard[];
  session?: Session | null;
}

function swapGateway(url: string, gatewayIndex: number): string | null {
  const hash = extractIpfsHash(url);
  if (!hash) return null;
  const gw = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
  return `${gw}${hash}`;
}

function RevealCardImage({ card, isRevealed }: { card: RevealCard; isRevealed: boolean }) {
  const [gwIdx, setGwIdx] = useState(0);
  const currentSrc = card.image ? (gwIdx === 0 ? card.image : swapGateway(card.image, gwIdx)) : null;

  return (
    <div className="relative aspect-[2/3]"
      style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-out', transform: isRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)' }}>
      <div className="absolute inset-0 border border-border bg-transparent shadow-md" style={{ backfaceVisibility: 'hidden' }}>
        {currentSrc ? (
          <img src={currentSrc} alt={card.name} className="w-full h-full object-contain object-center" loading="lazy"
            onError={() => { if (gwIdx < IPFS_GATEWAYS.length - 1) setGwIdx(g => g + 1); }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-2xl">🃏</div>
        )}
      </div>
      <div className="absolute inset-0 border-2 border-primary/30 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/30 flex items-center justify-center shadow-md"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
        <div className="text-center space-y-1">
          <span className="text-3xl">🧀</span>
          <p className="text-[10px] text-muted-foreground font-medium">GPK</p>
        </div>
      </div>
    </div>
  );
}

const POLL_INTERVAL = 3000;

export async function fetchPendingNfts(owner: string): Promise<PendingNftRow[]> {
  try {
    const result = await fetchTableRows<PendingNftRow>({
      code: 'gpk.topps', scope: owner, table: 'pendingnft.a', limit: 500,
    });
    return result.rows;
  } catch (e) {
    console.error('[pack-reveal] fetchPendingNfts error', e);
    return [];
  }
}

export function PackRevealDialog({
  open, onOpenChange, packSymbol, packLabel, packImage,
  accountName, preOpenUnboxingIds, onComplete, onDemoCollect, demoCards, session,
}: PackRevealDialogProps) {
  const [phase, setPhase] = useState<'waiting' | 'revealing' | 'collect' | 'collecting' | 'done'>('waiting');
  const [newCards, setNewCards] = useState<RevealCard[]>([]);
  const [pendingRowIds, setPendingRowIds] = useState<number[]>([]);
  const [unboxingId, setUnboxingId] = useState<number | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [waitMessage, setWaitMessage] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const pollStartRef = useRef<number>(0);
  const isDemo = !!(demoCards && demoCards.length > 0);

  const expectedCount = EXPECTED_CARDS[packSymbol] ?? 5;
  const boxtype = SYMBOL_TO_BOXTYPE[packSymbol];

  usePackRevealAudio({ open, phase, isShaking, revealedCount });

  useEffect(() => {
    if (open) {
      setPhase('waiting'); setNewCards([]); setPendingRowIds([]);
      setUnboxingId(null); setRevealedCount(0); setWaitMessage('');
      setCollectError(null); pollStartRef.current = Date.now();
      setIsShaking(true);
      const shakeTimer = setTimeout(() => setIsShaking(false), 3500);
      return () => clearTimeout(shakeTimer);
    } else {
      setIsShaking(false);
    }
  }, [open]);

  // Demo mode
  useEffect(() => {
    if (!open || phase !== 'waiting' || !demoCards || demoCards.length === 0) return;
    const timer = setTimeout(() => { setNewCards(demoCards); setPhase('revealing'); }, 4000);
    return () => clearTimeout(timer);
  }, [open, phase, demoCards]);

  // Real polling
  useEffect(() => {
    if (!open || !accountName || (demoCards && demoCards.length > 0)) return;
    if (phase !== 'waiting') return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const rows = await fetchPendingNfts(accountName);
        if (cancelled) return;
        const newRows = rows.filter((r) => r.done === 0 && !preOpenUnboxingIds.has(r.unboxingid));
        const grouped = new Map<number, PendingNftRow[]>();
        for (const r of newRows) {
          const arr = grouped.get(r.unboxingid) || [];
          arr.push(r);
          grouped.set(r.unboxingid, arr);
        }
        const elapsed = Date.now() - pollStartRef.current;
        if (elapsed > 60000) setWaitMessage('Taking longer than usual... still waiting for oracle');
        else if (elapsed > 30000) setWaitMessage('Still waiting for the RNG oracle...');

        let targetRows: PendingNftRow[] | null = null;
        let targetUnboxingId: number | null = null;
        for (const [uid, uRows] of grouped) {
          if (boxtype && uRows[0]?.boxtype === boxtype && uRows.length >= expectedCount) {
            targetRows = uRows; targetUnboxingId = uid; break;
          }
        }
        if (!targetRows) {
          for (const [uid, uRows] of grouped) {
            if (uRows.length >= expectedCount) { targetRows = uRows; targetUnboxingId = uid; break; }
          }
        }
        if (targetRows && targetUnboxingId !== null) {
          clearInterval(interval);
          const sorted = targetRows.sort((a, b) => a.draw - b.draw);
          const cards: RevealCard[] = sorted.map((r) => ({
            asset_id: String(r.id),
            name: `Card #${r.cardid}${r.quality}`,
            image: buildGpkCardImageUrl(r.boxtype, r.variant, r.cardid, r.quality),
            rarity: `${r.variant} ${r.quality}`,
          }));
          setNewCards(cards);
          setPendingRowIds(sorted.map((r) => r.id));
          setUnboxingId(targetUnboxingId);
          setPhase('revealing');
        }
      } catch (e) { console.error('[pack-reveal] poll error', e); }
    };

    const startDelay = setTimeout(() => {
      if (cancelled) return;
      poll();
      interval = setInterval(poll, POLL_INTERVAL);
    }, 4000);

    return () => { cancelled = true; clearTimeout(startDelay); clearInterval(interval); };
  }, [open, phase, accountName, preOpenUnboxingIds, expectedCount, boxtype, demoCards]);

  // Staggered reveal
  useEffect(() => {
    if (phase !== 'revealing' || newCards.length === 0 || revealedCount >= newCards.length) return;
    const timer = setTimeout(() => {
      setRevealedCount((c) => c + 1);
      setTimeout(() => playRandomFart(), 600);
    }, 1600);
    return () => clearTimeout(timer);
  }, [phase, revealedCount, newCards.length]);

  // Transition to collect
  useEffect(() => {
    if (phase === 'revealing' && revealedCount >= newCards.length && newCards.length > 0) {
      if (demoCards && demoCards.length > 0) {
        setPhase('collect');
        return;
      }
      if (pendingRowIds.length > 0) setPhase('collect');
    }
  }, [phase, revealedCount, newCards.length, pendingRowIds, demoCards]);

  const handleCollect = useCallback(async () => {
    if (isDemo) {
      setPhase('done');
      onOpenChange(false);
      onDemoCollect?.();
      return;
    }
    if (!session || unboxingId === null || pendingRowIds.length === 0) return;
    setPhase('collecting'); setCollectError(null);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    try {
      const result = await session.transact({
        actions: [{
          account: 'gpk.topps', name: 'getcards', authorization: auth,
          data: { from: actor, unboxing: unboxingId, cardids: pendingRowIds },
        }],
      }, { transactPlugins: getTransactPlugins(session) });
      const txId = result?.resolved?.transaction?.id?.toString() || null;
      setPhase('done'); onComplete(txId);
    } catch (e) {
      console.error('[pack-reveal] getcards failed', e);
      closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 100);
      setCollectError(e instanceof Error ? e.message : 'Transaction failed');
      setPhase('collect');
    }
  }, [session, unboxingId, pendingRowIds, onComplete, isDemo, onDemoCollect, onOpenChange]);

  const handleClose = () => { onOpenChange(false); if (phase !== 'done') onComplete(); };
  const allRevealed = revealedCount >= newCards.length && newCards.length > 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border" hideClose onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Pack Reveal</DialogTitle>

        {phase === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="animate-pack-shake">
              {packImage ? (
                <img src={packImage} alt={packLabel} className="w-32 h-auto rounded-lg shadow-lg shadow-primary/30" />
              ) : (
                <span className="text-7xl">📦</span>
              )}
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-foreground">Opening {packLabel}...</p>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for cards to be minted...</span>
              </div>
              <p className="text-xs text-muted-foreground/60">{waitMessage || 'This usually takes 2-15 seconds'}</p>
            </div>
          </div>
        )}

        {(phase === 'revealing' || phase === 'collect' || phase === 'collecting' || phase === 'done') && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">
                  {phase === 'done' ? 'Cards Collected!' : allRevealed ? 'All Cards Revealed!' : 'Revealing Cards...'}
                </h2>
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{newCards.length} card{newCards.length !== 1 ? 's' : ''} from {packLabel}</p>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3" style={{ perspective: '1000px' }}>
              {newCards.map((card, i) => {
                const isRevealed = i < revealedCount;
                return (
                  <RevealCardImage key={card.asset_id} card={card} isRevealed={isRevealed} />
                );
              })}
            </div>

            {phase === 'collect' && (
              <div className="flex flex-col items-center gap-3 pt-2">
                {collectError && <p className="text-xs text-destructive text-center">{collectError}</p>}
                <Button onClick={handleCollect} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!isDemo && !session}>
                  <Download className="h-4 w-4 mr-2" />Collect Assets
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {isDemo ? 'Click to see your cards added to the collection' : 'Sign a transaction to deliver these cards to your wallet'}
                </p>
              </div>
            )}

            {phase === 'collecting' && (
              <div className="flex justify-center pt-2">
                <Button disabled className="bg-primary/70 text-primary-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Collecting...</Button>
              </div>
            )}

            {phase === 'done' && (
              <div className="flex justify-center pt-2">
                <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 text-primary-foreground">Awesome! Close</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
