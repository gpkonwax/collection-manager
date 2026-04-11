import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Session } from '@wharfkit/session';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { AtomicPackRevealDialog } from './AtomicPackRevealDialog';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';

const PACKS_PER_PAGE = 10;

interface AtomicPackBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pack: AtomicPack;
  session: Session | null;
  accountName: string;
  onSuccess?: (txId?: string | null) => void;
}

export function AtomicPackBrowserDialog({
  open, onOpenChange, pack, session, accountName, onSuccess,
}: AtomicPackBrowserDialogProps) {
  const [page, setPage] = useState(0);
  const [openingIdx, setOpeningIdx] = useState<number | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [openedAssetId, setOpenedAssetId] = useState<string | null>(null);
  const [localAssetIds, setLocalAssetIds] = useState<string[]>(pack.assetIds);
  const [localMints, setLocalMints] = useState<number[]>(pack.mints ?? []);
  const { executeTransaction } = useWaxTransaction(session);

  // Sync when pack data changes externally
  useEffect(() => {
    setLocalAssetIds(pack.assetIds);
    setLocalMints(pack.mints ?? []);
  }, [pack.assetIds, pack.mints]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (v) {
      setLocalAssetIds(pack.assetIds);
      setLocalMints(pack.mints ?? []);
    }
    setPage(0);
    onOpenChange(v);
  }, [pack.assetIds, pack.mints, onOpenChange]);

  const localCount = localAssetIds.length;
  const totalPages = Math.ceil(localCount / PACKS_PER_PAGE);
  const startIdx = page * PACKS_PER_PAGE;
  const visibleCount = Math.min(PACKS_PER_PAGE, localCount - startIdx);

  const handleOpen = useCallback(async (idx: number) => {
    if (!session) return;
    const globalIdx = startIdx + idx;
    const assetId = localAssetIds[globalIdx];
    if (!assetId) return;

    setOpeningIdx(globalIdx);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];

    try {
      const result = await executeTransaction([{
        account: 'atomicassets', name: 'transfer', authorization: auth,
        data: { from: actor, to: pack.unpackContract, asset_ids: [assetId], memo: 'unbox' },
      }], { successTitle: 'Pack Sent!', successDescription: `Your ${pack.name} has been sent for unboxing. Revealing cards...` });

      if (result.success) {
        setOpenedAssetId(assetId);
        setLocalAssetIds(prev => prev.filter(id => id !== assetId));
        setLocalMints(prev => prev.filter((_, i) => localAssetIds[i] !== assetId));
        setRevealOpen(true);
        // Adjust page if we removed the last item on this page
        if (visibleCount === 1 && page > 0) setPage(p => p - 1);
      }
    } finally {
      setOpeningIdx(null);
    }
  }, [session, startIdx, localAssetIds, localMints, pack, executeTransaction, visibleCount, page]);

  const handleRevealComplete = useCallback((txId?: string | null) => {
    onSuccess?.(txId);
    if (localAssetIds.length <= 0) onOpenChange(false);
  }, [onSuccess, localAssetIds.length, onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {pack.name} — {localCount} pack{localCount !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: visibleCount }, (_, i) => {
              const globalIdx = startIdx + i;
              const isThis = openingIdx === globalIdx;
              return (
                <Card key={localAssetIds[globalIdx]} className="bg-card border-border hover:border-primary/40 transition-colors">
                  <CardContent className="p-3 flex flex-col items-center text-center space-y-2">
                    <img src={pack.image} alt={pack.name} className="w-3/4 h-auto rounded mx-auto" />
                    <p className="text-xs text-muted-foreground">Mint #{localMints[globalIdx] || globalIdx + 1}</p>
                    <Button size="sm" variant="outline" className="w-full text-xs"
                      disabled={!session || openingIdx !== null}
                      onClick={() => handleOpen(i)}>
                      {isThis ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Opening...</> : 'Open'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AtomicPackRevealDialog open={revealOpen} onOpenChange={setRevealOpen} packName={pack.name} packImage={pack.image}
        packAssetId={openedAssetId} unpackContract={pack.unpackContract} expectedCards={pack.cardsPerPack}
        accountName={accountName} session={session} onComplete={handleRevealComplete} />
    </>
  );
}
