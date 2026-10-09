import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { getMintLabel } from '@/lib/mintPresentation';
import { isFreshMintId } from '@/lib/freshMints';
import { CATEGORY_LABELS, normalizeAssetCategory } from '@/lib/gpkCategories';
import { cn } from '@/lib/utils';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

/**
 * Tiles for cards already picked in the grid (transfer / bridge windows).
 * Artwork is 64px — twice the old chip size — with the original mint number
 * shown on top of each card, the same label the grid ribbon uses.
 *
 * Hovering a tile opens the same fields the NFT detail lists under its
 * "Information" heading: NFT ID, Template ID, Collection and Series.
 */
export function SelectedAssetGrid({ assets }: { assets: SimpleAsset[] }) {
  return (
    <div className="flex flex-wrap gap-3 p-1">
      {assets.map((asset) => {
        const mintLabel = getMintLabel(asset);
        const mintSyncing = mintLabel === '#--' && isFreshMintId(asset.id);
        const tooltip = mintSyncing
          ? 'Newly minted — the mint number appears after the next mint backup index tick'
          : `Mint ${mintLabel}`;
        const isAA = asset.source === 'atomicassets';
        const templateId = isAA ? String(asset.idata?._template_id ?? '') : '';
        const seriesLabel = CATEGORY_LABELS[normalizeAssetCategory(asset.category)] ?? asset.category;
        return (
          <HoverCard key={asset.id} openDelay={150} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="w-20 shrink-0 cursor-help rounded-md border border-border/50 bg-muted/40 p-1.5">
                <div className="mb-1 flex justify-center" title={tooltip}>
                  <span
                    className={cn(
                      'max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold',
                      mintSyncing
                        ? 'animate-pulse border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                        : 'border-border/40 bg-background/80 text-cheese',
                    )}
                  >
                    {mintSyncing ? 'Syncing' : mintLabel}
                  </span>
                </div>
                <IpfsMedia
                  url={asset.images?.[0] || asset.image}
                  alt={asset.name}
                  className="h-16 w-16 rounded object-contain"
                  context="card"
                />
                <div className="mt-1 truncate text-center text-[10px] text-muted-foreground">{asset.name}</div>
              </div>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="center" className="w-64 p-3">
              <p className="mb-1 text-sm font-semibold text-cheese">Information</p>
              <div className="space-y-1 text-sm text-foreground">
                <p className="break-all font-mono text-xs">NFT ID: {asset.id}</p>
                {isAA && templateId && (
                  <p className="break-all font-mono text-xs">Template ID: {templateId}</p>
                )}
                <p className="text-xs">Collection: gpk.topps</p>
                <p className="text-xs">Series: {seriesLabel}</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
