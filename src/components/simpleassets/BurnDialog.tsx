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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Flame, Loader2, AlertTriangle } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { getTransactPlugins } from '@/lib/wharfKit';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface BurnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAssets: SimpleAsset[];
  onSuccess: (txId: string | null) => void;
}

export function BurnDialog({ open, onOpenChange, selectedAssets, onSuccess }: BurnDialogProps) {
  const { session } = useWax();
  const [confirmation, setConfirmation] = useState('');
  const [isBurning, setIsBurning] = useState(false);

  const saAssets = selectedAssets.filter(a => a.source === 'simpleassets');
  const aaAssets = selectedAssets.filter(a => a.source === 'atomicassets');
  const isConfirmed = confirmation.toUpperCase() === 'BURN';

  const handleBurn = async () => {
    if (!session || !isConfirmed || selectedAssets.length === 0) return;

    setIsBurning(true);
    try {
      const actor = session.actor.toString();
      const auth = [session.permissionLevel];
      const actions: any[] = [];

      if (saAssets.length > 0) {
        actions.push({
          account: 'simpleassets',
          name: 'burn',
          authorization: auth,
          data: {
            owner: actor,
            assetids: saAssets.map(a => a.id),
            memo: 'burn',
          },
        });
      }

      if (aaAssets.length > 0) {
        for (const asset of aaAssets) {
          actions.push({
            account: 'atomicassets',
            name: 'burnasset',
            authorization: auth,
            data: {
              asset_owner: actor,
              asset_id: asset.id,
            },
          });
        }
      }

      const result = await session.transact(
        { actions },
        { transactPlugins: getTransactPlugins(session) }
      );
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast.success(`Burned ${selectedAssets.length} NFT(s)`);
      setConfirmation('');
      onOpenChange(false);
      onSuccess(txId);
    } catch (error) {
      console.error('Burn failed:', error);
      toast.error(error instanceof Error ? error.message : 'Burn failed');
    } finally {
      setIsBurning(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setConfirmation(''); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Flame className="h-5 w-5" />
            Burn {selectedAssets.length} NFT{selectedAssets.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {saAssets.length > 0 && <span className="block text-xs">SimpleAssets: {saAssets.length}</span>}
            {aaAssets.length > 0 && <span className="block text-xs">AtomicAssets: {aaAssets.length}</span>}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-40">
          <div className="flex flex-wrap gap-2 p-1">
            {selectedAssets.map(asset => (
              <div key={asset.id} className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1">
                <IpfsMedia url={asset.images?.[0] || asset.image} alt={asset.name} className="w-8 h-8 rounded object-contain" context="card" />
                <span className="text-xs truncate max-w-[100px]">{asset.name}</span>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex gap-2 items-start">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">
            This action is irreversible. Burned NFTs cannot be recovered.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">
            Type <span className="font-bold">BURN</span> to confirm
          </label>
          <Input
            placeholder="BURN"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="mt-1"
          />
        </div>

        <Button
          onClick={handleBurn}
          disabled={!isConfirmed || isBurning || selectedAssets.length === 0}
          variant="destructive"
          className="w-full mt-2"
        >
          {isBurning ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Burning...</>
          ) : (
            <><Flame className="h-4 w-4 mr-2" />Burn {selectedAssets.length} NFT{selectedAssets.length !== 1 ? 's' : ''}</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
