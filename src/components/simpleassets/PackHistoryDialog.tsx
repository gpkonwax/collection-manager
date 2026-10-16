import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Upload, History, Play, ExternalLink, Loader2, AlertTriangle, Trash2, ChevronUp, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { PRIMARY_MIRROR, extractIpfsHash } from '@/lib/ipfsGateways';
import { warmThumbs, clearThumbs } from '@/lib/thumbCache';
import { clearIpfsUrlCache } from '@/hooks/useIpfsMedia';
import { ExternalLinkWarningDialog, useExternalLinkWarning } from '@/components/ExternalLinkWarningDialog';
import {
  getPackHistory,
  mergePackHistory,
  downloadPackHistory,
  markPackHistoryDownloaded,
  countUnsavedOpenings,
  ensurePackHistoryLoaded,
  subscribePackHistory,
  getPackHistorySaveFailed,
  parsePackHistoryEnvelope,
  clearPackHistory,
  PACK_HISTORY_CAP,
  type PackHistoryEntry,
} from '@/lib/packOpenHistory';
import {
  exportPackHistoryFromChain,
  HistoryUnavailableError,
  type ChainExportProgress,
} from '@/lib/packOpenHistoryChain';

import { resolvePackArt } from '@/lib/gpkPackMeta';
import simpleAssetsLogo from '@/assets/simpleassets-logo.png';
import atomicAssetsLogo from '@/assets/atomicassets-logo.png';

interface PackHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: string;
  /** Bumped by the parent whenever a new opening is recorded. */
  refreshKey?: number;
  onReplay: (entry: PackHistoryEntry) => void;
  /** Replay is blocked while a live open or deal animation is running. */
  replayDisabled?: boolean;
  replayDisabledReason?: string;
  /** Called after an import so the parent can refresh anything derived from history. */
  onHistoryChanged?: () => void;
}

function ProtocolLogo({ source, className }: { source: PackHistoryEntry['source']; className?: string }) {
  const isAtomic = source === 'atomicassets';
  return (
    <img
      src={isAtomic ? atomicAssetsLogo : simpleAssetsLogo}
      alt={isAtomic ? 'AtomicAssets' : 'SimpleAssets'}
      title={isAtomic ? 'AtomicAssets' : 'SimpleAssets'}
      className={cn('inline-block rounded-full object-contain shrink-0', !isAtomic && 'bg-white p-[1px]', className)}
    />
  );
}

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString([], {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

function explorerUrl(txId: string): string {
  return `https://waxblock.io/transaction/${txId}`;
}

export function PackHistoryDialog({
  open,
  onOpenChange,
  account,
  refreshKey,
  onReplay,
  replayDisabled,
  replayDisabledReason,
  onHistoryChanged,
}: PackHistoryDialogProps) {
  const [entries, setEntries] = useState<PackHistoryEntry[]>([]);
  const [unsaved, setUnsaved] = useState(0);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'simpleassets' | 'atomicassets'>('all');
  const [chainBusy, setChainBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [chainProgress, setChainProgress] = useState<ChainExportProgress | null>(null);
  /** A pack history loaded from someone else's JSON — session-only, never saved. */
  const [sharedView, setSharedView] = useState<{ account: string; entries: PackHistoryEntry[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pendingUrl, requestNavigation, confirm, cancel } = useExternalLinkWarning();

  const refresh = useCallback(() => {
    if (sharedView) {
      setEntries(sharedView.entries);
      setUnsaved(0);
      setSaveFailed(false);
      return;
    }
    if (!account) { setEntries([]); setUnsaved(0); return; }
    setEntries(getPackHistory(account));
    setUnsaved(countUnsavedOpenings(account));
    setSaveFailed(getPackHistorySaveFailed());
  }, [account, sharedView]);

  const closeSharedView = useCallback(() => setSharedView(null), []);

  const handleOpenChange = useCallback((o: boolean) => {
    if (!o) setSharedView(null);
    onOpenChange(o);
  }, [onOpenChange]);

  const reload = useCallback(() => {
    setActiveGroup(null);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    reload();
    // The store hydrates from IndexedDB asynchronously — refresh once it lands,
    // and again whenever anything writes to it.
    void ensurePackHistoryLoaded().then(refresh);
    return subscribePackHistory(refresh);
  }, [open, refreshKey, reload, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
      if (!q) return true;
      if (e.packName.toLowerCase().includes(q)) return true;
      return e.cards.some((c) => (c.name || '').toLowerCase().includes(q));
    });
  }, [entries, search, sourceFilter]);

  type PackGroup = {
    key: string;
    packName: string;
    source: PackHistoryEntry['source'];
    packImage?: string;
    count: number;
    latestAt: number;
    entries: PackHistoryEntry[];
  };

  const normalizePackName = (name: string) => {
    const cleaned = (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(gpk|pack|packs|the|a|nft|garbage|pail|kids)\b/g, ' ')
      .replace(/\s+/g, '')
      .trim();
    return cleaned || (name || '').toLowerCase().trim();
  };

  const groups = useMemo(() => {
    const map = new Map<string, PackGroup>();
    for (const e of filtered) {
      const key = `${e.source}::${normalizePackName(e.packName)}`;
      const g = map.get(key);
      if (!g) {
        map.set(key, {
          key,
          packName: e.packName,
          source: e.source,
          packImage: resolvePackArt(e.source, e.packId, e.packName, e.packImage),
          count: 1,
          latestAt: e.openedAt,
          entries: [e],
        });
      } else {
        g.count += 1;
        g.entries.push(e);
        // Prefer the richer (longer) display name across variants of the same pack
        if ((e.packName || '').length > (g.packName || '').length) g.packName = e.packName;
        if (e.openedAt > g.latestAt) g.latestAt = e.openedAt;
        if (!g.packImage) g.packImage = resolvePackArt(e.source, e.packId, e.packName, e.packImage);
      }
    }
    for (const g of map.values()) g.entries.sort((a, b) => b.openedAt - a.openedAt);
    return map;
  }, [filtered]);

  // Natural pack order, matching the homepage pack grid ("All categories")
  const packSortOrder = (name: string) => {
    const n = (name || '').toLowerCase();
    if (/series\s*1\b|series1/.test(n) && !/exotic|tiger/.test(n)) return 1;
    if (/mega/.test(n) && !/exotic|tiger/.test(n)) return 2;
    if (/2a\b/.test(n)) return 3;
    if (/2b\b/.test(n)) return 4;
    if (/2c\b/.test(n)) return 5;
    if (/(exotic|tiger)/.test(n) && /mega/.test(n)) return 7;
    if (/(exotic|tiger)/.test(n)) return 6;
    if (/bernventure/.test(n)) return 8;
    if (/gamestonk|game\s*stonk/.test(n)) return 9;
    if (/crash\s*gordon|crashgordon/.test(n)) return 10;
    if (/mitten/.test(n)) return 11;
    if (/wintercon/.test(n)) {
      const day = n.match(/day\s*([1-4])/)?.[1];
      return day ? 12 + Number(day) : 13;
    }
    if (/food\s*fight/.test(n)) return 12;
    return 99;
  };

  const groupList = useMemo(
    () =>
      Array.from(groups.values()).sort(
        (a, b) =>
          packSortOrder(a.packName) - packSortOrder(b.packName) ||
          a.packName.localeCompare(b.packName),
      ),
    [groups],
  );


  const active = activeGroup ? groups.get(activeGroup) ?? null : null;

  useEffect(() => {
    if (activeGroup && !groups.has(activeGroup)) setActiveGroup(null);
  }, [activeGroup, groups]);

  // Warm the byte cache for the thumbnails about to be shown so re-opening the
  // dialog (or drilling into a pack) paints instantly with no network work.
  useEffect(() => {
    if (!open || !PRIMARY_MIRROR) return;
    const urls: string[] = [];
    for (const g of groupList) if (g.packImage) urls.push(g.packImage);
    if (active) {
      for (const entry of active.entries) {
        if (entry.packImage) urls.push(entry.packImage);
        for (const card of entry.cards ?? []) if (card.image) urls.push(card.image);
      }
    }
    const hashes = Array.from(
      new Set(urls.map((u) => extractIpfsHash(u)).filter((h): h is string => !!h)),
    );
    if (hashes.length === 0) return;
    let cancelled = false;
    const id = setTimeout(() => {
      if (cancelled) return;
      void warmThumbs(hashes, (h) => `${PRIMARY_MIRROR}${h}`);
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [open, groupList, active]);



  const handleDownload = useCallback(async () => {
    if (sharedView) {
      // Re-share the loaded file exactly as viewed — no chain rebuild.
      downloadPackHistory(sharedView.account, sharedView.entries);
      toast.success(`Downloaded ${sharedView.entries.length} opening${sharedView.entries.length === 1 ? '' : 's'} from the loaded file.`);
      return;
    }
    if (!account) {
      toast.info('Connect a wallet first.');
      return;
    }
    if (chainBusy) return;
    setChainBusy(true);
    setChainProgress({ stage: 'scanning', message: 'Contacting WAX history nodes…', done: 0, total: 0 });
    let chainEntries: PackHistoryEntry[] = [];
    try {
      const result = await exportPackHistoryFromChain(account, (p) => setChainProgress(p));
      chainEntries = result.entries;
      for (const w of result.warnings) toast.warning(w);
    } catch (err) {
      const message =
        err instanceof HistoryUnavailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Chain rebuild failed';
      toast.warning(`${message} Downloading what's stored on this device instead.`);
    } finally {
      setChainBusy(false);
      setChainProgress(null);
    }

    const local = getPackHistory(account);
    const seen = new Set(local.map((e) => e.txId));
    const all = [...local];
    for (const e of chainEntries) {
      if (seen.has(e.txId)) continue;
      seen.add(e.txId);
      all.push(e);
    }
    all.sort((a, b) => b.openedAt - a.openedAt);
    if (all.length === 0) {
      toast.info('No pack openings found for this account — nothing to download.');
      return;
    }
    downloadPackHistory(account, all);
    markPackHistoryDownloaded(account, all);
    setUnsaved(0);
    const chainOnly = all.length - local.length;
    toast.success(
      `Downloaded ${all.length} opening${all.length === 1 ? '' : 's'}${chainOnly > 0 ? ` (${chainOnly} rebuilt from chain)` : ''}`,
    );
  }, [account, chainBusy, sharedView]);



  const handleLoadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    let added = 0;
    let updated = 0;
    let bad = 0;
    // Openings from other accounts are shown as a session-only "shared" view
    // instead of being merged into this device's store.
    const shared = new Map<string, PackHistoryEntry[]>();
    for (const file of files) {
      try {
        const parsedEntries = parsePackHistoryEnvelope(JSON.parse(await file.text()));
        if (!parsedEntries) { bad++; continue; }
        const own = parsedEntries.filter((e) => e.account === account);
        const others = parsedEntries.filter((e) => e.account !== account);
        if (own.length > 0) {
          const r = mergePackHistory(own);
          added += r.added;
          updated += r.updated;
        }
        for (const e of others) {
          const list = shared.get(e.account) ?? [];
          list.push(e);
          shared.set(e.account, list);
        }
      } catch {
        bad++;
      }
    }
    if (shared.size > 0) {
      const accounts = Array.from(shared.keys());
      const owner = accounts[0];
      // De-dupe by txId and show newest first.
      const seen = new Set<string>();
      const entries = accounts
        .flatMap((a) => shared.get(a) ?? [])
        .filter((e) => (seen.has(e.txId) ? false : (seen.add(e.txId), true)))
        .sort((a, b) => b.openedAt - a.openedAt);
      setSharedView({ account: owner, entries });
      toast.success(
        `Viewing ${owner}'s shared pack history — ${entries.length} opening${entries.length === 1 ? '' : 's'} loaded. Nothing was saved to this device.`,
      );
    } else {
      reload();
    }
    onHistoryChanged?.();
    if (shared.size === 0) {
      if (added || updated) {
        toast.success(`Loaded pack history — ${added} new, ${updated} updated`);
      } else if (!bad) {
        toast.info('Pack history already up to date — nothing new in that file.');
      }
    }
    if (bad) toast.error(`${bad} file${bad === 1 ? '' : 's'} were not a pack history JSON`);
  }, [account, reload, onHistoryChanged]);


  const handleClear = useCallback(() => {
    if (entries.length === 0) return;
    if (!window.confirm('Clear the pack history stored on this device? Download the JSON first if you want to keep it.')) return;
    clearPackHistory(account);
    // Also flush cached thumbnail bytes and remembered image URLs.
    void clearThumbs();
    clearIpfsUrlCache();
    reload();
    onHistoryChanged?.();
    toast.success('Pack history and cached thumbnails cleared on this device');
  }, [account, entries.length, reload, onHistoryChanged]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 theme-bright-text">
            <History className="h-5 w-5 text-cheese" />
            Pack History
          </DialogTitle>
          <DialogDescription className="theme-bright-text-muted">
            {sharedView ? (
              <>
                Viewing <span className="text-cheese theme-bright-text font-medium">{sharedView.account}</span>'s shared pack
                history, loaded from a JSON file. Replay any opening to see the reveal and deal again — no wallet signing,
                nothing is sent on-chain.
              </>
            ) : (
              <>
                Every pack <span className="text-cheese theme-bright-text font-medium">{account || '—'}</span> has opened on this
                device, plus anything you load from a pack history JSON. Replay any opening to see the reveal and deal again —
                no wallet signing, nothing is sent on-chain.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {sharedView && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-cheese/40 bg-cheese/10 px-3 py-2 text-xs text-foreground">
            <span className="min-w-0 truncate">
              Shared file from <span className="text-cheese font-medium">{sharedView.account}</span> — session-only, nothing
              was saved to this device.
            </span>
            <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={closeSharedView}>
              Back to my history
            </Button>
          </div>
        )}


        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            onClick={handleDownload}
            disabled={chainBusy || !account}
            title="Rebuilds your past openings from WAX history, adds them to the list, and downloads one combined file"
          >
            {chainBusy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            {chainBusy ? 'Building…' : 'Download pack history JSON'}
          </Button>
          <Button size="sm" variant="outline" onClick={handleLoadClick}>
            <Upload className="h-4 w-4 mr-1.5" />
            Load pack history JSON
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={handleFile}
          />
          <div className="ml-auto flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search packs or cards…"
              className="h-8 w-44"
            />
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contracts</SelectItem>
                <SelectItem value="simpleassets">SimpleAssets</SelectItem>
                <SelectItem value="atomicassets">AtomicAssets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!sharedView && chainProgress && (
          <p className="text-[11px] text-cheese">{chainProgress.message}</p>
        )}


        {!sharedView && saveFailed && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <span>
              This browser refused to save your pack history to its local storage. Download the JSON now — new openings
              may not survive a reload.
            </span>
          </div>
        )}

        {!sharedView && unsaved > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-cheese/40 bg-cheese/10 px-3 py-2 text-xs text-foreground">
            <AlertTriangle className="h-4 w-4 text-cheese shrink-0 mt-0.5" />
            <span>
              {unsaved} opening{unsaved === 1 ? '' : 's'} recorded since your last download. Your JSON file is out of date —
              download it again so nothing is lost if this browser clears its storage.
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                {entries.length === 0
                  ? 'No openings recorded yet on this device.'
                  : 'No openings match this filter.'}
              </p>
              {entries.length === 0 && (
                <p className="text-xs text-muted-foreground/70 max-w-md mx-auto">
                  New packs you open are recorded here automatically. To bring in packs you opened in the past, hit
                  "Download pack history JSON" — it rebuilds them from WAX history and adds them to this list.
                </p>

              )}
            </div>
          ) : !active ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {groupList.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setActiveGroup(g.key)}
                  className="group rounded-lg border border-border bg-background/40 p-3 text-left hover:border-cheese/60 hover:bg-background/70 transition-colors"
                >
                  <div className="w-full flex items-center justify-center">
                    {g.packImage ? (
                      <IpfsMedia
                        url={g.packImage}
                        alt={g.packName}
                        context="detail"
                        loading="eager"
                        className="w-full h-44 [&_img]:object-contain [&_video]:object-contain rounded"
                        mirrorFirst
                      />
                    ) : (
                      <div className="w-full h-44 rounded bg-muted flex items-center justify-center text-4xl">📦</div>
                    )}
                  </div>

                  <div className="mt-2 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <ProtocolLogo source={g.source} className="h-3.5 w-3.5" />
                      <span className="font-semibold text-sm text-foreground theme-bright-text truncate">
                        {g.packName}
                      </span>
                    </div>
                    <p className="text-xs text-cheese font-medium">
                      {g.count} pack{g.count === 1 ? '' : 's'} opened
                    </p>
                    <p className="text-[11px] text-muted-foreground">Last: {formatWhen(g.latestAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <>
            <div className="flex items-center gap-2 pb-1">
              <Button size="sm" variant="outline" onClick={() => setActiveGroup(null)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to all packs
              </Button>
              <span className="text-xs text-muted-foreground truncate">
                {active.packName} · {active.count} opening{active.count === 1 ? '' : 's'}
              </span>
            </div>
            {active.entries.map((entry) => (
              <div
                key={`${entry.account}:${entry.txId}`}
                className="rounded-lg border border-border bg-background/40 p-3 flex gap-3 items-start"
              >
                <div className="w-16 shrink-0">
                  {resolvePackArt(entry.source, entry.packId, entry.packName, entry.packImage) ? (
                    <IpfsMedia
                      url={resolvePackArt(entry.source, entry.packId, entry.packName, entry.packImage)}
                      alt={entry.packName}
                      context="detail"
                      loading="lazy"
                      className="w-16 h-20 [&_img]:object-contain [&_video]:object-contain rounded"
                      mirrorFirst
                    />
                  ) : (
                    <div className="w-16 h-20 rounded bg-muted flex items-center justify-center text-2xl">📦</div>
                  )}
                </div>


                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ProtocolLogo source={entry.source} className="h-4 w-4" />
                    <span className="font-semibold text-sm text-foreground theme-bright-text truncate">{entry.packName}</span>
                    {entry.fromChain && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                        from chain
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(entry.openedAt)} · {entry.cards.length} card{entry.cards.length === 1 ? '' : 's'}
                  </p>

                  {(() => {
                    const entryKey = `${entry.account}:${entry.txId}`;
                    const isExpanded = expanded.has(entryKey);
                    const hidden = entry.cards.length - 14;
                    const shown = isExpanded ? entry.cards : entry.cards.slice(0, 14);
                    const toggle = () =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(entryKey)) next.delete(entryKey);
                        else next.add(entryKey);
                        return next;
                      });
                    return (
                      <div className="flex gap-1 flex-wrap">
                        {shown.map((card, i) => (
                          <div key={`${entry.txId}-${i}`} className="w-9 h-9 rounded overflow-hidden bg-muted/40" title={card.name}>
                            <IpfsMedia url={card.image || ''} alt={card.name} className="w-full h-full" context="card" loading="lazy" mirrorFirst />
                          </div>
                        ))}
                        {hidden > 0 && (
                          <button
                            type="button"
                            onClick={toggle}
                            aria-expanded={isExpanded}
                            title={isExpanded ? 'Show fewer cards' : `Show all ${entry.cards.length} cards`}
                            className="w-9 h-9 rounded bg-muted/40 hover:bg-muted flex items-center justify-center text-[10px] text-muted-foreground hover:text-cheese transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : `+${hidden}`}
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
                    disabled={replayDisabled || entry.cards.length === 0}
                    title={replayDisabled ? (replayDisabledReason || 'Busy') : 'Replay this opening'}
                    onClick={() => onReplay(entry)}
                  >
                    <Play className="h-4 w-4 mr-1.5" />
                    Replay
                  </Button>
                  {!entry.txId.startsWith('local-') && (
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-cheese inline-flex items-center gap-1"
                      onClick={() => requestNavigation(explorerUrl(entry.txId))}
                    >
                      Transaction <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            </>
          )}
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {!sharedView && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleClear}
                disabled={entries.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Clear on this device
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">
              {sharedView
                ? `${sharedView.entries.length} opening${sharedView.entries.length === 1 ? '' : 's'} from the loaded file`
                : `${entries.length}/${PACK_HISTORY_CAP} stored`}
            </span>
          </div>
        </div>

      </DialogContent>
      <ExternalLinkWarningDialog url={pendingUrl} onConfirm={confirm} onCancel={cancel} />
    </Dialog>
  );
}
