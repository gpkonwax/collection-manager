import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SimpleAssetCard } from '@/components/simpleassets/SimpleAssetCard';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface BinderStackDialogProps {
  assets: SimpleAsset[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAsset: (asset: SimpleAsset) => void;
}

export function BinderStackDialog({ assets, open, onOpenChange, onSelectAsset }: BinderStackDialogProps) {
  if (assets.length === 0) return null;

  const name = assets[0].name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{name}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            You own {assets.length} copies — select one to view details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          {assets.map((asset) => (
            <SimpleAssetCard
              key={asset.id}
              asset={asset}
              onClick={() => onSelectAsset(asset)}
              draggable={false}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
