import { useState, useMemo, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react';
import { Heart, Wallet, LogOut } from 'lucide-react';
import { Search, RefreshCw, Download, Upload, CheckSquare, X, Send } from 'lucide-react';
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
import { CardDealAnimation } from '@/components/simpleassets/CardDealAnimation';
import { fetchPendingNfts } from '@/components/simpleassets/PackRevealDialog';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import { TransferDialog } from '@/components/simpleassets/TransferDialog';
import { DonateDialog } from '@/components/wallet/DonateDialog';
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

const SERIES1_VARIANTS: { value: string; label: string }[] = [
  { value: 'a', label: 'Base' },
  { value: 'b', label: 'Prism' },
  { value: 'c', label: 'Sketch' },
  { value: 'd', label: 'Collectors' },
  { value: 'e', label: 'Gold' },
];

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

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('series1');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [variantFilter, setVariantFilter] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<SimpleAsset | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; title: string; description: string; txId: string | null }>({
    open: false, title: '', description: '', txId: null,
  });

  // --- Selection mode state ---
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [donateDialogOpen, setDonateDialogOpen] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);


  // --- Deal animation state ---
  const preCollectIdsRef = useRef<Set<string>>(new Set());
  const pendingAnimationRef = useRef<{ txId: string | null } | null>(null);
  const assetsRef = useRef<SimpleAsset[]>([]);
  const [dealingCards, setDealingCards] = useState<SimpleAsset[]>([]);
  const [dealtIds, setDealtIds] = useState<Set<string>>(new Set());
  const [pendingSuccessInfo, setPendingSuccessInfo] = useState<{ txId: string | null; count: number } | null>(null);
  const gridCellRefs = useRef<Map<string, HTMLElement | null>>(new Map());

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

  const selectedAssets = useMemo(() =>
    assets.filter(a => selectedIds.has(a.id)), [assets, selectedIds]);

  // Keep assetsRef in sync
  assetsRef.current = assets;

  // Keep preCollectIds updated (but not during pending animation)
  useEffect(() => {
    if (!pendingAnimationRef.current && dealingCards.length === 0) {
      preCollectIdsRef.current = new Set(assets.map(a => a.id));
    }
  }, [assets, dealingCards.length]);

  // Detect new cards after refetch and trigger deal animation
  useEffect(() => {
    if (!pendingAnimationRef.current) return;
    const newCards = assets.filter(a => !preCollectIdsRef.current.has(a.id) && a.category !== 'packs');
    if (newCards.length > 0) {
      const txInfo = pendingAnimationRef.current;
      pendingAnimationRef.current = null;

      // Auto-switch to the category of the new cards
      const cat = newCards[0].category;
      if (cat) setCategoryFilter(cat);
      setSearch('');
      setSourceFilter('all');
      // customOrder will be reloaded by the filter-change effect

      setDealingCards(newCards);
      setDealtIds(new Set());
      setPendingSuccessInfo({ txId: txInfo.txId, count: newCards.length });
    }
  }, [assets]);

  // --- Pack opened / collect success handler ---
  const handlePackOpened = useCallback(async (txId?: string | null) => {
    if (txId) {
      preCollectIdsRef.current = new Set(assetsRef.current.map(a => a.id));
      pendingAnimationRef.current = { txId };
    }
    await Promise.all([refetchPacks(), refetchAtomicPacks(), refetchSa(), refetchAa()]);
  }, [refetchPacks, refetchAtomicPacks, refetchSa, refetchAa]);

  // --- Fallback collect unclaimed ---
  const handleCollectUnclaimed = useCallback(async () => {
    if (!accountName || !session) return;
    setIsCollecting(true);
    try {
      preCollectIdsRef.current = new Set(assetsRef.current.map(a => a.id));

      const rows = await fetchPendingNfts(accountName);
      const unclaimed = rows.filter((r: any) => r.done === 0);
      if (unclaimed.length === 0) {
        toast.info('No unclaimed cards found');
        setIsCollecting(false);
        return;
      }
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

      // Trigger animation flow
      pendingAnimationRef.current = { txId: lastTxId };
      await Promise.all([refetchSa(), refetchAa(), refetchPacks(), refetchAtomicPacks()]);
    } catch (e) {
      console.error('Collect unclaimed failed:', e);
    } finally {
      setIsCollecting(false);
    }
  }, [accountName, session, executeRawTransaction, refetchSa, refetchAa, refetchPacks, refetchAtomicPacks]);

  // --- Deal animation callbacks ---
  const handleCardDealt = useCallback((id: string) => {
    setDealtIds(prev => new Set([...prev, id]));
  }, []);

  const handleDealComplete = useCallback(() => {
    setDealingCards([]);
    setDealtIds(new Set());
    if (pendingSuccessInfo) {
      setSuccessDialog({
        open: true,
        title: 'Cards Collected!',
        description: `Successfully collected ${pendingSuccessInfo.count} card(s).`,
        txId: pendingSuccessInfo.txId,
      });
      setPendingSuccessInfo(null);
    }
  }, [pendingSuccessInfo]);

  const dealingCardIds = useMemo(() => new Set(dealingCards.map(c => c.id)), [dealingCards]);

  // --- Grid / drag / filter state ---
  const getStorageKey = useCallback((cat: string, src: string) =>
    `gpk-order-${accountName}-${cat}-${src}`, [accountName]);

  const loadOrder = useCallback((cat: string, src: string, currentFiltered: SimpleAsset[]): string[] | null => {
    try {
      const raw = localStorage.getItem(getStorageKey(cat, src));
      if (!raw) return null;
      const saved: string[] = JSON.parse(raw);
      if (!Array.isArray(saved)) return null;
      const filteredIds = new Set(currentFiltered.map(a => a.id));
      // Keep only IDs still in the filtered set (remove stale)
      const valid = saved.filter(id => id === EMPTY || filteredIds.has(id));
      // Append new cards not in saved order
      const savedSet = new Set(saved);
      const newIds = currentFiltered.filter(a => !savedSet.has(a.id)).map(a => a.id);
      return [...valid, ...newIds];
    } catch { return null; }
  }, [getStorageKey]);

  const [customOrder, setCustomOrder] = useState<string[] | null>(null);
  const dragSourceIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save to localStorage whenever customOrder changes
  useEffect(() => {
    if (!accountName || customOrder === null) return;
    try {
      localStorage.setItem(getStorageKey(categoryFilter, sourceFilter), JSON.stringify(customOrder));
    } catch { /* storage full */ }
  }, [customOrder, accountName, categoryFilter, sourceFilter, getStorageKey]);

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
      if (categoryFilter === 'series1' && variantFilter !== 'all' && a.quality !== variantFilter) return false;
      return true;
    });
  }, [assets, search, categoryFilter, sourceFilter, variantFilter]);

  // Load saved order from localStorage on filter change
  useEffect(() => {
    const saved = loadOrder(categoryFilter, sourceFilter, filtered);
    setCustomOrder(saved);
  }, [categoryFilter, sourceFilter, search, filtered, loadOrder]);

  const gridSlots = useMemo(() => {
    const base = customOrder ?? filtered.map((a) => a.id);
    const trimmed = [...base];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === EMPTY) trimmed.pop();
    return [...trimmed, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)];
  }, [customOrder, filtered]);

  const assetMap = useMemo(() => new Map(filtered.map((a) => [a.id, a])), [filtered]);

  // --- Export / Import handlers ---
  const handleExportLayout = useCallback(() => {
    if (!accountName) return;
    const prefix = `gpk-order-${accountName}-`;
    const orders: Record<string, string[]> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const val = JSON.parse(localStorage.getItem(key)!);
          if (Array.isArray(val)) orders[key.slice(prefix.length)] = val;
        } catch { /* skip */ }
      }
    }
    const blob = new Blob([JSON.stringify({ account: accountName, orders }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gpk-layout-${accountName}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Layout exported');
  }, [accountName]);

  const handleImportLayout = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accountName) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data || typeof data.orders !== 'object') { toast.error('Invalid layout file'); return; }
        const prefix = `gpk-order-${accountName}-`;
        for (const [suffix, order] of Object.entries(data.orders)) {
          if (Array.isArray(order)) {
            localStorage.setItem(`${prefix}${suffix}`, JSON.stringify(order));
          }
        }
        // Reload current view's order
        const saved = loadOrder(categoryFilter, sourceFilter, filtered);
        setCustomOrder(saved);
        toast.success('Layout imported');
      } catch { toast.error('Failed to parse layout file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [accountName, categoryFilter, sourceFilter, filtered, loadOrder]);

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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-cheese">GPK.Topps Collection Manager</h1>
          <p className="text-cheese/70 mt-1">View, organize and transfer your gpk.topps cards. Open packs and drag and reorder cards where you want them.<br />Supports SimpleAssets and AtomicAssets.</p>
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <p className="text-muted-foreground">Connect your wallet to view your SimpleAssets NFTs.</p>
            <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">Connect Wallet</Button>
          </div>
        ) : (
          <>
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

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cheese" />
                <Input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-cheese/50 text-cheese placeholder:text-cheese/50" />
              </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full sm:w-[150px] border-cheese/50 text-cheese"><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="simpleassets">Simple Assets</SelectItem>
                  <SelectItem value="atomicassets">Atomic Assets</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); if (v !== 'series1') setVariantFilter('all'); }}>
                <SelectTrigger className="w-full sm:w-[180px] border-cheese/50 text-cheese"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                </SelectContent>
              </Select>
              {categoryFilter === 'series1' && (
                <Select value={variantFilter} onValueChange={setVariantFilter}>
                  <SelectTrigger className="w-full sm:w-[150px] border-cheese/50 text-cheese"><SelectValue placeholder="Variant" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Variants</SelectItem>
                    {SERIES1_VARIANTS.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleCollectUnclaimed} disabled={isCollecting} variant="outline" size="sm" className="whitespace-nowrap border-cheese/50 text-cheese hover:bg-cheese/10">
                <RefreshCw className={`h-4 w-4 mr-1 ${isCollecting ? 'animate-spin' : ''}`} />
                {isCollecting ? 'Collecting...' : 'Collect Unclaimed'}
              </Button>
              <Button onClick={handleExportLayout} variant="outline" size="sm" className="whitespace-nowrap border-cheese/50 text-cheese hover:bg-cheese/10" title="Export card layout">
                <Download className="h-4 w-4 mr-1" />Save Layout
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="whitespace-nowrap border-cheese/50 text-cheese hover:bg-cheese/10" title="Import card layout">
                <Upload className="h-4 w-4 mr-1" />Load Layout
              </Button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportLayout} />
              <Button
                onClick={() => { if (selectionMode) clearSelection(); else setSelectionMode(true); }}
                variant="outline"
                size="sm"
                className={`whitespace-nowrap ${selectionMode ? 'bg-cheese text-primary-foreground hover:bg-cheese/90' : 'border-cheese/50 text-cheese hover:bg-cheese/10'}`}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                {selectionMode ? 'Cancel Select' : 'Select'}
              </Button>
            </div>

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

                      // Card is being dealt — show reserved empty slot with ref
                      const isInFlight = dealingCardIds.has(slotId) && !dealtIds.has(slotId);
                      if (isInFlight) {
                        return (
                          <div
                            key={slotId}
                            ref={(el) => { if (el) gridCellRefs.current.set(slotId, el); else gridCellRefs.current.delete(slotId); }}
                            className="aspect-square rounded-lg border-2 border-dashed border-cheese/40 bg-cheese/5 animate-pulse"
                          />
                        );
                      }

                      const justLanded = dealtIds.has(slotId);
                      return (
                        <SimpleAssetCard
                          key={asset.id}
                          asset={asset}
                          onClick={() => setSelectedAsset(asset)}
                          className={justLanded ? 'animate-card-glow' : ''}
                          draggable={!selectionMode}
                          selectionMode={selectionMode}
                          selected={selectedIds.has(asset.id)}
                          onSelect={toggleSelection}
                          onDragStart={handleDragStart(idx)}
                          onDragOver={handleDragOver(idx)}
                          onDrop={handleDrop(idx)}
                          onDragEnd={handleDragEnd}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-cheese/20 mt-12 py-8">
        <div className="container text-center space-y-4">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            This Project was built by the $CHEESE team for the GPK and WAX Communities and is completely free to use. If you appreciate these efforts please consider a donation to help cover costs and time consumed. Any amount is appreciated.
          </p>
          <Button
            onClick={() => setDonateDialogOpen(true)}
            className="bg-cheese hover:bg-cheese/90 text-primary-foreground"
          >
            <Heart className="h-4 w-4 mr-2" />
            Donate
          </Button>
        </div>
      </footer>

      {/* Deal animation overlay */}
      {dealingCards.length > 0 && (
        <CardDealAnimation
          cards={dealingCards}
          gridCellRefs={gridCellRefs}
          onCardDealt={handleCardDealt}
          onComplete={handleDealComplete}
        />
      )}

      <SimpleAssetDetailDialog asset={selectedAsset} open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)} />
      <TransactionSuccessDialog
        open={successDialog.open}
        onOpenChange={(open) => setSuccessDialog(prev => ({ ...prev, open }))}
        title={successDialog.title}
        description={successDialog.description}
        txId={successDialog.txId}
      />
      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        selectedAssets={selectedAssets}
        onSuccess={(txId) => {
          clearSelection();
          refetchSa();
          refetchAa();
          setSuccessDialog({ open: true, title: 'Transfer Complete!', description: `Successfully transferred ${selectedAssets.length} NFT(s).`, txId });
        }}
      />
      <DonateDialog
        open={donateDialogOpen}
        onOpenChange={setDonateDialogOpen}
        assets={assets}
        onSuccess={(txId) => {
          refetchSa();
          refetchAa();
          setSuccessDialog({ open: true, title: 'Donation Sent!', description: 'Thank you for your generous donation to the $CHEESE team!', txId });
        }}
      />

      {/* Floating selection bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-cheese/50 rounded-lg shadow-2xl px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <Button size="sm" className="bg-cheese hover:bg-cheese/90 text-primary-foreground" onClick={() => setTransferDialogOpen(true)}>
            <Send className="h-4 w-4 mr-1" />Transfer
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
