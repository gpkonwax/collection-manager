import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Download, AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { playCardRevealSound } from '@/lib/fartSounds';
import { fetchTableRows } from '@/lib/waxRpcFallback';
import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, extractIpfsHash, IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { Session } from '@wharfkit/session';
import { closeWharfkitModals, getTransactPlugins } from '@/lib/wharfKit';
import { getCachedTemplate, setCachedTemplate } from '@/lib/templateCache';
import { usePackRevealAudio } from '@/hooks/usePackRevealAudio';
import { findRandnotifyForPack } from '@/lib/stuckPackDetect';
import { recordStuckPack, buildStuckPackReportText } from '@/lib/stuckPackStorage';
import type { PackOpenMode } from '@/hooks/useGpkAtomicPacks';

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
  openMode?: PackOpenMode;
  demoCards?: { asset_id: string; name: string; image: string | null; rarity: string }[];
  onDemoCollect?: () => void;
  /** Optional tx id of the transfer-to-contract that started the open. Used in stuck-pack reports. */
  transferTxId?: string | null;
}
/** Result row from unbox.nft's results table */
interface UnboxNftResultRow {
  template_id: number;
  [key: string]: unknown;
}

async function fetchUnboxNftResults(accountName: string, packAssetId: string): Promise<number[]> {
  try {
    // unbox.nft stores results with scope = the account that opened the pack
    // We fetch recent assets for the account from the atomic API instead
    const result = await fetchTableRows<UnboxNftResultRow>({
      code: 'unbox.nft', scope: accountName, table: 'results',
      limit: 100,
    });
    if (result.rows.length > 0) {
      return result.rows.map(r => r.template_id);
    }
  } catch (e) {
    console.warn('[AtomicReveal] unbox.nft results table fetch failed, trying assets API', e);
  }
  
  // Fallback: poll the atomic assets API for recently minted assets
  try {
    const params = new URLSearchParams({
      owner: accountName,
      collection_name: 'gpk.topps',
      sort: 'asset_id',
      order: 'desc',
      limit: '20',
    });
    const path = `${ATOMIC_API.paths.assets}?${params}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
    const json = await response.json();
    if (json.success && json.data) {
      return json.data
        .filter((a: any) => a.template?.template_id)
        .map((a: any) => parseInt(a.template.template_id, 10));
    }
  } catch (e) {
    console.warn('[AtomicReveal] assets API fallback failed', e);
  }
  return [];
}

function swapGateway(url: string, gatewayIndex: number): string | null {
  const hash = extractIpfsHash(url);
  if (!hash) return null;
  return `${IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length]}${hash}`;
}

function AtomicRevealCardImage({ card, isRevealed, packImage }: { card: RevealCard; isRevealed: boolean; packImage?: string }) {
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
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center shadow-md border border-zinc-700/50 rounded-sm"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
        {packImage ? (
          <img src={packImage} alt="card back" className="w-3/4 h-3/4 object-contain opacity-15" style={{ filter: 'grayscale(1) contrast(1.5) brightness(0.8)' }} />
        ) : (
          <span className="text-4xl opacity-20">🃏</span>
        )}
        <div className="absolute inset-0 border border-zinc-600/30 rounded-sm" />
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

async function fetchUnboxResults(contract: string, packAssetId: string, accountName?: string): Promise<UnboxResultRow[]> {
  try {
    // Try scope = packAssetId first (works for most contracts)
    const result = await fetchTableRows<UnboxResultRow>({
      code: contract, scope: packAssetId, table: 'unboxassets',
      limit: 100,
    });
    if (result.rows.length > 0) return result.rows;

    // Fallback: try scope = accountName (some contracts like gpkcrashpack use this)
    if (accountName) {
      const fallback = await fetchTableRows<UnboxResultRow>({
        code: contract, scope: accountName, table: 'unboxassets',
        limit: 100,
      });
      return fallback.rows;
    }
    return [];
  } catch (e) {
    console.error('[AtomicReveal] fetchUnboxResults error', e);
    return [];
  }
}

export function AtomicPackRevealDialog({
  open, onOpenChange, packName, packImage, packAssetId,
  unpackContract, expectedCards, accountName, session, onComplete, openMode = 'transfer',
  demoCards, onDemoCollect, transferTxId,
}: AtomicPackRevealDialogProps) {
  const isDemo = !!(demoCards && demoCards.length > 0);
  const [phase, setPhase] = useState<'waiting' | 'revealing' | 'collect' | 'collecting' | 'done' | 'stalled'>('waiting');
  const [newCards, setNewCards] = useState<RevealCard[]>([]);
  const [rollIds, setRollIds] = useState<number[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [waitMessage, setWaitMessage] = useState('');
  const [collectError, setCollectError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [showEscape, setShowEscape] = useState(false);
  const [randnotifyTxId, setRandnotifyTxId] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const pollStartRef = useRef<number>(0);

  usePackRevealAudio({ open, phase, isShaking, revealedCount });

  useEffect(() => {
    if (open) {
      setPhase('waiting'); setNewCards([]); setRollIds([]);
      setRevealedCount(0); setWaitMessage(''); setCollectError(null); setShowEscape(false);
      setRandnotifyTxId(null); setReportCopied(false);
      pollStartRef.current = Date.now();
      setIsShaking(true);
      const shakeTimer = setTimeout(() => setIsShaking(false), 3500);
      return () => clearTimeout(shakeTimer);
    } else {
      setIsShaking(false);
    }
  }, [open]);

  // Escape hatch: show close button after 60s of waiting
  useEffect(() => {
    if (!open || phase !== 'waiting') { setShowEscape(false); return; }
    const timer = setTimeout(() => setShowEscape(true), 60000);
    return () => clearTimeout(timer);
  }, [open, phase]);

  // Stalled-pack detection (RNG-based contracts only).
  // After ~45s of waiting, ask Hyperion whether `orng.wax::randnotify` already
  // fired for this pack on the unbox contract. If it did but `unboxassets` is
  // still empty after another grace window, the contract failed to consume the
  // RNG callback — the pack is burned with no recovery path from the client.
  useEffect(() => {
    if (!open || phase !== 'waiting' || isDemo || !packAssetId) return;
    if (openMode === 'unbox_nft') return; // unbox.nft uses a different flow
    let cancelled = false;
    let stalledTimer: ReturnType<typeof setTimeout> | undefined;

    const probe = async () => {
      try {
        const found = await findRandnotifyForPack(unpackContract, packAssetId);
        if (cancelled || !found) return;
        setRandnotifyTxId(found.trxId);
        // RNG already returned. If after 45 more seconds we still haven't
        // moved out of `waiting`, the contract did not process it.
        stalledTimer = setTimeout(() => {
          if (cancelled) return;
          setPhase((p) => {
            if (p !== 'waiting') return p;
            recordStuckPack({
              packAssetId,
              contract: unpackContract,
              packName,
              account: accountName,
              transferTxId: transferTxId ?? null,
              randnotifyTxId: found.trxId || null,
              timestamp: Date.now(),
            });
            return 'stalled';
          });
        }, 45000);
      } catch {
        /* probe is best-effort */
      }
    };

    const startProbe = setTimeout(probe, 45000);
    return () => {
      cancelled = true;
      clearTimeout(startProbe);
      if (stalledTimer) clearTimeout(stalledTimer);
    };
  }, [open, phase, isDemo, openMode, unpackContract, packAssetId, packName, accountName, transferTxId]);

  // Demo mode: skip polling, show cards after shake
  useEffect(() => {
    if (!open || phase !== 'waiting' || !isDemo) return;
    const timer = setTimeout(() => { setNewCards(demoCards!); setPhase('revealing'); }, 4000);
    return () => clearTimeout(timer);
  }, [open, phase, isDemo, demoCards]);

  // Snapshot asset IDs before opening so we can detect new ones for unbox_nft
  const preOpenAssetIdsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    if (!open || !packAssetId || phase !== 'waiting' || isDemo) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    // Snapshot current assets for unbox_nft mode
    const snapshotAndStart = async () => {
      if (openMode === 'unbox_nft') {
        try {
          const params = new URLSearchParams({
            owner: accountName, collection_name: 'gpk.topps',
            sort: 'asset_id', order: 'desc', limit: '100',
          });
          const path = `${ATOMIC_API.paths.assets}?${params}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
          const json = await response.json();
          if (json.success && json.data) {
            preOpenAssetIdsRef.current = new Set(json.data.map((a: any) => a.asset_id));
          }
        } catch (e) { console.warn('[AtomicReveal] snapshot failed', e); }
      }
    };

    const poll = async () => {
      try {
        if (cancelled) return;
        const elapsed = Date.now() - pollStartRef.current;
        if (elapsed > 90000) setWaitMessage('The indexer is running behind, but don\'t worry — your cards are definitely coming. Hang in there!');
        else if (elapsed > 60000) setWaitMessage('Almost there — the blockchain is a little busy right now. Your cards are safe and will appear shortly.');
        else if (elapsed > 30000) setWaitMessage('Still working... the indexer is processing your cards. Sit tight!');

        if (openMode === 'unbox_nft') {
          // For unbox.nft: poll the atomic assets API for new assets
          const params = new URLSearchParams({
            owner: accountName, collection_name: 'gpk.topps',
            sort: 'asset_id', order: 'desc', limit: '100',
          });
          const path = `${ATOMIC_API.paths.assets}?${params}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
          const json = await response.json();
          if (!json.success || !json.data) return;
          
          const newAssets = json.data.filter((a: any) => !preOpenAssetIdsRef.current.has(a.asset_id));
          if (newAssets.length >= expectedCards) {
            clearInterval(interval);
            const cards: RevealCard[] = newAssets.slice(0, expectedCards).map((a: any) => {
              const idata = a.template?.immutable_data || {};
              const img = resolveImage(idata.img || idata.image);
              return {
                asset_id: a.asset_id,
                name: idata.name || a.name || `Card`,
                image: img,
                rarity: '',
              };
            });
            setNewCards(cards);
            setRollIds([]); // No roll IDs for unbox.nft
            setPhase('revealing');
          }
        } else {
          // Standard flow: poll unboxassets table
          const rows = await fetchUnboxResults(unpackContract, packAssetId, accountName);
          if (cancelled) return;
          if (rows.length >= expectedCards) {
            clearInterval(interval);
            const templateData = await Promise.all(rows.map((r) => fetchTemplateImage(r.template_id)));
            const cards: RevealCard[] = rows.map((r, i) => ({
              asset_id: `${r.pack_asset_id}-${r.origin_roll_id}`,
              name: templateData[i].name, image: templateData[i].image, rarity: '',
            }));
            setNewCards(cards); setRollIds(rows.map((r) => r.origin_roll_id)); setPhase('revealing');
          }
        }
      } catch (e) { console.error('[AtomicReveal] poll error', e); }
    };

    const startDelay = setTimeout(async () => {
      if (cancelled) return;
      await snapshotAndStart();
      poll();
      interval = setInterval(poll, POLL_INTERVAL);
    }, 4000);
    return () => { cancelled = true; clearTimeout(startDelay); clearInterval(interval); };
  }, [open, phase, packAssetId, unpackContract, expectedCards, openMode, accountName]);

  useEffect(() => {
    if (phase !== 'revealing' || newCards.length === 0 || revealedCount >= newCards.length) return;
    const timer = setTimeout(() => {
      setRevealedCount((c) => c + 1);
      setTimeout(() => playCardRevealSound(), 600);
    }, 1600);
    return () => clearTimeout(timer);
  }, [phase, revealedCount, newCards.length]);

  useEffect(() => {
    if (phase === 'revealing' && revealedCount >= newCards.length && newCards.length > 0) {
      if (isDemo) {
        setPhase('collect');
      } else if (openMode === 'unbox_nft') {
        setPhase('collect');
      } else if (rollIds.length > 0) {
        setPhase('collect');
      }
    }
  }, [phase, revealedCount, newCards.length, rollIds, openMode, isDemo]);

  // Auto-close dialog after cards are collected (standard mode only)
  useEffect(() => {
    if (phase !== 'done') return;
    // For unbox_nft, the Done button already closed — this handles standard collect
    const timer = setTimeout(() => {
      onOpenChange(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [phase, onOpenChange]);

  const handleCollect = useCallback(async () => {
    // Demo mode: just close and trigger callback
    if (isDemo) {
      setPhase('done');
      onOpenChange(false);
      onDemoCollect?.();
      return;
    }
    // For unbox_nft: no blockchain claim needed, just close with a marker
    if (openMode === 'unbox_nft') {
      setPhase('done');
      onComplete('unbox_nft_complete');
      setTimeout(() => onOpenChange(false), 1500);
      return;
    }
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
  }, [session, packAssetId, rollIds, unpackContract, onComplete, openMode, onOpenChange, isDemo, onDemoCollect]);

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
              <p className="text-xs text-muted-foreground/60 max-w-sm text-center">{waitMessage || 'This can take a few seconds to 2–3 minutes depending on the indexer. Don\'t worry — your cards are on their way! You\'ll hear bell rings when they\'re revealed.'}</p>
            </div>
            {showEscape && (
              <div className="flex flex-col items-center gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  Close & Check Later
                </Button>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Your pack was sent — cards may still arrive. Check your collection or try again later.
                </p>
              </div>
            )}
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
                  <AtomicRevealCardImage key={card.asset_id} card={card} isRevealed={isRevealed} packImage={packImage} />
                );
              })}
            </div>
            {phase === 'collect' && (
              <div className="flex flex-col items-center gap-3 pt-2">
                {collectError && <p className="text-xs text-destructive text-center">{collectError}</p>}
                {isDemo ? (
                  <>
                    <Button onClick={handleCollect} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Download className="h-4 w-4 mr-2" />Collect Assets
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">Click to see your cards added to the collection</p>
                  </>
                ) : openMode === 'unbox_nft' ? (
                  <>
                    <Button onClick={handleCollect} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Sparkles className="h-4 w-4 mr-2" />View in Collection
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">Your cards are already in your wallet</p>
                  </>
                ) : (
                  <>
                    <Button onClick={handleCollect} className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={!session}>
                      <Download className="h-4 w-4 mr-2" />Collect Assets
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">Sign a transaction to deliver these cards to your wallet</p>
                  </>
                )}
              </div>
            )}
            {phase === 'collecting' && (
              <div className="flex justify-center pt-2">
                <Button disabled className="bg-primary/70 text-primary-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Collecting...</Button>
              </div>
            )}
            {phase === 'done' && (
              <div className="flex justify-center pt-2">
                <p className="text-sm text-muted-foreground animate-pulse">Closing...</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
