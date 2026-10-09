import { useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariantFilterPopover } from '@/components/simpleassets/VariantFilterPopover';
import { CATEGORY_LABELS, deriveVariantOptions, normalizeAssetCategory } from '@/lib/gpkCategories';
import { normalizeGpkVariant } from '@/lib/gpkVariant';
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
  const [category, setCategory] = useState('series1');
  const [variants, setVariants] = useState<string[]>(['all']);

  useEffect(() => {
    if (!open) return;
    setDirection('to-aa');
    setCategory('series1');
    setVariants(['all']);
    setSelectedIds(new Set());
  }, [open]);

  // SA -> AA: every SimpleAssets card can be bridged across.
  const saAssets = useMemo(() => assets.filter((a) => a.source === 'simpleassets'), [assets]);
  // AA -> SA: only bridged AtomicAssets cards (carrying sassets_id) have an
  // original SimpleAssets card waiting in the bridge's custody.
  const bridgedAaAssets = useMemo(
    () => assets.filter((a) => a.source === 'atomicassets' && isUnbridgeable(a.idata)),
    [assets],
  );

  const eligible = direction === 'to-aa' ? saAssets : bridgedAaAssets;
  const categories = useMemo(() => {
    const known = ['series1', 'series2', 'exotic', 'crashgordon', 'bernventures', 'mittens', 'gamestonk', 'foodfightb', 'bonus', 'originalart', 'promo'];
    const extra = [...new Set(eligible.map(a => normalizeAssetCategory(a.category)))].filter(c => c && c !== 'packs' && !known.includes(c)).sort();
    return [...known, ...extra];
  }, [eligible]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of eligible) {
      const key = normalizeAssetCategory(asset.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [eligible]);
  const categoryAssets = eligible.filter(a => category === 'all' || normalizeAssetCategory(a.category) === category);
  const variantCounts = new Map<string, number>();
  for (const asset of categoryAssets) {
    const key = normalizeGpkVariant(asset.quality);
    if (key) variantCounts.set(key, (variantCounts.get(key) ?? 0) + 1);
  }
  const variantOptions = category === 'all' ? [] : deriveVariantOptions(category, variantCounts.keys());
  const visible = categoryAssets.filter(a => variants.includes('all') || variants.includes(normalizeGpkVariant(a.quality)));
  const selected = visible.filter((a) => selectedIds.has(a.id));
  const allSelected = visible.length > 0 && selected.length === visible.length;
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-1">
        {list.map((asset) => {
          const isSelected = selectedIds.has(asset.id);
          return (
            <Button
              key={asset.id}
              type="button"
              variant="ghost"
              aria-pressed={isSelected}
              disabled={isBridging}
              onClick={() => toggle(asset.id)}
              className={`relative block h-auto min-w-0 whitespace-normal rounded-md border p-1.5 text-left transition-colors ${
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
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelectedIds(new Set()); onOpenChange(v); }}>
      <DialogContent className="flex h-[90dvh] max-h-[1100px] w-[calc(100%-2rem)] max-w-[1344px] flex-col overflow-hidden p-4 sm:p-6">
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

        <Tabs value={direction} onValueChange={switchDirection} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="to-aa" disabled={isBridging}>To AtomicAssets ({saAssets.length})</TabsTrigger>
            <TabsTrigger value="to-sa" disabled={isBridging}>To SimpleAssets ({bridgedAaAssets.length})</TabsTrigger>
          </TabsList>

          <div className="my-3 flex flex-wrap items-center gap-3">
            <Select value={category} disabled={isBridging} onValueChange={value => {
              setCategory(value);
              setVariants(['all']);
              setSelectedIds(new Set());
            }}>
              <SelectTrigger aria-label="Collection" className="w-full sm:w-[220px] border-cheese/50 text-cheese theme-bright-border theme-bright-text">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories ({eligible.length})</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c} ({categoryCounts.get(c) ?? 0})</SelectItem>)}
              </SelectContent>
            </Select>
            <div className={isBridging ? 'pointer-events-none opacity-50' : ''}>
              <VariantFilterPopover category={category} value={variants} variants={variantOptions} counts={variantCounts} onChange={value => {
                if (isBridging) return;
                setVariants(value);
                setSelectedIds(new Set());
              }} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox aria-label="Select all" checked={allSelected ? true : selected.length > 0 ? 'indeterminate' : false} disabled={visible.length === 0 || isBridging} onCheckedChange={checked => {
                setSelectedIds(checked === true ? new Set(visible.map(a => a.id)) : new Set());
              }} />
              Select all ({visible.length})
            </label>
            <span className="text-sm text-muted-foreground sm:ml-auto">{selected.length} selected · max {MAX_BRIDGE_PER_TX} per transaction</span>
          </div>

          <TabsContent value="to-aa" className="mt-0 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
            <p className="text-xs text-muted-foreground mb-2">
              Select SimpleAssets cards to bridge to AtomicAssets. You will receive the AtomicAssets
              copies in the same transaction.
            </p>
            <ScrollArea className="min-h-0 flex-1">
              {renderGrid(visible, 'No SimpleAssets cards match these filters.')}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="to-sa" className="mt-0 min-h-0 flex-1 data-[state=active]:flex data-[state=active]:flex-col">
            <p className="text-xs text-muted-foreground mb-2">
              Only AtomicAssets cards that were originally bridged from SimpleAssets can go back —
              your original SimpleAssets card is returned to you. Cards minted natively on
              AtomicAssets are not listed.
            </p>
            <ScrollArea className="min-h-0 flex-1">
              {renderGrid(
                visible,
                'No bridged AtomicAssets cards match these filters. Only cards that came from SimpleAssets can be bridged back.',
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
