import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import { Session } from '@wharfkit/session';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { AtomicPackRevealDialog } from './AtomicPackRevealDialog';
import { AtomicPackBrowserDialog } from './AtomicPackBrowserDialog';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';
import { buildOpenPackActions } from '@/lib/packOpenActions';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface RevealCard {
  asset_id: string;
  name: string;
  image: string | null;
  rarity: string;
}

interface AtomicPackCardProps {
  pack: AtomicPack;
  session: Session | null;
  accountName: string;
  onSuccess?: (txId?: string | null) => void;
  onDemoCollect?: (demoAssets: SimpleAsset[]) => void;
  collectionAssets?: SimpleAsset[];
}

export function AtomicPackCard({ pack, session, accountName, onSuccess, onDemoCollect, collectionAssets = [] }: AtomicPackCardProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [openedAssetId, setOpenedAssetId] = useState<string | null>(null);
  const [demoRevealOpen, setDemoRevealOpen] = useState(false);
  const { executeTransaction } = useWaxTransaction(session);

  const hasMultiple = pack.count > 1;
  const isDisabled = pack.packConfig.disabled === true;

  const demoAssetsSample = useMemo(() => {
    if (collectionAssets.length === 0) return [];
    const shuffled = [...collectionAssets].sort(() => Math.random() - 0.5);
    const result: SimpleAsset[] = [];
    for (let i = 0; i < pack.cardsPerPack; i++) {
      result.push({ ...shuffled[i % shuffled.length], id: `demo-${shuffled[i % shuffled.length].id}-${i}` });
    }
    return result;
  }, [collectionAssets, pack.cardsPerPack]);

  const demoCards = useMemo((): RevealCard[] => {
    return demoAssetsSample.map((a, i) => ({
      asset_id: `demo-${a.id}-${i}`, name: a.name, image: a.image || null, rarity: a.quality || '',
    }));
  }, [demoAssetsSample]);

  const handleOpenSingle = useCallback(async () => {
    if (!session || pack.assetIds.length === 0) return;
    setIsOpening(true);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    const assetId = pack.assetIds[0];
    try {
      const actions = buildOpenPackActions(pack, assetId, actor, auth);
      const result = await executeTransaction(actions, {
        successTitle: 'Pack Sent!',
        successDescription: `Your ${pack.name} has been sent for unboxing. Revealing cards...`,
      });
      if (result.success) { setOpenedAssetId(assetId); setRevealOpen(true); }
    } finally { setIsOpening(false); }
  }, [session, pack, executeTransaction]);

  const handleRevealComplete = useCallback((txId?: string | null) => { onSuccess?.(txId); }, [onSuccess]);

  const handleClick = useCallback(() => {
    if (hasMultiple) {
      setBrowserOpen(true);
    } else {
      handleOpenSingle();
    }
  }, [hasMultiple, handleOpenSingle]);

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
          <img src={pack.image} alt={pack.name} className="w-3/4 h-auto rounded mx-auto" />
          <p className="font-bold text-foreground text-sm">{pack.name}</p>
          <p className="text-xs text-muted-foreground">{pack.cardsPerPack} cards per pack</p>
          <p className="text-lg font-mono text-primary">{pack.count}</p>
          {isDisabled ? (
            <div className="w-full space-y-1">
              <Button size="sm" className="w-full text-xs" disabled>
                Opening Disabled
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">{pack.packConfig.disabledReason}</p>
            </div>
          ) : (
            <Button size="sm" className="w-full text-xs bg-cheese hover:bg-cheese/90 text-cheese-foreground"
              disabled={!session || isOpening || pack.count === 0} onClick={handleClick}>
              {isOpening ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Opening...</> : hasMultiple ? 'Open Packs' : 'Open Pack'}
            </Button>
          )}
          {demoCards.length > 0 && (
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => setDemoRevealOpen(true)}>
              <Play className="h-3 w-3 mr-1" /> Demo Open
            </Button>
          )}
        </CardContent>
      </Card>
      <AtomicPackRevealDialog open={revealOpen} onOpenChange={setRevealOpen} packName={pack.name} packImage={pack.image}
        packAssetId={openedAssetId} unpackContract={pack.unpackContract} expectedCards={pack.cardsPerPack}
        accountName={accountName} session={session} onComplete={handleRevealComplete} openMode={pack.openMode} />
      <AtomicPackRevealDialog open={demoRevealOpen} onOpenChange={setDemoRevealOpen} packName={pack.name} packImage={pack.image}
        packAssetId={null} unpackContract={pack.unpackContract} expectedCards={pack.cardsPerPack}
        accountName={accountName} session={session} onComplete={() => {}} openMode={pack.openMode}
        demoCards={demoCards} onDemoCollect={() => onDemoCollect?.(demoAssetsSample)} />
      <AtomicPackBrowserDialog open={browserOpen} onOpenChange={setBrowserOpen} pack={pack}
        session={session} accountName={accountName} onSuccess={onSuccess} />
    </>
  );
}