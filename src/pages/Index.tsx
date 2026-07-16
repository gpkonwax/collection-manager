import { useState, useMemo, useRef, useCallback, useEffect, DragEvent, ChangeEvent } from 'react';
import { Wallet, ChevronDown, Check, BookOpen, Package, Grid3X3, GripVertical, Filter, Layers, Globe, Sparkles, Users, Save, ZoomIn, Puzzle, Eye, Info, Box, Plus, Github } from 'lucide-react';
import { Search, RefreshCw, Download, Upload, CheckSquare, X, Send, Trash2, Flame } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PuzzleBuilder, type PuzzlePieceMap } from '@/components/simpleassets/PuzzleBuilder';
import { MissingPuzzlePiecePlaceholder } from '@/components/simpleassets/MissingPuzzlePiecePlaceholder';
import { PUZZLE_CARD_IDS } from '@/lib/puzzlePieces';
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
import { AlertsManagerPopover } from '@/components/simpleassets/AlertsManagerPopover';
import { useBinderTemplates } from '@/hooks/useBinderTemplates';
import { SimpleAssetDetailDialog } from '@/components/simpleassets/SimpleAssetDetailDialog';
import { GpkPackCard } from '@/components/simpleassets/GpkPackCard';
import { AtomicPackCard } from '@/components/simpleassets/AtomicPackCard';
import { CardDealAnimation } from '@/components/simpleassets/CardDealAnimation';
import { fetchPendingNfts } from '@/components/simpleassets/PackRevealDialog';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { matchRevealedAssets, type RevealResult } from '@/lib/packReveal';
import { getGpkCategoryForBoxtype, normalizePendingGpkCardId } from '@/lib/gpkCardImages';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import { TransferDialog } from '@/components/simpleassets/TransferDialog';
import { BurnDialog } from '@/components/simpleassets/BurnDialog';

import { BannerAd } from '@/components/BannerAd';
import { BackupPanel } from '@/components/BackupPanel';
import { BackupNudgeBanner } from '@/components/BackupNudgeBanner';
import { BinderStackDialog } from '@/components/simpleassets/BinderStackDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import cheesehubLogo from '@/assets/cheesehub-logo.png';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { getGpkVariantRank, normalizeGpkVariant } from '@/lib/gpkVariant';
import { useCollectionCompletion } from '@/hooks/useCollectionCompletion';
import { Progress } from '@/components/ui/progress';
import { useExternalLinkWarning, ExternalLinkWarningDialog } from '@/components/ExternalLinkWarningDialog';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { Bell, BellRing } from 'lucide-react';
import { routeOne, parseAndDetect, addRecentJson, type RecentJsonEntry, type DetectedLayout } from '@/lib/jsonRouter';
import { JsonMenu } from '@/components/JsonMenu';
import { ViewWalletControl } from '@/components/ViewWalletControl';
import { ViewingBanner } from '@/components/ViewingBanner';
import logoSimpleAssets from '@/assets/logo-simpleassets.png';
import logoAtomicAssets from '@/assets/logo-atomicassets.png';

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
  { value: 'slime', label: 'Slime' },
  { value: 'gum', label: 'Gum' },
  { value: 'vhs', label: 'VHS' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'returning', label: 'Returning' },
  { value: 'error', label: 'Error' },
  { value: 'originalart', label: 'Original Art' },
  { value: 'relic', label: 'Relic' },
  { value: 'promo', label: 'Promo' },
  { value: 'collector', label: 'Collectors' },
  { value: 'golden', label: 'Golden' },
];

const EXOTIC_VARIANTS: { value: string; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'tiger stripe', label: 'Tiger Stripe' },
  { value: 'tiger claw', label: 'Tiger Claw' },
  { value: 'golden', label: 'Golden' },
  { value: 'collector', label: 'Collector' },
];

const CRASHGORDON_VARIANTS: { value: string; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'golden', label: 'Golden' },
];

const FOODFIGHT_VARIANTS: { value: string; label: string }[] = [
  { value: 'base', label: 'Base' },
  { value: 'prism', label: 'Prism' },
  { value: 'sketch', label: 'Sketch' },
  { value: 'artistssignature', label: "Artist's Signature" },
  { value: 'golden', label: 'Golden' },
];

const SCHEMA_TO_CATEGORY: Record<string, string> = {
  exotic: 'exotic',
  five: 'series1',
};

type PendingNftAuditRow = {
  id: number;
  unboxingid: number;
  draw: number;
  boxtype: string;
  variant: string;
  quality: string;
  done: number;
  cardid: number;
};

type PackAuditMissing = {
  rowId: number;
  cardid: string;
  side: string;
  variant: string;
};

type PackAuditState = {
  unboxingId: number | null;
  category: string | null;
  boxtype: string | null;
  assets: SimpleAsset[];
  missing: PackAuditMissing[];
  status: 'collected' | 'unclaimed' | 'partial' | 'none';
  checkedAt: number;
};

function normalizeAssetCategory(category: string | undefined): string {
  return SCHEMA_TO_CATEGORY[category ?? ''] || category || '';
}

function compareAssetIdDesc(a: SimpleAsset, b: SimpleAsset): number {
  try {
    const aId = BigInt(a.id);
    const bId = BigInt(b.id);
    return bId > aId ? 1 : bId < aId ? -1 : 0;
  } catch {
    return b.id.localeCompare(a.id);
  }
}

function matchPendingRowsToMintedAssets(rows: PendingNftAuditRow[], assets: SimpleAsset[]) {
  const used = new Set<string>();
  const matched: SimpleAsset[] = [];
  const missing: PackAuditMissing[] = [];
  const sortedRows = [...rows].sort((a, b) => a.draw - b.draw);

  for (const row of sortedRows) {
    const category = getGpkCategoryForBoxtype(row.boxtype);
    const cardid = normalizePendingGpkCardId(row.boxtype, row.cardid);
    const side = String(row.quality ?? '').toLowerCase();
    const variant = normalizeGpkVariant(String(row.variant ?? ''));
    const hit = assets
      .filter((asset) =>
        !used.has(asset.id) &&
        asset.source === 'simpleassets' &&
        (!category || normalizeAssetCategory(asset.category) === category) &&
        String(asset.cardid ?? '') === cardid &&
        String(asset.side ?? '').toLowerCase() === side &&
        String(asset.quality ?? '').toLowerCase() === variant,
      )
      .sort(compareAssetIdDesc)[0];

    if (hit) {
      used.add(hit.id);
      matched.push(hit);
    } else {
      missing.push({ rowId: row.id, cardid, side, variant });
    }
  }

  return { matched, missing };
}

const PACK_CATEGORY_MAP: Record<string, string> = {
  GPKFIVE: 'series1', GPKMEGA: 'series1',
  GPKTWOA: 'series2', GPKTWOB: 'series2', GPKTWOC: 'series2',
  EXOFIVE: 'exotic', EXOMEGA: 'exotic',
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
      <h3 className="text-lg font-semibold text-cheese">{title}</h3>
      <p className="text-sm text-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default function SimpleAssetsPage() {
  const { accountName, isConnected, login, logout, session, waxBalance, allSessions, switchAccount, addAccount, removeAccount } = useWax();

  // Read-only "view another wallet" mode
  const [viewedAccount, setViewedAccount] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    return v && v !== 'me' ? v.trim().toLowerCase() : null;
  });
  const isViewing = !!viewedAccount && viewedAccount !== accountName;
  const effectiveAccount = isViewing ? viewedAccount : accountName;
  const canWrite = !isViewing;

  // Keep ?view= param in sync with viewedAccount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get('view');
    if (viewedAccount) {
      if (current !== viewedAccount) {
        url.searchParams.set('view', viewedAccount);
        window.history.replaceState({}, '', url.toString());
      }
    } else if (current) {
      url.searchParams.delete('view');
      window.history.replaceState({}, '', url.toString());
    }
  }, [viewedAccount]);

  const handleViewWallet = useCallback((name: string) => {
    setViewedAccount(name);
  }, []);
  const handleClearViewing = useCallback(() => {
    setViewedAccount(null);
  }, []);

  const { assets: saAssets, isLoading: saLoading, error: saError, refetch: refetchSa } = useSimpleAssets(effectiveAccount);
  const { assets: aaAssets, isLoading: aaLoading, error: aaError, refetch: refetchAa } = useGpkAtomicAssets(effectiveAccount);
  const { packs, isLoading: packsLoading, refetch: refetchPacks } = useGpkPacks(effectiveAccount);
  const { packs: atomicPacks, isLoading: atomicPacksLoading, refetch: refetchAtomicPacks } = useGpkAtomicPacks(effectiveAccount);

  const { executeRawTransaction } = useWaxTransaction(session);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('series1');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [variantFilter, setVariantFilter] = useState<string[]>(['all']);
  type SortMode = 'natural' | 'name' | 'variant' | 'newest';
  const [sortMode, setSortMode] = useState<SortMode>('natural');
  const [viewMode, setViewMode] = useState<ViewMode>('classic');
  const [selectedAsset, setSelectedAsset] = useState<SimpleAsset | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [showCollectUnclaimed, setShowCollectUnclaimed] = useState(false);
  const [collectionSyncNotice, setCollectionSyncNotice] = useState<{ category: string | null; count?: number } | null>(null);
  const [packAudit, setPackAudit] = useState<PackAuditState | null>(null);
  const [isReconstructingOpen, setIsReconstructingOpen] = useState(false);
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; title: string; description: string; txId: string | null }>({
    open: false, title: '', description: '', txId: null,
  });

  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [search, categoryFilter, sourceFilter, variantFilter, viewMode, sortMode]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [burnDialogOpen, setBurnDialogOpen] = useState(false);
  
  const [stackedAssets, setStackedAssets] = useState<SimpleAsset[] | null>(null);
  const [stackDialogOpen, setStackDialogOpen] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const { pendingUrl: footerPendingUrl, requestNavigation: footerRequestNav, confirm: footerConfirm, cancel: footerCancel } = useExternalLinkWarning();

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

  // Buffer for layout imports that need to survive a category switch + restore-effect cycle.
  // Keyed by savedLayoutKey so multiple layouts imported in one batch don't overwrite each other.
  const pendingImportsRef = useRef<Map<string, { order: string[]; name: string; puzzle?: PuzzlePieceMap | null }>>(new Map());
  const [series2SubTab, setSeries2SubTab] = useState<string>('collection');

  const handleSwitchToBinder = useCallback(() => {
    setViewMode('binder');
    setSeries2SubTab('collection');
  }, []);

  const preCollectIdsRef = useRef<Set<string>>(new Set());
  const pendingAnimationRef = useRef<{ txId: string | null } | null>(null);
  const assetsRef = useRef<SimpleAsset[]>([]);
  const [dealingCards, setDealingCards] = useState<SimpleAsset[]>([]);
  const [dealtIds, setDealtIds] = useState<Set<string>>(new Set());
  const [pendingSuccessInfo, setPendingSuccessInfo] = useState<{ txId: string | null; count: number } | null>(null);
  const gridCellRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  useEffect(() => {
    if (dealingCards.length > 0) {
      // Instead of rendering the entire collection, find the furthest dealing card
      // position in filtered list and only render up to that + a buffer
      const allAssets = [...saAssets, ...aaAssets];
      let maxIdx = 0;
      for (const dc of dealingCards) {
        const idx = allAssets.findIndex(f => f.id === dc.id);
        if (idx > maxIdx) maxIdx = idx;
      }
      setVisibleCount(maxIdx + 12);
    }
  }, [dealingCards, saAssets, aaAssets]);

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

  const { completion } = useCollectionCompletion(assets, packs, atomicPacks, accountName);

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

  const recheckUnclaimed = useCallback(async () => {
    if (!accountName || isViewing) { setShowCollectUnclaimed(false); return; }
    try {
      const rows = await fetchPendingNfts(accountName);
      const unclaimed = rows.filter((r: any) => r.done === 0);
      setShowCollectUnclaimed(unclaimed.length > 0);
      if (unclaimed.length > 0) return;

      const collected = rows.filter((r: any) => r.done === 1);
      if (collected.length === 0) {
        setCollectionSyncNotice(null);
        return;
      }

      const latestUnboxingId = Math.max(...collected.map((r: any) => Number(r.unboxingid)).filter(Number.isFinite));
      const latestRows = collected.filter((r: any) => Number(r.unboxingid) === latestUnboxingId);
      setCollectionSyncNotice({
        category: getGpkCategoryForBoxtype(String(latestRows[0]?.boxtype ?? '')),
        count: latestRows.length || undefined,
      });
    } catch { }
  }, [accountName, isViewing]);

  const focusCollectionView = useCallback((category?: string | null) => {
    if (category) setCategoryFilter(category);
    setViewMode('classic');
    setSearch('');
    setSourceFilter('all');
    setVariantFilter(['all']);
    setSortMode('natural');
    setVisibleCount(Number.POSITIVE_INFINITY);
  }, []);

  const waitForNewCollectionAssets = useCallback(async (
    preIds: Set<string>,
    expectedCategory?: string | null,
    timeoutMs = 20_000,
  ) => {
    const deadline = Date.now() + timeoutMs;
    let newest: SimpleAsset[] = [];
    while (Date.now() < deadline) {
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      await new Promise(r => setTimeout(r, 100));
      newest = assetsRef.current.filter((asset) => {
        if (preIds.has(asset.id)) return false;
        const effectiveCategory = SCHEMA_TO_CATEGORY[asset.category] || asset.category;
        return !expectedCategory || effectiveCategory === expectedCategory;
      });
      if (newest.length > 0) return newest;
      await new Promise(r => setTimeout(r, 1500));
      await Promise.all([refetchSa(), refetchAa()]);
    }
    return newest;
  }, [refetchSa, refetchAa]);

  const reconstructLatestPackOpen = useCallback(async (options?: { focus?: boolean; silent?: boolean }) => {
    if (!accountName || isViewing) return null;
    setIsReconstructingOpen(true);
    try {
      const rows = (await fetchPendingNfts(accountName)) as PendingNftAuditRow[];
      if (rows.length === 0) {
        const emptyAudit: PackAuditState = {
          unboxingId: null,
          category: null,
          boxtype: null,
          assets: [],
          missing: [],
          status: 'none',
          checkedAt: Date.now(),
        };
        setPackAudit(emptyAudit);
        setCollectionSyncNotice(null);
        if (!options?.silent) toast.info('No pack-open history found for this wallet');
        return emptyAudit;
      }

      await Promise.all([refetchSa(), refetchAa()]);
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      await new Promise(r => setTimeout(r, 100));

      const latestUnboxingId = Math.max(...rows.map((row) => Number(row.unboxingid)).filter(Number.isFinite));
      const latestRows = rows.filter((row) => Number(row.unboxingid) === latestUnboxingId);
      const category = getGpkCategoryForBoxtype(String(latestRows[0]?.boxtype ?? ''));
      const { matched, missing } = matchPendingRowsToMintedAssets(latestRows, assetsRef.current);
      const hasUnclaimed = latestRows.some((row) => Number(row.done) === 0);
      const status: PackAuditState['status'] = hasUnclaimed ? 'unclaimed' : missing.length > 0 ? 'partial' : 'collected';
      const audit: PackAuditState = {
        unboxingId: latestUnboxingId,
        category,
        boxtype: latestRows[0]?.boxtype ?? null,
        assets: matched,
        missing,
        status,
        checkedAt: Date.now(),
      };

      setPackAudit(audit);
      setCollectionSyncNotice({ category, count: latestRows.length || undefined });
      if (options?.focus !== false) focusCollectionView(category);
      if (!options?.silent) {
        if (status === 'unclaimed') toast.info('Latest pack still has unclaimed cards');
        else if (status === 'partial') toast.warning('Latest pack was collected, but some minted cards were not found yet');
        else toast.success(`Found ${matched.length} received card${matched.length !== 1 ? 's' : ''}`);
      }
      return audit;
    } catch (error) {
      console.error('Reconstruct latest pack failed:', error);
      if (!options?.silent) toast.error('Could not reconstruct the latest pack open');
      return null;
    } finally {
      setIsReconstructingOpen(false);
    }
  }, [accountName, isViewing, refetchSa, refetchAa, focusCollectionView]);

  // Match-based delivery: only start the deal animation once every revealed
  // card is confirmed present in the refetched collection. Never diff blindly —
  // that used to pick up unrelated background refetches and deal already-owned
  // cards while the real cards were still being indexed.
  const handlePackOpened = useCallback(async (txId?: string | null, reveal?: RevealResult) => {
    const isUnboxNft = txId === 'unbox_nft_complete';
    const preIds = new Set(assetsRef.current.map(a => a.id));
    const hasReveal = !!(reveal && reveal.matchers.length > 0);
    if (hasReveal) {
      preCollectIdsRef.current = preIds;
      pendingAnimationRef.current = { txId: isUnboxNft ? 'unbox_nft' : (txId ?? null) };
    }

    // Initial defer so the reveal dialog can close cleanly, then first refetch.
    await new Promise(r => setTimeout(r, isUnboxNft ? 1500 : 300));
    await Promise.all([refetchPacks(), refetchAtomicPacks(), refetchSa(), refetchAa()]);

    if (!hasReveal) {
      recheckUnclaimed();
      return;
    }

    // Poll for matched delivery up to ~45s.
    const deadline = Date.now() + 45_000;
    const delays = [1500, 2000, 3000, 4000, 5000, 6000, 8000, 10000];
    let attempt = 0;
    let matched: SimpleAsset[] = [];
    while (Date.now() < deadline) {
      // Let React commit the latest refetch into state before reading assetsRef.
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      await new Promise(r => setTimeout(r, 50));
      const result = matchRevealedAssets(reveal!.matchers, assetsRef.current, preCollectIdsRef.current);
      if (result.unresolved.length === 0 && result.matched.length > 0) {
        matched = result.matched;
        break;
      }
      const delay = delays[Math.min(attempt, delays.length - 1)];
      attempt++;
      await new Promise(r => setTimeout(r, delay));
      await Promise.all([refetchSa(), refetchAa()]);
    }

    if (matched.length === reveal!.matchers.length && matched.length > 0) {
      const cat = SCHEMA_TO_CATEGORY[matched[0].category] || matched[0].category || reveal!.expectedCategory || null;
      focusCollectionView(cat);
      setCollectionSyncNotice({ category: cat, count: matched.length });
      setPackAudit({
        unboxingId: null,
        category: cat,
        boxtype: null,
        assets: matched,
        missing: [],
        status: 'collected',
        checkedAt: Date.now(),
      });
      setDealingCards([...matched].reverse());
      setDealtIds(new Set());
      setPendingSuccessInfo({ txId: isUnboxNft ? null : (txId ?? null), count: matched.length });
    } else {
      // Delivery didn't land in the indexer window — do NOT start an animation
      // with the wrong cards. Surface Collect Unclaimed (if applicable) and let
      // the user find their new cards on the next refetch.
      pendingAnimationRef.current = null;
      recheckUnclaimed();
      focusCollectionView(reveal!.expectedCategory);
      setCollectionSyncNotice({ category: reveal!.expectedCategory ?? null, count: reveal!.matchers.length });
      reconstructLatestPackOpen({ focus: false, silent: true });
      toast.info('Cards delivered on-chain — they will appear in your collection shortly.', { duration: 6000 });
    }
  }, [refetchPacks, refetchAtomicPacks, refetchSa, refetchAa, recheckUnclaimed, focusCollectionView, reconstructLatestPackOpen]);

  const handleDemoCollect = useCallback((demoAssets: SimpleAsset[]) => {
    if (demoAssets.length === 0) return;
    const cat = demoAssets[0].category;
    if (cat) setCategoryFilter(cat);
    setViewMode('classic');
    setSearch('');
    setSourceFilter('all');
    setVisibleCount(Number.POSITIVE_INFINITY);
    setDealingCards([...demoAssets].reverse());
    setDealtIds(new Set());
    setPendingSuccessInfo({ txId: null, count: demoAssets.length });
  }, []);

  useEffect(() => {
    if (!accountName || isViewing) { setShowCollectUnclaimed(false); return; }
    recheckUnclaimed();
    const interval = setInterval(recheckUnclaimed, 45_000);
    const onFocus = () => recheckUnclaimed();
    const onVisibility = () => { if (document.visibilityState === 'visible') recheckUnclaimed(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [accountName, isViewing, recheckUnclaimed]);

  // Force-exit private views when entering view-another-wallet mode.
  useEffect(() => {
    if (!isViewing) return;
    setViewMode((prev) => (prev === 'saved' ? 'classic' : prev));
    setSeries2SubTab((prev) => (prev === 'puzzle' ? 'collection' : prev));
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [isViewing]);

  const handleCollectUnclaimed = useCallback(async () => {
    if (!accountName || !session) return;
    setIsCollecting(true);
    try {
      preCollectIdsRef.current = new Set(assetsRef.current.map(a => a.id));

      const rows = await fetchPendingNfts(accountName);
      const unclaimed = rows.filter((r: any) => r.done === 0);
      if (unclaimed.length === 0) {
        toast.info('No unclaimed cards found');
        setCollectionSyncNotice({ category: null });
        setShowCollectUnclaimed(false);
        setIsCollecting(false);
        return;
      }
      const expectedCategory = getGpkCategoryForBoxtype(String(unclaimed[0]?.boxtype ?? ''));
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
      const newest = await waitForNewCollectionAssets(preCollectIdsRef.current, expectedCategory, 20_000);
      pendingAnimationRef.current = null;
      focusCollectionView(expectedCategory);
      setCollectionSyncNotice({ category: expectedCategory, count: newest.length || unclaimed.length });
      reconstructLatestPackOpen({ focus: false, silent: true });
      recheckUnclaimed();
    } catch (e) {
      pendingAnimationRef.current = null;
      console.error('Collect unclaimed failed:', e);
    } finally {
      setIsCollecting(false);
    }
  }, [accountName, session, executeRawTransaction, refetchSa, refetchAa, refetchPacks, refetchAtomicPacks, recheckUnclaimed, waitForNewCollectionAssets, focusCollectionView, reconstructLatestPackOpen]);

  const handleCardDealt = useCallback((id: string) => {
    setDealtIds(prev => new Set([...prev, id]));
  }, []);

  const handleDealComplete = useCallback(() => {
    pendingAnimationRef.current = null;
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

  const savedLayoutKey = useMemo(() => {
    if (!accountName) return null;
    return `gpk-saved-layout-${accountName}-${categoryFilter}`;
  }, [accountName, categoryFilter]);

  const [savedOrder, setSavedOrder] = useState<string[] | null>(() => {
    if (!accountName) return null;
    try {
      const stored = localStorage.getItem(`gpk-saved-layout-${accountName}-${categoryFilter}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.order ?? null;
      }
    } catch {}
    return null;
  });
  const [loadedLayoutName, setLoadedLayoutName] = useState<string | null>(() => {
    if (!accountName) return null;
    try {
      const stored = localStorage.getItem(`gpk-saved-layout-${accountName}-${categoryFilter}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.name ?? null;
      }
    } catch {}
    return null;
  });
  const dragSourceIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  
  const [recentRefreshKey, setRecentRefreshKey] = useState(0);
  const { alerts: priceAlerts, maxAlerts, lastManualCheckAt, manualCooldownMs, checkNow: checkAlertsNow, exportJson: exportAlertsJson, importJson: importAlertsJson, clearAll: clearAllAlerts } = usePriceAlerts();
  const [alertsCheckingNow, setAlertsCheckingNow] = useState(false);
  const [alertsCooldownRemaining, setAlertsCooldownRemaining] = useState(0);

  useEffect(() => {
    if (!lastManualCheckAt) { setAlertsCooldownRemaining(0); return; }
    const tick = () => {
      const remaining = Math.max(0, manualCooldownMs - (Date.now() - lastManualCheckAt));
      setAlertsCooldownRemaining(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastManualCheckAt, manualCooldownMs]);

  const handleCheckAlertsNow = useCallback(async () => {
    setAlertsCheckingNow(true);
    try {
      const res = await checkAlertsNow();
      if (!res.ok && res.remainingMs) {
        toast.error(`Please wait ${Math.ceil(res.remainingMs / 1000)}s before checking again`);
      } else if (res.ok) {
        toast.success('Price alerts checked');
      }
    } finally {
      setAlertsCheckingNow(false);
    }
  }, [checkAlertsNow]);

  const handleExportAlerts = useCallback(() => {
    if (priceAlerts.length === 0) {
      toast.error('No alerts to export');
      return;
    }
    const json = exportAlertsJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `gpk-price-alerts-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${priceAlerts.length} alert${priceAlerts.length !== 1 ? 's' : ''}`);
  }, [priceAlerts.length, exportAlertsJson]);

  // Reusable apply for alerts (called by router-driven multi-file import + Recent menu)
  const applyAlertsRaw = useCallback((raw: string) => {
    const result = importAlertsJson(raw);
    if (result.skipped.length) {
      toast.error(`Alert cap is ${maxAlerts}. Skipped: ${result.skipped.slice(0, 5).join(', ')}${result.skipped.length > 5 ? '…' : ''}`);
    }
    return result;
  }, [importAlertsJson, maxAlerts]);


  // Restore saved layout when account or category changes
  const restoringRef = useRef(false);
  useEffect(() => {
    restoringRef.current = true;
    if (!savedLayoutKey) { setSavedOrder(null); setLoadedLayoutName(null); return; }

    // If a pending import targets this exact key, apply it instead of reading localStorage.
    const pending = pendingImportsRef.current.get(savedLayoutKey);
    if (pending) {
      setSavedOrder(pending.order);
      setLoadedLayoutName(pending.name);
      if (pending.puzzle) setImportedPuzzle(pending.puzzle);
      pendingImportsRef.current.delete(savedLayoutKey);
      requestAnimationFrame(() => { restoringRef.current = false; });
      return;
    }

    try {
      const stored = localStorage.getItem(savedLayoutKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSavedOrder(parsed.order ?? null);
        setLoadedLayoutName(parsed.name ?? null);
      } else {
        setSavedOrder(null);
        setLoadedLayoutName(null);
      }
    } catch {
      setSavedOrder(null);
      setLoadedLayoutName(null);
    }
    // Allow persist after restore completes
    requestAnimationFrame(() => { restoringRef.current = false; });
  }, [savedLayoutKey]);

  // Persist saved layout to localStorage
  useEffect(() => {
    if (!savedLayoutKey || savedOrder === null || restoringRef.current) return;
    try {
      localStorage.setItem(savedLayoutKey, JSON.stringify({
        order: savedOrder,
        name: loadedLayoutName
      }));
    } catch {}
  }, [savedOrder, loadedLayoutName, savedLayoutKey]);

  const categories = useMemo(() => {
    const fromAssets = new Set(assets.map((a) => SCHEMA_TO_CATEGORY[a.category] || a.category).filter((c) => c !== 'packs'));
    for (const p of packs) { const cat = PACK_CATEGORY_MAP[p.symbol]; if (cat) fromAssets.add(cat); }
    for (const p of atomicPacks) { const cat = ATOMIC_PACK_CATEGORY_MAP[p.templateId]; if (cat) fromAssets.add(cat); }
    // Always include all known categories so they appear in the dropdown even if user owns none
    const priority = ['all', 'series1', 'series2', 'exotic', 'crashgordon', 'bernventures', 'mittens', 'gamestonk', 'foodfightb', 'bonus', 'originalart', 'promo'];
    for (const cat of priority) {
      if (cat !== 'all') fromAssets.add(cat);
    }
    return [...fromAssets].sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [assets, packs, atomicPacks]);

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (a.category === 'packs') return false;
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.id.includes(search)) return false;
      const effectiveCategory = SCHEMA_TO_CATEGORY[a.category] || a.category;
      if (categoryFilter !== 'all' && effectiveCategory !== categoryFilter) return false;
      if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
      if ((categoryFilter === 'series1' || categoryFilter === 'series2' || categoryFilter === 'exotic' || categoryFilter === 'foodfightb') && !variantFilter.includes('all') && !variantFilter.includes(a.quality.toLowerCase())) return false;
      return true;
    });
  }, [assets, search, categoryFilter, sourceFilter, variantFilter]);

  const sortedFiltered = useMemo(() => {
    if (sortMode === 'natural') return filtered;
    const arr = [...filtered];
    if (sortMode === 'newest') {
      arr.sort((a, b) => {
        try {
          const aId = BigInt(a.id);
          const bId = BigInt(b.id);
          return bId > aId ? 1 : bId < aId ? -1 : 0;
        }
        catch { return b.id.localeCompare(a.id); }
      });
      return arr;
    }
    const cardNum = (a: SimpleAsset) => {
      const n = parseInt(a.cardid, 10);
      return isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
    };
    if (sortMode === 'name') {
      arr.sort((a, b) =>
        a.name.localeCompare(b.name) ||
        cardNum(a) - cardNum(b) ||
        (a.side || '').localeCompare(b.side || '')
      );
    } else {
      arr.sort((a, b) =>
        getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality) ||
        cardNum(a) - cardNum(b) ||
        (a.side || '').localeCompare(b.side || '')
      );
    }
    return arr;
  }, [filtered, sortMode]);

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
    if ((categoryFilter === 'series1' || categoryFilter === 'series2' || categoryFilter === 'exotic' || categoryFilter === 'foodfightb') && !variantFilter.includes('all')) {
      filteredTemplates = binderTemplates.filter(t => variantFilter.includes(t.variant.toLowerCase()));
    }

    return filteredTemplates.map(template => {
      const byTid = ownedByTemplateId.get(template.templateId);
      const byKey = ownedByCardKey.get(`${template.cardid}:${template.quality.toLowerCase()}:${template.variant.toLowerCase()}`);
      // Merge (atomic + simpleasset) sources; dedupe by asset id. byTid first so the
      // primary rendered card keeps its previous identity when both exist.
      const merged: SimpleAsset[] = [];
      const seenIds = new Set<string>();
      const pushAll = (arr?: SimpleAsset[]) => {
        if (!arr) return;
        for (const a of arr) if (!seenIds.has(a.id)) { seenIds.add(a.id); merged.push(a); }
      };
      pushAll(byTid);
      pushAll(byKey);
      const owned = merged.length ? merged : null;
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

  const handleExportLayout = useCallback(async () => {
    if (!accountName || savedOrder === null) return;
    const defaultFilename = `gpk-layout-${accountName}-${categoryFilter}.json`;
    const puzzle = puzzleStateRef.current;
    const firstReal = savedOrder.findIndex(id => id !== EMPTY);
    let lastReal = -1;
    for (let i = savedOrder.length - 1; i >= 0; i--) { if (savedOrder[i] !== EMPTY) { lastReal = i; break; } }
    const cleanOrder = firstReal === -1 ? [] : savedOrder.slice(firstReal, lastReal + 1);
    const jsonStr = JSON.stringify({ account: accountName, category: categoryFilter, orders: { saved: cleanOrder }, puzzle }, null, 2);

    // Try File System Access API (lets user pick folder & name)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        toast.success('Layout exported');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user cancelled
      }
    }

    // Fallback for browsers without File System Access API
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = defaultFilename; a.click();
    URL.revokeObjectURL(url);
    toast.success('Layout exported');
  }, [accountName, savedOrder, categoryFilter]);

  const handleExportPuzzle = useCallback(async () => {
    const puzzle = puzzleStateRef.current;
    if (!puzzle || Object.keys(puzzle).length === 0) {
      toast.error('No puzzle layout to export');
      return;
    }
    const jsonStr = JSON.stringify(puzzle, null, 2);
    const defaultFilename = `gpk-puzzle-${accountName || 'layout'}.json`;
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        toast.success('Puzzle layout exported');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = defaultFilename; a.click();
    URL.revokeObjectURL(url);
    toast.success('Puzzle layout exported');
  }, [accountName]);

  // Extract a normalized order array from a parsed layout file. Returns null if no usable data.
  const extractLayoutOrder = useCallback((data: DetectedLayout['parsed']): string[] | null => {
    let order: string[] | null = null;
    if (data.orders) {
      if (Array.isArray((data.orders as any).saved)) {
        order = (data.orders as any).saved;
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
    return order && order.length > 0 ? order : null;
  }, []);

  // Resolve target category from layout file. Returns null if missing/unknown (caller falls back to current).
  const resolveTargetCategory = useCallback((data: DetectedLayout['parsed']): { target: string | null; rawUnknown: string | null } => {
    const rawCategory = typeof (data as any).category === 'string' ? (data as any).category.trim() : '';
    if (!rawCategory) return { target: null, rawUnknown: null };
    const isKnown = rawCategory === 'all' || rawCategory in CATEGORY_LABELS;
    return isKnown ? { target: rawCategory, rawUnknown: null } : { target: null, rawUnknown: rawCategory };
  }, []);

  // Single-file apply (also used by Recent menu). For multi-file imports, use applyLayoutDataBatch.
  const applyLayoutData = useCallback((data: DetectedLayout['parsed'], filename: string) => {
    if (!accountName) throw new Error('Connect a wallet to import a layout');

    const order = extractLayoutOrder(data);
    if (!order) throw new Error('No layout data found in file');

    const paddedOrder = [...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY), ...order, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)];
    const hasPuzzle = !!(data.puzzle && typeof data.puzzle === 'object');
    const puzzleData = hasPuzzle ? (data.puzzle as PuzzlePieceMap) : null;

    const { target: targetCategory, rawUnknown } = resolveTargetCategory(data);
    if (rawUnknown) {
      toast.message(`Layout's category '${rawUnknown}' is unknown — applied to current view`);
    }

    if (targetCategory && targetCategory !== categoryFilter) {
      const newKey = `gpk-saved-layout-${accountName}-${targetCategory}`;
      pendingImportsRef.current.set(newKey, { order: paddedOrder, name: filename, puzzle: puzzleData });
      setCategoryFilter(targetCategory);
    } else {
      setSavedOrder(paddedOrder);
      setLoadedLayoutName(filename);
      if (puzzleData) setImportedPuzzle(puzzleData);
    }

    setViewMode('saved');
    return { cards: order.length, hasPuzzle };
  }, [accountName, categoryFilter, extractLayoutOrder, resolveTargetCategory]);

  // Batch apply for multi-file imports. Writes non-active categories straight to localStorage,
  // queues all in pendingImportsRef, and switches to the FIRST layout's category (deterministic).
  const applyLayoutDataBatch = useCallback((
    items: Array<{ data: DetectedLayout['parsed']; filename: string }>
  ): { applied: number; switchedTo: string | null; categories: string[] } => {
    if (!accountName) throw new Error('Connect a wallet to import a layout');
    if (items.length === 0) return { applied: 0, switchedTo: null, categories: [] };

    let switchTarget: string | null = null;
    const appliedCategories: string[] = [];

    for (const { data, filename } of items) {
      const order = extractLayoutOrder(data);
      if (!order) continue;

      const paddedOrder = [...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY), ...order, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)];
      const hasPuzzle = !!(data.puzzle && typeof data.puzzle === 'object');
      const puzzleData = hasPuzzle ? (data.puzzle as PuzzlePieceMap) : null;

      const { target } = resolveTargetCategory(data);
      const effectiveCategory = target || categoryFilter;
      const key = `gpk-saved-layout-${accountName}-${effectiveCategory}`;

      // Queue in-memory so the restore effect (or current-category render) picks it up.
      pendingImportsRef.current.set(key, { order: paddedOrder, name: filename, puzzle: puzzleData });

      // Persist immediately to localStorage so non-active categories survive even without a state cycle.
      try {
        localStorage.setItem(key, JSON.stringify({ order: paddedOrder, name: filename }));
      } catch {}

      appliedCategories.push(effectiveCategory);
      if (switchTarget === null) switchTarget = effectiveCategory;
    }

    if (switchTarget && switchTarget !== categoryFilter) {
      setCategoryFilter(switchTarget);
    } else if (switchTarget) {
      // Same category — apply immediately from the pending entry so UI updates without a key change.
      const key = `gpk-saved-layout-${accountName}-${switchTarget}`;
      const pending = pendingImportsRef.current.get(key);
      if (pending) {
        setSavedOrder(pending.order);
        setLoadedLayoutName(pending.name);
        if (pending.puzzle) setImportedPuzzle(pending.puzzle);
        pendingImportsRef.current.delete(key);
      }
    }

    setViewMode('saved');
    return { applied: appliedCategories.length, switchedTo: switchTarget, categories: appliedCategories };
  }, [accountName, categoryFilter, extractLayoutOrder, resolveTargetCategory]);


  // Reusable apply for puzzle (called by router-driven multi-file import + Recent menu)
  const applyPuzzleData = useCallback((data: PuzzlePieceMap) => {
    setImportedPuzzle(data);
    return { pieces: Object.keys(data).length };
  }, []);

  const summarizeRouteResults = useCallback((results: ReturnType<typeof routeOne>[]) => {
    const ok = results.filter(r => r.ok);
    const failed = results.filter(r => !r.ok);
    const parts: string[] = [];

    const alertsTotals = ok
      .filter(r => r.kind === 'alerts' && r.alerts)
      .reduce((acc, r) => {
        acc.added += r.alerts!.added;
        acc.updated += r.alerts!.updated;
        acc.skipped += r.alerts!.skipped.length;
        return acc;
      }, { added: 0, updated: 0, skipped: 0 });
    if (alertsTotals.added || alertsTotals.updated || alertsTotals.skipped) {
      const a: string[] = [];
      if (alertsTotals.added) a.push(`${alertsTotals.added} added`);
      if (alertsTotals.updated) a.push(`${alertsTotals.updated} updated`);
      if (alertsTotals.skipped) a.push(`${alertsTotals.skipped} skipped`);
      parts.push(`Alerts: ${a.join(', ')}`);
    }

    const layoutOk = ok.find(r => r.kind === 'layout');
    if (layoutOk?.layout) {
      parts.push(`Layout: ${layoutOk.layout.cards} card${layoutOk.layout.cards !== 1 ? 's' : ''}${layoutOk.layout.hasPuzzle ? ' + puzzle' : ''}`);
    }

    const puzzleOk = ok.find(r => r.kind === 'puzzle');
    if (puzzleOk?.puzzle && !layoutOk?.layout?.hasPuzzle) {
      parts.push(`Puzzle: ${puzzleOk.puzzle.pieces} piece${puzzleOk.puzzle.pieces !== 1 ? 's' : ''}`);
    }

    if (ok.length > 0) {
      toast.success(`Imported ${ok.length} file${ok.length !== 1 ? 's' : ''}${parts.length ? ` — ${parts.join(' · ')}` : ''}`);
    }
    for (const f of failed) {
      toast.error(`${f.filename}: ${f.message || 'Could not import'}`);
    }
  }, []);

  const routerHandlers = useMemo(() => ({
    onAlerts: (raw: string) => applyAlertsRaw(raw),
    onLayout: (parsed: DetectedLayout['parsed'], filename: string) => applyLayoutData(parsed, filename),
    onPuzzle: (parsed: PuzzlePieceMap) => applyPuzzleData(parsed),
  }), [applyAlertsRaw, applyLayoutData, applyPuzzleData]);

  const handleImportFiles = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Two-pass: first read & detect everything, then process layouts as a single batch
    // (so multiple per-category layouts in one selection don't race each other).
    type Pending =
      | { kind: 'layout'; filename: string; raw: string; parsed: DetectedLayout['parsed'] }
      | { kind: 'other'; filename: string; raw: string }
      | { kind: 'error'; filename: string; message: string };

    const pendings: Pending[] = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const detected = parseAndDetect(text);
        if (detected.kind === 'layout') {
          pendings.push({ kind: 'layout', filename: file.name, raw: text, parsed: detected.parsed });
        } else {
          pendings.push({ kind: 'other', filename: file.name, raw: text });
        }
      } catch (err) {
        pendings.push({ kind: 'error', filename: file.name, message: err instanceof Error ? err.message : 'Failed to read file' });
      }
    }

    const results: ReturnType<typeof routeOne>[] = [];

    // Process non-layout files via the existing per-file router.
    for (const p of pendings) {
      if (p.kind === 'other') {
        const result = routeOne(p.filename, p.raw, routerHandlers);
        results.push(result);
        if (result.ok && result.kind !== 'unknown') {
          addRecentJson({ filename: p.filename, kind: result.kind, raw: p.raw });
        }
      } else if (p.kind === 'error') {
        results.push({ filename: p.filename, kind: 'unknown', ok: false, message: p.message });
      }
    }

    // Process all layouts together via the batch path.
    const layoutPendings = pendings.filter((p): p is Extract<Pending, { kind: 'layout' }> => p.kind === 'layout');
    if (layoutPendings.length > 0) {
      try {
        const items = layoutPendings.map(p => ({ data: p.parsed, filename: p.filename }));
        const summary = applyLayoutDataBatch(items);
        for (const p of layoutPendings) {
          const order = extractLayoutOrder(p.parsed) || [];
          const hasPuzzle = !!(p.parsed.puzzle && typeof p.parsed.puzzle === 'object');
          results.push({ filename: p.filename, kind: 'layout', ok: true, layout: { cards: order.length, hasPuzzle } });
          addRecentJson({ filename: p.filename, kind: 'layout', raw: p.raw });
        }
        if (summary.applied > 1) {
          const cats = Array.from(new Set(summary.categories)).map(c => CATEGORY_LABELS[c] || c).join(', ');
          const switchedLabel = summary.switchedTo ? (CATEGORY_LABELS[summary.switchedTo] || summary.switchedTo) : null;
          toast.success(
            `Imported ${summary.applied} layouts (${cats})${switchedLabel ? ` — switched to ${switchedLabel}` : ''}. Others saved and ready when you switch categories.`
          );
        }
      } catch (err) {
        for (const p of layoutPendings) {
          results.push({
            filename: p.filename,
            kind: 'layout',
            ok: false,
            message: err instanceof Error ? err.message : 'Failed to apply layout',
          });
        }
      }
    }

    setRecentRefreshKey(k => k + 1);
    summarizeRouteResults(results);
    e.target.value = '';
  }, [routerHandlers, summarizeRouteResults, applyLayoutDataBatch, extractLayoutOrder]);

  const handleApplyRecent = useCallback((entry: RecentJsonEntry) => {
    const result = routeOne(entry.filename, entry.raw, routerHandlers);
    summarizeRouteResults([result]);
  }, [routerHandlers, summarizeRouteResults]);


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
          priceAlertTemplate={template}
          isReadOnly={isViewing}
        />
      );
    }
    return (
      <MissingCardPlaceholder key={`missing-${template.templateId}`} template={template} isReadOnly={isViewing} />
    );
  }, [selectionMode, selectedIds, toggleSelection, isViewing]);

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

  const renderSelectButton = () => {
    if (isViewing) return null;
    return (
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
  };

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

  const renderCompletionBar = () => {
    if (!accountName || isViewing) return null;
    const key = categoryFilter === 'all' ? 'overall' : categoryFilter;
    const entry = completion[key];
    if (!entry) return null;
    const label = categoryFilter === 'all' ? 'Overall' : (CATEGORY_LABELS[categoryFilter] || categoryFilter);
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-cheese whitespace-nowrap">
          {label}: {entry.percent}%
        </span>
        <Progress value={entry.percent} className="w-24 h-2 bg-muted" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {entry.owned}/{entry.total}
        </span>
      </div>
    );
  };

  const renderPackAuditPanel = () => {
    if (!packAudit || packAudit.status === 'none') return null;
    const label = packAudit.category ? (CATEGORY_LABELS[packAudit.category] || packAudit.category) : 'Latest pack';
    const checked = new Date(packAudit.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="mb-4 rounded-lg border border-cheese/30 bg-card/70 p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-cheese">Last Pack Opened</h3>
            <p className="text-sm text-muted-foreground">
              {label}{packAudit.unboxingId ? ` · Unboxing ${packAudit.unboxingId}` : ''} · checked {checked}
            </p>
            {packAudit.status === 'unclaimed' && (
              <p className="text-sm text-muted-foreground">This pack still has unclaimed rows. Use Collect Unclaimed to finish delivery.</p>
            )}
            {packAudit.status === 'partial' && (
              <p className="text-sm text-muted-foreground">The contract says this pack was collected, but some matching assets are not visible from the indexer yet.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => reconstructLatestPackOpen({ focus: false })}
              disabled={isReconstructingOpen}
              variant="outline"
              size="sm"
              className="border-cheese/50 text-cheese hover:bg-cheese/10"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isReconstructingOpen ? 'animate-spin' : ''}`} />
              Recheck
            </Button>
            <Button
              onClick={() => setPackAudit(null)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Hide last pack"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {packAudit.assets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {packAudit.assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedAsset(asset)}
                className="flex items-center gap-3 rounded-md border border-border bg-background/60 p-2 text-left hover:border-cheese/50 transition-colors"
              >
                <div className="h-16 w-12 flex-shrink-0 rounded-sm bg-muted overflow-hidden">
                  <IpfsMedia url={asset.image} alt={asset.name} context="card" showSkeleton className="h-full w-full" />
                </div>
                <span className="min-w-0 space-y-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{asset.name}</span>
                  <span className="block text-xs text-cheese">#{asset.cardid}{asset.side || ''} {asset.quality}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">Asset {asset.id}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {packAudit.missing.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Still waiting on: {packAudit.missing.map((m) => `#${m.cardid}${m.side} ${m.variant}`).join(', ')}
          </div>
        )}
      </div>
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
      <div className="flex items-center gap-3 relative z-10 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <p className="text-sm text-muted-foreground">{filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found</p>
          {renderSelectButton()}
          {selectionMode && renderSelectAllCheckbox(sortedFiltered.slice(0, visibleCount).map(a => a.id))}
        </div>
        <div className="flex-shrink-0">
          {renderCompletionBar()}
        </div>
        <div className="flex items-center justify-end flex-1">
          {!isViewing && (
            <Button
              onClick={handleSnapshotToSaved}
              variant="outline"
              size="sm"
              className="whitespace-nowrap border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10 h-8"
              title="Copy current view to Saved Collection for custom arrangement"
            >
              <Save className="h-4 w-4 mr-1" />
              Copy to Saved
            </Button>
          )}
        </div>
      </div>
      {renderPackAuditPanel()}
      {filtered.length === 0 && !isLoading ? (
        <p className="text-center text-muted-foreground py-12">
          {isViewing
            ? `${viewedAccount} has no GPK NFTs${categoryFilter !== 'all' ? ' in this category' : ''}.`
            : (assets.length === 0 ? 'No SimpleAssets NFTs found in this wallet.' : 'No NFTs match your filters.')}
        </p>
      ) : filtered.length === 0 ? null : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sortedFiltered.slice(0, visibleCount).map((asset) => {
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
                  isReadOnly={isViewing}
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
    const visibleOwned = binderGrid ? binderGrid.flatMap(s => s.owned ? s.owned.map(a => a.id) : []) : [];
    const triggeredCount = priceAlerts.filter(a => a.triggered).length;
    const cooldownActive = alertsCooldownRemaining > 0;
    return (
      <>
        <div className="flex items-center gap-3 relative z-10 mb-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            {binderGrid ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found · {binderGrid.filter(s => s.owned).length} / {binderGrid.length} unique collected
                  {binderLoading && ' (loading templates...)'}
                </p>
                {renderSelectButton()}
                {renderSelectAllCheckbox(visibleOwned)}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a specific series to use Collector Binder.</p>
            )}
          </div>
          {binderGrid && (
            <div className="flex-shrink-0">
              {renderCompletionBar()}
            </div>
          )}
          {!isViewing && (
          <div className="flex items-center justify-end gap-2 flex-1 min-w-[300px]">
            <AlertsManagerPopover triggeredCount={triggeredCount} />
            <JsonMenu
              refreshKey={recentRefreshKey}
              alertsCount={priceAlerts.length}
              alertsMax={maxAlerts}
              triggeredCount={triggeredCount}
              alertsCheckingNow={alertsCheckingNow}
              alertsCooldownMs={alertsCooldownRemaining}
              onImportFiles={handleImportFiles}
              onApplyRecent={handleApplyRecent}
              onCheckAlertsNow={handleCheckAlertsNow}
              onExportAlerts={handleExportAlerts}
              onExportLayout={handleExportLayout}
              onExportPuzzle={handleExportPuzzle}
              layoutHasData={savedOrder !== null}
              puzzleHasData={Object.keys(puzzleStateRef.current).length > 0}
            />
            <Button
              onClick={() => {
                const count = priceAlerts.length;
                clearAllAlerts();
                toast.success(count > 0 ? `Cleared ${count} alert${count !== 1 ? 's' : ''}` : 'No alerts to clear');
              }}
              disabled={priceAlerts.length === 0}
              variant="outline"
              size="sm"
              className="whitespace-nowrap border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive/10 h-8"
              title="Remove all price alerts"
            >
              <Trash2 className="h-4 w-4 mr-1" />Clear Alerts
            </Button>
          </div>
          )}
        </div>
        {binderGrid ? (
          renderBinderSections(binderGrid, categoryFilter === 'series2')
        ) : (
          <p className="text-center text-muted-foreground py-12">Select a specific series (e.g., Series 1, Series 2, or Food Fight) to view the Collector Binder grid.</p>
        )}
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
            <JsonMenu
              refreshKey={recentRefreshKey}
              alertsCount={priceAlerts.length}
              alertsMax={maxAlerts}
              triggeredCount={priceAlerts.filter(a => a.triggered).length}
              alertsCheckingNow={alertsCheckingNow}
              alertsCooldownMs={alertsCooldownRemaining}
              onImportFiles={handleImportFiles}
              onApplyRecent={handleApplyRecent}
              onCheckAlertsNow={handleCheckAlertsNow}
              onExportAlerts={handleExportAlerts}
              onExportLayout={handleExportLayout}
              onExportPuzzle={handleExportPuzzle}
              layoutHasData={savedOrder !== null}
              puzzleHasData={Object.keys(puzzleStateRef.current).length > 0}
            />
          </div>
        </div>
      );
    }

    const filteredIdSet = new Set(filtered.map(a => a.id));
    const validSlots = savedGridSlots.filter(id => id !== EMPTY);
    const visibleAssets = validSlots.filter(id => filteredIdSet.has(id));

    return (
      <>
        <div className="flex items-center gap-3 relative z-10 mb-4">
          <div className="flex items-center gap-3 flex-1">
            <p className="text-sm text-muted-foreground">{visibleAssets.length} card{visibleAssets.length !== 1 ? 's' : ''} in saved layout</p>
            {renderSelectButton()}
            {selectionMode && renderSelectAllCheckbox(validSlots.filter(id => allAssetMap.has(id)))}
          </div>
          <div className="flex-shrink-0">
            {renderCompletionBar()}
          </div>
          <div className="flex items-center justify-end gap-2 flex-1">
            {loadedLayoutName && (
              <span className="text-xs px-2 py-1 rounded bg-cheese/10 border border-cheese/20 text-cheese truncate max-w-[200px]" title={loadedLayoutName}>
                📄 {loadedLayoutName}
              </span>
            )}
            <JsonMenu
              refreshKey={recentRefreshKey}
              alertsCount={priceAlerts.length}
              alertsMax={maxAlerts}
              triggeredCount={priceAlerts.filter(a => a.triggered).length}
              alertsCheckingNow={alertsCheckingNow}
              alertsCooldownMs={alertsCooldownRemaining}
              onImportFiles={handleImportFiles}
              onApplyRecent={handleApplyRecent}
              onCheckAlertsNow={handleCheckAlertsNow}
              onExportAlerts={handleExportAlerts}
              onExportLayout={handleExportLayout}
              onExportPuzzle={handleExportPuzzle}
              layoutHasData={savedOrder !== null}
              puzzleHasData={Object.keys(puzzleStateRef.current).length > 0}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="whitespace-nowrap border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10 h-8">
                  <Plus className="h-4 w-4 mr-1" />Add Row
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setSavedOrder(prev => prev ? [...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY), ...prev] : prev);
                  toast.success('Empty row added to top');
                }}>
                  Add to Top
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setSavedOrder(prev => prev ? [...prev, ...Array(EXTRA_EMPTY_SLOTS).fill(EMPTY)] : prev);
                  toast.success('Empty row added to bottom');
                }}>
                  Add to Bottom
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => { if (savedLayoutKey) localStorage.removeItem(savedLayoutKey); setSavedOrder(null); setLoadedLayoutName(null); toast.success('Layout cleared for this category'); }} variant="outline" size="sm" className="whitespace-nowrap border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive/10 h-8">
              <Trash2 className="h-4 w-4 mr-1" />Clear Layout
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {savedGridSlots.slice(0, visibleCount).map((slotId, idx) => {
            if (slotId === EMPTY) return <EmptySlot key={`empty-${idx}`} onDragOver={handleDragOver(idx)} onDrop={handleDrop(idx)} isOver={dragOverIdx === idx} />;

            const asset = allAssetMap.get(slotId);
            if (!asset || !filteredIdSet.has(asset.id)) return (
              <div key={`missing-${idx}`} className="aspect-square rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">Missing</span>
              </div>
            );

            return (
              <SimpleAssetCard
                key={asset.id}
                asset={asset}
                onClick={() => setSelectedAsset(asset)}
                draggable={!selectionMode && !isViewing}
                selectionMode={selectionMode}
                selected={selectedIds.has(asset.id)}
                onSelect={toggleSelection}
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                isReadOnly={isViewing}
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
      <div className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/50">
        <div className="container flex h-12 items-center justify-between">

          {/* Left: offline backup trigger */}
          <div className="flex items-center gap-2">
            <BackupPanel triggerClassName="text-cheese/80 hover:text-cheese text-sm inline-flex items-center gap-1.5 transition-colors" />
          </div>

          {/* Right: Info button + view wallet (logged in only) + wallet controls */}
          <div className="flex items-center gap-2 ml-auto">
            {isConnected && accountName && !isViewing && (
              <>
                <Button
                  onClick={handleCollectUnclaimed}
                  disabled={isCollecting}
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap border-cheese/50 text-cheese hover:bg-cheese/10 h-8"
                  title="Scan pendingnft.a and claim any cards that were minted but never delivered."
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isCollecting ? 'animate-spin' : ''}`} />
                  {isCollecting ? 'Collecting...' : 'Recover Stuck Cards'}
                </Button>
                {collectionSyncNotice && (
                  <Button
                    onClick={() => reconstructLatestPackOpen({ focus: true })}
                    disabled={isReconstructingOpen}
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap border-cheese/50 text-cheese hover:bg-cheese/10 h-8"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isReconstructingOpen ? 'animate-spin' : ''}`} />
                    Show Received Cards{collectionSyncNotice.count ? ` (${collectionSyncNotice.count})` : ''}
                  </Button>
                )}
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-cheese/10"
              onClick={() => setShowInfoDialog(true)}
            >
              <Info className="h-4 w-4 text-cheese" />
              <span className="sr-only">GPK Collection Manager Info</span>
            </Button>

            {isConnected && accountName && (
              <ViewWalletControl
                currentAccount={accountName}
                viewedAccount={viewedAccount}
                onView={handleViewWallet}
                onClear={handleClearViewing}
              />
            )}


            {isConnected && accountName ? (
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
            ) : (
              <Button onClick={login} size="sm" className="bg-cheese hover:bg-cheese/90 text-cheese-foreground h-8">
                <Wallet className="h-4 w-4 mr-1" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>

      <BackupNudgeBanner />



      {isViewing && viewedAccount && (
        <ViewingBanner viewedAccount={viewedAccount} onClear={handleClearViewing} />
      )}

      {/* Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-cheese text-xl">GPK Collection Manager</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-5 text-sm">
              <div className="rounded-lg border border-cheese/30 bg-cheese/5 p-3">
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">🔒</span> No New Smart Contracts</h4>
                <p className="text-foreground">This manager is a pure front-end client. It does <strong>not</strong> deploy or rely on any custom smart contracts — every action is built from the existing, audited <strong>simpleassets</strong> and <strong>atomicassets</strong> tables and actions on WAX.</p>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">👁️</span> Collection Views</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li><strong>Classic View</strong> — A clean, read-only grid of your cards in natural sort order. No clutter, just your collection as it is. Supports pagination for large collections and instant search across all card names.</li>
                  <li><strong>Collector Binder</strong> — Template-based completionist view with real-time completion percentage tracking. Owned cards appear in full color with checkmarks; missing cards are greyscale placeholders linked directly to AtomicHub so you can buy what you need. Duplicate cards are stacked and accessible via a stack dialog showing all copies. Completion stats update live as you open packs or receive transfers.</li>
                  <li><strong>Saved Collection</strong> — Your personal workspace. Drag-and-drop to rearrange cards into any order you like, insert empty spacer slots for custom layouts, and build the perfect display of your collection. Layouts persist across sessions via localStorage, and can be exported as JSON to back up or share with other collectors. Import layouts to restore previous arrangements instantly.</li>
                </ul>
                <p className="text-foreground mt-2">All three views persist simultaneously — your Classic filters, Binder progress, and Saved layouts are all maintained at once. Switch seamlessly between them using a simple tab interface for unprecedented control over how you manage and view your collection.</p>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">📦</span> Pack Openings</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Most Topps pack types supported — Series 1, Series 2, Tiger King (Exotic), Food Fight, Crash Gordon and Bernventures — with Mittens, GameStonk and more likely soon</li>
                  <li>Both <strong>SimpleAssets</strong> and <strong>AtomicAssets</strong> packs open natively.</li>
                  <li>Card-by-card reveal animation</li>
                  <li>Choreographed card-deal sequence animates revealed cards into their sorted collection positions with an option to skip animation</li>
<li>Immersive sound design — packs shake, packs rip, and card reveal noises synchronized to the animations. When the cards are dealt listen to your new cards fuse to your collection</li>
                  <li>View your SimpleAssets packs using the original placeholder artwork.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">🎛️</span> Flexibility</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Unified view for <strong>SimpleAssets</strong> and <strong>AtomicAssets</strong> — your entire GPK collection in one place regardless of which contract holds them.</li>
                  <li>Multi-account support: add multiple WAX accounts and switch between them instantly.</li>
                  <li>Filter by any GPK sub-collection (Series 1, Series 2, Crash Gordon, Tiger King, etc.).</li>
                  <li>Drill down by variant — Base, Prism, Sketch, VHS, Slime, Tiger Stripe, Gold, and more.</li>
                  <li>Multiple sort options: natural order, name, variant rarity.</li>
                  <li>Source filter to view SimpleAssets only, AtomicAssets only, or both together.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">👁️</span> View Any Wallet (Read-Only)</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Enter any valid WAX account name and browse that wallet's collection without logging in.</li>
                  <li>View the Classic card grid, Collector Binder view, card detail dialogs, and pack holdings.</li>
                  <li>See both SimpleAssets and AtomicAssets items together.</li>
                  <li>Switch back to your own collection at any time with the <strong>Return to my collection</strong> button.</li>
                </ul>
                <p className="text-foreground mt-2"><strong>You cannot</strong> see their saved layout, Puzzle Builder, or completion percentage.</p>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">🧩</span> Series 2 Puzzle Builder</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Series 2 cards contain hidden puzzle pieces on their backs.</li>
                  <li>Free-form canvas to drag, rotate, and arrange your puzzle pieces.</li>
                  <li>Save and load your puzzle progress as JSON.</li>
                  <li>Scramble pieces to start fresh or fine-tune placements.</li>
                  <li><strong>Timer Race Mode</strong> — race the clock to assemble the puzzle.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">🔍</span> Inspection & Magnification</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Click any card to open a full-detail view with front/back both visible.</li>
                  <li>Magnifying lens follows your cursor on hover, zooming into every line and detail.</li>
                  <li>Interactive 3D tilt effect on card hover — cards respond to your mouse with realistic depth and perspective.</li>
                  <li>IPFS-sourced high-resolution images with automatic gateway fallback.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-sm">✏️</span> Draw & Write on Cards</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Switch to pen mode on any card to doodle, scribble or write.</li>
                  <li>Reward your friends and family members with the <strong>'Spaz Award'</strong>, permit them the right to stay up late and watch the <strong>Late Late Late Show</strong>.</li>
                  <li>After taking a screenshot just press the erase button or close the modal and your cards are as good as new!</li>
                  <li>Pick from multiple colors and draw on both front and back images.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">🔥</span> Transfer & Burn</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Transfer NFTs between WAX accounts — supports both SimpleAssets and AtomicAssets in one transaction.</li>
                  <li>Bulk selection mode for transferring or burning multiple cards at once.</li>
                  <li>Burn unwanted NFTs permanently with a "type BURN to confirm" safety check.</li>
                  <li>Mixed selections work seamlessly — select SimpleAssets and AtomicAssets together and the correct contract actions are built automatically.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">🔔</span> Price Alerts</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Set up to <strong>5 active price alerts</strong> in total across your entire collection (global cap, not per category).</li>
                  <li>Pick any missing card from the Collector Binder and set your maximum target WAX price.</li>
                  <li>Alerts run quietly in the background — get a toast notification the moment a listing drops below your threshold.</li>
                  <li>Export and import all your alerts as JSON to back them up or move between devices.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">📂</span> Import / Export &amp; Multi-File Load</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Save your Saved Collection layouts, Puzzle Builder progress, and Price Alerts as JSON files.</li>
                  <li><strong>Multi-file import:</strong> drop or select multiple JSON files at once — load every saved category layout, your price alerts, and your puzzle formation in one easy step.</li>
                  <li>Each file is auto-routed to the correct category, alert store, or puzzle layout — no manual sorting required.</li>
                  <li>Recent imports are remembered for quick re-apply, and the unified JSON menu is available in both the main collection view and the Puzzle Builder.</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-cheese mb-1 flex items-center gap-2"><span className="text-base">🤝</span> Community</h4>
                <ul className="list-disc pl-5 space-y-1 text-foreground">
                  <li>Completely free to use — no fees, no sign-ups.</li>
                  <li>Built by <span className="text-cheese font-semibold">$CHEESE</span>, the first project ever launched on the WAX blockchain.</li>
                  <li>Banner ad slots available via CheeseHub for community projects.</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      <div className="container py-8 space-y-6">
        <BannerAd />
        <div className="mb-6" />

        {(isConnected || isViewing) && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cheese">Unofficial GPK.Topps Collection Manager</h1>
            <p className="text-cheese/70 mt-1">View, organize and transfer your gpk.topps cards. Open packs and drag and reorder cards where you want them.<br />Supports SimpleAssets and AtomicAssets.</p>
            {(categoryFilter === 'series1' || categoryFilter === 'series2' || categoryFilter === 'exotic') && (
              <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 text-sm text-cheese/80">
                <span>Optional: Bridge your</span>
                <img src={logoSimpleAssets} alt="SimpleAssets" className="h-5 w-auto rounded" />
                <span>to</span>
                <img src={logoAtomicAssets} alt="AtomicAssets" className="h-5 w-auto rounded" />
                <a
                  href="https://atomichub.io/bridge"
                  onClick={(e) => { e.preventDefault(); footerRequestNav('https://atomichub.io/bridge'); }}
                  className="text-cheese underline hover:text-cheese/80"
                >
                  here
                </a>
                <span>.</span>
              </p>
            )}
          </div>
        )}

        {!isConnected && !isViewing ? (
          <div className="space-y-16 py-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold text-cheese-gradient leading-[1.25] pb-2 max-w-3xl">
                The Unofficial GPK Collection Manager
              </h2>
              <p className="text-lg text-foreground max-w-2xl">
                Free to use, open source, built by <span className="text-cheese font-semibold">$CHEESE</span> for the WAX and GPK communities.
              </p>
              <div className="max-w-2xl rounded-lg border border-cheese/30 bg-cheese/5 px-4 py-3 text-sm text-foreground">
                <span className="font-semibold text-cheese">🔒 No new smart contracts.</span> This manager only uses the existing <strong>simpleassets</strong> and <strong>atomicassets</strong> actions and tables — no custom contracts, fully transparent on-chain.
              </div>
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
                  icon={<span className="text-2xl">👁️</span>}
                  title="Classic View"
                  description="A read-only grid of your cards in natural sort order. Clean, simple, no clutter. Just your collection as it is."
                />
                <FeatureCard
                  icon={<span className="text-2xl">📖</span>}
                  title="Collector Binder"
                  description="Template-based completionist view. Owned cards in full color, missing cards as greyscale placeholders linked directly to AtomicHub. Set price alerts on any missing card to get notified when it drops below your target. See exactly what you need."
                />
                <FeatureCard
                  icon={<span className="text-2xl">💾</span>}
                  title="Saved Collection"
                  description="Your personal workspace. Import/export JSON layouts, drag-and-drop to rearrange, and build the perfect display of your collection."
                />
              </div>
            </div>
            <p className="max-w-5xl mx-auto text-center text-cheese text-base font-medium">
              All three views persist simultaneously — your Classic filters, Binder progress, and Saved layouts are all maintained at once. Toggle between them instantly using a simple tab interface.
            </p>

            {/* Section B — Pack Openings */}
            <div className="max-w-5xl mx-auto">
              <div className="rounded-xl border border-cheese/20 bg-cheese/5 p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0 h-16 w-16 rounded-full bg-cheese/10 flex items-center justify-center">
                  <span className="text-3xl">📦</span>
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-bold text-cheese mb-2">Pack Openings</h3>
                  <ul className="list-disc pl-5 space-y-1 text-foreground text-sm">
                    <li><strong>Supported now:</strong> Series 1, Series 2, Tiger King (Exotic), all Food Fight packs and Crash Gordon</li>
                    <li>Both <strong>SimpleAssets</strong> and <strong>AtomicAssets</strong> packs open natively.</li>
                    <li>Card-by-card reveal animation.</li>
                    <li>Immersive sound design.</li>
                    <li>Demo openings available to preview the experience without spending any packs.</li>
                    <li>View your SimpleAssets packs using the original placeholder artwork.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section C — Puzzle Builder + Draw & Write */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Puzzle Builder */}
              <div className="rounded-xl border border-cheese/20 bg-cheese/5 p-6 flex flex-col items-center text-center gap-4">
                <div className="flex-shrink-0 h-16 w-16 rounded-full bg-cheese/10 flex items-center justify-center">
                  <span className="text-3xl">🧩</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-cheese mb-2">Series 2 Puzzle Builder</h3>
                   <p className="text-foreground text-sm">
                     Series 2 cards contain hidden puzzle pieces on their backs. The Puzzle Builder auto-populates your collected pieces onto a free-form canvas where you can drag, rotate, and arrange them. Scramble them, line them up, and save your progress as JSON.
                   </p>
                </div>
              </div>

              {/* Draw & Write */}
              <div className="rounded-xl border border-cheese/20 bg-cheese/5 p-6 flex flex-col items-center text-center gap-4">
                <div className="flex-shrink-0 h-16 w-16 rounded-full bg-cheese/10 flex items-center justify-center">
                  <span className="text-3xl">✏️</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-cheese mb-2">Draw & Write on Cards</h3>
                  <p className="text-foreground text-sm">
                     Switch to pen mode on any card to doodle, scribble or write. Reward your friends and family members with the <span className="text-cheese font-semibold">'Spaz Award'</span>, permit them the right to stay up late and watch the <span className="text-cheese font-semibold">Late Late Late Show</span>. Except now after taking a screenshot just press the erase button or close the modal and your cards are as good as new!
                   </p>
                </div>
              </div>
            </div>

            {/* Section D — More Features */}
            <div className="max-w-5xl mx-auto space-y-4">
              <h3 className="text-2xl font-bold text-cheese text-center">More Features</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FeatureCard
                  icon={<span className="text-2xl">📐</span>}
                  title="3D Card Tilt Effect"
                  description="Cards respond to your mouse with an interactive 3D tilt effect — realistic depth and perspective that brings your collection to life as you hover over each card."
                />
                <FeatureCard
                  icon={<span className="text-2xl">🔍</span>}
                  title="Inspect Every Detail"
                  description="Click any card to open a full-detail view with front/back both visible. A magnifying lens follows your cursor on hover, zooming in so you can see every line, every detail, every variant difference up close."
                />
                <FeatureCard
                  icon={<span className="text-2xl">🎛️</span>}
                  title="Filter by Series & Variant"
                  description="Filter by Series 1, Series 2, and all other collections. Drill down by variant — Base, Prism, Sketch, VHS, Slime, Tiger Stripe, Gold and more. Available in all 3 view options."
                />
                <FeatureCard
                  icon={<span className="text-2xl">🔗</span>}
                  title="SimpleAssets & AtomicAssets"
                  description="Full support for both NFT standards on WAX. Your entire GPK collection in one unified view regardless of which contract holds them."
                />
                <FeatureCard
                  icon={<span className="text-2xl">🔔</span>}
                  title="Price Alerts"
                  description="Set up to 5 price alerts across your entire collection on any missing card. Get pinged the moment a listing drops below your target — never miss a deal on that one card you've been hunting."
                />
                <FeatureCard
                  icon={<span className="text-2xl">📂</span>}
                  title="Multi-File JSON Import"
                  description="Load all your saved collection layouts, price alerts, and puzzle formation in one easy step. Drop multiple JSON files at once — each lands in the right category automatically, with recent imports cached for instant re-apply."
                />
                <FeatureCard
                  icon={<span className="text-2xl">🔥</span>}
                  title="Transfer & Burn"
                  description="Select multiple NFTs and transfer them to any WAX account or burn them permanently — all in a single transaction. Supports both SimpleAssets and AtomicAssets contracts simultaneously."
                />
                <FeatureCard
                  icon={<span className="text-2xl">👁️</span>}
                  title="View Any Wallet"
                  description="Enter any valid WAX account name to browse that wallet's collection without logging in. See their Classic grid, Collector Binder, card details, and packs — then return to your own collection in one click."
                />
                <div className="sm:col-span-2 flex justify-center">
                  <div className="w-full max-w-lg">
                    <FeatureCard
                      icon={<span className="text-2xl">🤝</span>}
                      title="Free Community Tool"
                      description="No fees, no sign-ups. A WAX community asset."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center space-y-4">
              <p className="text-foreground">Connect your WAX wallet to get started — it only takes a few seconds.</p>
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

            {/* Completion bar removed - now shown in view rows */}

            {(() => {
              const TOKEN_PACK_ORDER: Record<string, number> = {
                GPKFIVE: 1, GPKMEGA: 2, GPKTWOA: 3, GPKTWOB: 4, GPKTWOC: 5,
                EXOFIVE: 6, EXOMEGA: 7,
              };
              const ATOMIC_PACK_ORDER: Record<string, number> = {
                '48479': 8,   // Bernventures
                '53187': 9,   // GameStonk
                '13778': 10,  // Crash Gordon
                '51437': 11,  // Mittens
                '59072': 12,  // Food Fight! Pack
                '59489': 13,  // Food Fight! WinterCon Day 1
                '59490': 14,  // Food Fight! WinterCon Day 2
                '59491': 15,  // Food Fight! WinterCon Day 3
                '59492': 16,  // Food Fight! WinterCon Day 4
              };
              const ROW_BREAKS = [5, 11]; // break after order 5 (row1) and 11 (row2)
              const filteredTokenPacks = packs.filter((p) => categoryFilter === 'all' || PACK_CATEGORY_MAP[p.symbol] === categoryFilter);
              const filteredAtomicPacks = atomicPacks.filter((p) => categoryFilter === 'all' || ATOMIC_PACK_CATEGORY_MAP[p.templateId] === categoryFilter);
              type PackItem = { type: 'token'; pack: typeof packs[0]; order: number } | { type: 'atomic'; pack: typeof atomicPacks[0]; order: number };
              const allPacks: PackItem[] = [
                ...filteredTokenPacks.map(p => ({ type: 'token' as const, pack: p, order: TOKEN_PACK_ORDER[p.symbol] ?? 99 })),
                ...filteredAtomicPacks.map(p => ({ type: 'atomic' as const, pack: p, order: ATOMIC_PACK_ORDER[p.templateId] ?? 99 })),
              ].sort((a, b) => a.order - b.order);
              if (packsLoading || atomicPacksLoading || allPacks.length === 0) return null;
              // Split into rows
              const rows: PackItem[][] = [[], [], []];
              for (const item of allPacks) {
                if (item.order <= ROW_BREAKS[0]) rows[0].push(item);
                else if (item.order <= ROW_BREAKS[1]) rows[1].push(item);
                else rows[2].push(item);
              }
              const renderPackItem = (item: PackItem) => item.type === 'token' ? (
                <div key={item.pack.symbol} className="w-[calc(50%-0.5rem)] sm:w-48">
                  <GpkPackCard pack={item.pack} session={session} accountName={effectiveAccount || ''} onSuccess={handlePackOpened} onDemoCollect={handleDemoCollect} collectionAssets={assets.filter(a => { const assetCat = SCHEMA_TO_CATEGORY[a.category] || a.category; return assetCat === PACK_CATEGORY_MAP[item.pack.symbol]; })} isReadOnly={isViewing} />
                </div>
              ) : (
                <div key={item.pack.templateId} className="w-[calc(50%-0.5rem)] sm:w-48">
                  <AtomicPackCard pack={item.pack} session={session} accountName={effectiveAccount || ''} onSuccess={handlePackOpened} onDemoCollect={handleDemoCollect} collectionAssets={assets.filter(a => { const cat = ATOMIC_PACK_CATEGORY_MAP[item.pack.templateId]; return cat && a.category === cat; })} isReadOnly={isViewing} />
                </div>
              );
              return (
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-foreground text-center">Packs</h2>
                  {rows.filter(r => r.length > 0).map((row, ri) => (
                    <div key={ri} className="flex flex-wrap justify-center gap-4">
                      {row.map(renderPackItem)}
                    </div>
                  ))}
                </div>
              );
            })()}

            {(categoryFilter === 'series1' || categoryFilter === 'series2' || categoryFilter === 'exotic' || categoryFilter === 'crashgordon' || categoryFilter === 'bernventures' || categoryFilter === 'mittens' || categoryFilter === 'gamestonk' || categoryFilter === 'foodfightb') && (
              <div className="text-center">
                <button
                  onClick={() => {
                    if (categoryFilter === 'exotic') {
                      footerRequestNav('https://wax.alcor.exchange/markets?search=exo');
                    } else if (categoryFilter === 'series1' || categoryFilter === 'series2') {
                      footerRequestNav('https://wax.alcor.exchange/markets?search=gpk');
                    } else {
                      footerRequestNav('https://atomichub.io/market?blockchain=wax-mainnet&collection_name=gpk.topps&order=asc&primary_chain=wax-mainnet&schema_name=packs&sort=price&symbol=WAX');
                    }
                  }}
                  className="text-sm text-cheese hover:text-cheese/80 underline underline-offset-2"
                >
                  {categoryFilter === 'exotic' || categoryFilter === 'series1' || categoryFilter === 'series2' ? 'Buy Packs on Alcor' : 'Buy Packs on AtomicHub'}
                </button>
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
              {viewMode === 'classic' && (
                <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                  <SelectTrigger className="w-full sm:w-[150px] border-cheese/50 text-cheese"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural">Natural (Card ID)</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="name">Name (A–Z)</SelectItem>
                    <SelectItem value="variant">Variant Rarity</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); if (v !== 'series1' && v !== 'series2' && v !== 'exotic' && v !== 'foodfightb') setVariantFilter(['all']); }}>
                <SelectTrigger className="w-full sm:w-[180px] border-cheese/50 text-cheese"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent className="max-h-none overflow-visible">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const needsBoth = ['all', 'series1', 'series2', 'exotic'];
                  if (needsBoth.includes(categoryFilter)) { refetchSa(); refetchAa(); }
                  else { refetchAa(); }
                  refetchPacks();
                  refetchAtomicPacks();
                }}
                className="text-cheese hover:text-cheese/80"
                title="Refresh category"
              >
                <RefreshCw className={`h-4 w-4 ${(saLoading || aaLoading || packsLoading || atomicPacksLoading) ? 'animate-spin' : ''}`} />
              </Button>
              {(categoryFilter === 'series1' || categoryFilter === 'series2' || categoryFilter === 'exotic' || categoryFilter === 'foodfightb' || categoryFilter === 'crashgordon') && (() => {
                const variants = categoryFilter === 'series1' ? SERIES1_VARIANTS : categoryFilter === 'exotic' ? EXOTIC_VARIANTS : categoryFilter === 'foodfightb' ? FOODFIGHT_VARIANTS : categoryFilter === 'crashgordon' ? CRASHGORDON_VARIANTS : SERIES2_VARIANTS;
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
                  {!isViewing && (
                    <TabsTrigger value="saved" className="text-xs px-3 py-1 data-[state=active]:bg-cheese/20 data-[state=active]:text-cheese">
                      <Save className="h-3 w-3 mr-1" />
                      Saved Collection
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            </div>

            {!isLoading && !error && (
              categoryFilter === 'series2' && viewMode !== 'saved' ? (
                <Tabs value={series2SubTab} onValueChange={setSeries2SubTab} className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="collection">Collection</TabsTrigger>
                    {!isViewing && <TabsTrigger value="puzzle">Puzzle Builder</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="collection">
                    {viewMode === 'binder' && binderGrid ? (
                      <>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                          <div className="flex items-center gap-3 flex-1">
                            <p className="text-sm text-muted-foreground">
                              {filtered.length} NFT{filtered.length !== 1 ? 's' : ''} found · {binderGrid.filter(s => s.owned).length} / {binderGrid.length} unique collected
                              {binderLoading && ' (loading templates...)'}
                            </p>
                            {renderSelectButton()}
                            {renderSelectAllCheckbox(binderGrid.flatMap(s => s.owned ? s.owned.map(a => a.id) : []))}
                          </div>
                          <div className="flex-shrink-0">
                            {renderCompletionBar()}
                          </div>
                          {!isViewing && (
                          <div className="flex items-center justify-end gap-2 flex-1 min-w-[200px]">
                            <span className="text-xs text-muted-foreground" title={`${priceAlerts.length} of ${maxAlerts} alerts used`}>
                              {priceAlerts.filter(a => a.triggered).length > 0 ? (
                                <span className="text-destructive font-medium inline-flex items-center gap-1">
                                  <BellRing className="h-3 w-3" />{priceAlerts.filter(a => a.triggered).length} triggered
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Bell className="h-3 w-3" />{priceAlerts.length}/{maxAlerts}
                                </span>
                              )}
                            </span>
                            <JsonMenu
                              refreshKey={recentRefreshKey}
                              alertsCount={priceAlerts.length}
                              alertsMax={maxAlerts}
                              triggeredCount={priceAlerts.filter(a => a.triggered).length}
                              alertsCheckingNow={alertsCheckingNow}
                              alertsCooldownMs={alertsCooldownRemaining}
                              onImportFiles={handleImportFiles}
                              onApplyRecent={handleApplyRecent}
                              onCheckAlertsNow={handleCheckAlertsNow}
                              onExportAlerts={handleExportAlerts}
                              onExportLayout={handleExportLayout}
                              onExportPuzzle={handleExportPuzzle}
                              layoutHasData={savedOrder !== null}
                              puzzleHasData={Object.keys(puzzleStateRef.current).length > 0}
                            />
                            <Button
                              onClick={() => {
                                const count = priceAlerts.length;
                                clearAllAlerts();
                                toast.success(count > 0 ? `Cleared ${count} alert${count !== 1 ? 's' : ''}` : 'No alerts to clear');
                              }}
                              disabled={priceAlerts.length === 0}
                              variant="outline"
                              size="sm"
                              className="whitespace-nowrap border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive/10 h-8"
                              title="Remove all price alerts"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />Clear Alerts
                            </Button>
                          </div>
                          )}
                        </div>
                        {renderBinderSections(binderGrid, true)}

                        {/* Missing Puzzle Pieces section */}
                        {(() => {
                          const ownedCardIds = new Set(
                            filtered
                              .map(a => typeof a.cardid === 'string' ? parseInt(a.cardid, 10) : a.cardid)
                              .filter((id): id is number => id != null)
                          );
                          const missingIds = PUZZLE_CARD_IDS.filter(id => !ownedCardIds.has(id));
                          if (missingIds.length === 0) return null;
                          return (
                            <div className="mt-8">
                              <h3 className="text-sm font-semibold text-cheese mb-3 flex items-center gap-2">
                                <Puzzle className="h-4 w-4" />
                                Missing Puzzle Pieces ({missingIds.length} of {PUZZLE_CARD_IDS.length})
                              </h3>
                              <p className="text-xs text-muted-foreground mb-3">The a, b, and prism versions of these cards all contain the puzzle piece on the back.</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {missingIds.map(id => {
                                  const tpl = binderTemplates.find(t => t.cardid === String(id) && t.variant === 'base' && t.quality === 'a');
                                  return <MissingPuzzlePiecePlaceholder key={id} cardId={id} templateId={tpl?.templateId} />;
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      renderClassicView()
                    )}
                  </TabsContent>
                  <TabsContent value="puzzle">
                    <PuzzleBuilder
                      assets={filtered}
                      initialPieceState={importedPuzzle}
                      onPiecesChange={handlePuzzlePiecesChange}
                      onSwitchToBinder={handleSwitchToBinder}
                      jsonMenuSlot={
                        <JsonMenu
                          refreshKey={recentRefreshKey}
                          alertsCount={priceAlerts.length}
                          alertsMax={maxAlerts}
                          triggeredCount={priceAlerts.filter(a => a.triggered).length}
                          alertsCheckingNow={alertsCheckingNow}
                          alertsCooldownMs={alertsCooldownRemaining}
                          onImportFiles={handleImportFiles}
                          onApplyRecent={handleApplyRecent}
                          onCheckAlertsNow={handleCheckAlertsNow}
                          onExportAlerts={handleExportAlerts}
                          onExportLayout={handleExportLayout}
                          onExportPuzzle={handleExportPuzzle}
                          layoutHasData={savedOrder !== null}
                          puzzleHasData={Object.keys(puzzleStateRef.current).length > 0}
                        />
                      }
                    />
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
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4">
            <div className="text-xs text-cheese space-y-0.5 text-center sm:text-left">
              <p>• Developed by $CHEESE</p>
              <p>• Free to Use</p>
              <p>• Open Source</p>
            </div>
            <div className="flex items-center justify-center gap-6">
              <button onClick={() => footerRequestNav('https://cheeseonwax.github.io/')} className="flex flex-col items-center gap-1 text-cheese hover:text-cheese/70 transition-colors" title="Website">
                <Globe className="h-5 w-5" />
                <span className="text-[10px]">Web</span>
              </button>
              <button onClick={() => footerRequestNav('https://t.me/cheeseonwaxofficial')} className="flex flex-col items-center gap-1 text-cheese hover:text-cheese/70 transition-colors" title="Telegram">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                <span className="text-[10px]">TG</span>
              </button>
              <button onClick={() => footerRequestNav('https://cheesehubwax.github.io/cheesehub')} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-cheese transition-colors" title="CHEESEHub">
                <img src={cheesehubLogo} alt="CHEESEHub" className="h-5 w-5 rounded" />
                <span className="text-[10px] text-cheese">Hub</span>
              </button>
              <button onClick={() => footerRequestNav('https://x.com/cheesetoken')} className="flex flex-col items-center gap-1 text-cheese hover:text-cheese/70 transition-colors" title="X / Twitter">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                <span className="text-[10px]">X</span>
              </button>
              <button onClick={() => footerRequestNav('https://github.com/gpkonwax/collection-manager')} className="flex flex-col items-center gap-1 text-cheese hover:text-cheese/70 transition-colors" title="GitHub">
                <Github className="h-5 w-5" />
                <span className="text-[10px]">GitHub</span>
              </button>
            </div>
            <div className="text-xs text-cheese space-y-0.5 text-center sm:text-right">
              <p className="font-semibold">Important Links</p>
              <p>• <button type="button" onClick={() => footerRequestNav('https://www.wax.io/')} className="hover:underline">WAX</button></p>
              <p>• <button type="button" onClick={() => footerRequestNav('https://www.greymass.com/anchor#download')} className="hover:underline">Anchor Wallet</button></p>
              <p>• <button type="button" onClick={() => footerRequestNav('https://www.mycloudwallet.com/')} className="hover:underline">Cloud Wallet</button></p>
              <p>• <button type="button" onClick={() => footerRequestNav('https://atomichub.io/')} className="hover:underline">AtomicHub</button></p>
              <p>• <button type="button" onClick={() => footerRequestNav('https://geepeekay.com/')} className="hover:underline">GeePeekay</button></p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-cheese/10 text-[10px] leading-relaxed text-muted-foreground max-w-4xl mx-auto space-y-2">

            <p>
              <strong className="text-cheese/80">Disclaimer.</strong> The GPK Collection Manager is a free, open-source community tool built by the $CHEESE community on the WAX blockchain. It is hosted on GitHub and incurs no hosting costs, making it durable and independent. It is <strong className="text-cheese/80">not affiliated with, endorsed by, sponsored by, or associated with The Topps Company, Inc., Garbage Pail Kids, WWE, Netflix, Tiger King, GameStop / GameStonk, or any other rights holder</strong>. All trademarks, character names, artwork, and brand assets shown are the property of their respective owners and are displayed solely as on-chain metadata of NFTs that users already own on WAX. No Topps, WWE, Netflix, Tiger King, or GameStop branding, logos, or imagery are used to promote, market, or advertise this tool.
            </p>
            <p>
              This manager does <strong className="text-cheese/80">not mint, sell, or distribute any NFTs or packs</strong>. It deploys <strong className="text-cheese/80">no new smart contracts</strong> — all on-chain actions (pack opening, transfers, burns, claims) are executed against pre-existing public WAX contracts (<code className="text-cheese/80">gpk.topps</code>, AtomicAssets, etc.) using the user's own wallet and signatures. It was built to preserve community access to SimpleAssets pack opening and contract actions after the original front-end infrastructure serving these actions was deprecated, and to showcase and preserve these important assets for the Topps GPK, WAX, and broader digital collectibles communities.
            </p>
            <p className="text-cheese/80">This was peak WAX.</p>
            <p>
              Original pack artwork for <strong className="text-cheese/80">Series 1, Series 2, and Tiger King</strong> packs is displayed courtesy of <a href="https://geepeekay.com" target="_blank" rel="noopener noreferrer" className="text-cheese hover:underline">geepeekay.com</a>.
            </p>
            <p>
              No fees are charged by this tool. Use at your own risk — blockchain transactions are irreversible. Nothing here constitutes financial, legal, or investment advice. Rights holders with concerns or takedown requests may contact us at{' '}
              <a href="mailto:gpkonwax@protonmail.com" className="text-cheese hover:underline">gpkonwax@protonmail.com</a>
              {' '}or via Telegram:{' '}
              <button type="button" onClick={() => footerRequestNav('https://t.me/cheeseonwaxofficial')} className="text-cheese hover:underline">@cheeseonwaxofficial</button>.
            </p>
          </div>
          <ExternalLinkWarningDialog url={footerPendingUrl} onConfirm={footerConfirm} onCancel={footerCancel} />

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
      <BurnDialog
        open={burnDialogOpen}
        onOpenChange={setBurnDialogOpen}
        selectedAssets={selectedAssets}
        onSuccess={(txId) => {
          clearSelection();
          refetchSa();
          refetchAa();
          setSuccessDialog({ open: true, title: 'NFTs Burned!', description: `Successfully burned ${selectedAssets.length} NFT(s).`, txId });
        }}
      />

      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-cheese/50 rounded-lg shadow-2xl px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <Button size="sm" className="bg-cheese hover:bg-cheese/90 text-primary-foreground" onClick={() => setTransferDialogOpen(true)}>
            <Send className="h-4 w-4 mr-1" />Transfer
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setBurnDialogOpen(true)}>
            <Flame className="h-4 w-4 mr-1" />Burn
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            <X className="h-4 w-4 mr-1" />Cancel
          </Button>
        </div>
      )}

    </div>
  );
}
