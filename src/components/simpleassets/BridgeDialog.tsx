import { useMemo, useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { useWax } from '@/context/WaxContext';
import { getTransactPlugins, closeWharfkitModals } from '@/lib/wharfKit';
import { toast } from 'sonner';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import {
  buildBridgeToAaActions,
  buildBridgeToSaActions,
  isUnbridgeable,
  validateBridge,
  MAX_BRIDGE_PER_TX,
} from '@/lib/bridgeActions';

interface BridgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: SimpleAsset[];
  onSuccess: (txId: string | null, direction: 'to-aa' | 'to-sa', count: number) => void;
}

type Direction = 'to-aa' | 'to-sa';

export function BridgeDialog({ open, onOpenChange, assets, onSuccess }: BridgeDialogProps) {
  const { session } = useWax();
  const [direction, setDirection] = useState<Direction>('to-aa');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBridging, setIsBridging] = useState(false);

  // SA -> AA: every SimpleAssets card can be bridged across.
  const saAssets = useMemo(() => assets.filter((a) => a.source === 'simpleassets'), [assets]);
  // AA -> SA: only bridged AtomicAssets cards (carrying sassets_id) have an
  // original SimpleAssets card waiting in the bridge's custody.
  const bridgedAaAssets = useMemo(
    () => assets.filter((a) => a.source === 'atomicassets' && isUnbridgeable(a.idata)),
    [assets],
  );

  const eligible = direction === 'to-aa' ? saAssets : bridgedAaAssets;
  const selected = eligible.filter((a) => selectedIds.has(a.id));
  const validation = validateBridge(selected.map((a) => a.id));

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const switchDirection = (value: string) => {
    setDirection(value as Direction);
    setSelectedIds(new Set());
  };

  const handleBridge = async () => {
    if (!session || !validation.ok) return;
    setIsBridging(true);
    try {
      const actor = session.actor.toString();
      const ids = selected.map((a) => a.id);
      const actions = direction === 'to-aa'
        ? buildBridgeToAaActions(actor, ids)
        : buildBridgeToSaActions(actor, ids);

      const result = await session.transact(
        { actions },
        { transactPlugins: getTransactPlugins(session) },
      );
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast.success(
        direction === 'to-aa'
          ? `Bridged ${ids.length} card${ids.length !== 1 ? 's' : ''} to AtomicAssets`
          : `Bridged ${ids.length} card${ids.length !== 1 ? 's' : ''} back to SimpleAssets`,
      );
      setSelectedIds(new Set());
      onOpenChange(false);
      onSuccess(txId, direction, ids.length);
    } catch (error) {
      console.error('Bridge failed:', error);
      toast.error(error instanceof Error ? error.message : 'Bridge failed');
    } finally {
      setIsBridging(false);
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const renderGrid = (list: SimpleAsset[], emptyText: string) => {
    if (list.length === 0) {
      return <p className="text-sm text-muted-foreground p-2">{emptyText}</p>;
    }
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-1">
        {list.map((asset) => {
          const isSelected = selectedIds.has(asset.id);
          return (
            <button
              key={asset.id}
              type="button"
              onClick={() => toggle(asset.id)}
              className={`relative rounded-md border p-1.5 text-left transition-colors ${
                isSelected
                  ? 'border-cheese bg-cheese/15 ring-1 ring-cheese'
                  : 'border-border bg-background/60 hover:border-cheese/50'
              }`}
            >
              <div className="aspect-[3/4] w-full overflow-hidden rounded-sm bg-muted">
                <IpfsMedia
                  url={asset.images?.[0] || asset.image}
                  alt={asset.name}
                  context="card"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mt-1 truncate text-[11px] text-foreground">{asset.name}</p>
              {isSelected && (
                <span className="absolute right-1 top-1 rounded-full bg-cheese px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelectedIds(new Set()); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-cheese" />
            Bridge Cards
          </DialogTitle>
          <DialogDescription>
            Move cards between SimpleAssets and AtomicAssets. Cards are never burned — the bridge
            holds them in custody until they come back.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={direction} onValueChange={switchDirection}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="to-aa">To AtomicAssets ({saAssets.length})</TabsTrigger>
            <TabsTrigger value="to-sa">To SimpleAssets ({bridgedAaAssets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="to-aa">
            <p className="text-xs text-muted-foreground mb-2">
              Select SimpleAssets cards to bridge to AtomicAssets. You will receive the AtomicAssets
              copies in the same transaction.
            </p>
            <ScrollArea className="h-72">
              {renderGrid(saAssets, 'No SimpleAssets cards in this wallet.')}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="to-sa">
            <p className="text-xs text-muted-foreground mb-2">
              Only AtomicAssets cards that were originally bridged from SimpleAssets can go back —
              your original SimpleAssets card is returned to you. Cards minted natively on
              AtomicAssets are not listed.
            </p>
            <ScrollArea className="h-72">
              {renderGrid(
                bridgedAaAssets,
                'No bridged AtomicAssets cards in this wallet. Only cards that came from SimpleAssets can be bridged back.',
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {selected.length > MAX_BRIDGE_PER_TX && (
          <p className="text-xs text-destructive">
            Too many cards selected — the bridge can handle at most {MAX_BRIDGE_PER_TX} per transaction.
          </p>
        )}

        <Button
          onClick={handleBridge}
          disabled={!validation.ok || isBridging}
          className="w-full bg-cheese hover:bg-cheese/90 text-primary-foreground"
        >
          {isBridging ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Bridging...</>
          ) : (
            <>
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Bridge {selected.length} card{selected.length !== 1 ? 's' : ''}{' '}
              {direction === 'to-aa' ? 'to AtomicAssets' : 'to SimpleAssets'}
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
