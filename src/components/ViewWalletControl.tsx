import { useState, useCallback, KeyboardEvent, useEffect, useRef, useMemo } from 'react';
import { Eye, Loader2, X, ChevronDown, ChevronUp, RefreshCw, Star, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WAX_CHAIN } from '@/lib/waxConfig';
import { fetchTopGpkHolders, getCachedHolders, clearCachedHolders, type Holder } from '@/lib/gpkHolders';
import { fetchActiveWallets, getCachedActiveWallets, clearCachedActiveWallets, formatLastActive, type ActiveWallet } from '@/lib/activeWallets';
import { isOfflineBundle } from '@/lib/offlineBundle';
import {
  loadFavorites,
  toggleFavorite,
  isValidWaxName,
  exportFavoritesJson,
  importFavorites,
  parseFavoritesEnvelope,
  FAVORITES_CHANGED_EVENT,
  type FavoriteAccount,
} from '@/lib/favoriteAccounts';

interface ViewWalletControlProps {
  currentAccount: string | null;
  viewedAccount: string | null;
  onView: (account: string) => void;
  onClear: () => void;
  /** Increment this number to programmatically open the popover (e.g. from a link in another dialog). */
  openSignal?: number;
}

// WAX account naming rules: a-z, 1-5, and '.', length 1..12, no leading/trailing/double dots.
const WAX_NAME_RE = /^[a-z1-5]+(\.[a-z1-5]+)*$/;

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function validateWaxName(name: string): string | null {
  if (!name) return 'Enter a WAX account name';
  if (name.length > 12) return 'Max 12 characters';
  if (!WAX_NAME_RE.test(name)) return 'Only a–z, 1–5 and single dots';
  return null;
}

async function accountExists(name: string): Promise<boolean> {
  for (const url of WAX_CHAIN.rpcUrls.slice(0, 3)) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/v1/chain/get_account`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_name: name }),
        signal: controller.signal,
      });
      clearTimeout(t);
      if (res.status === 200) return true;
      if (res.status === 500) {
        try {
          const body = await res.json();
          const what = body?.error?.what || '';
          if (typeof what === 'string' && /unknown/i.test(what)) return false;
        } catch { /* ignore */ }
        return false;
      }
    } catch { /* try next */ }
  }
  return true;
}

function formatSnapshotDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function ViewWalletControl({ currentAccount, viewedAccount, onView, onClear, openSignal }: ViewWalletControlProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [showList, setShowList] = useState(false);
  const initialCache = getCachedHolders();
  const [holders, setHolders] = useState<Holder[] | null>(initialCache?.holders ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialCache?.generatedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notPublished, setNotPublished] = useState(false);
  const [filter, setFilter] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const attemptedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [showActive, setShowActive] = useState(false);
  const initialActiveCache = getCachedActiveWallets();
  const [activeWallets, setActiveWallets] = useState<ActiveWallet[] | null>(initialActiveCache?.wallets ?? null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('');
  const activeAbortRef = useRef<AbortController | null>(null);
  const activeAttemptedRef = useRef(false);

  const [showFavs, setShowFavs] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteAccount[]>(() => loadFavorites());
  const [favFilter, setFavFilter] = useState('');

  // Keep in sync when favourites change elsewhere (JSON import, other popover)
  useEffect(() => {
    const sync = () => setFavorites(loadFavorites());
    window.addEventListener(FAVORITES_CHANGED_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, sync);
  }, []);

  // Allow external components (e.g. a link in the Trades dialog) to open this popover.
  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setOpen(true);
      // Focus the input shortly after the popover opens.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [openSignal]);

  const favoriteSet = useMemo(() => new Set(favorites.map((f) => f.account)), [favorites]);

  const handleToggleFavorite = useCallback((account: string) => {
    toggleFavorite(account);
    setFavorites(loadFavorites());
  }, []);

  const filteredFavs = useMemo(() => {
    const f = favFilter.trim().toLowerCase();
    if (!f) return favorites;
    return favorites.filter((w) => w.account.includes(f));
  }, [favorites, favFilter]);

  const favInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportFavs = useCallback(() => {
    const count = loadFavorites().length;
    if (count === 0) {
      toast.error('No favourites to export');
      return;
    }
    const blob = new Blob([exportFavoritesJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `gpk-favorite-accounts-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${count} favourite${count !== 1 ? 's' : ''}`);
  }, []);

  const handleImportFavsFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const accounts = parseFavoritesEnvelope(parsed);
      if (!accounts || accounts.length === 0) {
        toast.error('That file is not a favourites export');
        return;
      }
      const res = importFavorites(accounts);
      setFavorites(loadFavorites());
      toast.success(
        `Imported favourites — ${res.added} added, ${res.updated} already saved${res.skipped ? `, ${res.skipped} skipped` : ''}`,
      );
    } catch {
      toast.error('Could not read that file as JSON');
    }
  }, []);

  const submit = useCallback(async () => {
    const name = normalize(value);
    const validation = validateWaxName(name);
    if (validation) { setError(validation); return; }
    if (currentAccount && name === currentAccount) {
      onClear();
      setOpen(false);
      setValue('');
      setError(null);
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const exists = await accountExists(name);
      if (!exists) { setError('Account not found on WAX'); return; }
      onView(name);
      setOpen(false);
      setValue('');
    } finally {
      setChecking(false);
    }
  }, [value, currentAccount, onView, onClear]);

  const onKey = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  }, [submit]);

  const loadHolders = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    attemptedRef.current = true;
    setLoading(true);
    setLoadError(null);
    setNotPublished(false);
    try {
      const { holders: h, generatedAt: g } = await fetchTopGpkHolders({ signal: ctrl.signal });
      setHolders(h);
      setGeneratedAt(g);
    } catch (e) {
      const err = e as Error & { reason?: 'not-published' | 'network' };
      if (err.name === 'AbortError') return;
      if (err.reason === 'not-published') {
        setNotPublished(true);
      } else {
        setLoadError(err.message || 'Failed to load holders');
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    clearCachedHolders();
    setHolders(null);
    setGeneratedAt(null);
    attemptedRef.current = false;
    loadHolders();
  }, [loadHolders]);

  // Auto-load on first expand if no cache — one attempt only, never a retry loop
  useEffect(() => {
    if (showList && !holders && !loading && !attemptedRef.current) loadHolders();
  }, [showList, holders, loading, loadHolders]);

  const loadActive = useCallback(async () => {
    activeAbortRef.current?.abort();
    const ctrl = new AbortController();
    activeAbortRef.current = ctrl;
    activeAttemptedRef.current = true;
    setActiveLoading(true);
    setActiveError(null);
    try {
      const { wallets } = await fetchActiveWallets({ signal: ctrl.signal });
      setActiveWallets(wallets);
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') return;
      setActiveError(err.message || 'Failed to load active traders');
    } finally {
      if (activeAbortRef.current === ctrl) activeAbortRef.current = null;
      setActiveLoading(false);
    }
  }, []);

  const refreshActive = useCallback(() => {
    clearCachedActiveWallets();
    setActiveWallets(null);
    activeAttemptedRef.current = false;
    loadActive();
  }, [loadActive]);

  useEffect(() => {
    if (showActive && !activeWallets && !activeLoading && !activeAttemptedRef.current && !isOfflineBundle()) loadActive();
  }, [showActive, activeWallets, activeLoading, loadActive]);

  // Abort in-flight on popover close
  useEffect(() => {
    if (!open) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
        setLoading(false);
      }
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
        setActiveLoading(false);
      }
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!holders) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return holders;
    return holders.filter((h) => h.account.includes(f));
  }, [holders, filter]);

  const filteredActive = useMemo(() => {
    if (!activeWallets) return [];
    const f = activeFilter.trim().toLowerCase();
    if (!f) return activeWallets;
    return activeWallets.filter((w) => w.account.includes(f));
  }, [activeWallets, activeFilter]);

  const snapshotLabel = formatSnapshotDate(generatedAt);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); setShowList(false); setShowActive(false); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-4 gap-1.5 whitespace-nowrap bg-cheese hover:bg-cheese/90 text-cheese-foreground font-semibold theme-bright-fill theme-bright-text"
          title={viewedAccount ? `Viewing ${viewedAccount}` : 'View another wallet (read-only)'}
        >
          <Eye className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">
            {viewedAccount ? `Viewing ${viewedAccount}` : 'View Wallet'}
          </span>
          {viewedAccount && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClear(); } }}
              className="ml-1 inline-flex items-center justify-center rounded hover:bg-cheese/20 p-0.5 cursor-pointer"
              aria-label="Stop viewing this wallet"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-2">
        <div>
          <p className="text-sm font-medium text-cheese">View another wallet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse any WAX account's GPK collection. Read-only — no actions available.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="e.g. someuser.wam"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            onKeyDown={onKey}
            maxLength={12}
            className="h-8 text-sm border-cheese/40"
          />
          <Button
            size="sm"
            className="h-8 bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            onClick={submit}
            disabled={checking}
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'View'}
          </Button>
          {(() => {
            const candidate = normalize(value) || viewedAccount || '';
            const valid = isValidWaxName(candidate);
            const starred = valid && favoriteSet.has(candidate);
            return (
              <Button
                size="sm"
                variant="ghost"
                className={`h-8 px-2 ${starred ? 'text-amber-400' : 'text-muted-foreground'} hover:bg-cheese/10 hover:text-amber-400`}
                disabled={!valid}
                onClick={() => handleToggleFavorite(candidate)}
                title={starred ? `Remove ${candidate} from favourites` : `Star ${candidate || 'this account'} as a favourite`}
                aria-label={starred ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Star className={`h-4 w-4 ${starred ? 'fill-amber-400' : ''}`} />
              </Button>
            );
          })()}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => setShowFavs((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-cheese hover:bg-cheese/10 rounded px-2 py-1.5 border border-cheese/20"
        >
          <span className="font-medium">
            {showFavs ? 'Hide List' : 'Show List'}
            <span className="text-muted-foreground font-normal ml-1">— Favourites ({favorites.length})</span>
          </span>
          {showFavs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showFavs && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-cheese hover:bg-cheese/10 flex-1"
                onClick={handleExportFavs}
                disabled={favorites.length === 0}
                title="Download your favourites as a JSON file"
              >
                <Download className="h-3 w-3 mr-1" />Export
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-cheese hover:bg-cheese/10 flex-1"
                onClick={() => favInputRef.current?.click()}
                title="Import a favourites JSON file (merges, no duplicates)"
              >
                <Upload className="h-3 w-3 mr-1" />Import
              </Button>
            </div>
            <input
              ref={favInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFavsFile(file);
                e.target.value = '';
              }}
            />
            {favorites.length > 4 && (
              <Input
                spellCheck={false}
                autoComplete="off"
                placeholder="Filter account…"
                value={favFilter}
                onChange={(e) => setFavFilter(e.target.value)}
                className="h-7 text-xs border-cheese/40"
              />
            )}
            {favorites.length === 0 ? (
              <p className="px-1 text-[11px] text-muted-foreground">
                No favourites yet. Star an account with the ★ button, or import a favourites JSON from the JSON menu.
              </p>
            ) : (
              <div className="max-h-[320px] overflow-auto rounded border border-cheese/20">
                {filteredFavs.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground text-center">No matches</div>
                )}
                {filteredFavs.map((f) => (
                  <div
                    key={f.account}
                    className="grid grid-cols-[1fr_24px] gap-1 items-center px-2 py-1.5 border-t border-cheese/10 first:border-t-0 hover:bg-cheese/10"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setValue(f.account);
                        setShowFavs(false);
                        setError(null);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                      className="text-xs text-foreground truncate text-left"
                    >
                      {f.account}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(f.account)}
                      className="text-amber-400 hover:text-muted-foreground p-0.5"
                      title={`Remove ${f.account} from favourites`}
                      aria-label={`Remove ${f.account} from favourites`}
                    >
                      <Star className="h-3.5 w-3.5 fill-amber-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-cheese hover:bg-cheese/10 rounded px-2 py-1.5 border border-cheese/20"
        >
          <span className="font-medium">
            {showList ? 'Hide List' : 'Show List'}
            <span className="text-muted-foreground font-normal ml-1">— Top GPK holders</span>
          </span>
          {showList ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showList && (
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <Input
                spellCheck={false}
                autoComplete="off"
                placeholder="Filter account…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-7 text-xs border-cheese/40"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-cheese hover:bg-cheese/10"
                onClick={refresh}
                disabled={loading}
                title="Re-fetch manifest from mirrors"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {notPublished ? (
              <div className="px-1 space-y-0.5">
                <p className="text-[11px] text-muted-foreground">Holders snapshot not published yet.</p>
                <p className="text-[10px] text-muted-foreground/80">
                  This list comes from a manually generated snapshot file. It appears here once it's
                  published to the mirrors.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                {loading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading holders…
                  </span>
                ) : loadError ? (
                  <span className="text-destructive">{loadError}</span>
                ) : holders ? (
                  <>
                    <span>Top {holders.length.toLocaleString()} holders</span>
                    {snapshotLabel && <span>snapshot {snapshotLabel}</span>}
                  </>
                ) : (
                  <span>Waiting…</span>
                )}
              </div>
            )}

            {!notPublished && (
            <div className="max-h-[320px] overflow-auto rounded border border-cheese/20">
              <div className="grid grid-cols-[28px_1fr_44px_44px_52px] gap-1 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40 px-2 py-1 sticky top-0">
                <span>#</span>
                <span>Account</span>
                <span className="text-right">SA</span>
                <span className="text-right">AA</span>
                <span className="text-right">Total</span>
              </div>
              {holders && filtered.length === 0 && !loading && (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  {filter ? 'No matches' : 'No holders found'}
                </div>
              )}
              {filtered.map((h) => {
                const rank = (holders?.indexOf(h) ?? 0) + 1;
                const starred = favoriteSet.has(h.account);
                return (
                  <div
                    key={h.account}
                    className="grid grid-cols-[28px_1fr_44px_44px_52px_24px] gap-1 items-center text-xs px-2 py-1.5 hover:bg-cheese/10 border-t border-cheese/10"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setValue(h.account);
                        setShowList(false);
                        setError(null);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                      className="contents text-left"
                      title={`${h.sa.toLocaleString()} SA · ${h.aa.toLocaleString()} AA`}
                    >
                      <span className="text-muted-foreground tabular-nums">#{rank}</span>
                      <span className="text-foreground truncate">{h.account}</span>
                      <span className="text-muted-foreground text-right tabular-nums">
                        {h.sa.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground text-right tabular-nums">
                        {h.aa.toLocaleString()}
                      </span>
                      <span className="text-cheese font-semibold text-right tabular-nums">
                        {h.total.toLocaleString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(h.account)}
                      className={`${starred ? 'text-amber-400' : 'text-muted-foreground/50'} hover:text-amber-400 p-0.5`}
                      title={starred ? `Remove ${h.account} from favourites` : `Star ${h.account} as a favourite`}
                      aria-label={starred ? `Remove ${h.account} from favourites` : `Add ${h.account} to favourites`}
                    >
                      <Star className={`h-3.5 w-3.5 ${starred ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowActive((v) => !v)}
          className="w-full flex items-center justify-between text-xs text-cheese hover:bg-cheese/10 rounded px-2 py-1.5 border border-cheese/20"
        >
          <span className="font-medium">
            {showActive ? 'Hide List' : 'Show List'}
            <span className="text-muted-foreground font-normal ml-1">— Active traders (90 days)</span>
          </span>
          {showActive ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {showActive && (
          <div className="space-y-2">
            {isOfflineBundle() ? (
              <p className="px-1 text-[11px] text-muted-foreground">Not available offline.</p>
            ) : (
              <>
                <div className="flex gap-2 items-center">
                  <Input
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="Filter account…"
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                    className="h-7 text-xs border-cheese/40"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-cheese hover:bg-cheese/10"
                    onClick={refreshActive}
                    disabled={activeLoading}
                    title="Re-fetch activity from the chain APIs"
                  >
                    <RefreshCw className={`h-3 w-3 ${activeLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  {activeLoading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Scanning the last 90 days…
                    </span>
                  ) : activeError ? (
                    <span className="text-destructive">{activeError}</span>
                  ) : activeWallets ? (
                    <span>{activeWallets.length.toLocaleString()} active accounts</span>
                  ) : (
                    <span>Waiting…</span>
                  )}
                </div>

                <div className="max-h-[320px] overflow-auto rounded border border-cheese/20">
                  <div className="grid grid-cols-[1fr_64px_56px] gap-1 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/40 px-2 py-1 sticky top-0">
                    <span>Account</span>
                    <span className="text-right">Active</span>
                    <span className="text-right">Events</span>
                  </div>
                  {activeWallets && filteredActive.length === 0 && !activeLoading && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      {activeFilter ? 'No matches' : 'No active accounts found'}
                    </div>
                  )}
                  {filteredActive.map((w) => {
                    const starred = favoriteSet.has(w.account);
                    return (
                      <div
                        key={w.account}
                        className="grid grid-cols-[1fr_64px_56px_24px] gap-1 items-center text-xs px-2 py-1.5 hover:bg-cheese/10 border-t border-cheese/10"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setValue(w.account);
                            setShowActive(false);
                            setError(null);
                            requestAnimationFrame(() => inputRef.current?.focus());
                          }}
                          className="contents text-left"
                        >
                          <span className="text-foreground truncate">{w.account}</span>
                          <span className="text-muted-foreground text-right tabular-nums">
                            {formatLastActive(w.lastActive)}
                          </span>
                          <span className="text-cheese font-semibold text-right tabular-nums">
                            {w.activityCount.toLocaleString()}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(w.account)}
                          className={`${starred ? 'text-amber-400' : 'text-muted-foreground/50'} hover:text-amber-400 p-0.5`}
                          title={starred ? `Remove ${w.account} from favourites` : `Star ${w.account} as a favourite`}
                          aria-label={starred ? `Remove ${w.account} from favourites` : `Add ${w.account} to favourites`}
                        >
                          <Star className={`h-3.5 w-3.5 ${starred ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {viewedAccount && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-cheese hover:bg-cheese/10"
            onClick={() => { onClear(); setOpen(false); }}
          >
            Return to my collection
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
