import { useState } from 'react';
import { SelectedAssetGrid } from '@/components/simpleassets/SelectedAssetGrid';
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
import type { GpkPack } from '@/hooks/useGpkPacks';
import type { AtomicPack } from '@/hooks/useGpkAtomicPacks';
import { buildPackTransferActions } from '@/lib/packTransferActions';
import { IpfsMedia } from './IpfsMedia';

/** Packs chosen for transfer. Token packs go by quantity, AtomicAssets packs by asset ID. */
export interface SelectedPacks {
  tokens: { pack: GpkPack; qty: number; image?: string }[];
  atomic: { pack: AtomicPack; ids: string[] }[];
}

export function countSelectedPacks(p: SelectedPacks | undefined): number {
  if (!p) return 0;
  return p.tokens.reduce((n, t) => n + t.qty, 0) + p.atomic.reduce((n, a) => n + a.ids.length, 0);
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAssets: SimpleAsset[];
  /** When set (and non-empty), the dialog transfers packs instead of cards. */
  selectedPacks?: SelectedPacks;
  onSuccess: (txId: string | null) => void;
}

const WAX_ACCOUNT_REGEX = /^[a-z1-5.]{1,12}$/;

export function TransferDialog({ open, onOpenChange, selectedAssets, selectedPacks, onSuccess }: TransferDialogProps) {
  const { session } = useWax();
  const [recipient, setRecipient] = useState('');
  const [memo, setMemo] = useState('');
  const [isSending, setIsSending] = useState(false);

  const packCount = countSelectedPacks(selectedPacks);
  const isPacks = packCount > 0;
  const itemCount = isPacks ? packCount : selectedAssets.length;
  const noun = isPacks ? 'Pack' : 'NFT';

  const isValidRecipient = WAX_ACCOUNT_REGEX.test(recipient);
  const saAssets = selectedAssets.filter(a => a.source === 'simpleassets');
  const aaAssets = selectedAssets.filter(a => a.source === 'atomicassets');

  const handleSend = async () => {
    if (!session || !isValidRecipient || itemCount === 0) return;

    setIsSending(true);
    try {
      const actor = session.actor.toString();
      const auth = [session.permissionLevel];
      const actions: any[] = [];

      if (isPacks && selectedPacks) {
        actions.push(...buildPackTransferActions({
          actor, auth, to: recipient, memo: memo || 'transfer',
          tokenQtys: new Map(selectedPacks.tokens.map(t => [t.pack.symbol, t.qty])),
          balances: selectedPacks.tokens.map(t => t.pack),
          atomicIds: selectedPacks.atomic.flatMap(a => a.ids),
          ownedAtomicIds: new Set(selectedPacks.atomic.flatMap(a => a.pack.assetIds)),
        }));
      } else {
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
      }

      const result = await session.transact(
        { actions },
        { transactPlugins: getTransactPlugins(session) }
      );
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast.success(`Transferred ${itemCount} ${noun.toLowerCase()}(s) to ${recipient}`);
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

  const tokenTotal = selectedPacks?.tokens.reduce((n, t) => n + t.qty, 0) ?? 0;
  const atomicTotal = selectedPacks?.atomic.reduce((n, a) => n + a.ids.length, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[46dvh] max-h-[800px] w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-3xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Transfer {itemCount} {noun}{itemCount !== 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            {isPacks ? (
              <>
                {tokenTotal > 0 && <span className="block text-xs">SimpleAssets packs (tokens): {tokenTotal}</span>}
                {atomicTotal > 0 && <span className="block text-xs">AtomicAssets packs (NFTs): {atomicTotal}</span>}
              </>
            ) : (
              <>
                {saAssets.length > 0 && <span className="block text-xs">SimpleAssets: {saAssets.length}</span>}
                {aaAssets.length > 0 && <span className="block text-xs">AtomicAssets: {aaAssets.length}</span>}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          {isPacks && selectedPacks ? (
            <div className="space-y-2 p-1">
              {selectedPacks.tokens.filter(t => t.qty > 0).map(t => (
                <div key={t.pack.symbol} className="flex items-center gap-3 rounded-md border border-border p-2">
                  {t.image ? <img src={t.image} alt={t.pack.label} className="h-16 w-12 rounded object-contain" /> : <span className="text-2xl">📦</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.pack.label}</p>
                    <p className="text-xs text-muted-foreground">Token pack · {t.pack.symbol}</p>
                  </div>
                  <span className="font-mono text-sm text-cheese">×{t.qty}</span>
                </div>
              ))}
              {selectedPacks.atomic.filter(a => a.ids.length > 0).map(a => (
                <div key={a.pack.templateId} className="flex items-center gap-3 rounded-md border border-border p-2">
                  <IpfsMedia url={a.pack.image} alt={a.pack.name} className="h-16 w-12 rounded" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.pack.name}</p>
                    <p className="text-xs text-muted-foreground">
                      NFT pack · {a.ids.map(id => { const i = a.pack.assetIds.indexOf(id); const m = a.pack.mints[i]; return m ? `#${m}` : id; }).join(', ')}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-cheese">×{a.ids.length}</span>
                </div>
              ))}
            </div>
          ) : (
            <SelectedAssetGrid assets={selectedAssets} />
          )}
        </ScrollArea>

        <div className="mt-2 shrink-0 space-y-3">
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
          disabled={!isValidRecipient || isSending || itemCount === 0}
          className="w-full shrink-0 mt-2 bg-cheese hover:bg-cheese/90 text-primary-foreground"
        >
          {isSending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />Send {itemCount} {noun}{itemCount !== 1 ? 's' : ''}</>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
