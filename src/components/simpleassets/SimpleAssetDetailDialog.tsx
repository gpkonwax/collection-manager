import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageWithModes, ArtworkModeControls, DRAW_COLORS } from './InteractiveArtwork';
import type { ViewMode } from './InteractiveArtwork';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import { getMintLabel, getMintSupplyLines, isBridgedAsset } from '@/lib/mintPresentation';

import atomicAssetsLogo from '@/assets/atomicassets-logo.png';
import simpleAssetsLogo from '@/assets/simpleassets-logo.png';

interface Props {
  asset: SimpleAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MINT_KEYS = ['edition', 'mint', 'serial', 'num', 'mint_num'];
const IMAGE_LABELS = ['Front', 'Back'];
const SERIES1_CATEGORIES = new Set(['five', 'series1']);

export function SimpleAssetDetailDialog({ asset, open, onOpenChange }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [mode, setMode] = useState<ViewMode>('tilt');
  const [unifiedColor, setUnifiedColor] = useState(DRAW_COLORS[0].value);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const assetId = asset?.id;

  useEffect(() => {
    if (assetId) {
      setShowRawJson(false);
      setMode('tilt');
      setUnifiedColor(DRAW_COLORS[0].value);
      canvasRefs.current = [];
    }
  }, [assetId]);

  // Push color changes into any registered canvases without remounting them
  useEffect(() => {
    canvasRefs.current.forEach((canvas) => {
      if (canvas) (canvas as HTMLCanvasElement & { __setColor?: (color: string) => void }).__setColor?.(unifiedColor);
    });
  }, [unifiedColor]);

  if (!asset) return null;

  const images = asset.images;
  const mintLabel = getMintLabel(asset);
  const supplyLines = getMintSupplyLines(asset);
  const isSeries1 = SERIES1_CATEGORIES.has(asset.category);
  const isBridgedAA = isBridgedAsset(asset);
  const metaFields = Object.entries({ ...asset.idata, ...asset.mdata }).filter(
    ([key]) => !['img', 'image', 'icon', 'backimg', 'back', 'img2', 'image2', 'backimage', 'name', ...MINT_KEYS, 'maxsupply', 'max_supply', 'supply', 'bridge_mint', 'bridge_total', '_template_id'].includes(key)
  );
  const hasContainer = asset.container.length > 0;
  const hasContainerf = asset.containerf.length > 0;

  const hasLandscapeBack = isSeries1 && images.length > 1;
  const modalMaxWidth = hasLandscapeBack ? 'sm:max-w-[1100px]' : 'sm:max-w-[900px]';

  const clearAllCanvases = () => {
    canvasRefs.current.forEach((canvas) => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalMaxWidth} max-h-[90vh] overflow-y-auto overflow-x-hidden`}>
        <DialogHeader>
          <DialogTitle className="text-cheese">{asset.name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Asset #{asset.id}</span>
            <span aria-hidden>·</span>
            <span>by {asset.author}</span>
            <span aria-hidden>·</span>
            <span>{asset.category}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <img
                src={asset.source === 'atomicassets' ? atomicAssetsLogo : simpleAssetsLogo}
                alt=""
                className={`h-4 w-4 rounded-full object-cover ${asset.source === 'atomicassets' ? '' : 'bg-white p-[1px]'}`}
              />
              <span>{asset.source === 'atomicassets' ? 'AtomicAssets' : 'SimpleAssets'}</span>
            </span>
          </DialogDescription>
        </DialogHeader>
        {/* True mint number; supply details are listed separately below. */}
        <div
          className="w-full flex justify-center py-1 bg-muted/30 -mb-2"
          title={mintLabel === '#--' ? 'Mint number not available yet' : `Mint ${mintLabel}`}
        >
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/80 text-cheese border border-border/40">
            {mintLabel}
          </span>
        </div>
        <div className={`flex flex-col sm:flex-row gap-4 items-start justify-center overflow-hidden ${images.length === 1 ? 'max-w-[400px] mx-auto' : ''}`}>
          {images.map((imgUrl, i) => {
            const label = IMAGE_LABELS[i] || `Image ${i + 1}`;
            const isBack = i === 1;
            const isLandscape = isBack && isSeries1;

            return (
              <div key={i} className="space-y-1 shrink-0" style={{ width: isLandscape ? '500px' : '400px' }}>
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-xs font-semibold text-cheese text-center">{label}</p>
                </div>
                <ImageWithModes
                  url={imgUrl}
                  alt={`${asset.name} - ${label}`}
                  isLandscape={isLandscape}
                  className={isLandscape ? 'rotate-90 scale-[1.33] origin-center' : ''}
                  mode={mode}
                  canvasRegister={(canvas) => {
                    if (canvas) {
                      if (!canvasRefs.current.includes(canvas)) canvasRefs.current.push(canvas);
                      (canvas as HTMLCanvasElement & { __setColor?: (color: string) => void }).__setColor?.(unifiedColor);
                    } else {
                      canvasRefs.current = canvasRefs.current.filter(Boolean);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
        <ArtworkModeControls mode={mode} onModeChange={setMode} color={unifiedColor} onColorChange={setUnifiedColor} onClear={clearAllCanvases} />
        {supplyLines.length > 0 && (
          <div className="space-y-1 text-sm text-foreground">
            <p className="text-xs font-semibold text-cheese">Mint information</p>
            {supplyLines.map((line) => <p key={line}>{line}</p>)}
          </div>
        )}
        {/* Bridged AtomicAssets bridge mint (green, like the removed green mint) */}
        {isBridgedAA && asset.idata?.bridge_mint ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-cheese">Bridge Mint</span>
            <span
              className="text-sm font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400"
              title="Original bridge order from SimpleAssets → AtomicAssets bridging"
            >
              #{String(asset.idata.bridge_mint)}
              {asset.idata.bridge_total ? ` / ${String(asset.idata.bridge_total)}` : ''}
            </span>
          </div>
        ) : null}
        {metaFields.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-cheese">Metadata</h4>
            <div className="grid grid-cols-3 gap-1.5">
              {metaFields.map(([key, value]) => (
                <div key={key} className="bg-muted/30 rounded px-2 py-1">
                  <span className="text-[10px] text-cheese uppercase">{key}</span>
                  <p className="text-xs text-foreground truncate">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {(hasContainer || hasContainerf) && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-cheese">📎 Contained Assets</h4>
            {hasContainer && (
              <div className="bg-muted/30 rounded p-2">
                <span className="text-[10px] text-muted-foreground uppercase">NFTs ({asset.container.length})</span>
                <p className="text-xs text-foreground break-all">{asset.container.map((c) => (typeof c === 'object' ? JSON.stringify(c) : String(c))).join(', ')}</p>
              </div>
            )}
            {hasContainerf && (
              <div className="bg-muted/30 rounded p-2">
                <span className="text-[10px] text-muted-foreground uppercase">FTs ({asset.containerf.length})</span>
                <p className="text-xs text-foreground break-all">{asset.containerf.map((c) => (typeof c === 'object' ? JSON.stringify(c) : String(c))).join(', ')}</p>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Owner: {asset.owner}</span>
          <Button variant="ghost" size="sm" onClick={() => setShowRawJson(!showRawJson)}>{showRawJson ? 'Hide' : 'Show'} Raw JSON</Button>
        </div>
        {showRawJson && (
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-cheese mb-1">idata</p>
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto text-foreground">{JSON.stringify(asset.idata, null, 2)}</pre>
            </div>
            <div>
              <p className="text-xs font-semibold text-cheese mb-1">mdata</p>
              <pre className="text-xs bg-muted/30 rounded p-3 overflow-x-auto text-foreground">{JSON.stringify(asset.mdata, null, 2)}</pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
