import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Session } from '@wharfkit/session';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { PackRevealDialog } from './PackRevealDialog';
import type { GpkPack } from '@/hooks/useGpkPacks';

const UNBOX_TYPE_MAP: Record<string, string> = {
  GPKFIVE: 'five', GPKMEGA: 'thirty',
  GPKTWOA: 'gpktwoeight', GPKTWOB: 'gpktwo25', GPKTWOC: 'gpktwo55',
  EXOFIVE: 'exotic5', EXOMEGA: 'exotic25',
};

const PACKS_PER_PAGE = 10;

interface PackBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pack: GpkPack;
  packImage?: string;
  session: Session | null;
  accountName: string;
  snapshotUnboxingIds: (owner: string) => Promise<Set<number>>;
  onSuccess?: (txId?: string | null) => void;
}

export function PackBrowserDialog({
  open, onOpenChange, pack, packImage, session, accountName, snapshotUnboxingIds, onSuccess,
}: PackBrowserDialogProps) {
  const [page, setPage] = useState(0);
  const [openingIdx, setOpeningIdx] = useState<number | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [preOpenIds, setPreOpenIds] = useState<Set<number>>(new Set());
  const [localCount, setLocalCount] = useState(pack.amount);
  const { executeTransaction } = useWaxTransaction(session);

  const handleOpenChange = useCallback((v: boolean) => {
    if (v) setLocalCount(pack.amount);
    setPage(0);
    onOpenChange(v);
  }, [pack.amount, onOpenChange]);

  const totalPages = Math.ceil(localCount / PACKS_PER_PAGE);
  const startIdx = page * PACKS_PER_PAGE;
  const visibleCount = Math.min(PACKS_PER_PAGE, localCount - startIdx);
  const unboxType = UNBOX_TYPE_MAP[pack.symbol];

  const handleOpen = useCallback(async (idx: number) => {
    if (!session || !unboxType) return;
    setOpeningIdx(idx);
    const actor = String(session.actor);
    const auth = [{ actor, permission: String(session.permission) }];
    const qty = pack.precision > 0 ? `${(1).toFixed(pack.precision)} ${pack.symbol}` : `1 ${pack.symbol}`;
    try {
      const snapshot = await snapshotUnboxingIds(accountName);
      setPreOpenIds(snapshot);
      const result = await executeTransaction([
        { account: 'packs.topps', name: 'transfer', authorization: auth, data: { from: actor, to: 'gpk.topps', quantity: qty, memo: '' } },
        { account: 'gpk.topps', name: 'unbox', authorization: auth, data: { from: actor, type: unboxType } },
      ], { successTitle: 'Pack Opened!', successDescription: `Your ${pack.label} has been opened. Revealing cards...` });
      if (result.success) {
        setLocalCount(prev => prev - 1);
        setRevealOpen(true);
        if (visibleCount === 1 && page > 0) setPage(p => p - 1);
      }
    } finally { setOpeningIdx(null); }
  }, [session, unboxType, pack, accountName, snapshotUnboxingIds, executeTransaction, visibleCount, page]);

  const handleRevealComplete = useCallback((txId?: string | null) => {
    onSuccess?.(txId);
    if (localCount <= 1) onOpenChange(false);
  }, [onSuccess, localCount, onOpenChange]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">{pack.label} — {localCount} pack{localCount !== 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: visibleCount }, (_, i) => {
              const globalIdx = startIdx + i;
              const isThis = openingIdx === globalIdx;
              return (
                <Card key={globalIdx} className="bg-card border-border hover:border-primary/40 transition-colors">
                  <CardContent className="p-3 flex flex-col items-center text-center space-y-2">
                    {packImage ? <img src={packImage} alt={pack.label} className="w-3/4 h-auto rounded mx-auto" /> : <span className="text-3xl">📦</span>}
                    <p className="text-xs text-muted-foreground">#{globalIdx + 1}</p>
                    <Button size="sm" variant="outline" className="w-full text-xs" disabled={!session || openingIdx !== null || !unboxType} onClick={() => handleOpen(globalIdx)}>
                      {isThis ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Opening...</> : 'Open'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <PackRevealDialog open={revealOpen} onOpenChange={setRevealOpen} packSymbol={pack.symbol} packLabel={pack.label}
        packImage={packImage} accountName={accountName} preOpenUnboxingIds={preOpenIds} onComplete={handleRevealComplete} session={session} />
    </>
  );
}
