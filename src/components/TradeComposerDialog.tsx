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
import { useSimpleAssets } from '@/hooks/useSimpleAssets';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';
import type { Session } from '@wharfkit/session';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import type { TradeProtocol } from '@/lib/atomicOffers';
import {
  buildCreateOfferAction, buildCounterOfferActions,
  validateOffer, MAX_ASSETS_PER_SIDE, MAX_MEMO_LENGTH,
} from '@/lib/atomicTradeActions';
import {
  buildSaSwapActions, validateSaOffer, SA_MAX_ASSETS_PER_SIDE,
} from '@/lib/saTradeActions';
import type { PackEntry } from '@/lib/saTradeActions';
import { useGpkPacks } from '@/hooks/useGpkPacks';
import type { GpkPack } from '@/hooks/useGpkPacks';
import { packImage } from '@/lib/gpkPackMeta';
import { hideProposalLocally, rememberProposal } from '@/lib/saOffers';
import { getAccountResources, describeResourceProblem } from '@/lib/accountResources';

import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VariantFilterPopover } from '@/components/simpleassets/VariantFilterPopover';
import {
  CATEGORY_LABELS, PACKS_CATEGORY, deriveVariantOptions, getVariantsForCategory, variantDisplayLabel,
  isPacksCategory, normalizeAssetCategory,
} from '@/lib/gpkCategories';
import { getGpkVariantRank } from '@/lib/gpkVariant';
import atomicAssetsLogo from '@/assets/atomicassets-logo.png';
import simpleAssetsLogo from '@/assets/simpleassets-logo.png';



interface TradeComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** My wallet account (the signer). */
  me: string | null;
  /** The other party's wallet account. */
  counterparty: string | null;
  session: Session | null;
  /** Pre-selected asset IDs on the "They send back" side (e.g. clicked from card). */
  initialTheirAssetIds?: string[];
  /** SimpleAssets pack quantities preselected on the counterparty side. */
  initialTheirPackQty?: Record<string, number>;
  /** SimpleAssets pack quantities preselected on your side. */
  initialMyPackQty?: Record<string, number>;
  /** Pre-selected asset IDs on the "You send" side. */
  initialMyAssetIds?: string[];
  /** When set, this is a counter-offer: decline this offer + create a new one atomically. */
  counterOfferId?: string | null;
  /** Which contract this trade runs on. Trades are never mixed across protocols. */
  protocol?: TradeProtocol;
  /** SimpleAssets counter-offer target (the msig proposal being replaced). */
  counterProposal?: { proposer: string; name: string } | null;
  /** Whether I had already approved the SimpleAssets proposal being countered. */
  counterApproved?: boolean;
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
  mint: string;
}

/** Bridged SimpleAssets schemas: their AA sequence is not the real GPK mint. */
const BRIDGED_SCHEMAS = new Set(['series1', 'series2', 'exotic']);

/** Mint ribbon text: real mint for native SA / native AA, placeholder for bridged AA. */
function mintDisplayFor(category: string, mint: string, protocol: TradeProtocol): string {
  if (protocol === 'atomicassets' && BRIDGED_SCHEMAS.has((category || '').toLowerCase())) return '#--';
  return mint && mint.trim() !== '' ? `#${mint}` : '#--';
}

/** Human label for a variant within its category. */
function variantLabelFor(category: string, quality: string): string {
  const raw = (quality || '').trim();
  if (!raw) return '';
  const cat = normalizeAssetCategory((category || '').toLowerCase());
  return getVariantsForCategory(cat).find((v) => v.value === raw)?.label
    ?? variantDisplayLabel(raw);
}

/** Protocol logo used in the grid, sized up for the trade header. */
function ProtocolLogo({ protocol, className }: { protocol: TradeProtocol; className?: string }) {
  const isAtomic = protocol === 'atomicassets';
  return (
    <img
      src={isAtomic ? atomicAssetsLogo : simpleAssetsLogo}
      alt={isAtomic ? 'AtomicAssets' : 'SimpleAssets'}
      title={isAtomic ? 'AtomicAssets' : 'SimpleAssets'}
      className={cn(
        'inline-block rounded-full object-contain shrink-0',
        !isAtomic && 'bg-white p-[1px]',
        className,
      )}
    />
  );
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
    mint: String((a.idata as Record<string, unknown>)?.mint ?? ''),
  };
}



export interface PackOption {
  symbol: string;
  label: string;
  image?: string;
  /** How many of this pack the wallet holds. */
  available: number;
}

function AssetPicker({
  title, subtitle, assets, isLoading, selectedIds, onToggle, emptyLabel, protocol, maxPerSide,
  packOptions = [], packQty = {}, onPackQty, defaultPacksCategory = false,
}: {
  title: string;
  subtitle: string;
  assets: PickerAsset[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  emptyLabel: string;
  protocol: TradeProtocol;
  maxPerSide: number;
  /** SimpleAssets pack tokens available on this side (quantity picker). */
  packOptions?: PackOption[];
  packQty?: Record<string, number>;
  onPackQty?: (symbol: string, qty: number) => void;
  /** Open this side already switched to the Packs category. */
  defaultPacksCategory?: boolean;
}) {

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(defaultPacksCategory ? PACKS_CATEGORY : 'all');
  const [variants, setVariants] = useState<string[]>(['all']);
  const [sort, setSort] = useState<'natural' | 'name' | 'variant'>('natural');

  // Only offer categories that actually exist in this wallet.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      const c = normalizeAssetCategory(a.category);
      if (c) set.add(c);
    }
    if (packOptions.length > 0) set.add(PACKS_CATEGORY);
    return Array.from(set).sort((x, y) =>
      (CATEGORY_LABELS[x] || x).localeCompare(CATEGORY_LABELS[y] || y));
  }, [assets, packOptions.length]);

  /** Variants actually present in this picker for the selected category. */
  const variantOptions = useMemo(() => {
    if (category === 'all' || category === PACKS_CATEGORY) return [];
    const values = new Set<string>();
    for (const a of assets) {
      if (normalizeAssetCategory(a.category) !== category) continue;
      const v = (a.quality || '').toLowerCase();
      if (v) values.add(v);
    }
    return deriveVariantOptions(category, values);
  }, [assets, category]);

  const showVariants = hasVariants(category) || variantOptions.length > 1;
  const filtersActive = query.trim() !== '' || category !== 'all' || !variants.includes('all');
  /** SimpleAssets packs are token balances, so they get a quantity picker. */
  const showPackQuantities = category === PACKS_CATEGORY && packOptions.length > 0;

  const clearFilters = () => { setQuery(''); setCategory('all'); setVariants(['all']); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = assets.filter((a) => {
      // Packs stay out of the way until the Packs category is picked.
      if (category === 'all' && isPacksCategory(a.category)) return false;
      if (category !== 'all' && normalizeAssetCategory(a.category) !== category) return false;
      if (showVariants && !variants.includes('all')
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

  const selectedPacks = useMemo(
    () => packOptions.filter((p) => (packQty[p.symbol] || 0) > 0), [packOptions, packQty]);

  const totalSelected = selectedIds.size + selectedPacks.reduce((n, p) => n + (packQty[p.symbol] || 0), 0);

  return (
    <div className="flex flex-col min-h-0 rounded-lg border border-cheese/30 theme-bright-border bg-background/40 theme-bright-fill p-2 gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-cheese theme-bright-text">{title}</div>
          <div className="text-[11px] text-muted-foreground theme-bright-text-muted">{subtitle}</div>
        </div>
        <Badge variant="outline" className="border-cheese/50 text-cheese theme-bright-border theme-bright-text">
          {totalSelected}/{maxPerSide}
        </Badge>
      </div>
      <Input
        placeholder="Search name, cardid, id…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8 text-xs border-cheese/40 theme-bright-border theme-bright-fill"
      />
      <div className="flex flex-wrap gap-1.5">
        <Select value={category} onValueChange={(v) => { setCategory(v); setVariants(['all']); }}>
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
            variants={variantOptions}
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
      {selectedPacks.length > 0 && (
        <div className="rounded-md border border-cheese/25 theme-bright-border p-1.5 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-cheese/80 theme-bright-text">
            Selected packs ({selectedPacks.length})
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {selectedPacks.map((p) => (
              <div
                key={`selpack-${p.symbol}`}
                className="relative w-16 shrink-0 rounded-md border border-cheese/40 theme-bright-border bg-background/60 theme-bright-fill p-1"
                title={`${packQty[p.symbol]} × ${p.label} (${p.symbol})`}
              >
                <div className="w-full flex justify-center">
                  <span className="text-[8px] font-bold px-1 py-px rounded-full bg-background/80 text-cheese border border-border/40 theme-bright-text theme-bright-border">
                    {packQty[p.symbol]}x
                  </span>
                </div>
                <div className="aspect-square w-full overflow-hidden rounded bg-black/40 mt-0.5">
                  {p.image
                    ? <img src={p.image} alt={p.label} className="w-full h-full object-contain" />
                    : <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">{p.symbol}</div>}
                </div>
                <div className="text-[9px] leading-tight truncate text-foreground theme-bright-text mt-0.5">{p.label}</div>
                <div className="text-[8px] leading-tight truncate text-muted-foreground theme-bright-text-muted">Pack</div>
                <button
                  type="button"
                  onClick={() => onPackQty?.(p.symbol, 0)}
                  title={`Remove ${p.label} from this side`}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-cheese text-cheese-foreground flex items-center justify-center shadow hover:opacity-80"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>

        </div>
      )}

      {selectedAssets.length > 0 && (
        <div className="rounded-md border border-cheese/25 theme-bright-border p-1.5 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-cheese/80 theme-bright-text">
            Selected ({selectedAssets.length})
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {selectedAssets.map((a) => {
              const mintDisplay = mintDisplayFor(a.category, a.mint, protocol);
              const catKey = normalizeAssetCategory((a.category || '').toLowerCase());
              const categoryLabel = CATEGORY_LABELS[catKey] || a.category || '';
              const variantLabel = variantLabelFor(a.category, a.quality);
              return (
                <div
                  key={`sel-${a.id}`}
                  className="relative w-16 shrink-0 rounded-md border border-cheese/40 theme-bright-border bg-background/60 theme-bright-fill p-1"
                  title={`${a.name} · #${a.id}${categoryLabel ? ` · ${categoryLabel}` : ''}${variantLabel ? ` · ${variantLabel}` : ''} · mint ${mintDisplay}`}
                >
                  <div
                    className="w-full flex justify-center"
                    title="Mint number (placeholder — real mint will populate when available)"
                  >
                    <span className="text-[8px] font-bold px-1 py-px rounded-full bg-background/80 text-cheese border border-border/40 theme-bright-text theme-bright-border">
                      {mintDisplay}
                    </span>
                  </div>
                  <div className="aspect-square w-full overflow-hidden rounded bg-black/40 mt-0.5">
                    <IpfsMedia url={a.image} alt={a.name} className="w-full h-full object-contain" context="card" />
                  </div>
                  <div className="text-[9px] leading-tight truncate text-foreground theme-bright-text mt-0.5">{a.name}</div>
                  {(a.cardid || variantLabel) && (
                    <div className="text-[8px] leading-tight truncate font-semibold text-cheese theme-bright-text">
                      {[`${a.cardid}${a.side}`.trim(), variantLabel].filter(Boolean).join(' ')}
                    </div>
                  )}
                  {categoryLabel && (
                    <div className="text-[8px] leading-tight truncate text-muted-foreground theme-bright-text-muted">
                      {categoryLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggle(a.id)}
                    title={`Remove ${a.name} from this side`}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-cheese text-cheese-foreground flex items-center justify-center shadow hover:opacity-80"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}


      <ScrollArea className="h-[42vh] pr-2">
        {showPackQuantities ? (
          <div className="grid grid-cols-3 gap-2">
            {packOptions.map((p) => {
              const qty = packQty[p.symbol] || 0;
              const canAdd = qty < p.available;
              return (
                <div
                  key={p.symbol}
                  className={cn(
                    'rounded-md border p-1.5 bg-background/60 theme-bright-fill',
                    qty > 0
                      ? 'border-cheese ring-2 ring-cheese/70'
                      : 'border-cheese/25 theme-bright-border',
                  )}
                  title={`${p.label} (${p.symbol}) — ${p.available} owned`}
                >
                  <div className="aspect-square w-full overflow-hidden rounded bg-black/40">
                    {p.image
                      ? <img src={p.image} alt={p.label} className="w-full h-full object-contain" />
                      : <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">{p.symbol}</div>}
                  </div>

                  <div className="text-[10px] mt-1 truncate text-foreground theme-bright-text">{p.label}</div>
                  <div className="text-[9px] text-muted-foreground theme-bright-text-muted">
                    {p.available} owned
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      disabled={qty <= 0}
                      onClick={() => onPackQty?.(p.symbol, Math.max(0, qty - 1))}
                      className="h-6 w-6 rounded border border-cheese/40 theme-bright-border text-cheese theme-bright-text disabled:opacity-30"
                      title="Remove one"
                    >
                      −
                    </button>
                    <span className="text-xs font-semibold text-cheese theme-bright-text">{qty}</span>
                    <button
                      type="button"
                      disabled={!canAdd}
                      onClick={() => onPackQty?.(p.symbol, qty + 1)}
                      className="h-6 w-6 rounded border border-cheese/40 theme-bright-border text-cheese theme-bright-text disabled:opacity-30"
                      title="Add one"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : isLoading ? (
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
              const capReached = !selected && selectedIds.size >= maxPerSide;
              const mintDisplay = mintDisplayFor(a.category, a.mint, protocol);
              const catKey = normalizeAssetCategory((a.category || '').toLowerCase());
              const categoryLabel = CATEGORY_LABELS[catKey] || a.category || '';
              const variantLabel = variantLabelFor(a.category, a.quality);

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
                  title={`${a.name} · #${a.id}${categoryLabel ? ` · ${categoryLabel}` : ''}${variantLabel ? ` · ${variantLabel}` : ''} · mint ${mintDisplay}`}
                >
                  <div
                    className="w-full flex justify-center mb-1"
                    title="Mint number (placeholder — real mint will populate when available)"
                  >
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-background/80 text-cheese border border-border/40 theme-bright-text theme-bright-border">
                      {mintDisplay}
                    </span>
                  </div>
                  <div className="aspect-square w-full overflow-hidden rounded bg-black/40">
                    <IpfsMedia url={a.image} alt={a.name} className="w-full h-full object-contain" context="card" />
                  </div>
                  <div className="text-[10px] mt-1 truncate text-foreground theme-bright-text">{a.name}</div>
                  {(a.cardid || variantLabel) && (
                    <div className="text-[9px] leading-tight truncate font-semibold text-cheese theme-bright-text">
                      {[`${a.cardid}${a.side}`.trim(), variantLabel].filter(Boolean).join(' ')}
                    </div>
                  )}
                  {categoryLabel && (
                    <div className="text-[9px] leading-tight truncate text-muted-foreground theme-bright-text-muted">
                      {categoryLabel}
                    </div>
                  )}
                  <div className="text-[9px] text-muted-foreground theme-bright-text-muted truncate">
                    #{a.id}
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
  initialTheirAssetIds, initialMyAssetIds, initialTheirPackQty, initialMyPackQty, counterOfferId,
  protocol = 'atomicassets', counterProposal, counterApproved = false, onSuccess,
}: TradeComposerDialogProps) {
  const { toast } = useToast();
  const { executeTransaction } = useWaxTransaction(session);
  const isAtomic = protocol === 'atomicassets';
  const isCounter = Boolean(counterOfferId);
  const maxPerSide = isAtomic ? MAX_ASSETS_PER_SIDE : SA_MAX_ASSETS_PER_SIDE;
  const protocolLabel = isAtomic ? 'AtomicAssets' : 'SimpleAssets';

  // Load assets for both accounts while the composer is open — only for the
  // protocol this trade is locked to, so the two can never be mixed.
  const aaMe = open && isAtomic ? me : null;
  const aaThem = open && isAtomic ? counterparty : null;
  const saMe = open && !isAtomic ? me : null;
  const saThem = open && !isAtomic ? counterparty : null;
  const { assets: aaMyAssets, isLoading: aaMyLoading } = useGpkAtomicAssets(aaMe);
  const { assets: aaTheirAssets, isLoading: aaTheirLoading } = useGpkAtomicAssets(aaThem);
  const { assets: saMyAssets, isLoading: saMyLoading } = useSimpleAssets(saMe);
  const { assets: saTheirAssets, isLoading: saTheirLoading } = useSimpleAssets(saThem);

  const myAssets = isAtomic ? aaMyAssets : saMyAssets;
  const theirAssets = isAtomic ? aaTheirAssets : saTheirAssets;
  const myLoading = isAtomic ? aaMyLoading : saMyLoading;
  const theirLoading = isAtomic ? aaTheirLoading : saTheirLoading;

  // SimpleAssets packs are fungible packs.topps balances, not NFTs.
  const { packs: saMyPacks } = useGpkPacks(saMe);
  const { packs: saTheirPacks } = useGpkPacks(saThem);

  const toPackOptions = (packs: GpkPack[]): PackOption[] => packs
    .filter((p) => p.amount > 0)
    .map((p) => ({
      symbol: p.symbol,
      label: p.label,
      image: packImage(p.symbol),
      available: Math.floor(p.amount),
    }));

  const myPackOptions = useMemo(
    () => (isAtomic ? [] : toPackOptions(saMyPacks)), [isAtomic, saMyPacks]);
  const theirPackOptions = useMemo(
    () => (isAtomic ? [] : toPackOptions(saTheirPacks)), [isAtomic, saTheirPacks]);

  const myPicker = useMemo(
    () => myAssets.filter((a) => a.source === protocol).map(toPicker), [myAssets, protocol]);
  const theirPicker = useMemo(
    () => theirAssets.filter((a) => a.source === protocol).map(toPicker), [theirAssets, protocol]);

  const [mySelected, setMySelected] = useState<Set<string>>(new Set());
  const [theirSelected, setTheirSelected] = useState<Set<string>>(new Set());
  const [myPackQty, setMyPackQty] = useState<Record<string, number>>({});
  const [theirPackQty, setTheirPackQty] = useState<Record<string, number>>({});
  const [memo, setMemo] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successTxId, setSuccessTxId] = useState<string | null>(null);

  // Reset state whenever the dialog is (re)opened with fresh props.
  useEffect(() => {
    if (!open) return;
    setMySelected(new Set(initialMyAssetIds || []));
    setTheirSelected(new Set(initialTheirAssetIds || []));
    setMyPackQty({ ...(initialMyPackQty || {}) });
    setTheirPackQty({ ...(initialTheirPackQty || {}) });
    setMemo('');
    setSubmitting(false);
    setSuccessOpen(false);
    setSuccessTxId(null);
  }, [open, initialMyAssetIds, initialTheirAssetIds, initialMyPackQty, initialTheirPackQty]);

  const toggleMine  = (id: string) => setMySelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTheirs = (id: string) => setTheirSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const setPackQty = (
    setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  ) => (symbol: string, qty: number) => setter((prev) => {
    const next = { ...prev };
    if (qty > 0) next[symbol] = qty; else delete next[symbol];
    return next;
  });

  const toPackEntries = (qty: Record<string, number>): PackEntry[] =>
    Object.entries(qty)
      .filter(([, amount]) => amount > 0)
      .map(([symbol, amount]) => ({ symbol, amount, precision: 0 }));

  const myPackEntries = useMemo(() => toPackEntries(myPackQty), [myPackQty]);
  const theirPackEntries = useMemo(() => toPackEntries(theirPackQty), [theirPackQty]);

  const validation = useMemo(() => {
    if (!me || !counterparty) return { ok: false, reason: 'Wallet not ready' };
    const mine = Array.from(mySelected);
    const theirs = Array.from(theirSelected);
    return isAtomic
      ? validateOffer(me, counterparty, mine, theirs)
      : validateSaOffer(me, counterparty, mine, theirs, myPackEntries, theirPackEntries);
  }, [me, counterparty, mySelected, theirSelected, isAtomic, myPackEntries, theirPackEntries]);


  const handleSubmit = async () => {
    if (!me || !counterparty || !session) return;
    if (!validation.ok) {
      toast({ title: 'Cannot send offer', description: validation.reason, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const problem = describeResourceProblem(await getAccountResources(me));
      if (problem) {
        toast({ title: 'Account resources too low', description: problem, variant: 'destructive' });
        return;
      }

      const senderAssetIds = Array.from(mySelected);
      const recipientAssetIds = Array.from(theirSelected);

      let actions;
      let proposalName: string | null = null;

      if (isAtomic) {
        actions = isCounter && counterOfferId
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
      } else {
        const bundle = await buildSaSwapActions({
          me,
          counterparty,
          myAssetIds: senderAssetIds,
          theirAssetIds: recipientAssetIds,
          myPacks: myPackEntries,
          theirPacks: theirPackEntries,
          memo,
          counterProposal: counterProposal ?? null,
          counterApproved,
        });
        actions = bundle.actions;
        proposalName = bundle.proposalName;
      }

      const result = await executeTransaction(actions, {
        successTitle: isCounter ? 'Counter-offer sent' : 'Trade offer sent',
        successDescription: isCounter
          ? `Declined the original offer and sent a new one to ${counterparty}.`
          : `Offer sent to ${counterparty}. They can accept it in their Trades tab.`,
        errorTitle: 'Trade failed',
      });

      if (result.success) {
        if (!isAtomic && proposalName) {
          rememberProposal(me, { proposer: me, name: proposalName, createdAt: Date.now() });
          if (counterProposal) hideProposalLocally(me, counterProposal.proposer, counterProposal.name);
        }
        setSuccessTxId(result.txId ?? null);
        setSuccessOpen(true);
        onSuccess?.(result.txId);
      }
    } catch (err) {
      toast({
        title: 'Trade failed',
        description: (err as Error).message || 'Could not build the swap proposal.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };


  const handleSuccessClose = () => {
    setSuccessOpen(false);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-cheese theme-bright-text flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            {isCounter ? 'Counter-offer' : 'Propose a trade'}
            <Badge
              variant="outline"
              className={cn(
                'gap-1 px-2 py-1 text-[10px] uppercase tracking-wide',
                isAtomic
                  ? 'border-cheese/60 text-cheese theme-bright-border theme-bright-text'
                  : 'border-emerald-500/60 text-emerald-400',
              )}
            >
              <ProtocolLogo protocol={protocol} className="h-5 w-5" />
              ↔
              <ProtocolLogo protocol={protocol} className="h-5 w-5" />
            </Badge>
          </DialogTitle>
          <DialogDescription className="theme-bright-text-muted">
            Cards and packs, <ProtocolLogo protocol={protocol} className="h-5 w-5 align-text-bottom" /> only, between{' '}
            <span className="text-cheese theme-bright-text font-medium">{me || '—'}</span>{' '}
            and{' '}
            <span className="text-cheese theme-bright-text font-medium">{counterparty || '—'}</span>.
            {' '}Mixed-contract trades are not supported, so only <ProtocolLogo protocol={protocol} className="h-5 w-5 align-text-bottom" /> items are shown. Pick the "Packs" category to trade unopened packs.
            {isCounter && (
              <> This will <span className="text-destructive font-medium">decline the original offer</span> and send a fresh one in a single transaction.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2 flex-1 min-h-0">
          <AssetPicker
            title="You send"
            subtitle={`Pick cards or packs from your ${protocolLabel}`}
            assets={myPicker}
            isLoading={myLoading}
            selectedIds={mySelected}
            onToggle={toggleMine}
            emptyLabel={`You have no ${protocolLabel} cards to offer.`}
            protocol={protocol}
            maxPerSide={maxPerSide}
            packOptions={myPackOptions}
            packQty={myPackQty}
            defaultPacksCategory={Object.keys(initialMyPackQty || {}).length > 0}
            onPackQty={setPackQty(setMyPackQty)}
          />
          <AssetPicker
            title="They send back"
            subtitle={`Pick cards or packs from ${counterparty || 'their'} ${protocolLabel}`}
            assets={theirPicker}
            isLoading={theirLoading}
            selectedIds={theirSelected}
            onToggle={toggleTheirs}
            emptyLabel={`No ${protocolLabel} cards found in that wallet.`}
            protocol={protocol}
            maxPerSide={maxPerSide}
            packOptions={theirPackOptions}
            packQty={theirPackQty}
            defaultPacksCategory={Object.keys(initialTheirPackQty || {}).length > 0}
            onPackQty={setPackQty(setTheirPackQty)}
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
            {isAtomic ? (
              <>Cards and packs only — no WAX or tokens are exchanged. AtomicAssets contract: <span className="font-mono">createoffer</span>.</>
            ) : (
              <>Cards and packs only. SimpleAssets has no escrow, so every transfer is wrapped in a single
                {' '}<span className="font-mono">eosio.msig</span> proposal that can only execute once both of you approve.
                It stays valid for 7 days and costs nothing but CPU/NET.</>
            )}
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

    <TransactionSuccessDialog
      open={successOpen}
      onOpenChange={handleSuccessClose}
      title={isCounter ? 'Counter-offer sent!' : 'Trade offer sent!'}
      description={isCounter
        ? `You declined the original offer and sent a fresh counter-offer to ${counterparty || 'the other trader'}.`
        : `Your trade offer was successfully sent to ${counterparty || 'the other trader'}. They can review and accept it in their Trades tab.`}
      txId={successTxId}
    />
    </>
  );
}
