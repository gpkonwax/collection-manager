import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Session } from '@wharfkit/session';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { AtomicPackRevealDialog } from './AtomicPackRevealDialog';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';

interface AtomicPackCardProps {
  pack: AtomicPack;
  session: Session | null;
  accountName: string;
  onSuccess?: (txId?: string | null) => void;
}

export function AtomicPackCard({ pack, session, accountName, onSuccess }: AtomicPackCardProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [openedAssetId, setOpenedAssetId] = useState<string | null>(null);
  const { executeTransaction } = useWaxTransaction(session);

  const handleOpen = useCallback(async () => {
    if (!session || pack.assetIds.length === 0) return;
    setIsOpening(true);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    const assetId = pack.assetIds[0];
    try {
      const result = await executeTransaction([{
        account: 'atomicassets', name: 'transfer', authorization: auth,
        data: { from: actor, to: pack.unpackContract, asset_ids: [assetId], memo: 'unbox' },
      }], { successTitle: 'Pack Sent!', successDescription: `Your ${pack.name} has been sent for unboxing. Revealing cards...` });
      if (result.success) { setOpenedAssetId(assetId); setRevealOpen(true); }
    } finally { setIsOpening(false); }
  }, [session, pack, executeTransaction]);

  const handleRevealComplete = useCallback(() => { onSuccess?.(); }, [onSuccess]);

  return (
    <>
      <Card className="bg-card border-border hover:border-primary/40 transition-colors">
        <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
          <img src={pack.image} alt={pack.name} className="w-3/4 h-auto rounded mx-auto" />
          <p className="font-bold text-foreground text-sm">{pack.name}</p>
          <p className="text-xs text-muted-foreground">{pack.cardsPerPack} cards per pack</p>
          <p className="text-lg font-mono text-primary">{pack.count}</p>
          <Button size="sm" variant="outline" className="w-full text-xs" disabled={!session || isOpening || pack.count === 0} onClick={handleOpen}>
            {isOpening ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Opening...</> : 'Open Pack'}
          </Button>
        </CardContent>
      </Card>
      <AtomicPackRevealDialog open={revealOpen} onOpenChange={setRevealOpen} packName={pack.name} packImage={pack.image}
        packAssetId={openedAssetId} unpackContract={pack.unpackContract} expectedCards={pack.cardsPerPack}
        accountName={accountName} session={session} onComplete={handleRevealComplete} />
    </>
  );
}
