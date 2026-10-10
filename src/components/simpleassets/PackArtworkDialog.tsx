import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArtworkModeControls, DRAW_COLORS, ImageWithModes } from './InteractiveArtwork';
import type { HandwritingCanvasHandle, ViewMode } from './InteractiveArtwork';
import { Button } from '@/components/ui/button';
import { extractIpfsHash } from '@/lib/ipfsGateways';
import { PACK_ART_SOURCES } from '@/lib/gpkPackMeta';

interface PackArtworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  image?: string;
  source?: 'simpleassets' | 'atomicassets';
  symbol?: string;
  templateId?: string;
  assetId?: string;
  mint?: number;
  imageReference?: string;
  immutableData?: Record<string, string>;
  mutableData?: Record<string, string>;
}

export function PackArtworkDialog({ open, onOpenChange, name, image, source, symbol, templateId, assetId, mint, imageReference, immutableData, mutableData }: PackArtworkDialogProps) {
  const [mode, setMode] = useState<ViewMode>('tilt');
  const [color, setColor] = useState(DRAW_COLORS[0].value);
  const [showRawJson, setShowRawJson] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasHandleRef = useRef<HandwritingCanvasHandle | null>(null);
  const [activeCanvas, setActiveCanvas] = useState<HandwritingCanvasHandle | null>(null);
  const originalUrl = source === 'simpleassets' && symbol ? PACK_ART_SOURCES[symbol] : undefined;
  const reference = source === 'atomicassets' ? imageReference || image : undefined;
  const ipfsPath = reference ? extractIpfsHash(reference) : null;
  const isIpfs = source === 'atomicassets' && !!ipfsPath;

  useEffect(() => {
    if (open) {
      setMode('tilt');
      setColor(DRAW_COLORS[0].value);
      setShowRawJson(false);
    }
  }, [open, image]);

  useEffect(() => {
    canvasHandleRef.current?.setColor(color);
  }, [color, mode]);

  const clear = () => {
    canvasHandleRef.current?.clear();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,520px)] max-w-none max-h-[94dvh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-cheese pr-6">{name}</DialogTitle>
          <DialogDescription className="sr-only">Enlarged pack artwork</DialogDescription>
        </DialogHeader>
        <div className="w-full max-w-[400px] mx-auto" style={{ width: 'min(100%, 65dvh)' }}>
          {image && image !== '/placeholder.svg' ? (
            <ImageWithModes key={image + String(open)} url={image} alt={name} isLandscape={false} mode={mode}
              canvasRegister={(canvas, handle) => {
                canvasRef.current = canvas;
                canvasHandleRef.current = handle ?? null;
                setActiveCanvas(handle ?? null);
                handle?.setColor(color);
              }} />
          ) : <div className="aspect-[3/4] bg-muted/30 flex items-center justify-center text-muted-foreground">Artwork unavailable</div>}
        </div>
        <ArtworkModeControls mode={mode} onModeChange={setMode} color={color} onColorChange={setColor} onClear={clear} activeCanvas={activeCanvas} subject="pack" />
        <div className="border-t border-border pt-3 space-y-2 text-xs">
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
            <span>{source === 'atomicassets' ? 'AtomicAssets' : 'SimpleAssets'}</span>
            {symbol && <span>· packs.topps · {symbol}</span>}
            {templateId && <span>· Template #{templateId}</span>}
            {assetId && <span>· Asset #{assetId}</span>}
            {mint != null && mint > 0 && <span>· Mint #{mint}</span>}
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-cheese">Artwork source</p>
            {isIpfs ? (
              <>
                <p className="text-foreground">IPFS ({immutableData || mutableData ? 'on-chain pack image reference' : 'catalog pack image reference'})</p>
                <p className="text-muted-foreground break-all font-mono" aria-label="IPFS image path">{ipfsPath}</p>
              </>
            ) : originalUrl ? (
              <>
                <p className="text-foreground">Official Topps pack render · locally bundled from IPFS</p>
                <p className="text-muted-foreground break-all">{originalUrl}</p>
              </>
            ) : (
              <p className="text-foreground break-all">{reference ? `Image reference: ${reference}` : 'Source unavailable'}</p>
            )}
          </div>
          {source === 'atomicassets' && (immutableData || mutableData) && (
            <div className="border-t border-border pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowRawJson(v => !v)}>{showRawJson ? 'Hide' : 'Show'} Raw JSON</Button>
              {showRawJson && <div className="space-y-2 mt-2">
                <div><p className="font-semibold text-cheese mb-1">immutable_data</p><pre className="bg-muted/30 p-3 overflow-x-auto text-foreground">{JSON.stringify(immutableData || {}, null, 2)}</pre></div>
                <div><p className="font-semibold text-cheese mb-1">data</p><pre className="bg-muted/30 p-3 overflow-x-auto text-foreground">{JSON.stringify(mutableData || {}, null, 2)}</pre></div>
              </div>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
