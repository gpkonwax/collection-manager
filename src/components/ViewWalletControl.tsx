import { useState, useCallback, KeyboardEvent, useEffect, useRef, useMemo } from 'react';
import { Eye, Loader2, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WAX_CHAIN } from '@/lib/waxConfig';
import { fetchTopGpkHolders, getCachedHolders, clearCachedHolders, type Holder } from '@/lib/gpkHolders';

interface ViewWalletControlProps {
  currentAccount: string | null;
  viewedAccount: string | null;
  onView: (account: string) => void;
  onClear: () => void;
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

export function ViewWalletControl({ currentAccount, viewedAccount, onView, onClear }: ViewWalletControlProps) {
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

  // Abort in-flight on popover close
  useEffect(() => {
    if (!open && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setLoading(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!holders) return [];
    const f = filter.trim().toLowerCase();
    if (!f) return holders;
    return holders.filter((h) => h.account.includes(f));
  }, [holders, filter]);

  const snapshotLabel = formatSnapshotDate(generatedAt);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); setShowList(false); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1.5 border-cheese/30 hover:border-cheese hover:bg-cheese/10 ${viewedAccount ? 'border-cheese bg-cheese/10 text-cheese' : 'text-cheese'}`}
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
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

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
                return (
                  <button
                    type="button"
                    key={h.account}
                    onClick={() => {
                      setValue(h.account);
                      setShowList(false);
                      setError(null);
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    className="w-full grid grid-cols-[28px_1fr_44px_44px_52px] gap-1 items-center text-xs px-2 py-1.5 hover:bg-cheese/10 border-t border-cheese/10 text-left"
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
                );
              })}
            </div>
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
