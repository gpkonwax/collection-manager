import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Check, ExternalLink, Loader2, RefreshCw, Reply, Send, Inbox, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import type { AtomicOffer, OfferAsset } from '@/lib/atomicOffers';
import { cn } from '@/lib/utils';

type OfferAction = 'accept' | 'decline' | 'cancel' | 'counter';

interface TradesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: string | null;
  incoming: AtomicOffer[];
  outgoing: AtomicOffer[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => Promise<void> | void;
  onMarkAllRead: () => void;
  /** Optional Phase-2 action handler. Return true if handled. */
  onOfferAction?: (action: OfferAction, offer: AtomicOffer) => Promise<void> | void;
  /** Offer id currently being processed (spinner state). */
  busyOfferId?: string | null;
  busyAction?: OfferAction | null;
}

const BRIDGED_SCHEMAS = new Set(['series1', 'series2', 'exotic']);

function AssetThumb({ asset }: { asset: OfferAsset }) {
  const isBridged = BRIDGED_SCHEMAS.has(String(asset.schema_name || '').toLowerCase());
  const mintValue = isBridged ? null : asset.mint;
  const mintDisplay = mintValue !== null && mintValue !== undefined && String(mintValue).trim() !== ''
    ? `#${mintValue}`
    : '#--';

  const category = normalizeAssetCategory(String(asset.schema_name || '').toLowerCase());
  const categoryLabel = CATEGORY_LABELS[category] || (asset.schema_name || '');
  const variantRaw = (asset.variant || '').trim();
  const variantLabel = variantRaw
    ? (getVariantsForCategory(category).find(v => v.value === variantRaw)?.label
        ?? variantRaw.replace(/\b\w/g, c => c.toUpperCase()))
    : '';

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 w-20 shrink-0',
        'rounded-md border border-cheese/30 bg-background/40 p-1.5',
        'theme-bright-border',
      )}
      title={`${asset.name} • #${asset.asset_id}${categoryLabel ? ` • ${categoryLabel}` : ''}${variantLabel ? ` • ${variantLabel}` : ''}${asset.mint ? ` • mint ${asset.mint}` : ''}`}
    >
      <div
        className="w-full flex justify-center"
        title="Mint number (placeholder — real mint will populate when available)"
      >
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-background/80 text-cheese border border-border/40">
          {mintDisplay}
        </span>
      </div>
      <div className="w-full aspect-[3/4] overflow-hidden rounded-sm bg-black/40">
        <IpfsMedia
          url={asset.image || undefined}
          alt={asset.name}
          className="w-full h-full object-contain"
          context="card"
        />
      </div>
      <div className="text-[10px] leading-tight text-center text-cheese/80 theme-bright-text w-full truncate">
        {asset.name}
      </div>
      {(asset.cardid || variantLabel) && (
        <div className="text-[9px] leading-tight text-center font-semibold text-cheese theme-bright-text w-full truncate">
          {[asset.cardid, variantLabel].filter(Boolean).join(' ')}
        </div>
      )}
      {categoryLabel && (
        <div className="text-[9px] leading-tight text-center text-muted-foreground theme-bright-text-muted w-full truncate">
          {categoryLabel}
        </div>
      )}
      <div className="text-[9px] leading-tight text-muted-foreground theme-bright-text-muted">
        #{asset.asset_id}
      </div>
    </div>
  );
}


function AssetRow({ label, assets }: { label: string; assets: OfferAsset[] }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-cheese/80 theme-bright-text">
        {label}{' '}
        <span className="text-muted-foreground theme-bright-text-muted font-normal">
          ({assets.length})
        </span>
      </div>
      {assets.length === 0 ? (
        <div className="text-xs text-muted-foreground theme-bright-text-muted italic px-1">
          Nothing
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {assets.map((a) => <AssetThumb key={a.asset_id} asset={a} />)}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  direction,
  isNew,
  onAction,
  busyAction,
}: {
  offer: AtomicOffer;
  direction: 'incoming' | 'outgoing';
  isNew: boolean;
  onAction?: (action: OfferAction, offer: AtomicOffer) => Promise<void> | void;
  busyAction?: OfferAction | null;
}) {
  const theyGive = direction === 'incoming' ? offer.sender_assets : offer.recipient_assets;
  const youGive  = direction === 'incoming' ? offer.recipient_assets : offer.sender_assets;
  const counterparty = direction === 'incoming' ? offer.sender_name : offer.recipient_name;
  const created = offer.created_at_time ? new Date(offer.created_at_time) : null;
  const isBusy = Boolean(busyAction);

  const btn = (a: OfferAction, label: string, icon: React.ReactNode, variant: 'default' | 'outline' | 'destructive' = 'outline') => (
    <Button
      key={a}
      size="sm"
      variant={variant}
      disabled={isBusy || !onAction}
      onClick={() => onAction?.(a, offer)}
      className={cn(
        'h-8 text-xs',
        variant === 'outline' && 'border-cheese/50 text-cheese hover:bg-cheese/10 theme-bright-border theme-bright-text',
        variant === 'default' && 'bg-cheese hover:bg-cheese/90 text-cheese-foreground',
      )}
    >
      {busyAction === a ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : icon}
      {label}
    </Button>
  );

  return (
    <div
      className={cn(
        'rounded-lg border border-cheese/30 bg-background/50 p-3 space-y-3',
        'theme-bright-border theme-bright-fill',
        isNew && 'ring-2 ring-cheese/70',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="border-cheese/50 text-cheese theme-bright-border theme-bright-text">
            Offer #{offer.offer_id}
          </Badge>
          {isNew && (
            <Badge className="bg-cheese text-cheese-foreground hover:bg-cheese/90">NEW</Badge>
          )}
          <span className="text-xs text-muted-foreground theme-bright-text-muted truncate">
            {direction === 'incoming' ? 'from' : 'to'}{' '}
            <span className="text-cheese theme-bright-text font-medium">{counterparty}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {created && (
            <span className="text-[11px] text-muted-foreground theme-bright-text-muted">
              {created.toLocaleString()}
            </span>
          )}
          <a
            href={`https://wax.atomichub.io/trading/offer/${offer.offer_id}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-cheese hover:text-cheese/80 theme-bright-text underline underline-offset-2"
            title="View on AtomicHub"
          >
            AtomicHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {offer.memo && (
        <div className="text-xs italic text-muted-foreground theme-bright-text-muted border-l-2 border-cheese/40 pl-2">
          &ldquo;{offer.memo}&rdquo;
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {direction === 'incoming' ? (
          <>
            <AssetRow label="They give you" assets={theyGive} />
            <AssetRow label="You give" assets={youGive} />
          </>
        ) : (
          <>
            <AssetRow label="You send" assets={youGive} />
            <AssetRow label="They send back" assets={theyGive} />
          </>
        )}
      </div>


      <div className="flex flex-wrap gap-2 pt-1">
        {direction === 'incoming' ? (
          <>
            {btn('accept',  'Accept',        <Check className="h-3.5 w-3.5 mr-1" />, 'default')}
            {btn('counter', 'Counter-offer', <Reply className="h-3.5 w-3.5 mr-1" />, 'outline')}
            {btn('decline', 'Decline',       <X className="h-3.5 w-3.5 mr-1" />,     'destructive')}
          </>
        ) : (
          btn('cancel', 'Cancel offer', <X className="h-3.5 w-3.5 mr-1" />, 'destructive')
        )}
      </div>
    </div>
  );
}

function EmptyState({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground theme-bright-text-muted">
      {icon}
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function TradesDialog({
  open, onOpenChange, account,
  incoming, outgoing, isLoading, error,
  onRefresh, onMarkAllRead,
  onOfferAction, busyOfferId, busyAction,
}: TradesDialogProps) {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [lastSeenAtOpen, setLastSeenAtOpen] = useState<number>(0);

  // Snapshot "last seen" at open so NEW ribbons stay visible during this viewing,
  // then mark everything read.
  useEffect(() => {
    if (!open || !account) return;
    let seen = 0;
    try {
      const raw = window.localStorage.getItem(`gpk-trades-last-seen:${account}`);
      seen = raw ? Number(raw) || 0 : 0;
    } catch { /* ignore */ }
    setLastSeenAtOpen(seen);
    onMarkAllRead();
  }, [open, account, onMarkAllRead]);

  const incomingSorted = useMemo(
    () => [...incoming].sort((a, b) => b.created_at_time - a.created_at_time),
    [incoming],
  );
  const outgoingSorted = useMemo(
    () => [...outgoing].sort((a, b) => b.created_at_time - a.created_at_time),
    [outgoing],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-cheese theme-bright-text flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Trades
          </DialogTitle>
          <DialogDescription className="theme-bright-text-muted">
            Pending AtomicAssets offers involving{' '}
            <span className="text-cheese theme-bright-text font-medium">
              {account || '\u2014'}
            </span>
            . Accept, decline, cancel or counter directly here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRefresh()}
            disabled={isLoading || !account}
            className="border-cheese/50 text-cheese hover:bg-cheese/10 theme-bright-border theme-bright-text"
          >
            {isLoading
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <RefreshCw className="h-4 w-4 mr-1" />}
            Refresh
          </Button>
          {error && (
            <span className="text-xs text-destructive truncate">{error}</span>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="incoming" className="gap-2">
              <Inbox className="h-4 w-4" />
              Received
              <Badge variant="secondary" className="ml-1">{incomingSorted.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="gap-2">
              <Send className="h-4 w-4" />
              Sent
              <Badge variant="secondary" className="ml-1">{outgoingSorted.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incoming" className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-[55vh] pr-3">
              {incomingSorted.length === 0 ? (
                <EmptyState
                  label={isLoading ? 'Loading offers\u2026' : 'No pending received offers.'}
                  icon={<Inbox className="h-8 w-8 opacity-60" />}
                />
              ) : (
                <div className="space-y-3">
                  {incomingSorted.map((o) => (
                    <OfferCard
                      key={o.offer_id}
                      offer={o}
                      direction="incoming"
                      isNew={o.created_at_time > lastSeenAtOpen}
                      onAction={onOfferAction}
                      busyAction={busyOfferId === o.offer_id ? busyAction ?? null : null}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="outgoing" className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-[55vh] pr-3">
              {outgoingSorted.length === 0 ? (
                <EmptyState
                  label={isLoading ? 'Loading offers\u2026' : 'No pending sent offers.'}
                  icon={<Send className="h-8 w-8 opacity-60" />}
                />
              ) : (
                <div className="space-y-3">
                  {outgoingSorted.map((o) => (
                    <OfferCard
                      key={o.offer_id}
                      offer={o}
                      direction="outgoing"
                      isNew={false}
                      onAction={onOfferAction}
                      busyAction={busyOfferId === o.offer_id ? busyAction ?? null : null}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
