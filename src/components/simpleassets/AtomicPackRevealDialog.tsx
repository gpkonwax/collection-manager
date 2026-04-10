import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download } from 'lucide-react';
import { playRandomFart } from '@/lib/fartSounds';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash, IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { Session } from '@wharfkit/session';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { getCachedTemplate, setCachedTemplate } from '@/lib/templateCache';
import { usePackRevealAudio } from '@/hooks/usePackRevealAudio';

interface RevealCard {
  asset_id: string;
  name: string;
  image: string | null;
  rarity: string;
}

interface UnboxResultRow {
  pack_asset_id: number;
  origin_roll_id: number;
  template_id: number;
}

interface AtomicPackRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packName: string;
  packImage: string;
  packAssetId: string | null;
  unpackContract: string;
  expectedCards: number;
  accountName: string;
  session: Session | null;
  onComplete: (txId?: string | null) => void;
}

function swapGateway(url: string, gatewayIndex: number): string | null {
  const hash = extractIpfsHash(url);
  if (!hash) return null;
  return `${IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length]}${hash}`;
}

function AtomicRevealCardImage({ card, isRevealed }: { card: RevealCard; isRevealed: boolean }) {
  const [gwIdx, setGwIdx] = useState(0);
  const currentSrc = card.image ? (gwIdx === 0 ? card.image : swapGateway(card.image, gwIdx)) : null;

  return (
    <div className="relative aspect-[2/3] rounded-lg"
      style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s ease-out', transform: isRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)' }}>
      <div className="absolute inset-0 rounded-lg overflow-hidden border border-border bg-card shadow-md" style={{ backfaceVisibility: 'hidden' }}>
        {currentSrc ? (
          <img src={currentSrc} alt={card.name} className="w-full h-full object-cover" loading="lazy"
            onError={() => { if (gwIdx < IPFS_GATEWAYS.length - 1) setGwIdx(g => g + 1); }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-2xl">🃏</div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
          <p className="text-[10px] font-medium truncate" style={{ color: 'white' }}>{card.name}</p>
          {card.rarity && <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{card.rarity}</p>}
        </div>
      </div>
      <div className="absolute inset-0 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/30 flex items-center justify-center shadow-md"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
        <div className="text-center space-y-1"><span className="text-3xl">🧀</span><p className="text-[10px] text-muted-foreground font-medium">GPK</p></div>
      </div>
    </div>
  );
}

const POLL_INTERVAL = 3000;

function resolveImage(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  const hash = extractIpfsHash(raw);
  if (hash) return getIpfsUrl(hash);
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return raw || null;
}

async function fetchTemplateImage(templateId: number): Promise<{ name: string; image: string | null }> {
  const tid = String(templateId);
  const cached = getCachedTemplate(tid, 'gpk.topps');
  if (cached) return { name: cached.name, image: cached.image };
  try {
    const path = `${ATOMIC_API.paths.templates}/gpk.topps/${tid}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
    const json = await response.json();
    if (json.success && json.data) {
      const idata = json.data.immutable_data || {};
      const name = idata.name || `Card #${tid}`;
      const image = resolveImage(idata.img || idata.image);
      setCachedTemplate(tid, 'gpk.topps', { name, image: image || '/placeholder.svg' });
      return { name, image };
    }
  } catch (e) { console.warn('[AtomicReveal] Template fetch failed for', tid, e); }
  return { name: `Card #${tid}`, image: null };
}

async function fetchUnboxResults(contract: string, packAssetId: string): Promise<UnboxResultRow[]> {
  try {
    const result = await fetchTableRows<UnboxResultRow>({
      code: contract, scope: contract, table: 'unboxassets',
      index_position: 2, key_type: 'i64',
      lower_bound: packAssetId, upper_bound: packAssetId, limit: 100,
    });
    return result.rows;
  } catch (e) {
    console.error('[AtomicReveal] fetchUnboxResults error', e);
    return [];
  }
}

export function AtomicPackRevealDialog({
  open, onOpenChange, packName, packImage, packAssetId,
  unpackContract, expectedCards, accountName, session, onComplete,
}: AtomicPackRevealDialogProps) {
  const [phase, setPhase] = useState<'waiting' | 'revealing' | 'collect' | 'collecting' | 'done'>('waiting');
  const [newCards, setNewCards] = useState<RevealCard[]>([]);
  const [rollIds, setRollIds] = useState<number[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [waitMessage, setWaitMessage] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const pollStartRef = useRef<number>(0);

  usePackRevealAudio({ open, phase, isShaking, revealedCount });

  useEffect(() => {
    if (open) {
      setPhase('waiting'); setNewCards([]); setRollIds([]);
      setRevealedCount(0); setWaitMessage(''); setCollectError(null);
      pollStartRef.current = Date.now();
      setIsShaking(true);
      const shakeTimer = setTimeout(() => setIsShaking(false), 3500);
      return () => clearTimeout(shakeTimer);
    } else {
      setIsShaking(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !packAssetId || phase !== 'waiting') return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const poll = async () => {
      try {
        const rows = await fetchUnboxResults(unpackContract, packAssetId);
        if (cancelled) return;
        const elapsed = Date.now() - pollStartRef.current;
        if (elapsed > 60000) setWaitMessage('Taking longer than usual... still waiting for oracle');
        else if (elapsed > 30000) setWaitMessage('Still waiting for the RNG oracle...');
        if (rows.length >= expectedCards) {
          clearInterval(interval);
          const templateData = await Promise.all(rows.map((r) => fetchTemplateImage(r.template_id)));
          const cards: RevealCard[] = rows.map((r, i) => ({
            asset_id: `${r.pack_asset_id}-${r.origin_roll_id}`,
            name: templateData[i].name, image: templateData[i].image, rarity: '',
          }));
          setNewCards(cards); setRollIds(rows.map((r) => r.origin_roll_id)); setPhase('revealing');
        }
      } catch (e) { console.error('[AtomicReveal] poll error', e); }
    };
    const startDelay = setTimeout(() => { if (cancelled) return; poll(); interval = setInterval(poll, POLL_INTERVAL); }, 4000);
    return () => { cancelled = true; clearTimeout(startDelay); clearInterval(interval); };
  }, [open, phase, packAssetId, unpackContract, expectedCards]);

  useEffect(() => {
    if (phase !== 'revealing' || newCards.length === 0 || revealedCount >= newCards.length) return;
    const timer = setTimeout(() => {
      setRevealedCount((c) => c + 1);
      setTimeout(() => playRandomFart(), 600);
    }, 1600);
    return () => clearTimeout(timer);
  }, [phase, revealedCount, newCards.length]);

  useEffect(() => {
    if (phase === 'revealing' && revealedCount >= newCards.length && newCards.length > 0 && rollIds.length > 0) setPhase('collect');
  }, [phase, revealedCount, newCards.length, rollIds]);

  const handleCollect = useCallback(async () => {
    if (!session || !packAssetId || rollIds.length === 0) return;
    setPhase('collecting'); setCollectError(null);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    try {
      const result = await session.transact({
        actions: [{ account: unpackContract, name: 'claimunboxed', authorization: auth,
          data: { pack_asset_id: parseInt(packAssetId, 10), origin_roll_ids: rollIds } }],
      }, { transactPlugins: getTransactPlugins(session) });
      const txId = result?.resolved?.transaction?.id?.toString() || null;
      setPhase('done'); onComplete(txId);
    } catch (e) {
      console.error('[AtomicReveal] claimunboxed failed', e);
      closeWharfkitModals(); setTimeout(() => closeWharfkitModals(), 100);
      setCollectError(e instanceof Error ? e.message : 'Transaction failed');
      setPhase('collect');
    }
  }, [session, packAssetId, rollIds, unpackContract, onComplete]);

  const handleClose = () => { onOpenChange(false); if (phase !== 'done') onComplete(); };
  const allRevealed = revealedCount >= newCards.length && newCards.length > 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border" hideClose onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogTitle className="sr-only">Pack Reveal</DialogTitle>
        {phase === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="animate-pack-shake">
              <img src={packImage} alt={packName} className="w-32 h-auto rounded-lg shadow-lg shadow-primary/30" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-bold text-foreground">Opening {packName}...</p>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /><span>Waiting for cards to be minted...</span>
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
              <p className="text-sm text-muted-foreground">{newCards.length} card{newCards.length !== 1 ? 's' : ''} from {packName}</p>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3" style={{ perspective: '1000px' }}>
              {newCards.map((card, i) => {
                const isRevealed = i < revealedCount;
                return (
                  <AtomicRevealCardImage key={card.asset_id} card={card} isRevealed={isRevealed} />
                );
              })}
            </div>
            {phase === 'collect' && (
              <div className="flex flex-col items-center gap-3 pt-2">
                {collectError && <p className="text-xs text-destructive text-center">{collectError}</p>}
                <Button onClick={handleCollect} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!session}>
                  <Download className="h-4 w-4 mr-2" />Collect Assets
                </Button>
                <p className="text-xs text-muted-foreground text-center">Sign a transaction to deliver these cards to your wallet</p>
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
