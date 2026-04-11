import { useState, useEffect, useRef, useCallback } from 'react';
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

function resolveUrl(url: string): string {
  const hash = url ? extractIpfsHash(url) : null;
  const cachedIdx = getCachedGatewayIndex(hash);
  return hash ? `${IPFS_GATEWAYS[cachedIdx]}${hash}` : url;
}

interface ImageStripProps {
  images: string[];
  asset: SimpleAsset;
  isSeries1: boolean;
}

function ImageStrip({ images, asset, isSeries1 }: ImageStripProps) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [cardRects, setCardRects] = useState<{ left: number; top: number; width: number; height: number }[]>([]);

  const measureCards = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const stripRect = strip.getBoundingClientRect();
    const rects = cardRefs.current.map(el => {
      if (!el) return { left: 0, top: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return {
        left: r.left - stripRect.left,
        top: r.top - stripRect.top,
        width: r.width,
        height: r.height,
      };
    });
    setCardRects(rects);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const strip = stripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPos({ x, y });
  }, []);

  const handleMouseEnter = useCallback(() => {
    measureCards();
    setHover(true);
  }, [measureCards]);

  const stripW = stripRef.current?.offsetWidth ?? 0;
  const stripH = stripRef.current?.offsetHeight ?? 0;

  const lensCenterX = PAD + pos.x * stripW;
  const lensCenterY = PAD + pos.y * stripH;

  const magOffsetX = LENS_SIZE / 2 - pos.x * stripW * ZOOM;
  const magOffsetY = LENS_SIZE / 2 - pos.y * stripH * ZOOM;

  const resolvedUrls = images.map(resolveUrl);
  const anyReal = resolvedUrls.some(u => u && !u.includes('placeholder'));

  return (
    <div
      ref={stageRef}
      className="relative"
      style={{ padding: PAD, margin: -PAD, cursor: hover ? 'crosshair' : 'default' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHover(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Visible strip */}
      <div
        ref={stripRef}
        className={`flex flex-row gap-4 items-start justify-center ${images.length === 1 ? 'max-w-[400px] mx-auto' : ''}`}
      >
        {images.map((imgUrl, i) => {
          const label = IMAGE_LABELS[i] || `Image ${i + 1}`;
          const isBack = i === 1;
          const isLandscape = isBack && isSeries1;

          return (
            <div key={i} className="space-y-1 shrink-0" style={{ width: isLandscape ? '500px' : '400px' }}>
              <p className="text-xs font-semibold text-cheese text-center">{label}</p>
              <div
                ref={el => { cardRefs.current[i] = el; }}
                className={`relative w-full ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'} bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center`}
              >
                <IpfsMedia
                  url={imgUrl}
                  alt={`${asset.name} - ${label}`}
                  className={`w-full h-full ${isLandscape ? 'rotate-90 scale-[1.33] origin-center' : ''}`}
                  context="detail"
                  showSkeleton
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared lens */}
      {hover && anyReal && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-cheese/50 shadow-lg z-50 overflow-hidden"
          style={{
            width: LENS_SIZE,
            height: LENS_SIZE,
            left: lensCenterX - LENS_SIZE / 2,
            top: lensCenterY - LENS_SIZE / 2,
          }}
        >
          {/* Magnified tiles positioned from measured rects */}
          <div
            style={{
              position: 'absolute',
              left: magOffsetX,
              top: magOffsetY,
              width: stripW * ZOOM,
              height: stripH * ZOOM,
            }}
          >
            {cardRects.map((rect, i) => {
              const resolved = resolvedUrls[i];
              if (!resolved) return null;
              const isBack = i === 1;
              const isLandscape = isBack && isSeries1;

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: rect.left * ZOOM,
                    top: rect.top * ZOOM,
                    width: rect.width * ZOOM,
                    height: rect.height * ZOOM,
                    borderRadius: 8 * ZOOM,
                    overflow: 'hidden',
                    backgroundImage: `url(${resolved})`,
                    backgroundSize: isLandscape ? 'cover' : 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    ...(isLandscape ? { transform: 'rotate(90deg) scale(1.33)', transformOrigin: 'center' } : {}),
                  }}
                />
              );
            })}
          </div>
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

        <div className="overflow-hidden">
          <ImageStrip images={images} asset={asset} isSeries1={isSeries1} />
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
