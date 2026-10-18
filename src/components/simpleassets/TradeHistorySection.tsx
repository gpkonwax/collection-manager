import { Fragment, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { originChain, mergeHistory, readClassicPref, timelineEvents, writeClassicPref, type TimelineEvent, type BridgeReceipt } from '@/lib/historyTimeline';
import { Button } from '@/components/ui/button';
import { fetchTradeHistory, HISTORY_LIMIT, type TradeHistory } from '@/lib/tradeHistory';
import { WAX_EXPLORER } from '@/lib/waxConfig';
import { getSaCardHistory, MARKET_NAMES, type SaCardHistory, type SaEvent } from '@/lib/saHistory';
import { fetchIncomingSaTransfer, getSavedSaTransfers, type IncomingResult, type SaTransfer } from '@/lib/saTransfers';
import { packImage } from '@/lib/gpkPackMeta';
import { PACK_DEFAULTS } from '@/hooks/useGpkAtomicPacks';
import { combineAaHistory, fetchLiveAaOpening, getAaCardHistory, POOL, type AaCardHistory, type AaOpening } from '@/lib/aaHistory';
import { IpfsMedia } from './IpfsMedia';
import { counterpartAssets, fetchTradeOffer, type OfferAsset } from '@/lib/tradeOffers';
import logoSimpleAssets from '@/assets/simpleassets-logo.png';
import logoAtomicAssets from '@/assets/atomicassets-logo.png';
import { fmtUsd, saleUsd } from '@/lib/waxUsd';

/** "(\$12.34)" — the sale's USD value on its UTC day; nothing when no price is known. */
function SaleUsd({ e }: { e: Pick<SaEvent, 'kind' | 'amount' | 'token' | 'time'> }) {
  const [usd, setUsd] = useState<number>();
  useEffect(() => {
    let live = true;
    setUsd(undefined);
    if (e.kind === 'sale' && e.amount) saleUsd(Number(e.amount), e.token, e.time).then((v) => { if (live) setUsd(v); });
    return () => { live = false; };
  }, [e.kind, e.amount, e.token, e.time]);
  return usd == null ? null : <span className="font-normal text-muted-foreground"> ({fmtUsd(usd)})</span>;
}

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

interface Props { assetId: string; isAtomic: boolean; owner?: string; opener?: string | null; cardImage?: string; /** Original SimpleAssets id of a bridged AtomicAssets copy. */ saOriginId?: string; /** Pack token symbol (e.g. GPKFIVE) the card was pulled from, when known. */ packSymbol?: string; /** Epoch ms the pack was opened, from the provenance record. */ openedAt?: number; bridgeReceipt?: BridgeReceipt; /** AtomicAssets schema (e.g. foodfightb), used to name the pack of native cards. */ schema?: string }

interface SaHistory { incoming: IncomingResult | null; saved: SaTransfer[]; full: SaCardHistory | null }

const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  sale: 'Sold', list: 'Listed', cancel: 'Listing cancelled', refund: 'Refunded', reprice: 'Repriced',
  transfer: 'Transferred', offer: 'Gift offered', unoffer: 'Gift withdrawn', claim: 'Gift claimed',
  'bridge-receipt': 'Minted on AtomicAssets',
  burn: 'Burned', bridge: 'Bridged to AtomicAssets', unbridge: 'Returned from AtomicAssets',
};

const MARKET_LABEL: Record<string, string> = { ...MARKET_NAMES, atomicmarket: 'AtomicMarket' };

function EventRow({ e }: { e: SaEvent }) {
  const price = e.amount ? `${Number(e.amount).toLocaleString('en-GB', { maximumFractionDigits: 8 })} ${e.token || 'WAX'}` : '';
  return (
    <div className="bg-muted/30 rounded px-2 py-1">
      <div className="flex justify-between gap-2">
        <span>{fmtDate(e.time)} · <span className="font-semibold">{KIND_LABEL[e.kind]}</span>{e.market && ` · ${MARKET_NAMES[e.market] ?? e.market}`}</span>
        <span className="flex gap-2">
          {price && <span className="font-semibold text-cheese">{price}<SaleUsd e={e} /></span>}
          {e.txid && <a href={`${WAX_EXPLORER}${e.txid}`} target="_blank" rel="noopener noreferrer" className="text-cheese underline">tx</a>}
        </span>
      </div>
      {(e.from || e.to) && <p className="font-mono break-all">{e.from || '—'}{e.to && ` → ${e.to}`}</p>}
    </div>
  );
}

const KIND_TONE: Partial<Record<TimelineEvent['kind'], string>> = {
  sale: 'border-cheese/60 bg-cheese/15 text-cheese',
  transfer: 'border-[hsl(var(--tl-transfer)/0.6)] bg-[hsl(var(--tl-transfer)/0.15)] text-[hsl(var(--tl-transfer))]',
  claim: 'border-[hsl(var(--tl-transfer)/0.6)] bg-[hsl(var(--tl-transfer)/0.15)] text-[hsl(var(--tl-transfer))]',
  'bridge-receipt': 'border-[hsl(var(--tl-bridge)/0.6)] bg-[hsl(var(--tl-bridge)/0.15)] text-[hsl(var(--tl-bridge))]',
  bridge: 'border-[hsl(var(--tl-bridge)/0.6)] bg-[hsl(var(--tl-bridge)/0.15)] text-[hsl(var(--tl-bridge))]',
  unbridge: 'border-[hsl(var(--tl-bridge)/0.6)] bg-[hsl(var(--tl-bridge)/0.15)] text-[hsl(var(--tl-bridge))]',
  burn: 'border-[hsl(var(--tl-burn)/0.6)] bg-[hsl(var(--tl-burn)/0.15)] text-[hsl(var(--tl-burn))]',
};
const QUIET_TONE = 'border-[hsl(var(--tl-quiet)/0.5)] bg-[hsl(var(--tl-quiet)/0.12)] text-muted-foreground';
const TRADED_TONE = 'border-[hsl(var(--tl-bridge)/0.6)] bg-[hsl(var(--tl-bridge)/0.15)] text-[hsl(var(--tl-bridge))]';


/** Jagged top edge so the pack thumbnail looks like it was ripped open. */
const TORN_TOP_CLIP =
  'polygon(0 14%, 7% 5%, 16% 11%, 27% 3%, 38% 10%, 50% 4%, 61% 12%, 72% 3%, 83% 10%, 92% 4%, 100% 9%, 100% 100%, 0 100%)';

function ChainLogo({ chain }: { chain: 'sa' | 'aa' }) {
  const sa = chain === 'sa';
  return (
    <img
      src={sa ? logoSimpleAssets : logoAtomicAssets}
      alt={sa ? 'SimpleAssets' : 'AtomicAssets'}
      title={sa ? 'SimpleAssets' : 'AtomicAssets'}
      className={`ml-auto h-4 w-4 rounded-full ${sa ? 'bg-white p-[1px]' : ''}`}
    />
  );
}

function Milestone({ title, date, tone, children, tx, highlight, chain, rtl }: { title: string; date?: string; tone: string; children?: React.ReactNode; tx?: string; highlight?: boolean; chain?: 'sa' | 'aa'; rtl?: boolean }) {
  return (
    <li className={`shrink-0 w-[180px] rounded-lg border bg-card/70 p-2 space-y-1 ${highlight ? 'border-cheese ring-1 ring-cheese/40' : 'border-border'}`}>
      <div className="flex justify-between items-center gap-2 text-[11px] text-muted-foreground">
        <span>{date ?? ''}</span>
        {chain && <ChainLogo chain={chain} />}
        {tx && <a href={`${WAX_EXPLORER}${tx}`} target="_blank" rel="noopener noreferrer" className="text-cheese underline">tx</a>}
      </div>
      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{title}</span>
      <div className={rtl ? 'text-right' : undefined}>{children}</div>
    </li>
  );
}

/** "Traded for" — the card(s) given in exchange in an accepted P2P trade offer. */
function TradedFor({ offerId, assetId }: { offerId: string; assetId?: string }) {
  const [assets, setAssets] = useState<OfferAsset[] | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setAssets(undefined);
    fetchTradeOffer(offerId)
      .then((o) => { if (live) setAssets(o && assetId ? counterpartAssets(o, assetId) : null); })
      .catch(() => { if (live) setAssets(null); });
    return () => { live = false; };
  }, [offerId, assetId]);
  if (assets === undefined) return <p className="text-[11px] text-muted-foreground">Looking up trade…</p>;
  if (!assets) return <p className="text-[11px] text-muted-foreground">Trade offer #{offerId}</p>;
  if (assets.length === 0) return <p className="text-[11px] text-muted-foreground">Traded for nothing in return (gift offer)</p>;
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">Traded for</p>
      <ul className="space-y-1">
        {assets.map((a) => (
          <li key={a.id} className="flex items-center gap-1.5">
            {a.image && <IpfsMedia url={a.image} alt={a.name} className="w-8 shrink-0 rounded-sm overflow-hidden" context="detail" loading="eager" mirrorFirst />}
            <span className="text-[11px] leading-tight">
              <span className="font-semibold text-cheese">{a.name}</span>
              {a.mint && <span className="text-muted-foreground"> #{a.mint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The ExpressTrade gift memo + intended recipient, read from the deposit transaction. */
function ExpressTradeNote({ txid }: { txid: string }) {
  const [gift, setGift] = useState<ExpressTradeGift | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setGift(undefined);
    fetchExpressTradeGift(txid).then((g) => { if (live) setGift(g); });
    return () => { live = false; };
  }, [txid]);
  if (!gift) return null;
  return (
    <div className="space-y-0.5">
      {gift.to && <p className="text-[11px] text-muted-foreground">Gift for <span className="font-mono text-cheese">{gift.to}</span></p>}
      {gift.memo && <p className="text-[11px] italic text-muted-foreground break-words">“{gift.memo}”</p>}
    </div>
  );
}

function EventMilestone({ e, rtl, assetId }: { e: TimelineEvent; rtl?: boolean; assetId?: string }) {
  const price = e.amount ? `${Number(e.amount).toLocaleString('en-GB', { maximumFractionDigits: 8 })} ${e.token || 'WAX'}` : '';
  const traded = e.kind === 'transfer' && !!e.offerId;
  const xt = isExpressTrade(e);
  const title = traded ? 'Traded' : xt ? (e.to === EXPRESS_TRADE ? 'ExpressTrade gift' : 'ExpressTrade withdrawal') : KIND_LABEL[e.kind];
  return (
    <Milestone title={title} date={fmtDate(e.time)} tone={(traded ? TRADED_TONE : KIND_TONE[e.kind]) ?? QUIET_TONE} tx={e.txid || undefined} chain={e.chain} rtl={rtl}>
      {price && <p className="font-semibold text-cheese">{price}<SaleUsd e={e as SaEvent} /></p>}
      {xt && <p className="text-[11px] text-muted-foreground">WAX ExpressTrade</p>}
      {!xt && e.market && <p className="text-[11px] text-muted-foreground">{MARKET_LABEL[e.market] ?? e.market}</p>}
      {xt && e.to === EXPRESS_TRADE && e.txid && <ExpressTradeNote txid={e.txid} />}
      {(e.from || e.to) && (
        <p className={`font-mono break-all leading-snug flex flex-wrap gap-x-1 ${rtl ? 'flex-row-reverse' : ''}`}>
          <span>{e.from || '—'}</span>
          {e.to && <><span className="font-black text-cheese drop-shadow-[0_0_6px_hsl(var(--cheese)/0.7)]">{rtl ? '←' : '→'}</span><span>{e.to}</span></>}
        </p>
      )}
      {traded && <TradedFor offerId={e.offerId!} assetId={assetId} />}
    </Milestone>
  );
}

export function HistoryTimeline({ events, opener, owner, packSymbol, packArt, origin, cardImage, originDate, originTx, minted, assetId }: { events: TimelineEvent[]; opener?: string | null; owner?: string; packSymbol?: string; /** IPFS artwork of an AtomicAssets pack. */ packArt?: string; origin?: 'sa' | 'aa'; cardImage?: string; originDate?: number; originTx?: string; /** Minted outside a pack (no "Pack opened"). */ minted?: boolean; /** The card this history belongs to (finds what it was traded for). */ assetId?: string }) {
  const burned = events.at(-1)?.kind === 'burn';
  const packImg = packSymbol ? packImage(packSymbol) : undefined;
  const nodes: React.ReactNode[] = [];
  if (opener) nodes.push(
    <Milestone key="origin" title={minted ? 'Minted' : 'Pack opened'} tone={KIND_TONE.sale!} chain={origin} date={originDate ? fmtDate(originDate) : undefined} tx={originTx || undefined}>
      {!minted && packImg && <img src={packImg} alt="Pack this card was pulled from" title="Pack this card was pulled from" className="mx-auto w-16 rounded-sm" style={{ clipPath: TORN_TOP_CLIP }} />}
      {!minted && !packImg && packArt && <IpfsMedia url={packArt} alt="Pack this card was pulled from" className="mx-auto w-16 rounded-sm overflow-hidden" style={{ clipPath: TORN_TOP_CLIP }} context="detail" loading="eager" mirrorFirst />}
      {!minted && packSymbol && <p className="text-center font-mono text-[11px] font-semibold text-cheese" title="Pack token code">{packSymbol.toUpperCase()}</p>}
      <p>{minted ? 'Minted to' : 'Pulled by'} <span className="font-mono text-cheese break-all">{opener}</span></p>
    </Milestone>,
  );
  events.forEach((e, i) => nodes.push(<EventMilestone key={`${e.chain}-${e.txid}-${e.kind}-${e.time}-${i}`} e={e} assetId={assetId} />));
  if (owner && !burned) nodes.push(
    <Milestone key="owner" title="Current owner" tone={KIND_TONE.sale!} highlight>
      <IpfsMedia url={cardImage} alt="Card held by the current owner" className="mx-auto w-16 rounded-sm overflow-hidden" context="detail" loading="eager" mirrorFirst />
      <p className="font-mono text-cheese break-all">{owner}</p>
    </Milestone>,
  );
  return <SnakeRows nodes={nodes} />;
}

// Sized so exactly 5 cards fit the 1036px row inside the 1100px detail modal.
const CARD_W = 180;
const ARROW_W = 28;
/** How much longer than tall the row-wrap arrow is, in the same glyph style as the in-row arrows. */
const WRAP_ARROW_STRETCH = 2.4;
/** Vertical breathing room between snake rows, so the eye follows the snake instead of dropping straight down. */
const ROW_GAP = 24;

/** Pure: how many milestone cards fit on one row of the given width. */
export function perRowFor(width: number): number {
  return Math.max(1, Math.floor((width + ARROW_W) / (CARD_W + ARROW_W)));
}

/**
 * Lays milestones out as a snake: row 1 left→right, row 2 right→left, …,
 * so long histories grow the window downwards instead of sideways.
 */
function SnakeRows({ nodes }: { nodes: React.ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setPerRow(perRowFor(el.clientWidth));
    update();
    // ResizeObserver is missing in some environments (older WebViews, jsdom) —
    // fall back to a one-shot measure rather than crashing the detail dialog.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < nodes.length; i += perRow) rows.push(nodes.slice(i, i + perRow));
  // Both rows share one band of this exact width, so the column a row turns on
  // is the same column the next row turns on — and the wrap arrow sits on it.
  const rowW = perRow * CARD_W + (perRow - 1) * ARROW_W;
  return (
    <div ref={ref} className="w-full min-w-0" aria-label="Card history, oldest first, snaking left to right then right to left">
      {rows.map((row, r) => {
        const rtl = r % 2 === 1;
        return (
          <Fragment key={r}>
            <ol className={`flex items-start mx-auto ${rtl ? 'flex-row-reverse' : ''}`} style={{ width: rowW, marginBottom: r < rows.length - 1 ? ROW_GAP : undefined }}>
              {row.map((n, i) => (
                <Fragment key={i}>
                  {i > 0 && <li aria-hidden data-arrow="row" className="shrink-0 self-center text-center text-xl font-black text-cheese drop-shadow-[0_0_6px_hsl(var(--cheese)/0.7)] list-none" style={{ width: ARROW_W }}>{rtl ? '←' : '→'}</li>}
                  {(() => {
                    const card = isValidElement(n) ? cloneElement(n as React.ReactElement<{ rtl?: boolean }>, { rtl }) : n;
                    if (r === rows.length - 1 || i !== row.length - 1) return card;
                    // Turning card: the wrap arrow fills the space under it, centred
                    // between this box and the box it bridges to on the next row.
                    return (
                      <div className="flex flex-col self-stretch shrink-0" style={{ width: CARD_W }}>
                        {card}
                        <span aria-hidden data-arrow="wrap" className="flex-1 flex items-center justify-center text-xl font-black text-cheese drop-shadow-[0_0_6px_hsl(var(--cheese)/0.7)] leading-none" style={{ minHeight: 46, marginBottom: -ROW_GAP }}>
                          <span className="inline-block" style={{ transform: `scaleY(${WRAP_ARROW_STRETCH})` }}>↓</span>
                        </span>
                      </div>
                    );
                  })()}
                </Fragment>
              ))}
            </ol>
          </Fragment>
        );
      })}
    </div>
  );
}

function AtomicColumns({ history }: { history: TradeHistory }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1">
        <p className="font-semibold text-cheese">Sales ({history.sales.length}{history.sales.length >= HISTORY_LIMIT ? '+' : ''})</p>
        {history.sales.length === 0 && <p className="text-muted-foreground">No market sales recorded.</p>}
        {history.sales.map((s) => (
          <div key={`${s.id}-${s.time}`} className="bg-muted/30 rounded px-2 py-1">
            <div className="flex justify-between gap-2"><span>{fmtDate(s.time)}</span><span className="font-semibold text-cheese">{s.price || '—'}</span></div>
            <p className="font-mono break-all">{s.seller} → {s.buyer ?? 'unknown'}</p>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-cheese">Transfers ({history.transfers.length}{history.transfers.length >= HISTORY_LIMIT ? '+' : ''})</p>
        {history.transfers.length === 0 && <p className="text-muted-foreground">No transfers recorded.</p>}
        {history.transfers.map((t) => (
          <div key={`${t.id}-${t.txid}-${t.from}-${t.to}-${t.time}`} className="bg-muted/30 rounded px-2 py-1">
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

function RetryRow({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{text}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function TradeHistorySection({ assetId, isAtomic, owner, opener, saOriginId, packSymbol, bridgeReceipt, cardImage, schema = '', openedAt }: Props) {
  const [open, setOpen] = useState(true);
  const [classic, setClassic] = useState(readClassicPref);
  const [history, setHistory] = useState<TradeHistory | null>(null);
  const [aaError, setAaError] = useState(false);
  const [saError, setSaError] = useState(false);
  const [aaAttempt, setAaAttempt] = useState(0);
  const [saAttempt, setSaAttempt] = useState(0);
  const [saHistory, setSaHistory] = useState<SaHistory | null>(null);
  const [showAll, setShowAll] = useState(false);
  // Our own AtomicAssets copy: undefined = loading, null = not available.
  const [aaStored, setAaStored] = useState<AaCardHistory | null | undefined>(undefined);
  const [liveOpening, setLiveOpening] = useState<AaOpening | null | undefined>(undefined);
  // SimpleAssets id whose history applies: the card itself, or the original of a bridged copy.
  const saId = isAtomic ? (saOriginId && /^\d+$/.test(saOriginId) ? saOriginId : '') : assetId;
  const heldByOpener = !!owner && !!opener && owner === opener;

  useEffect(() => { setOpen(true); setHistory(null); setSaHistory(null); setShowAll(false); setAaError(false); setSaError(false); setAaStored(undefined); setLiveOpening(undefined); }, [assetId, owner, saId]);

  useEffect(() => {
    if (!open || !saId || saHistory) return;
    let cancelled = false;
    setSaError(false);
    Promise.all([
      getSavedSaTransfers(saId),
      getSaCardHistory(saId).catch((err) => { console.warn('[TradeHistory] full history unavailable:', err); return null; }),
      // "How the current owner got it" only applies while the card is still a SimpleAsset.
      isAtomic || heldByOpener || !owner ? Promise.resolve(null) : fetchIncomingSaTransfer(saId, owner),
    ])
      .then(([saved, full, incoming]) => { if (!cancelled) setSaHistory({ saved, full, incoming }); })
      .catch((err) => { console.warn('[TradeHistory] SimpleAssets lookup failed:', err); if (!cancelled) setSaError(true); });
    return () => { cancelled = true; };
  }, [open, saId, isAtomic, owner, heldByOpener, saHistory, saAttempt]);

  useEffect(() => {
    if (!open || !isAtomic || history) return;
    let cancelled = false;
    setAaError(false);
    fetchTradeHistory(assetId)
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch((err) => { console.warn('[TradeHistory] lookup failed:', err); if (!cancelled) setAaError(true); });
    return () => { cancelled = true; };
  }, [open, isAtomic, assetId, history, aaAttempt]);

  useEffect(() => {
    if (!open || !isAtomic || aaStored !== undefined) return;
    let cancelled = false;
    getAaCardHistory(assetId)
      .then((h) => { if (!cancelled) setAaStored(h); })
      .catch((err) => { console.warn('[TradeHistory] saved AtomicAssets history unavailable:', err); if (!cancelled) setAaStored(null); });
    return () => { cancelled = true; };
  }, [open, isAtomic, assetId, aaStored]);

  const nativeAa = isAtomic && !saId;
  const combined = isAtomic ? combineAaHistory(aaStored ?? null, history) : null;
  // A card our copy doesn't cover yet (or not published) asks AtomicHub for its mint once.
  const needLiveOpening = open && nativeAa && aaStored !== undefined && !aaStored?.opening && !!history && liveOpening === undefined;
  useEffect(() => {
    if (!needLiveOpening) return;
    let cancelled = false;
    fetchLiveAaOpening(assetId, schema, combined?.transfers ?? [])
      .then((o) => { if (!cancelled) setLiveOpening(o); })
      .catch(() => { if (!cancelled) setLiveOpening(null); });
    return () => { cancelled = true; };
  }, [needLiveOpening, assetId, schema]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleClassic = (v: boolean) => { setClassic(v); writeClassicPref(v); };
  const retrySa = () => { setSaError(false); setSaHistory(null); setSaAttempt((n) => n + 1); };
  const retryAa = () => { setAaError(false); setAaAttempt((n) => n + 1); };

  const saLoading = !!saId && !saHistory && !saError;
  const aaLoading = isAtomic && ((!history && !aaError) || aaStored === undefined);
  const saEvents = saHistory?.full?.events ?? [];
  const opening = nativeAa ? (aaStored?.opening ?? liveOpening ?? null) : null;
  // A pool delivery IS the pack opening; don't show it twice.
  const aaHistory = combined && opening?.kind === 'open' ? {
    ...combined,
    transfers: combined.transfers.filter((t) => !(t.from === POOL && t.to === opening.account && (opening.txid ? t.txid === opening.txid : t.time === opening.time))),
  } : combined;
  let merged = mergeHistory(saEvents, aaHistory, isAtomic && saId ? bridgeReceipt : undefined);
  const burn = isAtomic ? aaStored?.burn : null;
  if (burn && !merged.some((e) => e.kind === 'burn' && e.chain === 'aa')) {
    merged = [...merged, { time: burn.time, kind: 'burn' as const, from: burn.owner, to: '', amount: '', token: '', market: '', txid: burn.txid, chain: 'aa' as const }];
  }
  const shownOpener = opener ?? opening?.account ?? null;
  const packArt = opening?.packTemplate ? PACK_DEFAULTS[opening.packTemplate]?.image : undefined;
  const shown = timelineEvents(merged, showAll);
  const hidden = merged.length - timelineEvents(merged, false).length;
  const aaCapped = !!history && !aaStored && (history.sales.length >= HISTORY_LIMIT || history.transfers.length >= HISTORY_LIMIT);
  const ready = !saLoading && !aaLoading;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-cheese">Asset History</h4>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" className="accent-[hsl(var(--cheese))]" checked={classic} onChange={(e) => toggleClassic(e.target.checked)} />
            Classic list
          </label>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'} history</Button>
        </div>
      </div>
      {open && saError && <RetryRow text={isAtomic ? "Couldn't load the SimpleAssets history before bridging right now." : "Couldn't load ownership history right now."} onRetry={retrySa} />}
      {open && aaError && !aaStored && <RetryRow text="Couldn't load AtomicAssets trading history right now." onRetry={retryAa} />}
      {open && !ready && <p className="text-xs text-muted-foreground">Loading history…</p>}
      {open && ready && (saHistory || history || aaStored) && (
        <div className="space-y-2 text-xs text-foreground">
          {!isAtomic && saHistory && (
            <div className="space-y-1">
              <p className="font-semibold text-cheese">How the current owner got it</p>
              {heldByOpener && <p>Still owned by <span className="font-mono text-cheese">{opener}</span>, who opened the pack it came in.</p>}
              {saHistory.incoming?.kind === 'found' && <TransferRow t={saHistory.incoming.transfer} />}
              {saHistory.incoming?.kind === 'none' && <p className="text-muted-foreground">No transfer to the current owner found — it was likely opened by them.</p>}
              {saHistory.incoming?.kind === 'unknown' && !heldByOpener && <p className="text-muted-foreground">Not found among the current owner's 500 most recent transfers.</p>}
            </div>
          )}
          {saHistory?.full && !saHistory.full.complete && <p className="text-muted-foreground">History scan still in progress{saHistory.full.upTo ? ` — covered up to ${fmtDate(Date.parse(saHistory.full.upTo))}` : ''}.</p>}
          {aaCapped && <p className="text-muted-foreground">AtomicHub only returns the {HISTORY_LIMIT} most recent sales and transfers, so older AtomicAssets events may be missing.</p>}
          {!classic && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-cheese">Full on-chain history ({shown.length}) <span className="font-normal text-muted-foreground">· oldest left, newest right</span></p>
                {hidden > 0 && <Button variant="outline" size="sm" className="h-7 text-xs" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>{showAll ? 'Milestones only' : `Show listings & cancellations (${hidden})`}</Button>}
              </div>
              {merged.length === 0 && <p className="text-muted-foreground">No recorded sales, listings or transfers.</p>}
              <HistoryTimeline events={shown} opener={shownOpener} owner={owner} packSymbol={packSymbol} packArt={packArt} origin={originChain(isAtomic, saOriginId)} cardImage={cardImage} assetId={isAtomic ? assetId : undefined}
                originDate={opener ? openedAt : opening?.time} originTx={!opener ? opening?.txid : undefined} minted={!opener && opening?.kind === 'mint'} />
            </div>
          )}
          {classic && saHistory?.full && (
            <div className="space-y-1">
              <p className="font-semibold text-cheese">{isAtomic ? 'SimpleAssets history before bridging' : 'Full on-chain history'} ({saHistory.full.events.length})</p>
              {saHistory.full.events.length === 0 && <p className="text-muted-foreground">No recorded sales, listings or transfers.</p>}
              {[...saHistory.full.events].reverse().map((e, i) => <EventRow key={`${e.txid}-${e.kind}-${e.time}-${i}`} e={e} />)}
            </div>
          )}
          {classic && saHistory && !saHistory.full && saHistory.saved.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-cheese">Recorded transfers and trades ({saHistory.saved.length})</p>
              {saHistory.saved.map((t) => <TransferRow key={`${t.txid}-${t.from}-${t.to}`} t={t} />)}
            </div>
          )}
          {classic && aaHistory && <AtomicColumns history={aaHistory} />}
          {saHistory && (
            <p className="text-muted-foreground">
              Sale prices of SimpleAssets cards aren't tracked by today's WAX market services. New transfers and trades are recorded twice daily from October 2026.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
