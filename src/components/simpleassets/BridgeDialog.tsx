import { useState } from 'react';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { getTransactPlugins, closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import {
  buildBridgeToAaActions,
  buildBridgeToSaActions,
  getBridgeEligibility,
  validateBridge,
  type BridgeDirection,
} from '@/lib/bridgeActions';

interface BridgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAssets: SimpleAsset[];
  onSuccess: (txId: string | null, direction: BridgeDirection, count: number) => void;
}

export function BridgeDialog({ open, onOpenChange, selectedAssets, onSuccess }: BridgeDialogProps) {
  const { session } = useWax();
  const [isBridging, setIsBridging] = useState(false);
  const { direction, reason } = getBridgeEligibility(selectedAssets);
  const ids = selectedAssets.map((a) => a.id);
  const canBridge = direction !== null && validateBridge(ids).ok;
  const n = selectedAssets.length;
  const plural = `card${n !== 1 ? 's' : ''}`;

  const handleBridge = async () => {
    if (!session || !canBridge || !direction) return;
    setIsBridging(true);
    try {
      const actor = session.actor.toString();
      const actions = direction === 'to-aa'
        ? buildBridgeToAaActions(actor, ids)
        : buildBridgeToSaActions(actor, ids);
      const result = await session.transact(
        { actions },
        { transactPlugins: getTransactPlugins(session) },
      );
      const txId = result.resolved?.transaction.id?.toString() || null;
      toast.success(direction === 'to-aa'
        ? `Bridged ${n} ${plural} to AtomicAssets`
        : `Bridged ${n} ${plural} back to SimpleAssets`);
      onOpenChange(false);
      onSuccess(txId, direction, n);
    } catch (error) {
      console.error('Bridge failed:', error);
      toast.error(error instanceof Error ? error.message : 'Bridge failed');
    } finally {
      setIsBridging(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-cheese" />
            Bridge {n} {plural}
          </DialogTitle>
          <DialogDescription>
            {direction === 'to-aa' && 'SimpleAssets → AtomicAssets. '}
            {direction === 'to-sa' && 'AtomicAssets → SimpleAssets. Your original SimpleAssets cards are returned. '}
            Cards are never burned — the bridge holds them in custody until they come back.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="flex flex-wrap gap-2 p-1">
            {selectedAssets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1">
                <IpfsMedia url={asset.images?.[0] || asset.image} alt={asset.name} className="h-8 w-8 rounded object-contain" context="card" />
                <span className="max-w-[100px] truncate text-xs">{asset.name}</span>
              </div>
            ))}
          </div>
        </ScrollArea>

        {!direction && reason && <p className="text-xs text-destructive">{reason}</p>}

        <Button
          onClick={handleBridge}
          disabled={!canBridge || isBridging}
          className="mt-2 w-full bg-cheese text-primary-foreground hover:bg-cheese/90"
        >
          {isBridging ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Bridging...</>
          ) : (
            <>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Bridge {n} {plural} {direction === 'to-sa' ? 'to SimpleAssets' : 'to AtomicAssets'}
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
