import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchTradeHistory, HISTORY_LIMIT, type TradeHistory } from '@/lib/tradeHistory';
import { WAX_EXPLORER } from '@/lib/waxConfig';
import { getSaCardHistory, MARKET_NAMES, type SaCardHistory, type SaEvent } from '@/lib/saHistory';
import { fetchIncomingSaTransfer, getSavedSaTransfers, type IncomingResult, type SaTransfer } from '@/lib/saTransfers';

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

interface Props { assetId: string; isAtomic: boolean; owner?: string; opener?: string | null }

interface SaHistory { incoming: IncomingResult | null; saved: SaTransfer[]; full: SaCardHistory | null }

const KIND_LABEL: Record<SaEvent['kind'], string> = {
  sale: 'Sold', list: 'Listed', cancel: 'Listing cancelled', refund: 'Refunded', reprice: 'Repriced',
  transfer: 'Transferred', offer: 'Gift offered', unoffer: 'Gift withdrawn', claim: 'Gift claimed',
  burn: 'Burned', bridge: 'Bridged to AtomicAssets', unbridge: 'Returned from AtomicAssets',
};

function EventRow({ e }: { e: SaEvent }) {
  const price = e.amount ? `${Number(e.amount).toLocaleString('en-GB', { maximumFractionDigits: 8 })} ${e.token || 'WAX'}` : '';
  return (
    <div className="bg-muted/30 rounded px-2 py-1">
      <div className="flex justify-between gap-2">
        <span>{fmtDate(e.time)} · <span className="font-semibold">{KIND_LABEL[e.kind]}</span>{e.market && ` · ${MARKET_NAMES[e.market] ?? e.market}`}</span>
        <span className="flex gap-2">
          {price && <span className="font-semibold text-cheese">{price}</span>}
          {e.txid && <a href={`${WAX_EXPLORER}${e.txid}`} target="_blank" rel="noopener noreferrer" className="text-cheese underline">tx</a>}
        </span>
      </div>
      {(e.from || e.to) && <p className="font-mono break-all">{e.from || '—'}{e.to && ` → ${e.to}`}</p>}
    </div>
  );
}

function TransferRow({ t }: { t: SaTransfer }) {
  return (
    <div className="bg-muted/30 rounded px-2 py-1">
      <div className="flex justify-between gap-2">
        <span>{fmtDate(t.time)}</span>
        {t.txid && <a href={`${WAX_EXPLORER}${t.txid}`} target="_blank" rel="noopener noreferrer" className="text-cheese underline">tx</a>}
      </div>
      <p className="font-mono break-all">{t.from} → {t.to}</p>
      {t.memo && <p className="text-muted-foreground break-all">“{t.memo}”</p>}
    </div>
  );
}

export function TradeHistorySection({ assetId, isAtomic, owner, opener }: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<TradeHistory | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saHistory, setSaHistory] = useState<SaHistory | null>(null);
  const heldByOpener = !!owner && !!opener && owner === opener;

  useEffect(() => { setOpen(false); setHistory(null); setSaHistory(null); setError(false); }, [assetId, owner]);

  useEffect(() => {
    if (!open || isAtomic || saHistory) return;
    let cancelled = false;
    setError(false);
    Promise.all([
      getSavedSaTransfers(assetId),
      getSaCardHistory(assetId).catch((err) => { console.warn('[TradeHistory] full history unavailable:', err); return null; }),
      heldByOpener || !owner ? Promise.resolve(null) : fetchIncomingSaTransfer(assetId, owner),
    ])
      .then(([saved, full, incoming]) => { if (!cancelled) setSaHistory({ saved, full, incoming }); })
      .catch((err) => { console.warn('[TradeHistory] SimpleAssets lookup failed:', err); if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [open, isAtomic, assetId, owner, heldByOpener, saHistory, attempt]);

  useEffect(() => {
    if (!open || !isAtomic || history) return;
    let cancelled = false;
    setError(false);
    fetchTradeHistory(assetId)
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch((err) => { console.warn('[TradeHistory] lookup failed:', err); if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [open, isAtomic, assetId, history, attempt]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-cheese">Trading history</h4>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'} history</Button>
      </div>
      {open && !isAtomic && error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Couldn't load ownership history right now.</span>
          <Button variant="outline" size="sm" onClick={() => { setError(false); setSaHistory(null); setAttempt((n) => n + 1); }}>Try again</Button>
        </div>
      )}
      {open && !isAtomic && !error && !saHistory && <p className="text-xs text-muted-foreground">Loading history…</p>}
      {open && !isAtomic && saHistory && (
        <div className="space-y-2 text-xs text-foreground">
          <div className="space-y-1">
            <p className="font-semibold text-cheese">How the current owner got it</p>
            {heldByOpener && <p>Still owned by <span className="font-mono text-cheese">{opener}</span>, who opened the pack it came in.</p>}
            {saHistory.incoming?.kind === 'found' && <TransferRow t={saHistory.incoming.transfer} />}
            {saHistory.incoming?.kind === 'none' && <p className="text-muted-foreground">No transfer to the current owner found — it was likely opened by them.</p>}
            {saHistory.incoming?.kind === 'unknown' && !heldByOpener && <p className="text-muted-foreground">Not found among the current owner's 500 most recent transfers.</p>}
          </div>
          {saHistory.full && (
            <div className="space-y-1">
              <p className="font-semibold text-cheese">Full on-chain history ({saHistory.full.events.length})</p>
              {!saHistory.full.complete && <p className="text-muted-foreground">History scan still in progress{saHistory.full.upTo ? ` — covered up to ${fmtDate(Date.parse(saHistory.full.upTo))}` : ''}.</p>}
              {saHistory.full.events.length === 0 && <p className="text-muted-foreground">No recorded sales, listings or transfers.</p>}
              {[...saHistory.full.events].reverse().map((e, i) => <EventRow key={`${e.txid}-${e.kind}-${e.time}-${i}`} e={e} />)}
            </div>
          )}
          {!saHistory.full && saHistory.saved.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-cheese">Recorded transfers and trades ({saHistory.saved.length})</p>
              {saHistory.saved.map((t) => <TransferRow key={`${t.txid}-${t.from}-${t.to}`} t={t} />)}
            </div>
          )}
          <p className="text-muted-foreground">
            Sale prices of SimpleAssets cards aren't tracked by today's WAX market services. New transfers and trades are recorded twice daily from October 2026.
          </p>
        </div>
      )}
      {open && isAtomic && error && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Couldn't load trading history right now.</span>
          <Button variant="outline" size="sm" onClick={() => { setError(false); setAttempt((n) => n + 1); }}>Try again</Button>
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
