import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { IpfsMedia } from './IpfsMedia';
import { getCachedGatewayIndex, getCachedLoadedUrl } from '@/hooks/useIpfsMedia';
import { extractIpfsHash, IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { useCardTilt } from '@/hooks/useCardTilt';
import { Move3d, Search, Pencil, Eraser } from 'lucide-react';

export type ViewMode = 'tilt' | 'lens' | 'draw';

export const DRAW_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Yellow', value: 'hsl(45, 97%, 54%)' },
  { name: 'White', value: '#ffffff' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
];

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

export function ImageWithModes({ url, alt, isLandscape, className, mode, drawColor, canvasRegister }: {
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
  const [displayedUrl, setDisplayedUrl] = useState<string | null>(null);
  const resolvedUrl = displayedUrl || (hash ? getCachedLoadedUrl(hash) : null) || (hash ? `${IPFS_GATEWAYS[cachedIdx]}${hash}` : url);
  useEffect(() => { setDisplayedUrl(null); }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const img = el.querySelector('img');
      if (img?.complete && img.naturalWidth > 0) setDisplayedUrl(img.currentSrc || img.src);
    };
    sync();
    el.addEventListener('load', sync, true);
    return () => el.removeEventListener('load', sync, true);
  }, [url]);

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

export function ArtworkModeControls({ mode, onModeChange, color, onColorChange, onClear, subject = 'card' }: {
  mode: ViewMode; onModeChange: (mode: ViewMode) => void; color: string; onColorChange: (color: string) => void; onClear: () => void; subject?: string;
}) {
  const modeBtnCls = (m: ViewMode) =>
    `h-7 w-7 rounded-md ${mode === m ? 'bg-cheese/20 text-cheese' : 'text-muted-foreground'}`;
  return (
    <div className="flex flex-col items-center gap-1.5 mt-1">
      <div className="flex gap-1.5">
        <Button variant="ghost" size="icon" className={modeBtnCls('tilt')} onClick={() => onModeChange('tilt')} title="3D tilt (default)" aria-label="3D tilt"><Move3d className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={modeBtnCls('lens')} onClick={() => onModeChange('lens')} title="Magnifier" aria-label="Magnifier"><Search className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className={modeBtnCls('draw')} onClick={() => onModeChange('draw')} title={`Draw on ${subject}`} aria-label={`Draw on ${subject}`}><Pencil className="h-4 w-4" /></Button>
      </div>
      {mode === 'draw' && (
        <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur rounded-full px-2 py-1">
          {DRAW_COLORS.map(c => (
            <Button key={c.name} variant="ghost" size="icon" title={c.name} aria-label={c.name} className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c.value ? 'scale-125 border-cheese' : 'border-muted-foreground/40'}`} style={{ background: c.value }} onClick={() => onColorChange(c.value)} />
          ))}
          <Button variant="ghost" size="sm" title="Clear" className="ml-1 px-2 py-0.5 rounded-full bg-cheese text-cheese-foreground text-xs font-semibold hover:bg-cheese/80 transition-colors flex items-center gap-1" onClick={onClear}><Eraser className="h-3 w-3" /> Clear</Button>
        </div>
      )}
    </div>
  );
}
