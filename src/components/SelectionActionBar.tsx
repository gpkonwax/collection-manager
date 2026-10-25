import { ArrowLeftRight, Flame, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getBridgeEligibility } from '@/lib/bridgeActions';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

// Floating bar shown while cards or packs are selected (Transfer / Bridge /
// Burn / Cancel). Moved out of pages/Index.tsx unchanged; state stays there.
export function SelectionActionBar({
  selectionMode, packSelectedCount, selectedCount, selectedAssets,
  onTransfer, onBridge, onBurn, onCancel,
}: {
  selectionMode: boolean;
  packSelectedCount: number;
  selectedCount: number;
  selectedAssets: SimpleAsset[];
  onTransfer: () => void;
  onBridge: () => void;
  onBurn: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      {selectionMode && packSelectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-cheese/50 rounded-lg shadow-2xl px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">{packSelectedCount} pack{packSelectedCount !== 1 ? 's' : ''} selected</span>
          <Button size="sm" className="bg-cheese hover:bg-cheese/90 text-primary-foreground" onClick={onTransfer}>
            <Send className="h-4 w-4 mr-1" />Transfer
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />Cancel
          </Button>
        </div>
      )}

      {selectionMode && selectedCount > 0 && packSelectedCount === 0 && (() => {
        const bridge = getBridgeEligibility(selectedAssets);
        const bridgeButton = (
          <Button
            size="sm"
            variant="outline"
            disabled={!bridge.direction}
            onClick={onBridge}
            className="border-cheese/50 text-cheese hover:bg-cheese/10 disabled:opacity-50"
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" />
            {bridge.direction === 'to-sa' ? 'Bridge to SA' : bridge.direction === 'to-aa' ? 'Bridge to AA' : 'Bridge'}
          </Button>
        );
        return (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-cheese/50 rounded-lg shadow-2xl px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">{selectedCount} selected</span>
            <Button size="sm" className="bg-cheese hover:bg-cheese/90 text-primary-foreground" onClick={onTransfer}>
              <Send className="h-4 w-4 mr-1" />Transfer
            </Button>
            {bridge.direction ? bridgeButton : (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="cursor-not-allowed" aria-label={bridge.reason}>{bridgeButton}</span>
                  </TooltipTrigger>
                  <TooltipContent>{bridge.reason}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button size="sm" variant="destructive" onClick={onBurn}>
              <Flame className="h-4 w-4 mr-1" />Burn
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="h-4 w-4 mr-1" />Cancel
            </Button>
          </div>
        );
      })()}
    </>
  );
}
