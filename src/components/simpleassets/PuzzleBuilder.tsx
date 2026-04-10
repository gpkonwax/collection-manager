import { useState, useCallback, useRef, PointerEvent as RPointerEvent } from 'react';
import { RotateCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildGpkCardBackUrl } from '@/lib/gpkCardImages';
import { PUZZLE_CARD_IDS } from '@/lib/puzzlePieces';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

const GRID_W = 130;
const GRID_H = 180;

function snapToGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(x / GRID_W) * GRID_W,
    y: Math.round(y / GRID_H) * GRID_H,
  };
}

interface PieceState {
  x: number;
  y: number;
  rotation: number;
}

interface PuzzleBuilderProps {
  assets: SimpleAsset[];
}

function isPuzzlePiece(asset: SimpleAsset): boolean {
  if (!asset.cardid) return false;
  const id = typeof asset.cardid === 'string' ? parseInt(asset.cardid, 10) : asset.cardid;
  return PUZZLE_CARD_IDS.includes(id);
}

function deduplicateByCardId(assets: SimpleAsset[]): SimpleAsset[] {
  const seen = new Set<number>();
  const result: SimpleAsset[] = [];
  for (const a of assets) {
    const id = typeof a.cardid === 'string' ? parseInt(a.cardid, 10) : a.cardid;
    if (id != null && !seen.has(id)) {
      seen.add(id);
      result.push(a);
    }
  }
  return result;
}

export function PuzzleBuilder({ assets }: PuzzleBuilderProps) {
  const puzzleAssets = deduplicateByCardId(assets.filter(isPuzzlePiece));

  const [pieces, setPieces] = useState<Map<string, PieceState>>(() => {
    const m = new Map<string, PieceState>();
    const cols = 6;
    puzzleAssets.forEach((a, i) => {
      m.set(a.id, { x: (i % cols) * GRID_W, y: Math.floor(i / cols) * GRID_H, rotation: 0 });
    });
    return m;
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getState = (id: string): PieceState => pieces.get(id) ?? { x: 0, y: 0, rotation: 0 };

  const rotate = useCallback((id: string, dir: 'cw' | 'ccw') => {
    setPieces(prev => {
      const next = new Map(prev);
      const s = next.get(id) ?? { x: 0, y: 0, rotation: 0 };
      next.set(id, { ...s, rotation: (s.rotation + (dir === 'cw' ? 90 : 270)) % 360 });
      return next;
    });
  }, []);

  const handlePointerDown = useCallback((id: string, e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const s = pieces.get(id) ?? { x: 0, y: 0, rotation: 0 };
    dragging.current = { id, startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y };
    setSelectedId(id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pieces]);

  const handlePointerMove = useCallback((e: RPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const d = dragging.current;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    setPieces(prev => {
      const next = new Map(prev);
      const s = next.get(d.id) ?? { x: 0, y: 0, rotation: 0 };
      next.set(d.id, { ...s, x: d.origX + dx, y: d.origY + dy });
      return next;
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragging.current) {
      const id = dragging.current.id;
      setPieces(prev => {
        const next = new Map(prev);
        const s = next.get(id);
        if (s) {
          next.set(id, { ...s, ...snapToGrid(s.x, s.y) });
        }
        return next;
      });
    }
    dragging.current = null;
  }, []);

  if (puzzleAssets.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No puzzle pieces found</p>
        <p className="text-sm mt-2">You don't own any Series 2 cards that match the puzzle piece list.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {puzzleAssets.length} puzzle piece{puzzleAssets.length !== 1 ? 's' : ''} · Drag to position (snaps to grid) · Click arrows to rotate 90°
      </p>
      <div
        ref={canvasRef}
        className="relative border border-border rounded-lg overflow-auto"
        style={{
          width: '100%',
          height: '70vh',
          minHeight: 500,
          backgroundSize: `${GRID_W}px ${GRID_H}px`,
          backgroundImage: `linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)`,
          backgroundColor: 'hsl(var(--muted) / 0.2)',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {puzzleAssets.map(asset => {
          const s = getState(asset.id);
          const cardid = typeof asset.cardid === 'string' ? parseInt(asset.cardid, 10) : asset.cardid;
          const backUrl = buildGpkCardBackUrl('gpktwoeight', cardid ?? 0);
          const isSelected = selectedId === asset.id;

          return (
            <div
              key={asset.id}
              className={`absolute cursor-grab active:cursor-grabbing select-none group transition-[left,top] ${isSelected ? 'z-20' : 'z-10'}`}
              style={{
                left: s.x + (GRID_W - 120) / 2,
                top: s.y + (GRID_H - 168) / 2,
                width: 120,
                height: 168,
                transform: `rotate(${s.rotation}deg)`,
                transformOrigin: 'center center',
                transitionDuration: dragging.current?.id === asset.id ? '0ms' : '150ms',
              }}
              onPointerDown={(e) => handlePointerDown(asset.id, e)}
              onClick={() => setSelectedId(asset.id)}
            >
              <div className={`w-full h-full rounded-md overflow-hidden border-2 transition-colors ${isSelected ? 'border-cheese shadow-lg shadow-cheese/20' : 'border-border'}`}>
                {backUrl ? (
                  <img
                    src={backUrl}
                    alt={`Card ${cardid}`}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-foreground/30 select-none">
                    {cardid}
                  </span>
                </div>
              </div>

              <div
                className={`absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                style={{ transform: `translateX(-50%) rotate(-${s.rotation}deg)` }}
              >
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6 bg-background border-border"
                  onClick={(e) => { e.stopPropagation(); rotate(asset.id, 'ccw'); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6 bg-background border-border"
                  onClick={(e) => { e.stopPropagation(); rotate(asset.id, 'cw'); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <RotateCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}