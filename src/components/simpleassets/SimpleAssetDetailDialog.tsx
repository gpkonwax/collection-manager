import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { getCachedGatewayIndex } from '@/hooks/useIpfsMedia';
import { extractIpfsHash, IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { Pen, Search, Eraser } from 'lucide-react';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

interface Props {
  asset: SimpleAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MINT_KEYS = ['edition', 'mint', 'serial', 'num', 'mint_num'];
const IMAGE_LABELS = ['Front', 'Back'];
const SERIES1_CATEGORIES = new Set(['five', 'series1']);
const DRAWABLE_CATEGORIES = new Set(['five', 'series1', 'series2']);
const DRAW_COLORS = [
  { name: 'Yellow', value: 'hsl(45, 97%, 54%)' },
  { name: 'White', value: '#ffffff' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Black', value: '#000000' },
];

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

function DrawCanvas({ isLandscape, color: externalColor, showPalette, onColorChange, canvasRegister, active }: {
  isLandscape: boolean;
  color?: string;
  showPalette?: boolean;
  onColorChange?: (c: string) => void;
  canvasRegister?: (canvas: HTMLCanvasElement | null) => void;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [localColor, setLocalColor] = useState(DRAW_COLORS[0].value);
  const color = externalColor || localColor;
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    canvasRegister?.(canvasRef.current);
    return () => canvasRegister?.(null);
  }, [canvasRegister]);

  const getPos = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drawing.current = true;
    lastPos.current = getPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }, [getPos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing.current || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const pos = getPos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [color, getPos]);

  const onPointerUp = useCallback(() => {
    drawing.current = false;
    lastPos.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-40 rounded-lg"
        style={{ cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      {showPalette && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-2 py-1">
          {DRAW_COLORS.map((c) => (
            <button
              key={c.name}
              title={c.name}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c.value ? 'scale-125 border-cheese' : 'border-muted-foreground/40'}`}
              style={{ background: c.value }}
              onClick={() => (onColorChange || setLocalColor)(c.value)}
            />
          ))}
          <button
            title="Clear"
            className="ml-1 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-cheese transition-colors"
            onClick={() => {
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext('2d');
              if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
            }}
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

function ImageWithLens({ url, alt, isLandscape, className, drawEnabled, drawColor, showPalette, onColorChange, canvasRegister }: {
  url: string;
  alt: string;
  isLandscape: boolean;
  className?: string;
  drawEnabled?: boolean;
  drawColor?: string;
  showPalette?: boolean;
  onColorChange?: (c: string) => void;
  canvasRegister?: (canvas: HTMLCanvasElement | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const hash = url ? extractIpfsHash(url) : null;
  const cachedIdx = getCachedGatewayIndex(hash);
  const resolvedUrl = hash ? `${IPFS_GATEWAYS[cachedIdx]}${hash}` : url;

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setPos({ x, y });
  };

  const bgX = isLandscape ? pos.y : pos.x;
  const bgY = isLandscape ? (100 - pos.x) : pos.y;

  return (
    <div
      ref={containerRef}
      className={`relative ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'} bg-muted/30 rounded-lg`}
      onMouseEnter={() => !drawEnabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseMove={!drawEnabled ? handleMouseMove : undefined}
      style={{ cursor: drawEnabled ? 'default' : hover ? 'crosshair' : 'default' }}
    >
      <div className="w-full h-full overflow-hidden rounded-lg flex items-center justify-center">
        <IpfsMedia
          url={url}
          alt={alt}
          className={`w-full h-full ${className || ''}`}
          context="detail"
          showSkeleton
        />
      </div>
      {drawEnabled && (
        <DrawCanvas
          isLandscape={isLandscape}
          color={drawColor}
          showPalette={showPalette}
          onColorChange={onColorChange}
          canvasRegister={canvasRegister}
        />
      )}
      {!drawEnabled && hover && resolvedUrl && !resolvedUrl.includes('placeholder') && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-cheese/50 shadow-lg z-50 overflow-hidden"
          style={{
            width: LENS_SIZE,
            height: LENS_SIZE,
            left: `calc(${pos.x}% - ${LENS_SIZE / 2}px)`,
            top: `calc(${pos.y}% - ${LENS_SIZE / 2}px)`,
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
  const [drawMode, setDrawMode] = useState<number | null>(null);
  const [drawAll, setDrawAll] = useState(false);
  const [unifiedColor, setUnifiedColor] = useState(DRAW_COLORS[0].value);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (asset) {
      setShowRawJson(false);
      setDrawMode(null);
      setDrawAll(false);
      setUnifiedColor(DRAW_COLORS[0].value);
      canvasRefs.current = [];
    }
  }, [asset?.id]);

  if (!asset) return null;

  const images = asset.images;
  const mintDisplay = getMintDisplay(asset);
  const isSeries1 = SERIES1_CATEGORIES.has(asset.category);
  const isDrawable = DRAWABLE_CATEGORIES.has(asset.category);
  const metaFields = Object.entries({ ...asset.idata, ...asset.mdata }).filter(
    ([key]) => !['img', 'image', 'icon', 'backimg', 'back', 'img2', 'image2', 'backimage', 'name', ...MINT_KEYS, 'maxsupply', 'max_supply', 'supply'].includes(key)
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
          <DialogDescription>Asset #{asset.id} · by {asset.author} · {asset.category}</DialogDescription>
        </DialogHeader>
        <div className={`flex flex-col sm:flex-row gap-4 items-start justify-center overflow-hidden ${images.length === 1 ? 'max-w-[400px] mx-auto' : ''}`}>
          {images.map((imgUrl, i) => {
            const label = IMAGE_LABELS[i] || `Image ${i + 1}`;
            const isBack = i === 1;
            const isLandscape = isBack && isSeries1;
            const isDrawing = isSeries1 ? drawAll : drawMode === i;

            return (
              <div key={i} className="space-y-1 shrink-0" style={{ width: isLandscape ? '500px' : '400px' }}>
                <div className="flex items-center justify-center gap-1.5">
                  <p className="text-xs font-semibold text-cheese text-center">{label}</p>
                  {isDrawable && !isSeries1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => setDrawMode(isDrawing ? null : i)}
                      title={isDrawing ? 'Switch to magnifier' : 'Draw on card'}
                    >
                      {isDrawing ? <Search className="h-3 w-3 text-cheese" /> : <Pen className="h-3 w-3 text-cheese" />}
                    </Button>
                  )}
                </div>
                <ImageWithLens
                  url={imgUrl}
                  alt={`${asset.name} - ${label}`}
                  isLandscape={isLandscape}
                  className={isLandscape ? 'rotate-90 scale-[1.33] origin-center' : ''}
                  drawEnabled={isDrawing}
                  drawColor={isSeries1 ? unifiedColor : undefined}
                  showPalette={!isSeries1}
                  onColorChange={!isSeries1 ? undefined : undefined}
                  canvasRegister={isSeries1 ? (canvas) => {
                    if (canvas) {
                      if (!canvasRefs.current.includes(canvas)) canvasRefs.current.push(canvas);
                    } else {
                      canvasRefs.current = canvasRefs.current.filter(Boolean);
                    }
                  } : undefined}
                />
              </div>
            );
          })}
        </div>
        {isSeries1 && isDrawable && images.length > 1 && (
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-md ${!drawAll ? 'bg-cheese/20 text-cheese' : 'text-muted-foreground'}`}
                onClick={() => setDrawAll(false)}
                title="Magnifier"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-md ${drawAll ? 'bg-cheese/20 text-cheese' : 'text-muted-foreground'}`}
                onClick={() => setDrawAll(true)}
                title="Draw on card"
              >
                <Pen className="h-4 w-4" />
              </Button>
            </div>
            {drawAll && (
              <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-2 py-1">
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c.name}
                    title={c.name}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${unifiedColor === c.value ? 'scale-125 border-cheese' : 'border-muted-foreground/40'}`}
                    style={{ background: c.value }}
                    onClick={() => setUnifiedColor(c.value)}
                  />
                ))}
                <button
                  title="Clear"
                  className="ml-1 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-cheese transition-colors"
                  onClick={clearAllCanvases}
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
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
