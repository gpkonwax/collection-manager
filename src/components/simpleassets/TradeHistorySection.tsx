import { Fragment, useEffect, useState } from 'react';
import { timelineEvents } from '@/lib/historyTimeline';
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

const KIND_TONE: Partial<Record<SaEvent['kind'], string>> = {
  sale: 'border-cheese/60 bg-cheese/15 text-cheese',
  transfer: 'border-[hsl(var(--tl-transfer)/0.6)] bg-[hsl(var(--tl-transfer)/0.15)] text-[hsl(var(--tl-transfer))]',
  claim: 'border-[hsl(var(--tl-transfer)/0.6)] bg-[hsl(var(--tl-transfer)/0.15)] text-[hsl(var(--tl-transfer))]',
  bridge: 'border-[hsl(var(--tl-bridge)/0.6)] bg-[hsl(var(--tl-bridge)/0.15)] text-[hsl(var(--tl-bridge))]',
  unbridge: 'border-[hsl(var(--tl-bridge)/0.6)] bg-[hsl(var(--tl-bridge)/0.15)] text-[hsl(var(--tl-bridge))]',
  burn: 'border-[hsl(var(--tl-burn)/0.6)] bg-[hsl(var(--tl-burn)/0.15)] text-[hsl(var(--tl-burn))]',
};
const QUIET_TONE = 'border-[hsl(var(--tl-quiet)/0.5)] bg-[hsl(var(--tl-quiet)/0.12)] text-muted-foreground';

function Arrow() {
  return <li aria-hidden className="shrink-0 self-center text-lg text-muted-foreground px-1 list-none">→</li>;
}

function Milestone({ title, date, tone, children, tx, highlight }: { title: string; date?: string; tone: string; children?: React.ReactNode; tx?: string; highlight?: boolean }) {
  return (
    <li className={`shrink-0 w-[196px] snap-start rounded-lg border bg-card/70 p-2 space-y-1 ${highlight ? 'border-cheese ring-1 ring-cheese/40' : 'border-border'}`}>
      <div className="flex justify-between items-center gap-2 text-[11px] text-muted-foreground">
        <span>{date ?? ''}</span>
        {tx && <a href={`${WAX_EXPLORER}${tx}`} target="_blank" rel="noopener noreferrer" className="text-cheese underline">tx</a>}
      </div>
      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{title}</span>
      {children}
    </li>
  );
}

function EventMilestone({ e }: { e: SaEvent }) {
  const price = e.amount ? `${Number(e.amount).toLocaleString('en-GB', { maximumFractionDigits: 8 })} ${e.token || 'WAX'}` : '';
  return (
    <Milestone title={KIND_LABEL[e.kind]} date={fmtDate(e.time)} tone={KIND_TONE[e.kind] ?? QUIET_TONE} tx={e.txid || undefined}>
      {price && <p className="font-semibold text-cheese">{price}</p>}
      {e.market && <p className="text-[11px] text-muted-foreground">{MARKET_NAMES[e.market] ?? e.market}</p>}
      {(e.from || e.to) && (
        <p className="font-mono break-all leading-snug">{e.from || '—'}{e.to && <><span className="text-muted-foreground"> → </span>{e.to}</>}</p>
      )}
    </Milestone>
  );
}

function HistoryTimeline({ events, opener, owner }: { events: SaEvent[]; opener?: string | null; owner?: string }) {
  const burned = events.at(-1)?.kind === 'burn';
  const nodes: React.ReactNode[] = [];
  if (opener) nodes.push(
    <Milestone key="origin" title="Pack opened" tone={KIND_TONE.sale!}>
      <p>Pulled by <span className="font-mono text-cheese break-all">{opener}</span></p>
    </Milestone>,
  );
  events.forEach((e, i) => nodes.push(<EventMilestone key={`${e.txid}-${e.kind}-${e.time}-${i}`} e={e} />));
  if (owner && !burned) nodes.push(
    <Milestone key="owner" title="Current owner" tone={KIND_TONE.sale!} highlight>
      <p className="font-mono text-cheese break-all">{owner}</p>
    </Milestone>,
  );
  return (
    <div className="relative">
      <ol className="flex items-stretch overflow-x-auto snap-x pb-2 [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] px-3" tabIndex={0} aria-label="Card history, oldest on the left">
        {nodes.map((n, i) => <Fragment key={i}>{i > 0 && <Arrow />}{n}</Fragment>)}
      </ol>
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
  const [showAll, setShowAll] = useState(false);
  const heldByOpener = !!owner && !!opener && owner === opener;

  useEffect(() => { setOpen(false); setHistory(null); setSaHistory(null); setShowAll(false); setError(false); }, [assetId, owner]);

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
          {saHistory.full && (() => {
            const shown = timelineEvents(saHistory.full.events, showAll);
            const hidden = saHistory.full.events.length - timelineEvents(saHistory.full.events, false).length;
            return (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-cheese">Full on-chain history ({shown.length}) <span className="font-normal text-muted-foreground">· oldest left, newest right</span></p>
                  {hidden > 0 && <Button variant="outline" size="sm" className="h-7 text-xs" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>{showAll ? 'Milestones only' : `Show listings & cancellations (${hidden})`}</Button>}
                </div>
                {!saHistory.full.complete && <p className="text-muted-foreground">History scan still in progress{saHistory.full.upTo ? ` — covered up to ${fmtDate(Date.parse(saHistory.full.upTo))}` : ''}.</p>}
                {saHistory.full.events.length === 0 && <p className="text-muted-foreground">No recorded sales, listings or transfers.</p>}
                <HistoryTimeline events={shown} opener={opener} owner={owner} />
              </div>
            );
          })()}
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
