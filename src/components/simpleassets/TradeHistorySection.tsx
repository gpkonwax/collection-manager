import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchTradeHistory, HISTORY_LIMIT, type TradeHistory } from '@/lib/tradeHistory';
import { WAX_EXPLORER } from '@/lib/waxConfig';

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

interface Props { assetId: string; isAtomic: boolean }

export function TradeHistorySection({ assetId, isAtomic }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<TradeHistory | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => { setOpen(false); setHistory(null); setError(false); }, [assetId]);

  useEffect(() => {
    if (!open || !isAtomic || history) return;
    let cancelled = false;
    setError(false);
    fetchTradeHistory(assetId)
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch((err) => { console.warn('[TradeHistory] lookup failed:', err); if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [open, isAtomic, assetId, history]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-cheese">Trading history</h4>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'} history</Button>
      </div>
      {open && !isAtomic && (
        <p className="text-xs text-muted-foreground">
          Sales and transfers of SimpleAssets cards aren't tracked by today's WAX market services. Full history is available once a card is bridged to AtomicAssets.
        </p>
      )}
      {open && isAtomic && error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Couldn't load trading history right now.</span>
          <Button variant="outline" size="sm" onClick={() => { setError(false); setHistory(null); setOpen(false); setTimeout(() => setOpen(true), 0); }}>Try again</Button>
        </div>
      )}
      {open && isAtomic && !error && !history && <p className="text-xs text-muted-foreground">Loading history…</p>}
      {open && isAtomic && history && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-foreground">
          <div className="space-y-1">
            <p className="font-semibold text-cheese">Sales ({history.sales.length}{history.sales.length >= HISTORY_LIMIT ? '+' : ''})</p>
            {history.sales.length === 0 && <p className="text-muted-foreground">No market sales recorded.</p>}
            {history.sales.map((s) => (
              <div key={s.id} className="bg-muted/30 rounded px-2 py-1">
                <div className="flex justify-between gap-2"><span>{fmtDate(s.time)}</span><span className="font-semibold text-cheese">{s.price || '—'}</span></div>
                <p className="font-mono break-all">{s.seller} → {s.buyer ?? 'unknown'}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-cheese">Transfers ({history.transfers.length}{history.transfers.length >= HISTORY_LIMIT ? '+' : ''})</p>
            {history.transfers.length === 0 && <p className="text-muted-foreground">No transfers recorded.</p>}
            {history.transfers.map((t) => (
              <div key={t.id} className="bg-muted/30 rounded px-2 py-1">
                <div className="flex justify-between gap-2">
                  <span>{fmtDate(t.time)}</span>
                  {t.txid && <a href={`${WAX_EXPLORER}${t.txid}`} target="_blank" rel="noopener noreferrer" className="text-cheese underline">tx</a>}
                </div>
                <p className="font-mono break-all">{t.from} → {t.to}</p>
                {t.memo && <p className="text-muted-foreground break-all">“{t.memo}”</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
