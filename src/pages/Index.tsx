import { useState, useMemo, useRef, useCallback, useEffect, DragEvent } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { useSimpleAssets } from '@/hooks/useSimpleAssets';
import { useGpkAtomicAssets } from '@/hooks/useGpkAtomicAssets';
import { useGpkPacks } from '@/hooks/useGpkPacks';
import { useGpkAtomicPacks } from '@/hooks/useGpkAtomicPacks';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import { SimpleAssetDetailDialog } from '@/components/simpleassets/SimpleAssetDetailDialog';
import { GpkPackCard } from '@/components/simpleassets/GpkPackCard';
import { AtomicPackCard } from '@/components/simpleassets/AtomicPackCard';
import { fetchPendingNfts } from '@/components/simpleassets/PackRevealDialog';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import { toast } from 'sonner';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

const EMPTY = '__empty__';
const EXTRA_EMPTY_SLOTS = 6;

const CATEGORY_LABELS: Record<string, string> = {
  series1: 'Series 1', series2: 'Series 2', crashgordon: 'Crash Gordon',
  exotic: 'Tiger King', bernventures: 'Bernventures', mittens: 'Mittens',
  gamestonk: 'GameStonk', foodfightb: 'Food Fight', bonus: 'Bonus',
  promo: 'Promo', originalart: 'Original Art',
};

const PACK_CATEGORY_MAP: Record<string, string> = {
  GPKFIVE: 'series1', GPKMEGA: 'series1',
  GPKTWOA: 'series2', GPKTWOB: 'series2', GPKTWOC: 'series2',
};

const ATOMIC_PACK_CATEGORY_MAP: Record<string, string> = {
  '13778': 'crashgordon', '48479': 'bernventures', '51437': 'mittens',
  '53187': 'gamestonk', '59072': 'foodfightb', '59489': 'foodfightb',
  '59490': 'foodfightb', '59491': 'foodfightb', '59492': 'foodfightb',
};

function EmptySlot({ onDragOver, onDrop, isOver }: {
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  isOver: boolean;
}) {
  return (
    <div onDragOver={onDragOver} onDrop={onDrop} onDragLeave={(e) => e.stopPropagation()}
      className={`aspect-square rounded-lg border-2 border-dashed transition-all flex items-center justify-center
        ${isOver ? 'border-primary bg-primary/10 scale-105' : 'border-border/50 bg-muted/10'}`} />
  );
}

export default function SimpleAssetsPage() {
  const { accountName, isConnected, login, session } = useWax();
  const { assets: saAssets, isLoading: saLoading, error: saError, refetch: refetchSa } = useSimpleAssets(accountName);
  const { assets: aaAssets, isLoading: aaLoading, error: aaError, refetch: refetchAa } = useGpkAtomicAssets(accountName);
  const { packs, isLoading: packsLoading, refetch: refetchPacks } = useGpkPacks(accountName);
  const { packs: atomicPacks, isLoading: atomicPacksLoading, refetch: refetchAtomicPacks } = useGpkAtomicPacks(accountName);

  const { executeRawTransaction } = useWaxTransaction(session);

  const handlePackOpened = useCallback(() => {
    refetchPacks(); refetchAtomicPacks(); refetchSa(); refetchAa();
  }, [refetchPacks, refetchAtomicPacks, refetchSa, refetchAa]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('series1');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<SimpleAsset | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; title: string; description: string; txId: string | null }>({
    open: false, title: '', description: '', txId: null,
  });

  const handleCollectUnclaimed = useCallback(async () => {
    if (!accountName || !session) return;
    setIsCollecting(true);
    try {
      const rows = await fetchPendingNfts(accountName);
      const unclaimed = rows.filter((r: any) => r.done === 0);
      if (unclaimed.length === 0) {
        toast.info('No unclaimed cards found');
        setIsCollecting(false);
        return;
      }
      // Group by unboxingid
      const groups = new Map<number, number[]>();
      for (const row of unclaimed) {
        const uid = (row as any).unboxingid;
        if (!groups.has(uid)) groups.set(uid, []);
        groups.get(uid)!.push((row as any).id);
      }
      const actor = String(session.actor);
      const auth = [{ actor, permission: String(session.permission) }];
      let lastTxId: string | null = null;
      for (const [unboxingId, cardids] of groups) {
        const result = await executeRawTransaction([{
          account: 'gpk.topps',
          name: 'getcards',
          authorization: auth,
          data: { from: actor, unboxing: unboxingId, cardids },
        }], { errorTitle: 'Collect Failed', showErrorToast: true });
        lastTxId = result.resolved?.transaction.id?.toString() || null;
      }
      setSuccessDialog({
        open: true,
        title: 'Cards Collected!',
        description: `Successfully collected ${unclaimed.length} card(s) from ${groups.size} pack(s).`,
        txId: lastTxId,
      });
      handlePackOpened();
    } catch (e) {
      console.error('Collect unclaimed failed:', e);
    } finally {
      setIsCollecting(false);
    }
  }, [accountName, session, executeRawTransaction, handlePackOpened]);

  const isLoading = saLoading || aaLoading;
  const error = saError || aaError;

  const assets = useMemo(() => {
    const combined = [...saAssets, ...aaAssets];
    const variantOrder = ['base', 'prism', 'sketch', 'collector', 'golden'];
    const getVariantRank = (q: string) => { const idx = variantOrder.indexOf(q.toLowerCase()); return idx === -1 ? variantOrder.length : idx; };
    combined.sort((a, b) => {
      const numA = parseInt(a.cardid, 10), numB = parseInt(b.cardid, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
        const rankDiff = getVariantRank(a.quality) - getVariantRank(b.quality);
        return rankDiff !== 0 ? rankDiff : a.quality.localeCompare(b.quality);
      }
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return Number(BigInt(a.id) - BigInt(b.id));
    });
    return combined;
  }, [saAssets, aaAssets]);

  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const dragSourceIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const categories = useMemo(() => {
    const fromAssets = new Set(assets.map((a) => a.category).filter((c) => c !== 'packs'));
    for (const p of packs) { const cat = PACK_CATEGORY_MAP[p.symbol]; if (cat) fromAssets.add(cat); }
    for (const p of atomicPacks) { const cat = ATOMIC_PACK_CATEGORY_MAP[p.templateId]; if (cat) fromAssets.add(cat); }
    return [...fromAssets].sort();
  }, [assets, packs, atomicPacks]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (a.category === 'packs') return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.includes(search)) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
      return true;
    });
  }, [assets, search, categoryFilter, sourceFilter]);

  useEffect(() => { setCustomOrder(null); }, [search, categoryFilter, sourceFilter]);

  const gridSlots = useMemo(() => {
    const base = customOrder ?? filtered.map((a) => a.id);
    const trimmed = [...base];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === EMPTY) trimmed.pop();
    return [...trimmed, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)];
  }, [customOrder, filtered]);

  const assetMap = useMemo(() => new Map(filtered.map((a) => [a.id, a])), [filtered]);

  const handleDragStart = useCallback((idx: number) => (_e: DragEvent<HTMLDivElement>) => { dragSourceIdx.current = idx; }, []);
  const handleDragOver = useCallback((idx: number) => (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOverIdx(idx); }, []);
  const handleDrop = useCallback((targetIdx: number) => (_e: DragEvent<HTMLDivElement>) => {
    const srcIdx = dragSourceIdx.current; dragSourceIdx.current = null; setDragOverIdx(null);
    if (srcIdx === null || srcIdx === targetIdx) return;
    const currentOrder = customOrder ?? filtered.map((a) => a.id);
    const padded = [...currentOrder];
    const maxIdx = Math.max(srcIdx, targetIdx);
    while (padded.length <= maxIdx) padded.push(EMPTY);
    const newOrder = [...padded]; const tmp = newOrder[srcIdx]; newOrder[srcIdx] = newOrder[targetIdx]; newOrder[targetIdx] = tmp;
    setCustomOrder(newOrder);
  }, [customOrder, filtered]);
  const handleDragEnd = useCallback(() => { dragSourceIdx.current = null; setDragOverIdx(null); }, []);

  return (
    <div className="min-h-screen">
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">GPK Topps Collection</h1>
          <p className="text-muted-foreground mt-1">View and organize your Garbage Pail Kids cards. Drag cards to reorder them.</p>
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <p className="text-muted-foreground">Connect your wallet to view your SimpleAssets NFTs.</p>
            <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">Connect Wallet</Button>
          </div>
        ) : (
          <>
             <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="simpleassets">Simple Assets</SelectItem>
                  <SelectItem value="atomicassets">Atomic Assets</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleCollectUnclaimed} disabled={isCollecting} variant="outline" size="sm" className="whitespace-nowrap">
                <RefreshCw className={`h-4 w-4 mr-1 ${isCollecting ? 'animate-spin' : ''}`} />
                {isCollecting ? 'Collecting...' : 'Collect Unclaimed'}
              </Button>
            </div>

            {isLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="space-y-2"><Skeleton className="aspect-square w-full rounded-lg" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
                ))}
              </div>
            )}

            {error && <p className="text-center text-destructive py-8">Error: {error}</p>}

            {!packsLoading && packs.filter((p) => categoryFilter === 'all' || PACK_CATEGORY_MAP[p.symbol] === categoryFilter).length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground text-center">Packs</h2>
                <div className="flex flex-wrap justify-center gap-4">
                  {packs.filter((p) => categoryFilter === 'all' || PACK_CATEGORY_MAP[p.symbol] === categoryFilter).map((pack) => (
                    <div key={pack.symbol} className="w-[calc(50%-0.5rem)] sm:w-48">
                      <GpkPackCard pack={pack} session={session} accountName={accountName || ''} onSuccess={handlePackOpened} collectionAssets={assets} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!atomicPacksLoading && atomicPacks.filter((p) => categoryFilter === 'all' || ATOMIC_PACK_CATEGORY_MAP[p.templateId] === categoryFilter).length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground text-center">Packs</h2>
                <div className="flex flex-wrap justify-center gap-4">
                  {atomicPacks.filter((p) => categoryFilter === 'all' || ATOMIC_PACK_CATEGORY_MAP[p.templateId] === categoryFilter).map((pack) => (
                    <div key={pack.templateId} className="w-[calc(50%-0.5rem)] sm:w-48">
                      <AtomicPackCard pack={pack} session={session} accountName={accountName || ''} onSuccess={handlePackOpened} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isLoading && !error && (
              <>
                <p className="text-sm text-muted-foreground">{filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found</p>
                {filtered.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">
                    {assets.length === 0 ? 'No SimpleAssets NFTs found in this wallet.' : 'No NFTs match your filters.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {gridSlots.map((slotId, idx) => {
                      if (slotId === EMPTY) return <EmptySlot key={`empty-${idx}`} onDragOver={handleDragOver(idx)} onDrop={handleDrop(idx)} isOver={dragOverIdx === idx} />;
                      const asset = assetMap.get(slotId);
                      if (!asset) return null;
                      return <SimpleAssetCard key={asset.id} asset={asset} onClick={() => setSelectedAsset(asset)} draggable
                        onDragStart={handleDragStart(idx)} onDragOver={handleDragOver(idx)} onDrop={handleDrop(idx)} onDragEnd={handleDragEnd} />;
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      <SimpleAssetDetailDialog asset={selectedAsset} open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)} />
      <TransactionSuccessDialog
        open={successDialog.open}
        onOpenChange={(open) => setSuccessDialog(prev => ({ ...prev, open }))}
        title={successDialog.title}
        description={successDialog.description}
        txId={successDialog.txId}
      />
    </div>
  );
}
