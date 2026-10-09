import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { IpfsMedia } from './IpfsMedia';

export type PackPickerTarget =
  | { kind: 'token'; symbol: string; label: string; image?: string; max: number; current: number }
  | { kind: 'atomic'; templateId: string; name: string; image: string; assetIds: string[]; mints: number[]; current: Set<string> };

interface PackSelectDialogProps {
  target: PackPickerTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirmToken: (symbol: string, qty: number) => void;
  onConfirmAtomic: (templateId: string, ids: Set<string>) => void;
}

/**
 * Chooser for packs the user owns 2+ of.
 * Token packs (packs.topps) are interchangeable, so the user picks a quantity.
 * AtomicAssets packs are individual NFTs, so the user picks exact mints.
 */
export function PackSelectDialog({ target, onOpenChange, onConfirmToken, onConfirmAtomic }: PackSelectDialogProps) {
  const [qty, setQty] = useState(0);
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'token') setQty(target.current);
    else setIds(new Set(target.current));
  }, [target]);

  const confirm = () => {
    if (!target) return;
    if (target.kind === 'token') onConfirmToken(target.symbol, qty);
    else onConfirmAtomic(target.templateId, ids);
    onOpenChange(false);
  };

  const title = target ? (target.kind === 'token' ? target.label : target.name) : '';

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] w-[calc(100%-2rem)] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select {title} to send</DialogTitle>
          <DialogDescription>
            {target?.kind === 'token'
              ? 'These packs are tokens, so choose how many to send.'
              : 'Each of these packs is its own NFT, so choose exactly which ones to send.'}
          </DialogDescription>
        </DialogHeader>

        {target?.kind === 'token' && (
          <div className="flex items-center gap-4">
            {target.image ? <img src={target.image} alt={target.label} className="h-20 w-auto rounded" /> : <span className="text-3xl">📦</span>}
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Available: {target.max}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={qty <= 0} onClick={() => setQty(q => Math.max(0, q - 1))} aria-label="Fewer">−</Button>
                <span className="w-10 text-center font-mono text-foreground" data-testid="pack-qty">{qty}</span>
                <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={qty >= target.max} onClick={() => setQty(q => Math.min(target.max, q + 1))} aria-label="More">+</Button>
                <Button size="sm" variant="ghost" onClick={() => setQty(target.max)}>All</Button>
              </div>
            </div>
          </div>
        )}

        {target?.kind === 'atomic' && (
          <>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={ids.size === target.assetIds.length && target.assetIds.length > 0}
                onCheckedChange={(c) => setIds(c ? new Set(target.assetIds) : new Set())}
              />
              Select all ({target.assetIds.length})
            </label>
            <ScrollArea className="min-h-0 flex-1 rounded border border-border">
              <div className="grid grid-cols-3 gap-2 p-2 sm:grid-cols-4">
                {target.assetIds.map((id, i) => {
                  const on = ids.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
                      className={`rounded border p-1 text-center ${on ? 'border-cheese ring-2 ring-cheese' : 'border-border'}`}
                    >
                      <IpfsMedia url={target.image} alt={target.name} className="w-full aspect-[3/4] rounded" />
                      <span className="mt-1 block text-xs font-mono text-cheese">{target.mints[i] ? `#${target.mints[i]}` : id}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <Button onClick={confirm} className="w-full bg-cheese hover:bg-cheese/90 text-primary-foreground">
          Done ({target?.kind === 'token' ? qty : ids.size} selected)
        </Button>
      </DialogContent>
    </Dialog>
  );
}
