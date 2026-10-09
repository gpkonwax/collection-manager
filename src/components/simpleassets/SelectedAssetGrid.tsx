import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { getMintLabel } from '@/lib/mintPresentation';
import { isFreshMintId } from '@/lib/freshMints';
import { cn } from '@/lib/utils';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

/**
 * Tiles for cards already picked in the grid (transfer / bridge windows).
 * Artwork is 64px — twice the old chip size — with the original mint number
 * shown on top of each card, the same label the grid ribbon uses.
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
        return (
          <div key={asset.id} className="w-20 shrink-0 rounded-md border border-border/50 bg-muted/40 p-1.5">
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
        );
      })}
    </div>
  );
}
