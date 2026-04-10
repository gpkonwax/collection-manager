import { useState, useMemo, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react';
import { Heart, Wallet, ChevronDown, Check, BookOpen, Package, Grid3X3, GripVertical, Filter, Layers, Globe, Sparkles, Users, Save, ZoomIn, Puzzle, Eye } from 'lucide-react';
import { Search, RefreshCw, Download, Upload, CheckSquare, X, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PuzzleBuilder, type PuzzlePieceMap } from '@/components/simpleassets/PuzzleBuilder';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { BackgroundDecorations } from '@/components/BackgroundDecorations';
import { Button } from '@/components/ui/button';
import { useWax } from '@/context/WaxContext';
import { useSimpleAssets } from '@/hooks/useSimpleAssets';
import { useGpkAtomicAssets } from '@/hooks/useGpkAtomicAssets';
import { useGpkPacks } from '@/hooks/useGpkPacks';
import { useGpkAtomicPacks } from '@/hooks/useGpkAtomicPacks';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import { MissingCardPlaceholder } from '@/components/simpleassets/MissingCardPlaceholder';
import { useBinderTemplates } from '@/hooks/useBinderTemplates';
import { SimpleAssetDetailDialog } from '@/components/simpleassets/SimpleAssetDetailDialog';
import { GpkPackCard } from '@/components/simpleassets/GpkPackCard';
import { AtomicPackCard } from '@/components/simpleassets/AtomicPackCard';
import { CardDealAnimation } from '@/components/simpleassets/CardDealAnimation';
import { fetchPendingNfts } from '@/components/simpleassets/PackRevealDialog';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import { TransferDialog } from '@/components/simpleassets/TransferDialog';
import { DonateDialog } from '@/components/wallet/DonateDialog';
import { BannerAd } from '@/components/BannerAd';
import { BinderStackDialog } from '@/components/simpleassets/BinderStackDialog';
import { toast } from 'sonner';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { getGpkVariantRank } from '@/lib/gpkVariant';

const EMPTY = '__empty__';
const EXTRA_EMPTY_SLOTS = 6;
const ITEMS_PER_PAGE = 36;

const CATEGORY_LABELS: Record<string, string> = {
  series1: 'Series 1', series2: 'Series 2', crashgordon: 'Crash Gordon',
  exotic: 'Tiger King', bernventures: 'Bernventures', mittens: 'Mittens',
  
  gamestonk: 'GameStonk', foodfightb: 'Food Fight', bonus: 'Bonus',
  promo: 'Promo', originalart: 'Original Art',
};

const SERIES1_VARIANTS: { value: string; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'collector', label: 'Collectors' },
  { value: 'golden', label: 'Gold' },
];

const SERIES2_VARIANTS: { value: string; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'raw', label: 'Raw' },
  { value: 'prism', label: 'Prism' },
  { value: 'slime', label: 'Slime' },
  { value: 'gum', label: 'Gum' },
  { value: 'vhs', label: 'VHS' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'tiger stripe', label: 'Tiger Stripe' },
  { value: 'tiger claw', label: 'Tiger Claw' },
  { value: 'returning', label: 'Returning' },
  { value: 'error', label: 'Error' },
  { value: 'originalart', label: 'Original Art' },
  { value: 'relic', label: 'Relic' },
  { value: 'promo', label: 'Promo' },
  { value: 'collector', label: 'Collectors' },
  { value: 'golden', label: 'Golden' },
];

const SCHEMA_TO_CATEGORY: Record<string, string> = {
  exotic: 'series2',
  five: 'series1',
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

type ViewMode = 'classic' | 'binder' | 'saved';

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

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-3 hover:border-cheese/40 transition-colors">
      <div className="h-12 w-12 rounded-lg bg-cheese/10 flex items-center justify-center">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default function SimpleAssetsPage() {
  const { accountName, isConnected, login, logout, session, waxBalance, allSessions, switchAccount, addAccount, removeAccount } = useWax();
  const { assets: saAssets, isLoading: saLoading, error: saError, refetch: refetchSa } = useSimpleAssets(accountName);
  const { assets: aaAssets, isLoading: aaLoading, error: aaError, refetch: refetchAa } = useGpkAtomicAssets(accountName);
  const { packs, isLoading: packsLoading, refetch: refetchPacks } = useGpkPacks(accountName);
  const { packs: atomicPacks, isLoading: atomicPacksLoading, refetch: refetchAtomicPacks } = useGpkAtomicPacks(accountName);

  const { executeRawTransaction } = useWaxTransaction(session);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('series1');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [variantFilter, setVariantFilter] = useState<string[]>(['all']);
  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const [selectedAsset, setSelectedAsset] = useState<SimpleAsset | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [showCollectUnclaimed, setShowCollectUnclaimed] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; title: string; description: string; txId: string | null }>({
    open: false, title: '', description: '', txId: null,
  });

  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [search, categoryFilter, sourceFilter, variantFilter, viewMode]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [donateDialogOpen, setDonateDialogOpen] = useState(false);
  const [stackedAssets, setStackedAssets] = useState<SimpleAsset[] | null>(null);
  const [stackDialogOpen, setStackDialogOpen] = useState(false);

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

  const [importedPuzzle, setImportedPuzzle] = useState<PuzzlePieceMap | null>(null);
  const puzzleStateRef = useRef<PuzzlePieceMap>({});
  const handlePuzzlePiecesChange = useCallback((state: PuzzlePieceMap) => { puzzleStateRef.current = state; }, []);

  const preCollectIdsRef = useRef<Set<string>>(new Set());
  const pendingAnimationRef = useRef<{ txId: string | null } | null>(null);
  const assetsRef = useRef<SimpleAsset[]>([]);
  const [dealingCards, setDealingCards] = useState<SimpleAsset[]>([]);
  const [dealtIds, setDealtIds] = useState<Set<string>>(new Set());
  const [pendingSuccessInfo, setPendingSuccessInfo] = useState<{ txId: string | null; count: number } | null>(null);
  const gridCellRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  useEffect(() => {
    if (dealingCards.length > 0) {
      setVisibleCount(Infinity);
    }
  }, [dealingCards]);

  const isLoading = saLoading || aaLoading;
  const error = saError || aaError;

  const assets = useMemo(() => {
    const combined = [...saAssets, ...aaAssets];
    combined.sort((a, b) => {
      const numA = parseInt(a.cardid, 10), numB = parseInt(b.cardid, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        if (numA !== numB) return numA - numB;
        const sideA = a.side || '', sideB = b.side || '';
        if (sideA !== sideB) return sideA.localeCompare(sideB);
        const rankDiff = getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality);
        return rankDiff !== 0 ? rankDiff : a.quality.localeCompare(b.quality);
      }
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return Number(BigInt(a.id) - BigInt(b.id));
    });
    return combined;
  }, [saAssets, aaAssets]);

  const binderSchema = viewMode === 'binder' ? categoryFilter : null;
  const { templates: binderTemplates, isLoading: binderLoading } = useBinderTemplates(
    binderSchema !== 'all' ? binderSchema : null
  );

  const selectedAssets = useMemo(() =>
    assets.filter(a => selectedIds.has(a.id)), [assets, selectedIds]);

  assetsRef.current = assets;

  useEffect(() => {
    if (!pendingAnimationRef.current && dealingCards.length === 0) {
      preCollectIdsRef.current = new Set(assets.map(a => a.id));
    }
  }, [assets, dealingCards.length]);

  useEffect(() => {
    if (!pendingAnimationRef.current) return;
    const newCards = assets.filter(a => !preCollectIdsRef.current.has(a.id) && a.category !== 'packs');
    if (newCards.length > 0) {
      const txInfo = pendingAnimationRef.current;
      pendingAnimationRef.current = null;

      const cat = newCards[0].category;
      if (cat) setCategoryFilter(cat);
      setViewMode('classic');
      setSearch('');
      setSourceFilter('all');
      setVisibleCount(Number.POSITIVE_INFINITY);

      setDealingCards(newCards);
      setDealtIds(new Set());
      setPendingSuccessInfo({ txId: txInfo.txId, count: newCards.length });
    }
  }, [assets]);

  const handlePackOpened = useCallback(async (txId?: string | null) => {
    if (txId) {
      preCollectIdsRef.current = new Set(assetsRef.current.map(a => a.id));
      pendingAnimationRef.current = { txId };
    }
    await Promise.all([refetchPacks(), refetchAtomicPacks(), refetchSa(), refetchAa()]);
  }, [refetchPacks, refetchAtomicPacks, refetchSa, refetchAa]);

  const handleDemoCollect = useCallback((demoAssets: SimpleAsset[]) => {
    if (demoAssets.length === 0) return;
    const cat = demoAssets[0].category;
    if (cat) setCategoryFilter(cat);
    setViewMode('classic');
    setSearch('');
    setSourceFilter('all');
    setVisibleCount(Number.POSITIVE_INFINITY);
    setDealingCards(demoAssets);
    setDealtIds(new Set());
    setPendingSuccessInfo({ txId: null, count: demoAssets.length });
  }, []);

  useEffect(() => {
    if (!accountName) { setShowCollectUnclaimed(false); return; }
    (async () => {
      try {
        const rows = await fetchPendingNfts(accountName);
        const unclaimed = rows.filter((r: any) => r.done === 0);
        setShowCollectUnclaimed(unclaimed.length > 0);
      } catch { }
    })();
  }, [accountName]);

  const handleCollectUnclaimed = useCallback(async () => {
    if (!accountName || !session) return;
    setIsCollecting(true);
    try {
      preCollectIdsRef.current = new Set(assetsRef.current.map(a => a.id));

      const rows = await fetchPendingNfts(accountName);
      const unclaimed = rows.filter((r: any) => r.done === 0);
      if (unclaimed.length === 0) {
        toast.info('No unclaimed cards found');
        setShowCollectUnclaimed(false);
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

      setShowCollectUnclaimed(false);
      pendingAnimationRef.current = { txId: lastTxId };
      await Promise.all([refetchSa(), refetchAa(), refetchPacks(), refetchAtomicPacks()]);
    } catch (e) {
      console.error('Collect unclaimed failed:', e);
    } finally {
      setIsCollecting(false);
    }
  }, [accountName, session, executeRawTransaction, refetchSa, refetchAa, refetchPacks, refetchAtomicPacks]);

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

  const [savedOrder, setSavedOrder] = useState<string[] | null>(null);
  const [loadedLayoutName, setLoadedLayoutName] = useState<string | null>(null);
  const dragSourceIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const fromAssets = new Set(assets.map((a) => SCHEMA_TO_CATEGORY[a.category] || a.category).filter((c) => c !== 'packs'));
    for (const p of packs) { const cat = PACK_CATEGORY_MAP[p.symbol]; if (cat) fromAssets.add(cat); }
    for (const p of atomicPacks) { const cat = ATOMIC_PACK_CATEGORY_MAP[p.templateId]; if (cat) fromAssets.add(cat); }
    return [...fromAssets].sort();
  }, [assets, packs, atomicPacks]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (a.category === 'packs') return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.includes(search)) return false;
      const effectiveCategory = SCHEMA_TO_CATEGORY[a.category] || a.category;
      if (categoryFilter !== 'all' && effectiveCategory !== categoryFilter) return false;
      if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
      if ((categoryFilter === 'series1' || categoryFilter === 'series2') && !variantFilter.includes('all') && !variantFilter.includes(a.quality.toLowerCase())) return false;
      return true;
    });
  }, [assets, search, categoryFilter, sourceFilter, variantFilter]);

  const binderGrid = useMemo(() => {
    if (viewMode !== 'binder' || !binderTemplates.length) return null;

    const ownedByTemplateId = new Map<string, SimpleAsset[]>();
    const ownedByCardKey = new Map<string, SimpleAsset[]>();

    for (const a of filtered) {
      const tid = (a.idata as any)?._template_id || '';
      if (tid) {
        if (!ownedByTemplateId.has(tid)) ownedByTemplateId.set(tid, []);
        ownedByTemplateId.get(tid)!.push(a);
      }

      if (a.cardid) {
        const side = String((a.idata as any)?.quality ?? (a.mdata as any)?.quality ?? '').toLowerCase();
        const key = `${a.cardid}:${side}:${a.quality.toLowerCase()}`;
        if (!ownedByCardKey.has(key)) ownedByCardKey.set(key, []);
        ownedByCardKey.get(key)!.push(a);
      }
    }

    let filteredTemplates = binderTemplates;
    if ((categoryFilter === 'series1' || categoryFilter === 'series2') && !variantFilter.includes('all')) {
      filteredTemplates = binderTemplates.filter(t => variantFilter.includes(t.variant.toLowerCase()));
    }

    return filteredTemplates.map(template => {
      const byTid = ownedByTemplateId.get(template.templateId);
      const byKey = ownedByCardKey.get(`${template.cardid}:${template.quality.toLowerCase()}:${template.variant.toLowerCase()}`);
      const owned = byTid || byKey || null;
      return { template, owned };
    });
  }, [viewMode, binderTemplates, filtered, categoryFilter, variantFilter]);

  const savedGridSlots = useMemo(() => {
    if (savedOrder === null) return [];
    const occupied = new Set(savedOrder.filter((id) => id !== EMPTY));
    const pendingSlots = dealingCards.map((card) => card.id).filter((id) => !occupied.has(id));
    return [...savedOrder, ...pendingSlots];
  }, [savedOrder, dealingCards]);

  const assetMap = useMemo(() => new Map(filtered.map((a) => [a.id, a])), [filtered]);
  const allAssetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const handleExportLayout = useCallback(() => {
    if (!accountName || savedOrder === null) return;
    const defaultFilename = `gpk-layout-${accountName}.json`;
    const userFilename = window.prompt('Enter filename for your layout:', defaultFilename);
    if (!userFilename) return;
    const finalFilename = userFilename.toLowerCase().endsWith('.json') ? userFilename : `${userFilename}.json`;
    const puzzle = puzzleStateRef.current;
    const firstReal = savedOrder.findIndex(id => id !== EMPTY);
    let lastReal = -1;
    for (let i = savedOrder.length - 1; i >= 0; i--) { if (savedOrder[i] !== EMPTY) { lastReal = i; break; } }
    const cleanOrder = firstReal === -1 ? [] : savedOrder.slice(firstReal, lastReal + 1);
    const blob = new Blob([JSON.stringify({ account: accountName, orders: { saved: cleanOrder }, puzzle }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = finalFilename; a.click();
    URL.revokeObjectURL(url);
    toast.success('Layout exported');
  }, [accountName, savedOrder]);

  const handleImportLayout = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accountName) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data || typeof data !== 'object') { toast.error('Invalid layout file'); return; }

        let order: string[] | null = null;
        if (data.orders) {
          if (Array.isArray(data.orders.saved)) {
            order = data.orders.saved;
          } else if (typeof data.orders === 'object') {
            const allIds: string[] = [];
            const seen = new Set<string>();
            for (const arr of Object.values(data.orders)) {
              if (Array.isArray(arr)) {
                for (const id of arr as string[]) {
                  if (!seen.has(id)) { seen.add(id); allIds.push(id); }
                }
              }
            }
            if (allIds.length > 0) order = allIds;
          }
        }

        if (!order || order.length === 0) {
          toast.error('No layout data found in file');
          return;
        }

        setSavedOrder([...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY), ...order, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)]);
        setLoadedLayoutName(file.name);
        setViewMode('saved');

        if (data.puzzle && typeof data.puzzle === 'object') {
          setImportedPuzzle(data.puzzle as PuzzlePieceMap);
        }
        toast.success('Layout imported — switch to Saved Collection tab to view');
      } catch { toast.error('Failed to parse layout file'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [accountName]);

  const handleDragStart = useCallback((idx: number) => (_e: DragEvent<HTMLDivElement>) => { dragSourceIdx.current = idx; }, []);
  const handleDragOver = useCallback((idx: number) => (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOverIdx(idx); }, []);
  const handleDrop = useCallback((targetIdx: number) => (_e: DragEvent<HTMLDivElement>) => {
    const srcIdx = dragSourceIdx.current; dragSourceIdx.current = null; setDragOverIdx(null);
    if (srcIdx === null || srcIdx === targetIdx || savedOrder === null) return;
    const padded = [...savedOrder];
    const maxIdx = Math.max(srcIdx, targetIdx);
    while (padded.length <= maxIdx) padded.push(EMPTY);
    const newOrder = [...padded]; const tmp = newOrder[srcIdx]; newOrder[srcIdx] = newOrder[targetIdx]; newOrder[targetIdx] = tmp;
    setSavedOrder(newOrder);
  }, [savedOrder]);
  const handleDragEnd = useCallback(() => { dragSourceIdx.current = null; setDragOverIdx(null); }, []);

  const handleSnapshotToSaved = useCallback(() => {
    const ids = filtered.map(a => a.id);
    setSavedOrder([...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY), ...ids, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)]);
    setLoadedLayoutName(null);
    setViewMode('saved');
    toast.success('Current view copied to Saved Collection — you can now rearrange and export');
  }, [filtered]);

  const renderBinderCard = useCallback(({ template, owned }: { template: any; owned: SimpleAsset[] | null }) => {
    if (owned && owned.length > 0) {
      const asset = owned[0];
      const handleClick = () => {
        if (owned.length > 1 && !selectionMode) {
          setStackedAssets(owned);
          setStackDialogOpen(true);
        } else {
          setSelectedAsset(asset);
        }
      };
      return (
        <SimpleAssetCard
          key={`binder-${template.templateId}`}
          asset={asset}
          onClick={handleClick}
          draggable={false}
          stackCount={owned.length}
          selectionMode={selectionMode}
          selected={selectedIds.has(asset.id)}
          onSelect={toggleSelection}
        />
      );
    }
    return (
      <MissingCardPlaceholder key={`missing-${template.templateId}`} template={template} />
    );
  }, [selectionMode, selectedIds, toggleSelection]);

  const renderBinderGrid = useCallback((items: NonNullable<typeof binderGrid>) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map(renderBinderCard)}
    </div>
  ), [renderBinderCard]);

  const renderGroupedGrid = useCallback((items: NonNullable<typeof binderGrid>) => {
    const groupMap = new Map<string, NonNullable<typeof binderGrid>>();
    const groupOrder: string[] = [];
    for (const item of items) {
      const numId = String(item.template.cardid).replace(/[^0-9]/g, '');
      if (!groupMap.has(numId)) {
        groupMap.set(numId, []);
        groupOrder.push(numId);
      }
      groupMap.get(numId)!.push(item);
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {groupOrder.flatMap((id) => {
          const slots = groupMap.get(id)!;
          const cells: React.ReactNode[] = slots.map(renderBinderCard);
          const remainder = slots.length % 6;
          if (remainder !== 0) {
            const padCount = 6 - remainder;
            for (let p = 0; p < padCount; p++) {
              cells.push(<div key={`pad-${id}-${p}`} className="hidden xl:block" />);
            }
          }
          return cells;
        })}
      </div>
    );
  }, [renderBinderCard]);

  const renderSelectButton = () => (
    <Button
      onClick={() => { if (selectionMode) clearSelection(); else setSelectionMode(true); }}
      variant="outline"
      size="sm"
      className={`whitespace-nowrap ${selectionMode ? 'bg-cheese text-primary-foreground hover:bg-cheese/90' : 'border-cheese/50 text-cheese hover:bg-cheese/10'}`}
    >
      <CheckSquare className="h-4 w-4 mr-1" />
      {selectionMode ? 'Cancel Select' : 'Select'}
    </Button>
  );

  const renderSelectAllCheckbox = (visibleIds: string[]) => {
    if (!selectionMode) return null;
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
    return (
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedIds(prev => { const next = new Set(prev); visibleIds.forEach(id => next.add(id)); return next; });
            } else {
              setSelectedIds(new Set());
            }
          }}
        />
        <span className="text-sm text-cheese">Select All</span>
      </label>
    );
  };

  const renderBinderSections = (grid: NonNullable<typeof binderGrid>, useGrouped: boolean) => {
    const showGoldenSection = categoryFilter === 'series1' || categoryFilter === 'series2';
    const regular = grid.filter(s => s.template.variant !== 'collector' && (!showGoldenSection || s.template.variant !== 'golden'));
    const collectors = grid.filter(s => s.template.variant === 'collector');
    const golden = showGoldenSection ? grid.filter(s => s.template.variant === 'golden') : [];
    const totalItems = regular.length + collectors.length + golden.length;

    const sections = [
      { key: 'regular', items: regular, heading: null, grouped: useGrouped },
      {
        key: 'collectors', items: collectors, grouped: false,
        heading: (
          <h3 className="text-lg font-bold text-cheese border-b border-cheese/30 pb-1">
            Collector ({collectors.filter(s => s.owned).length}/{collectors.length})
          </h3>
        ),
      },
      ...(golden.length > 0 ? [{
        key: 'golden', items: golden, grouped: false,
        heading: (
          <h3 className="text-lg font-bold text-cheese border-b border-cheese/30 pb-1">
            Golden ({golden.filter(s => s.owned).length}/{golden.length})
          </h3>
        ),
      }] : []),
    ];

    let remaining = visibleCount;

    return (
      <div className="space-y-6">
        {sections.map((section) => {
          const visible = section.items.slice(0, Math.max(remaining, 0));
          remaining = Math.max(remaining - visible.length, 0);
          if (visible.length === 0) return null;

          if (!section.heading) {
            return <div key={section.key}>{section.grouped ? renderGroupedGrid(visible) : renderBinderGrid(visible)}</div>;
          }

          return (
            <div key={section.key} className="space-y-2">
              {section.heading}
              {renderBinderGrid(visible)}
            </div>
          );
        })}

        {totalItems > visibleCount && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
              variant="outline"
              className="border-cheese/50 text-cheese hover:bg-cheese/10"
            >
              Show More ({Math.min(visibleCount, totalItems)} of {totalItems})
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderClassicView = () => (
    <>
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted-foreground">{filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found</p>
        {renderSelectButton()}
        {selectionMode && renderSelectAllCheckbox(filtered.slice(0, visibleCount).map(a => a.id))}
        <Button
          onClick={handleSnapshotToSaved}
          variant="outline"
          size="sm"
          className="whitespace-nowrap border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10 h-8 ml-auto"
          title="Copy current view to Saved Collection for custom arrangement"
        >
          <Save className="h-4 w-4 mr-1" />
          Copy to Saved
        </Button>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          {assets.length === 0 ? 'No SimpleAssets NFTs found in this wallet.' : 'No NFTs match your filters.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.slice(0, visibleCount).map((asset) => {
              const isInFlight = dealingCardIds.has(asset.id) && !dealtIds.has(asset.id);
              if (isInFlight) {
                return (
                  <div
                    key={asset.id}
                    ref={(el) => { if (el) gridCellRefs.current.set(asset.id, el); else gridCellRefs.current.delete(asset.id); }}
                    className="aspect-square rounded-lg border-2 border-dashed border-cheese/40 bg-cheese/5 animate-pulse"
                  />
                );
              }

              const justLanded = dealtIds.has(asset.id);
              return (
                <SimpleAssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => setSelectedAsset(asset)}
                  className={justLanded ? 'animate-card-glow' : ''}
                  draggable={false}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(asset.id)}
                  onSelect={toggleSelection}
                />
              );
            })}
          </div>
          {filtered.length > visibleCount && (
            <div className="flex justify-center pt-4">
              <Button
                onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                variant="outline"
                className="border-cheese/50 text-cheese hover:bg-cheese/10"
              >
                Show More ({Math.min(visibleCount, filtered.length)} of {filtered.length})
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );

  const renderBinderView = () => {
    if (!binderGrid) return <p className="text-center text-muted-foreground py-12">Select a specific series to use Collector Binder.</p>;
    const visibleOwned = binderGrid.flatMap(s => s.owned ? s.owned.map(a => a.id) : []);
    return (
      <>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found · {binderGrid.filter(s => s.owned).length} / {binderGrid.length} unique collected
            {binderLoading && ' (loading templates...)'}
          </p>
          {renderSelectButton()}
          {renderSelectAllCheckbox(visibleOwned)}
        </div>
        {renderBinderSections(binderGrid, categoryFilter === 'series2')}
      </>
    );
  };

  const renderSavedView = () => {
    if (savedOrder === null) {
      return (
        <div className="text-center py-16 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-cheese/10 flex items-center justify-center">
            <Upload className="h-8 w-8 text-cheese" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Saved Layout</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Load a previously exported JSON layout, or use "Copy to Saved" from the Classic tab to snapshot your current collection here for custom arrangement.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => fileInputRef.current?.click()} className="bg-cheese hover:bg-cheese/90 text-primary-foreground">
              <Upload className="h-4 w-4 mr-2" />
              Load Layout
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportLayout} />
        </div>
      );
    }

    const validSlots = savedGridSlots.filter(id => id !== EMPTY);
    const validAssets = validSlots.map(id => allAssetMap.get(id)).filter(Boolean) as SimpleAsset[];

    return (
      <>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">{validAssets.length} card{validAssets.length !== 1 ? 's' : ''} in saved layout</p>
          {renderSelectButton()}
          {selectionMode && renderSelectAllCheckbox(validSlots.filter(id => allAssetMap.has(id)))}
          <div className="ml-auto flex items-center gap-2">
            {loadedLayoutName && (
              <span className="text-xs px-2 py-1 rounded bg-cheese/10 border border-cheese/20 text-cheese truncate max-w-[200px]" title={loadedLayoutName}>
                📄 {loadedLayoutName}
              </span>
            )}
            <Button onClick={handleExportLayout} variant="outline" size="sm" className="whitespace-nowrap border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10 h-8">
              <Download className="h-4 w-4 mr-1" />Save Layout
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="whitespace-nowrap border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10 h-8">
              <Upload className="h-4 w-4 mr-1" />Load Layout
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportLayout} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {savedGridSlots.slice(0, visibleCount).map((slotId, idx) => {
            if (slotId === EMPTY) return <EmptySlot key={`empty-${idx}`} onDragOver={handleDragOver(idx)} onDrop={handleDrop(idx)} isOver={dragOverIdx === idx} />;

            const asset = allAssetMap.get(slotId);
            if (!asset) return (
              <div key={`missing-${idx}`} className="aspect-square rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Missing</span>
              </div>
            );

            return (
              <SimpleAssetCard
                key={asset.id}
                asset={asset}
                onClick={() => setSelectedAsset(asset)}
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
        {savedGridSlots.length > visibleCount && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
              variant="outline"
              className="border-cheese/50 text-cheese hover:bg-cheese/10"
            >
              Show More ({Math.min(visibleCount, savedGridSlots.length)} of {savedGridSlots.length})
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen relative">
      <BackgroundDecorations />
      {isConnected && accountName && (
        <div className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/50">
          <div className="container flex h-12 items-center justify-end">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-cheese/30 hover:border-cheese hover:bg-cheese/10 h-8 gap-2">
                    <Wallet className="h-4 w-4 text-cheese" />
                    <span className="max-w-[120px] truncate text-sm">{accountName}</span>
                    <span className="ml-1 text-cheese font-semibold text-sm">
                      {waxBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} WAX
                    </span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {allSessions.length > 0 && (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <span className="mr-2 text-sm leading-none">👥</span>
                          Switch Account
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="w-56">
                            <DropdownMenuItem disabled className="opacity-100">
                              <Check className="mr-2 h-4 w-4 text-cheese" />
                              <span className="font-medium">{accountName}</span>
                              <span className="ml-auto text-xs text-muted-foreground">(active)</span>
                            </DropdownMenuItem>
                            {allSessions.filter(s => String(s.actor) !== accountName).map((s) => (
                              <DropdownMenuItem
                                key={`${String(s.actor)}-${s.permission}`}
                                className="cursor-pointer group"
                                onClick={() => switchAccount(s)}
                              >
                                <div className="w-4 mr-2" />
                                <span>{String(s.actor)}</span>
                                <button
                                  className="ml-auto opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
                                  onClick={(e) => { e.stopPropagation(); removeAccount(s); }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={addAccount} className="cursor-pointer">
                              <span className="mr-2 text-sm leading-none">➕</span>
                              Add Account
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={logout} className="cursor-pointer">
                    <span className="mr-2 text-sm leading-none">🔌</span>
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}
      <div className="container py-8 space-y-6">
        <BannerAd />
        <div className="mb-6" />

        {isConnected && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cheese">GPK.Topps Collection Manager</h1>
            <p className="text-cheese/70 mt-1">View, organize and transfer your gpk.topps cards. Open packs and drag and reorder cards where you want them.<br />Supports SimpleAssets and AtomicAssets.</p>
          </div>
        )}

        {!isConnected ? (
          <div className="space-y-16 py-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold text-cheese-gradient leading-tight max-w-3xl">
                The Ultimate GPK Collection Manager
              </h2>
               <p className="text-lg text-muted-foreground max-w-2xl">
                 Flexible gpk.topps SimpleAssets and AtomicAssets collection manager. Includes pack openings with animation, transfer of SimpleAssets NFTs between accounts, a first of its kind Series 2 Puzzle Builder, collection binder option with placeholder AtomicHub links, and a special magnification tool to see, sort, and enjoy your digital GPK cards like never before!
               </p>
               <p className="text-lg text-muted-foreground max-w-2xl mt-2">
                 Free to use, built by <span className="text-cheese font-semibold">$CHEESE</span> for the WAX community.
               </p>
              <Button onClick={login} size="lg" className="bg-cheese hover:bg-cheese/90 text-cheese-foreground text-lg px-8 py-6 cheese-glow">
                <Wallet className="h-5 w-5 mr-2" />
                Connect Wallet
              </Button>
            </div>

            {/* Section A — Three Ways to View */}
            <div className="max-w-5xl mx-auto space-y-4">
              <h3 className="text-2xl font-bold text-cheese text-center">Three Ways to View, Sort and Show Your Collection</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FeatureCard
                  icon={<Eye className="h-6 w-6 text-cheese" />}
                  title="Classic View"
                  description="A read-only grid of your cards in natural sort order. Clean, simple, no clutter. Just your collection as it is."
                />
                <FeatureCard
                  icon={<BookOpen className="h-6 w-6 text-cheese" />}
                  title="Collector Binder"
                  description="Template-based completionist view. Owned cards in full color, missing cards as greyscale placeholders linked directly to AtomicHub. See exactly what you need."
                />
                <FeatureCard
                  icon={<Save className="h-6 w-6 text-cheese" />}
                  title="Saved Collection"
                  description="Your personal workspace. Import/export JSON layouts, drag-and-drop to rearrange, and build the perfect display of your collection."
                />
              </div>
            </div>

            {/* Section B — Pack Openings */}
            <div className="max-w-5xl mx-auto">
              <div className="rounded-xl border border-cheese/20 bg-cheese/5 p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0 h-16 w-16 rounded-full bg-cheese/10 flex items-center justify-center">
                  <Package className="h-8 w-8 text-cheese" />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-bold text-cheese mb-2">All Topps Packs Supported</h3>
                  <p className="text-muted-foreground">
                    Open Series 1 &amp; 2 packs, Crash Gordon, Bernventures, Mittens, GameStonk, Food Fight and more — both SimpleAssets and AtomicAssets formats. Watch each card reveal one by one with a full unboxing animation, then see them dealt out to their sorted positions in your collection with a choreographed card-deal sequence. Skip anytime or sit back and enjoy the show.
                  </p>
                </div>
              </div>
            </div>

            {/* Section C — Puzzle Builder */}
            <div className="max-w-5xl mx-auto">
              <div className="rounded-xl border border-cheese/20 bg-cheese/5 p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0 h-16 w-16 rounded-full bg-cheese/10 flex items-center justify-center">
                  <Puzzle className="h-8 w-8 text-cheese" />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-bold text-cheese mb-2">Series 2 Puzzle Builder</h3>
                  <p className="text-muted-foreground">
                    Series 2 cards contain hidden puzzle pieces on their backs. The Puzzle Builder gives you a free-form canvas to drag, rotate, and arrange your puzzle pieces. Scramble them, line them up, and save your progress as JSON. Can you complete the red border puzzle?
                  </p>
                </div>
              </div>
            </div>

            {/* Section D — More Features */}
            <div className="max-w-5xl mx-auto space-y-4">
              <h3 className="text-2xl font-bold text-cheese text-center">More Features</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FeatureCard
                  icon={<ZoomIn className="h-6 w-6 text-cheese" />}
                  title="Inspect Every Detail"
                  description="Click any card to see it in full detail. Hover over the image and a magnifying lens follows your cursor, zooming in so you can see every line, every detail, every variant difference up close."
                />
                <FeatureCard
                  icon={<Filter className="h-6 w-6 text-cheese" />}
                  title="Filter by Series & Variant"
                  description="Filter by Series 1, Series 2, and all sub-collections. Drill down by variant — Base, Prism, Sketch, VHS, Slime, Tiger Stripe, Gold and more."
                />
                <FeatureCard
                  icon={<Layers className="h-6 w-6 text-cheese" />}
                  title="SimpleAssets & AtomicAssets"
                  description="Full support for both NFT standards on WAX. Your entire GPK collection in one unified view regardless of which contract holds them."
                />
                <FeatureCard
                  icon={<Users className="h-6 w-6 text-cheese" />}
                  title="Free Community Tool"
                  description="No fees, no sign-ups. A WAX community asset built by the $CHEESE team — the first project ever launched on the WAX blockchain."
                />
              </div>
            </div>

            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Connect your WAX wallet to get started — it only takes a few seconds.</p>
              <Button onClick={login} className="bg-cheese hover:bg-cheese/90 text-cheese-foreground">
                <Wallet className="h-4 w-4 mr-2" />
                Connect Wallet
              </Button>
            </div>
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
                      <GpkPackCard pack={pack} session={session} accountName={accountName || ''} onSuccess={handlePackOpened} onDemoCollect={handleDemoCollect} collectionAssets={assets.filter(a => { const assetCat = SCHEMA_TO_CATEGORY[a.category] || a.category; return assetCat === PACK_CATEGORY_MAP[pack.symbol]; })} />
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
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); if (v !== 'series1' && v !== 'series2') setVariantFilter(['all']); }}>
                <SelectTrigger className="w-full sm:w-[180px] border-cheese/50 text-cheese"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                </SelectContent>
              </Select>
              {(categoryFilter === 'series1' || categoryFilter === 'series2') && (() => {
                const variants = categoryFilter === 'series1' ? SERIES1_VARIANTS : SERIES2_VARIANTS;
                const isAll = variantFilter.includes('all');
                const toggleVariant = (val: string) => {
                  if (val === 'all') {
                    setVariantFilter(['all']);
                    return;
                  }
                  let next: string[];
                  if (variantFilter.includes(val)) {
                    next = variantFilter.filter(v => v !== val && v !== 'all');
                  } else {
                    next = [...variantFilter.filter(v => v !== 'all'), val];
                  }
                  if (next.length === 0 || next.length === variants.length) {
                    setVariantFilter(['all']);
                  } else {
                    setVariantFilter(next);
                  }
                };
                const label = isAll ? 'All Variants' : variantFilter.length === 1 ? variants.find(v => v.value === variantFilter[0])?.label ?? variantFilter[0] : `${variantFilter.length} Variants`;
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full sm:w-[180px] justify-between border-cheese/50 text-cheese hover:bg-cheese/10">
                        {label}
                        <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-2 max-h-[300px] overflow-y-auto" align="start">
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm">
                        <Checkbox checked={isAll} onCheckedChange={() => toggleVariant('all')} />
                        All Variants
                      </label>
                      <div className="my-1 h-px bg-border" />
                      {variants.map(v => (
                        <label key={v.value} className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm">
                          <Checkbox checked={isAll || variantFilter.includes(v.value)} onCheckedChange={() => toggleVariant(v.value)} />
                          {v.label}
                        </label>
                      ))}
                    </PopoverContent>
                  </Popover>
                );
              })()}
              {showCollectUnclaimed && (
                <Button onClick={handleCollectUnclaimed} disabled={isCollecting} variant="outline" size="sm" className="whitespace-nowrap border-cheese/50 text-cheese hover:bg-cheese/10">
                  <RefreshCw className={`h-4 w-4 mr-1 ${isCollecting ? 'animate-spin' : ''}`} />
                  {isCollecting ? 'Collecting...' : 'Collect Unclaimed'}
                </Button>
              )}
            </div>

            <div className="flex justify-center mt-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-auto">
                <TabsList className="h-8 bg-muted/50 border border-cheese/20">
                  <TabsTrigger value="classic" className="text-xs px-3 py-1 data-[state=active]:bg-cheese/20 data-[state=active]:text-cheese">
                    <Grid3X3 className="h-3 w-3 mr-1" />
                    Classic View
                  </TabsTrigger>
                  <TabsTrigger
                    value="binder"
                    className="text-xs px-3 py-1 data-[state=active]:bg-cheese/20 data-[state=active]:text-cheese"
                    disabled={categoryFilter === 'all'}
                  >
                    <BookOpen className="h-3 w-3 mr-1" />
                    Collector Binder
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="text-xs px-3 py-1 data-[state=active]:bg-cheese/20 data-[state=active]:text-cheese">
                    <Save className="h-3 w-3 mr-1" />
                    Saved Collection
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {!isLoading && !error && (
              categoryFilter === 'series2' && viewMode !== 'saved' ? (
                <Tabs defaultValue="collection" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="collection">Collection</TabsTrigger>
                    <TabsTrigger value="puzzle">Puzzle Builder</TabsTrigger>
                  </TabsList>
                  <TabsContent value="collection">
                    {viewMode === 'binder' && binderGrid ? (
                      <>
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-muted-foreground">
                            {filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found · {binderGrid.filter(s => s.owned).length} / {binderGrid.length} unique collected
                            {binderLoading && ' (loading templates...)'}
                          </p>
                          {renderSelectButton()}
                          {renderSelectAllCheckbox(binderGrid.flatMap(s => s.owned ? s.owned.map(a => a.id) : []))}
                        </div>
                        {renderBinderSections(binderGrid, true)}
                      </>
                    ) : (
                      renderClassicView()
                    )}
                  </TabsContent>
                  <TabsContent value="puzzle">
                    <PuzzleBuilder assets={filtered} initialPieceState={importedPuzzle} onPiecesChange={handlePuzzlePiecesChange} />
                  </TabsContent>
                </Tabs>
              ) : viewMode === 'saved' ? (
                renderSavedView()
              ) : viewMode === 'binder' ? (
                renderBinderView()
              ) : (
                renderClassicView()
              )
            )}
          </>
        )}
      </div>

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

      {dealingCards.length > 0 && (
        <CardDealAnimation
          cards={dealingCards}
          gridCellRefs={gridCellRefs}
          onCardDealt={handleCardDealt}
          onComplete={handleDealComplete}
        />
      )}

      <SimpleAssetDetailDialog asset={selectedAsset} open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)} />
      <BinderStackDialog
        assets={stackedAssets ?? []}
        open={stackDialogOpen}
        onOpenChange={setStackDialogOpen}
        onSelectAsset={(asset) => {
          setStackDialogOpen(false);
          setSelectedAsset(asset);
        }}
      />
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
        gpkPacks={packs.filter(p => p.amount > 0)}
        atomicPacks={atomicPacks.filter(p => p.count > 0)}
        onSuccess={(txId) => {
          refetchSa();
          refetchAa();
          refetchPacks();
          refetchAtomicPacks();
          setSuccessDialog({ open: true, title: 'Donation Sent!', description: 'Thank you for your generous donation to the $CHEESE team!', txId });
        }}
      />

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
