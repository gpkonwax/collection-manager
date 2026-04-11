import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { getCachedGatewayIndex } from '@/hooks/useIpfsMedia';
import { extractIpfsHash, IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface Props {
  asset: SimpleAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MINT_KEYS = ['edition', 'mint', 'serial', 'num', 'mint_num'];
const IMAGE_LABELS = ['Front', 'Back'];
const SERIES1_CATEGORIES = new Set(['five', 'series1']);

function getMintDisplay(asset: SimpleAsset): string | null {
  const combined = { ...asset.idata, ...asset.mdata };
  for (const key of MINT_KEYS) {
    const val = combined[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const str = String(val);
      if (str.includes('/')) return str;
      const supply = combined.maxsupply ?? combined.max_supply ?? combined.supply;
      if (supply !== undefined && supply !== null) return `#${str} / ${supply}`;
      return `#${str}`;
    }
  }
  return null;
}

const ZOOM = 4;
const LENS_SIZE = 220;

const PAD = Math.ceil(LENS_SIZE / 2);

function ImageWithLens({ url, alt, isLandscape, className }: {
  url: string;
  alt: string;
  isLandscape: boolean;
  className?: string;
}) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const hash = url ? extractIpfsHash(url) : null;
  const cachedIdx = getCachedGatewayIndex(hash);
  const resolvedUrl = hash ? `${IPFS_GATEWAYS[cachedIdx]}${hash}` : url;

  const handleMouseMove = (e: React.MouseEvent) => {
    const inner = innerRef.current?.getBoundingClientRect();
    if (!inner) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - inner.left) / inner.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - inner.top) / inner.height) * 100));
    setPos({ x, y });
  };

  const bgX = isLandscape ? pos.y : pos.x;
  const bgY = isLandscape ? (100 - pos.x) : pos.y;

  const innerW = innerRef.current?.offsetWidth ?? 0;
  const innerH = innerRef.current?.offsetHeight ?? 0;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ padding: PAD, margin: -PAD, cursor: hover ? 'crosshair' : 'default' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseMove={handleMouseMove}
    >
      <div
        ref={innerRef}
        className={`relative w-full ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'} bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center`}
      >
        <IpfsMedia
          url={url}
          alt={alt}
          className={`w-full h-full ${className || ''}`}
          context="detail"
          showSkeleton
        />
      </div>
      {hover && resolvedUrl && !resolvedUrl.includes('placeholder') && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-cheese/50 shadow-lg z-50 overflow-hidden"
          style={{
            width: LENS_SIZE,
            height: LENS_SIZE,
            ...lensStyle,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundImage: `url(${resolvedUrl})`,
              backgroundSize: `${ZOOM * 100}%`,
              backgroundPosition: `${bgX}% ${bgY}%`,
              backgroundRepeat: 'no-repeat',
              ...(isLandscape ? { transform: 'rotate(90deg) scale(1.33)' } : {}),
            }}
          />
        </div>
      )}
    </div>
  );
}

export function SimpleAssetDetailDialog({ asset, open, onOpenChange }: Props) {
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    if (asset) setShowRawJson(false);
  }, [asset?.id]);

  if (!asset) return null;

  const images = asset.images;
  const mintDisplay = getMintDisplay(asset);
  const isSeries1 = SERIES1_CATEGORIES.has(asset.category);
  const metaFields = Object.entries({ ...asset.idata, ...asset.mdata }).filter(
    ([key]) => !['img', 'image', 'icon', 'backimg', 'back', 'img2', 'image2', 'backimage', 'name', ...MINT_KEYS, 'maxsupply', 'max_supply', 'supply'].includes(key)
  );
  const hasContainer = asset.container.length > 0;
  const hasContainerf = asset.containerf.length > 0;

  const hasLandscapeBack = isSeries1 && images.length > 1;
  const modalMaxWidth = hasLandscapeBack ? 'sm:max-w-[1100px]' : 'sm:max-w-[900px]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${modalMaxWidth} max-h-[90vh] overflow-y-auto overflow-x-hidden`}>
        <DialogHeader>
          <DialogTitle className="text-cheese">{asset.name}</DialogTitle>
          <DialogDescription>Asset #{asset.id} · by {asset.author} · {asset.category}</DialogDescription>
        </DialogHeader>
        <div className={`flex flex-col sm:flex-row gap-4 items-start justify-center overflow-hidden ${images.length === 1 ? 'max-w-[400px] mx-auto' : ''}`}>
          {images.map((imgUrl, i) => {
            const label = IMAGE_LABELS[i] || `Image ${i + 1}`;
            const isBack = i === 1;
            const isLandscape = isBack && isSeries1;

            return (
              <div key={i} className="space-y-1 shrink-0" style={{ width: isLandscape ? '500px' : '400px' }}>
                <p className="text-xs font-semibold text-cheese text-center">{label}</p>
                <ImageWithLens
                  url={imgUrl}
                  alt={`${asset.name} - ${label}`}
                  isLandscape={isLandscape}
                  className={isLandscape ? 'rotate-90 scale-[1.33] origin-center' : ''}
                />
              </div>
            );
          })}
        </div>
        {mintDisplay && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-cheese">Mint</span>
            <span className="text-sm font-mono text-primary">{mintDisplay}</span>
          </div>
        )}
        {metaFields.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-cheese">Metadata</h4>
            <div className="grid grid-cols-2 gap-2">
              {metaFields.map(([key, value]) => (
                <div key={key} className="bg-muted/30 rounded p-2">
                  <span className="text-[10px] text-cheese uppercase">{key}</span>
                  <p className="text-sm text-foreground truncate">{String(value)}</p>
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
