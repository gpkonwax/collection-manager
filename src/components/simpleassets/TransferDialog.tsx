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
import { Send, Loader2 } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { getTransactPlugins } from '@/lib/wharfKit';
import { closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAssets: SimpleAsset[];
  onSuccess: (txId: string | null) => void;
}

const WAX_ACCOUNT_REGEX = /^[a-z1-5.]{1,12}$/;

export function TransferDialog({ open, onOpenChange, selectedAssets, onSuccess }: TransferDialogProps) {
  const { session } = useWax();
  const [recipient, setRecipient] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const isValidRecipient = WAX_ACCOUNT_REGEX.test(recipient);
  const saAssets = selectedAssets.filter(a => a.source === 'simpleassets');
  const aaAssets = selectedAssets.filter(a => a.source === 'atomicassets');

  const handleSend = async () => {
    if (!session || !isValidRecipient || selectedAssets.length === 0) return;

    setIsSending(true);
    try {
      const actor = session.actor.toString();
      const auth = [session.permissionLevel];
      const actions: any[] = [];

      if (saAssets.length > 0) {
        actions.push({
          account: 'simpleassets',
          name: 'transfer',
          authorization: auth,
          data: {
            from: actor,
            to: recipient,
            assetids: saAssets.map(a => a.id),
            memo: memo || 'transfer',
          },
        });
      }

      if (aaAssets.length > 0) {
        actions.push({
          account: 'atomicassets',
          name: 'transfer',
          authorization: auth,
          data: {
            from: actor,
            to: recipient,
            asset_ids: aaAssets.map(a => a.id),
            memo: memo || 'transfer',
          },
        });
      }

      const result = await session.transact(
        { actions },
        { transactPlugins: getTransactPlugins(session) }
      );
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast.success(`Transferred ${selectedAssets.length} NFT(s) to ${recipient}`);
      setRecipient('');
      setMemo('');
      onOpenChange(false);
      onSuccess(txId);
    } catch (error) {
      console.error('Transfer failed:', error);
      toast.error(error instanceof Error ? error.message : 'Transfer failed');
    } finally {
      setIsSending(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer {selectedAssets.length} NFT{selectedAssets.length !== 1 ? 's' : ''}</DialogTitle>
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

        <div className="space-y-3 mt-2">
          <div>
            <label className="text-sm font-medium text-foreground">Recipient</label>
            <Input
              placeholder="WAX account name"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.toLowerCase())}
              className={`mt-1 ${recipient && !isValidRecipient ? 'border-destructive' : ''}`}
            />
            {recipient && !isValidRecipient && (
              <p className="text-xs text-destructive mt-1">Invalid WAX account (a-z, 1-5, dots, max 12 chars)</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Memo (optional)</label>
            <Input
              placeholder="Optional memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <Button
          onClick={handleSend}
          disabled={!isValidRecipient || isSending || selectedAssets.length === 0}
          className="w-full mt-2 bg-cheese hover:bg-cheese/90 text-primary-foreground"
        >
          {isSending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />Send {selectedAssets.length} NFT{selectedAssets.length !== 1 ? 's' : ''}</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
