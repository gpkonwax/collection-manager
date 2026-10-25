import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import { Search, RefreshCw, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { VariantFilterPopover } from '@/components/simpleassets/VariantFilterPopover';
import { CATEGORY_LABELS } from '@/lib/gpkCategories';
import { getCollectionHistory } from '@/lib/collectionHistory';

export type FilterSortMode = 'natural' | 'name' | 'variant' | 'newest' | 'mint';
type VariantOptions = NonNullable<ComponentProps<typeof VariantFilterPopover>['variants']>;

// Search / source / sort / category / variant / 1985-scan bar above the
// collection grid. Moved out of pages/Index.tsx unchanged; state stays there.
export function CollectionFilterBar(props: {
  search: string;
  setSearch: (v: string) => void;
  sourceFilter: string;
  setSourceFilter: (v: string) => void;
  viewMode: 'classic' | 'binder' | 'saved';
  sortMode: FilterSortMode;
  setSortMode: (v: FilterSortMode) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  setVariantFilter: (v: string[]) => void;
  categories: string[];
  categoryCounts: Map<string, number>;
  onOpenCollectionHistory: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  variantFilterActive: boolean;
  categoryVariantOptions: VariantOptions;
  variantCounts: Map<string, number>;
  variantFilter: string[];
  retroEligible: boolean;
  retroOn: boolean;
  setRetroOn: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    search, setSearch, sourceFilter, setSourceFilter, viewMode, sortMode, setSortMode,
    categoryFilter, setCategoryFilter, setVariantFilter, categories, categoryCounts,
    onOpenCollectionHistory, onRefresh, isRefreshing, variantFilterActive,
    categoryVariantOptions, variantCounts, variantFilter, retroEligible, retroOn, setRetroOn,
  } = props;
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cheese theme-bright-text" />
        <Input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-cheese/50 text-cheese placeholder:text-cheese/50 theme-bright-border theme-bright-text theme-bright-placeholder theme-bright-fill" />
      </div>
      <Select value={sourceFilter} onValueChange={setSourceFilter}>
        <SelectTrigger className="w-full sm:w-[150px] border-cheese/50 text-cheese theme-bright-border theme-bright-text theme-bright-fill"><SelectValue placeholder="Source" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="simpleassets">Simple Assets</SelectItem>
          <SelectItem value="atomicassets">Atomic Assets</SelectItem>
        </SelectContent>
      </Select>
      {viewMode === 'classic' && (
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as FilterSortMode)}>
          <SelectTrigger
            className="w-full sm:w-[180px] border-cheese/50 text-cheese theme-bright-border theme-bright-text theme-bright-fill"

            title="Recently received: AtomicAssets use real transfer time. SimpleAssets fall back to asset ID (mint order) — no on-chain receipt time exists for SA."
          >
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="natural">Natural (Card ID)</SelectItem>
            <SelectItem value="newest">Recently received</SelectItem>
            <SelectItem value="mint">Mint Number (Low → High)</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="variant">Variant Rarity</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setVariantFilter(['all']); }}>
        <SelectTrigger className="w-full sm:w-[180px] border-cheese/50 text-cheese theme-bright-border theme-bright-text theme-bright-fill"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent className="max-h-none overflow-visible">
          <SelectItem value="all">All Categories ({categoryCounts.get('all') ?? 0})</SelectItem>
          {categories.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c} ({categoryCounts.get(c) ?? 0})</SelectItem>)}
        </SelectContent>
      </Select>
      {getCollectionHistory(categoryFilter) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenCollectionHistory}
          className="text-cheese hover:text-cheese/80 theme-bright-text theme-bright-hover-text"
          title={`About ${CATEGORY_LABELS[categoryFilter] || categoryFilter}`}
          aria-label={`About ${CATEGORY_LABELS[categoryFilter] || categoryFilter}`}
        >
          <Info className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        className="text-cheese hover:text-cheese/80 theme-bright-text theme-bright-hover-text"
        title="Refresh category"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
      {variantFilterActive && (
        <VariantFilterPopover
          category={categoryFilter}
          variants={categoryVariantOptions}
          counts={variantCounts}
          value={variantFilter}
          onChange={setVariantFilter}
          className="w-full sm:w-[180px]"
        />
      )}
      {retroEligible && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={retroOn}
          onClick={() => setRetroOn((v) => !v)}
          title="Show the original 1985 Topps card scans (from geepeekay.com)"
          className={`h-9 ${retroOn ? 'border-cheese bg-cheese/20 text-cheese' : 'border-cheese/40 text-muted-foreground hover:text-cheese'}`}
        >
          📼 1985 Scans{retroOn ? ' · On' : ''}
        </Button>
      )}

    </div>
  );
}
