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
import { ExternalLinkWarningDialog, useExternalLinkWarning } from '@/components/ExternalLinkWarningDialog';
import {
  getPackHistory,
  mergePackHistory,
  downloadPackHistory,
  markPackHistoryDownloaded,
  countUnsavedOpenings,
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [chainProgress, setChainProgress] = useState<ChainExportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pendingUrl, requestNavigation, confirm, cancel } = useExternalLinkWarning();

  const reload = useCallback(() => {
    setActiveGroup(null);
    if (!account) { setEntries([]); setUnsaved(0); return; }
    setEntries(getPackHistory(account));
    setUnsaved(countUnsavedOpenings(account));
  }, [account]);

  useEffect(() => {
    if (open) reload();
  }, [open, refreshKey, reload]);

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

  const groups = useMemo(() => {
    const map = new Map<string, PackGroup>();
    for (const e of filtered) {
      const key = `${e.source}::${e.packName}`;
      const g = map.get(key);
      if (!g) {
        map.set(key, {
          key,
          packName: e.packName,
          source: e.source,
          packImage: e.packImage,
          count: 1,
          latestAt: e.openedAt,
          entries: [e],
        });
      } else {
        g.count += 1;
        g.entries.push(e);
        if (e.openedAt > g.latestAt) {
          g.latestAt = e.openedAt;
          if (e.packImage) g.packImage = e.packImage;
        }
        if (!g.packImage && e.packImage) g.packImage = e.packImage;
      }
    }
    for (const g of map.values()) g.entries.sort((a, b) => b.openedAt - a.openedAt);
    return map;
  }, [filtered]);

  const groupList = useMemo(
    () =>
      Array.from(groups.values()).sort(
        (a, b) => b.count - a.count || a.packName.localeCompare(b.packName),
      ),
    [groups],
  );

  const active = activeGroup ? groups.get(activeGroup) ?? null : null;

  useEffect(() => {
    if (activeGroup && !groups.has(activeGroup)) setActiveGroup(null);
  }, [activeGroup, groups]);


  const handleDownload = useCallback(async () => {
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
    markPackHistoryDownloaded(account);
    setUnsaved(0);
    const chainOnly = all.length - local.length;
    toast.success(
      `Downloaded ${all.length} opening${all.length === 1 ? '' : 's'}${chainOnly > 0 ? ` (${chainOnly} rebuilt from chain)` : ''}`,
    );
  }, [account, chainBusy]);



  const handleLoadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    let added = 0;
    let updated = 0;
    let bad = 0;
    for (const file of files) {
      try {
        const parsedEntries = parsePackHistoryEnvelope(JSON.parse(await file.text()));
        if (!parsedEntries) { bad++; continue; }
        const r = mergePackHistory(parsedEntries);
        added += r.added;
        updated += r.updated;
      } catch {
        bad++;
      }
    }
    reload();
    onHistoryChanged?.();
    if (added || updated) {
      toast.success(`Loaded pack history — ${added} new, ${updated} updated`);
    } else if (!bad) {
      toast.info('Pack history already up to date — nothing new in that file.');
    }
    if (bad) toast.error(`${bad} file${bad === 1 ? '' : 's'} were not a pack history JSON`);
  }, [reload, onHistoryChanged]);


  const handleClear = useCallback(() => {
    if (entries.length === 0) return;
    if (!window.confirm('Clear the pack history stored on this device? Download the JSON first if you want to keep it.')) return;
    clearPackHistory(account);
    reload();
    onHistoryChanged?.();
    toast.success('Pack history cleared on this device');
  }, [account, entries.length, reload, onHistoryChanged]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 theme-bright-text">
            <History className="h-5 w-5 text-cheese" />
            Pack History
          </DialogTitle>
          <DialogDescription className="theme-bright-text-muted">
            Every pack <span className="text-cheese theme-bright-text font-medium">{account || '—'}</span> has opened on this
            device, plus anything you load from a pack history JSON. Replay any opening to see the reveal and deal again —
            no wallet signing, nothing is sent on-chain.
          </DialogDescription>
        </DialogHeader>

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

        {chainProgress && (
          <p className="text-[11px] text-cheese">{chainProgress.message}</p>
        )}


        {unsaved > 0 && (
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
                  {entry.packImage ? (
                    <img src={entry.packImage} alt={entry.packName} className="w-16 h-auto rounded" />
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
            <span className="text-[11px] text-muted-foreground ml-auto">
              {entries.length}/{PACK_HISTORY_CAP} stored
            </span>
          </div>
        </div>

      </DialogContent>
      <ExternalLinkWarningDialog url={pendingUrl} onConfirm={confirm} onCancel={cancel} />
    </Dialog>
  );
}
