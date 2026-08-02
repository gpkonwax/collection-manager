import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Check, Loader2, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { useToast } from '@/hooks/use-toast';
import { useGpkAtomicAssets } from '@/hooks/useGpkAtomicAssets';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import type { Session } from '@wharfkit/session';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import {
  buildCreateOfferAction, buildCounterOfferActions,
  validateOffer, MAX_ASSETS_PER_SIDE, MAX_MEMO_LENGTH,
} from '@/lib/atomicTradeActions';
import { cn } from '@/lib/utils';

interface TradeComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** My wallet account (the signer). */
  me: string | null;
  /** The other party's wallet account. */
  counterparty: string | null;
  session: Session | null;
  /** Pre-selected asset IDs on the "They give" side (e.g. clicked from card). */
  initialTheirAssetIds?: string[];
  /** Pre-selected asset IDs on the "You give" side. */
  initialMyAssetIds?: string[];
  /** When set, this is a counter-offer: decline this offer + create a new one atomically. */
  counterOfferId?: string | null;
  /** Fires after a successful trade so parents can refresh state. */
  onSuccess?: (txId: string | null) => void;
}

interface PickerAsset {
  id: string;
  name: string;
  image?: string;
  cardid: string;
  side: string;
  quality: string;
  category: string;
}

function toPicker(a: SimpleAsset): PickerAsset {
  return {
    id: a.id,
    name: a.name,
    image: a.image,
    cardid: a.cardid || '',
    side: a.side || '',
    quality: a.quality || '',
    category: a.category || '',
  };
}

function AssetPicker({
  title, subtitle, assets, isLoading, selectedIds, onToggle, emptyLabel,
}: {
  title: string;
  subtitle: string;
  assets: PickerAsset[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [variants, setVariants] = useState<string[]>(['all']);
  const [sort, setSort] = useState<'natural' | 'name' | 'variant'>('natural');

  // Only offer categories that actually exist in this wallet.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      const c = normalizeAssetCategory(a.category);
      if (c) set.add(c);
    }
    return Array.from(set).sort((x, y) =>
      (CATEGORY_LABELS[x] || x).localeCompare(CATEGORY_LABELS[y] || y));
  }, [assets]);

  const showVariants = hasVariants(category);
  const filtersActive = query.trim() !== '' || category !== 'all' || !variants.includes('all');

  const clearFilters = () => { setQuery(''); setCategory('all'); setVariants(['all']); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = assets.filter((a) => {
      if (category !== 'all' && normalizeAssetCategory(a.category) !== category) return false;
      if (hasVariants(category) && !variants.includes('all')
        && !variants.includes((a.quality || '').toLowerCase())) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.cardid.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.id.includes(q)
      );
    });

    if (sort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sort === 'variant') {
      return [...list].sort((a, b) =>
        getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality) ||
        (parseInt(a.cardid, 10) || 0) - (parseInt(b.cardid, 10) || 0) ||
        a.side.localeCompare(b.side));
    }
    return [...list].sort((a, b) =>
      (parseInt(a.cardid, 10) || 0) - (parseInt(b.cardid, 10) || 0) ||
      a.side.localeCompare(b.side) ||
      getGpkVariantRank(a.quality) - getGpkVariantRank(b.quality));
  }, [assets, query, category, variants, sort]);

  const selectedAssets = useMemo(
    () => assets.filter((a) => selectedIds.has(a.id)), [assets, selectedIds]);

  return (
    <div className="flex flex-col min-h-0 rounded-lg border border-cheese/30 theme-bright-border bg-background/40 theme-bright-fill p-2 gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-cheese theme-bright-text">{title}</div>
          <div className="text-[11px] text-muted-foreground theme-bright-text-muted">{subtitle}</div>
        </div>
        <Badge variant="outline" className="border-cheese/50 text-cheese theme-bright-border theme-bright-text">
          {selectedIds.size}/{MAX_ASSETS_PER_SIDE}
        </Badge>
      </div>
      <Input
        placeholder="Search name, cardid, id…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8 text-xs border-cheese/40 theme-bright-border theme-bright-fill"
      />
      <div className="flex flex-wrap gap-1.5">
        <Select value={category} onValueChange={(v) => { setCategory(v); if (!hasVariants(v)) setVariants(['all']); }}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px] border-cheese/40 text-cheese theme-bright-border theme-bright-text theme-bright-fill">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showVariants && (
          <VariantFilterPopover
            category={category}
            value={variants}
            onChange={setVariants}
            className="h-8 text-xs flex-1 min-w-[120px]"
          />
        )}
        <Select value={sort} onValueChange={(v) => setSort(v as 'natural' | 'name' | 'variant')}>
          <SelectTrigger className="h-8 text-xs flex-1 min-w-[120px] border-cheese/40 text-cheese theme-bright-border theme-bright-text theme-bright-fill">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="natural">Natural (Card ID)</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="variant">Variant Rarity</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground theme-bright-text-muted">
        <span>{filtered.length} shown / {assets.length} owned</span>
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="text-cheese theme-bright-text hover:underline">
            Clear filters
          </button>
        )}
      </div>
      {selectedAssets.length > 0 && (
        <div className="flex flex-wrap gap-1 rounded-md border border-cheese/25 theme-bright-border p-1.5">
          {selectedAssets.map((a) => (
            <button
              type="button"
              key={`sel-${a.id}`}
              onClick={() => onToggle(a.id)}
              title={`Remove ${a.name} from this side`}
              className="flex items-center gap-1 rounded bg-cheese/15 px-1.5 py-0.5 text-[10px] text-cheese theme-bright-text hover:bg-cheese/25"
            >
              <span className="max-w-[90px] truncate">{a.name}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="h-[42vh] pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground theme-bright-text-muted">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground theme-bright-text-muted italic">
            {assets.length === 0 ? emptyLabel : 'No matches.'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((a) => {
              const selected = selectedIds.has(a.id);
              const capReached = !selected && selectedIds.size >= MAX_ASSETS_PER_SIDE;
              return (
                <button
                  type="button"
                  key={a.id}
                  disabled={capReached}
                  onClick={() => onToggle(a.id)}
                  className={cn(
                    'relative text-left rounded-md border p-1.5 transition-all',
                    'bg-background/60 theme-bright-fill',
                    selected
                      ? 'border-cheese ring-2 ring-cheese/70'
                      : 'border-cheese/25 theme-bright-border hover:border-cheese/60',
                    capReached && 'opacity-40 cursor-not-allowed',
                  )}
                  title={`${a.name} · #${a.id}${a.cardid ? ` · ${a.cardid}${a.side}${a.quality ? ' ' + a.quality : ''}` : ''}`}
                >
                  <div className="aspect-square w-full overflow-hidden rounded bg-black/40">
                    <IpfsMedia url={a.image} alt={a.name} className="w-full h-full object-contain" context="card" />
                  </div>
                  <div className="text-[10px] mt-1 truncate text-foreground theme-bright-text">{a.name}</div>
                  <div className="text-[9px] text-muted-foreground theme-bright-text-muted flex items-center justify-between">
                    <span className="truncate">#{a.id}</span>
                    {a.cardid && <span className="shrink-0 ml-1">{a.cardid}{a.side}</span>}
                  </div>
                  {selected && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-cheese text-cheese-foreground flex items-center justify-center shadow">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function TradeComposerDialog({
  open, onOpenChange, me, counterparty, session,
  initialTheirAssetIds, initialMyAssetIds, counterOfferId, onSuccess,
}: TradeComposerDialogProps) {
  const { toast } = useToast();
  const { executeTransaction } = useWaxTransaction(session);
  const isCounter = Boolean(counterOfferId);

  // Load AA assets for both accounts while the composer is open.
  const activeMe = open ? me : null;
  const activeThem = open ? counterparty : null;
  const { assets: myAssets, isLoading: myLoading } = useGpkAtomicAssets(activeMe);
  const { assets: theirAssets, isLoading: theirLoading } = useGpkAtomicAssets(activeThem);

  const myPicker = useMemo(() => myAssets.filter((a) => a.source === 'atomicassets').map(toPicker), [myAssets]);
  const theirPicker = useMemo(() => theirAssets.filter((a) => a.source === 'atomicassets').map(toPicker), [theirAssets]);

  const [mySelected, setMySelected] = useState<Set<string>>(new Set());
  const [theirSelected, setTheirSelected] = useState<Set<string>>(new Set());
  const [memo, setMemo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Reset state whenever the dialog is (re)opened with fresh props.
  useEffect(() => {
    if (!open) return;
    setMySelected(new Set(initialMyAssetIds || []));
    setTheirSelected(new Set(initialTheirAssetIds || []));
    setMemo('');
    setSubmitting(false);
  }, [open, initialMyAssetIds, initialTheirAssetIds]);

  const toggleMine  = (id: string) => setMySelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTheirs = (id: string) => setTheirSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const validation = useMemo(() => {
    if (!me || !counterparty) return { ok: false, reason: 'Wallet not ready' };
    return validateOffer(me, counterparty, Array.from(mySelected), Array.from(theirSelected));
  }, [me, counterparty, mySelected, theirSelected]);

  const handleSubmit = async () => {
    if (!me || !counterparty || !session) return;
    if (!validation.ok) {
      toast({ title: 'Cannot send offer', description: validation.reason, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const senderAssetIds = Array.from(mySelected);
      const recipientAssetIds = Array.from(theirSelected);

      const actions = isCounter && counterOfferId
        ? buildCounterOfferActions({
            originalOfferId: counterOfferId,
            me,
            originalSender: counterparty,
            senderAssetIds,
            recipientAssetIds,
            memo,
          })
        : [buildCreateOfferAction({
            sender: me,
            recipient: counterparty,
            senderAssetIds,
            recipientAssetIds,
            memo,
          })];

      const result = await executeTransaction(actions, {
        successTitle: isCounter ? 'Counter-offer sent' : 'Trade offer sent',
        successDescription: isCounter
          ? `Declined the original offer and sent a new one to ${counterparty}.`
          : `Offer sent to ${counterparty}. They can accept it in their Trades tab.`,
        errorTitle: 'Trade failed',
      });

      if (result.success) {
        onSuccess?.(result.txId);
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-cheese theme-bright-text flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            {isCounter ? 'Counter-offer' : 'Propose a trade'}
          </DialogTitle>
          <DialogDescription className="theme-bright-text-muted">
            Pure card-for-card AtomicAssets trade between{' '}
            <span className="text-cheese theme-bright-text font-medium">{me || '—'}</span>{' '}
            and{' '}
            <span className="text-cheese theme-bright-text font-medium">{counterparty || '—'}</span>.
            {isCounter && (
              <> This will <span className="text-destructive font-medium">decline offer #{counterOfferId}</span> and send a fresh one in a single transaction.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2 flex-1 min-h-0">
          <AssetPicker
            title="They give"
            subtitle={`Pick from ${counterparty || 'their'} AtomicAssets`}
            assets={theirPicker}
            isLoading={theirLoading}
            selectedIds={theirSelected}
            onToggle={toggleTheirs}
            emptyLabel="No AtomicAssets found in that wallet."
          />
          <AssetPicker
            title="You give"
            subtitle={`Pick from your AtomicAssets`}
            assets={myPicker}
            isLoading={myLoading}
            selectedIds={mySelected}
            onToggle={toggleMine}
            emptyLabel="You have no AtomicAssets to offer."
          />
        </div>

        <div className="space-y-2 pt-1">
          <label className="text-xs text-muted-foreground theme-bright-text-muted">Memo (optional, on-chain)</label>
          <Input
            value={memo}
            maxLength={MAX_MEMO_LENGTH}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="e.g. straight swap, thanks!"
            className="h-8 text-sm border-cheese/40 theme-bright-border theme-bright-fill"
          />
          {!validation.ok && (
            <p className="text-xs text-destructive">{validation.reason}</p>
          )}
          <p className="text-[11px] text-muted-foreground theme-bright-text-muted">
            Card-for-card only — no WAX or tokens are exchanged. AtomicAssets contract: <span className="font-mono">createoffer</span>.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !validation.ok || !session}
            className="bg-cheese hover:bg-cheese/90 text-cheese-foreground"
          >
            {submitting
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <ArrowLeftRight className="h-4 w-4 mr-1" />}
            {isCounter ? 'Send counter-offer' : 'Send offer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
