import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { getCachedGatewayIndex } from '@/hooks/useIpfsMedia';
import { extractIpfsHash, IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { useCardTilt } from '@/hooks/useCardTilt';
import { Move3d, Search, Pencil, Eraser } from 'lucide-react';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';
import atomicAssetsLogo from '@/assets/atomicassets-logo.png.asset.json';
import simpleAssetsLogo from '@/assets/simpleassets-logo.png.asset.json';

interface Props {
  asset: SimpleAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewMode = 'tilt' | 'lens' | 'draw';

const MINT_KEYS = ['edition', 'mint', 'serial', 'num', 'mint_num'];
const IMAGE_LABELS = ['Front', 'Back'];
const SERIES1_CATEGORIES = new Set(['five', 'series1']);
const DRAWABLE_CATEGORIES = new Set(['five', 'series1', 'series2']);
const BRIDGED_SCHEMAS = new Set(['series1', 'series2', 'exotic']);
const DRAW_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Yellow', value: 'hsl(45, 97%, 54%)' },
  { name: 'White', value: '#ffffff' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
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

function getRealMintDisplay(asset: SimpleAsset): string {
  const isAtomic = asset.source === 'atomicassets';
  const category = String(asset.category || '').toLowerCase();
  const isBridgedAA = isAtomic && BRIDGED_SCHEMAS.has(category);
  const realMint = (asset as unknown as { mintNumber?: number | string | null }).mintNumber;
  const nativeAAMint = isAtomic && !isBridgedAA ? asset.idata?.bridge_mint : undefined;
  const effectiveMint = realMint ?? nativeAAMint;
  if (effectiveMint !== undefined && effectiveMint !== null && String(effectiveMint).trim() !== '') {
    return `#${effectiveMint}`;
  }
  return '#--';
}

const ZOOM = 4;
const LENS_SIZE = 220;

function DrawCanvas({ canvasRegister, active }: {
  canvasRegister?: (canvas: HTMLCanvasElement | null) => void;
  active?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const colorRef = useRef<string>(DRAW_COLORS[0].value);

  useEffect(() => {
    canvasRegister?.(canvasRef.current);
    // Expose color setter on the canvas element so parent can update without remounting
    if (canvasRef.current) {
      (canvasRef.current as any).__setColor = (c: string) => { colorRef.current = c; };
    }
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
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [getPos]);

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
      // Preserve strokes across resize by saving/restoring image data
      const ctx = canvas.getContext('2d');
      const prev = ctx && canvas.width > 0 && canvas.height > 0
        ? ctx.getImageData(0, 0, canvas.width, canvas.height)
        : null;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (prev && ctx) {
        try { ctx.putImageData(prev, 0, 0); } catch { /* size changed, skip */ }
      }
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-40 rounded-lg"
      style={{
        cursor: active ? 'crosshair' : 'default',
        touchAction: 'none',
        pointerEvents: active ? 'auto' : 'none',
      }}
      onPointerDown={active ? onPointerDown : undefined}
      onPointerMove={active ? onPointerMove : undefined}
      onPointerUp={active ? onPointerUp : undefined}
      onPointerLeave={active ? onPointerUp : undefined}
    />
  );
}

function ImageWithModes({ url, alt, isLandscape, className, mode, drawColor, canvasRegister }: {
  url: string;
  alt: string;
  isLandscape: boolean;
  className?: string;
  mode: ViewMode;
  drawColor: string;
  canvasRegister?: (canvas: HTMLCanvasElement | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [everDrawn, setEverDrawn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hash = url ? extractIpfsHash(url) : null;
  const cachedIdx = getCachedGatewayIndex(hash);
  const resolvedUrl = hash ? `${IPFS_GATEWAYS[cachedIdx]}${hash}` : url;

  const tiltActive = mode === 'tilt';
  const { ref: tiltRef, glareRef, onMouseMove: tiltMove, onMouseLeave: tiltLeave } = useCardTilt({ disabled: !tiltActive, landscape: isLandscape });

  useEffect(() => {
    if (mode === 'draw') setEverDrawn(true);
  }, [mode]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'lens') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        setPos({ x, y });
      }
    }
    if (tiltActive) tiltMove(e as React.MouseEvent<HTMLDivElement>);
  };

  const handleMouseLeave = () => {
    setHover(false);
    if (tiltActive) tiltLeave();
  };

  const handleMouseEnter = () => {
    if (mode === 'lens') setHover(true);
  };

  const bgX = isLandscape ? pos.y : pos.x;
  const bgY = isLandscape ? (100 - pos.x) : pos.y;

  const showCanvas = mode === 'draw' || everDrawn;
  const cursor = mode === 'lens' ? (hover ? 'crosshair' : 'default') : 'default';

  return (
    <div
      ref={containerRef}
      className={`relative ${isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'} bg-muted/30 rounded-lg`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      style={{ cursor, perspective: tiltActive ? '1200px' : undefined }}
    >
      <div
        ref={tiltRef}
        className="w-full h-full overflow-hidden rounded-lg flex items-center justify-center relative"
        style={{ transformStyle: tiltActive ? 'preserve-3d' : undefined, willChange: tiltActive ? 'transform' : undefined }}
      >
        <IpfsMedia
          url={url}
          alt={alt}
          className={`w-full h-full ${className || ''}`}
          context="detail"
          showSkeleton
        />
        <div
          ref={glareRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-200"
          style={{ opacity: 0, mixBlendMode: 'overlay' }}
        />
      </div>
      {showCanvas && (
        <DrawCanvas
          canvasRegister={canvasRegister}
          active={mode === 'draw'}
        />
      )}
      {mode === 'lens' && hover && resolvedUrl && !resolvedUrl.includes('placeholder') && (
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
  const [mode, setMode] = useState<ViewMode>('tilt');
  const [unifiedColor, setUnifiedColor] = useState(DRAW_COLORS[0].value);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (asset) {
      setShowRawJson(false);
      setMode('tilt');
      setUnifiedColor(DRAW_COLORS[0].value);
      canvasRefs.current = [];
    }
  }, [asset?.id]);

  // Push color changes into any registered canvases without remounting them
  useEffect(() => {
    canvasRefs.current.forEach((canvas) => {
      if (canvas && (canvas as any).__setColor) (canvas as any).__setColor(unifiedColor);
    });
  }, [unifiedColor]);

  if (!asset) return null;

  const images = asset.images;
  const mintDisplay = getMintDisplay(asset);
  const realMintDisplay = getRealMintDisplay(asset);
  const isSeries1 = SERIES1_CATEGORIES.has(asset.category);
  const isDrawable = DRAWABLE_CATEGORIES.has(asset.category);
  const isAtomic = asset.source === 'atomicassets';
  const isBridgedAA = isAtomic && BRIDGED_SCHEMAS.has(String(asset.category || '').toLowerCase());
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

  const modeBtnCls = (m: ViewMode) =>
    `h-7 w-7 rounded-md ${mode === m ? 'bg-cheese/20 text-cheese' : 'text-muted-foreground'}`;

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
                src={asset.source === 'atomicassets' ? atomicAssetsLogo.url : simpleAssetsLogo.url}
                alt=""
                className={`h-4 w-4 rounded-full object-cover ${asset.source === 'atomicassets' ? '' : 'bg-white p-[1px]'}`}
              />
              <span>{asset.source === 'atomicassets' ? 'AtomicAssets' : 'SimpleAssets'}</span>
            </span>
          </DialogDescription>
        </DialogHeader>
        {/* Reserved mint-number ribbon (placeholder until real mint is plumbed) */}
        <div
          className="w-full flex justify-center py-1 bg-muted/30 -mb-2"
          title="Mint number (placeholder — real mint will populate when available)"
        >
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-background/80 text-cheese border border-border/40">
            {realMintDisplay}
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
                  drawColor={unifiedColor}
                  canvasRegister={(canvas) => {
                    if (canvas) {
                      if (!canvasRefs.current.includes(canvas)) canvasRefs.current.push(canvas);
                      (canvas as any).__setColor?.(unifiedColor);
                    } else {
                      canvasRefs.current = canvasRefs.current.filter(Boolean);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-1.5 mt-1">
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className={modeBtnCls('tilt')}
              onClick={() => setMode('tilt')}
              title="3D tilt (default)"
            >
              <Move3d className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={modeBtnCls('lens')}
              onClick={() => setMode('lens')}
              title="Magnifier"
            >
              <Search className="h-4 w-4" />
            </Button>
            {isDrawable && (
              <Button
                variant="ghost"
                size="icon"
                className={modeBtnCls('draw')}
                onClick={() => setMode('draw')}
                title="Draw on card"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          {mode === 'draw' && (
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
                className="ml-1 px-2 py-0.5 rounded-full bg-cheese text-black text-xs font-semibold hover:bg-cheese/80 transition-colors flex items-center gap-1"
                onClick={clearAllCanvases}
              >
                <Eraser className="h-3 w-3" /> Clear
              </button>
            </div>
          )}
        </div>
        {mintDisplay && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-cheese">Mint</span>
            <span className="text-sm font-mono text-primary">{mintDisplay}</span>
            {asset.idata?.bridge_mint ? (
              <span
                className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                title="Original bridge order from SimpleAssets → AtomicAssets bridging"
              >
                Bridge Mint #{String(asset.idata.bridge_mint)}
                {asset.idata.bridge_total ? ` / ${String(asset.idata.bridge_total)}` : ''}
              </span>
            ) : null}
          </div>
        )}
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
