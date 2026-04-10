import { useState, useCallback, useRef, useEffect, PointerEvent as RPointerEvent } from 'react';
import { RotateCw, RotateCcw, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildGpkCardBackUrl } from '@/lib/gpkCardImages';
import { PUZZLE_CARD_IDS } from '@/lib/puzzlePieces';
import type { SimpleAsset } from '@/hooks/useSimpleAssets';

export interface PieceState {
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
}

/** Serializable puzzle state keyed by cardid (string) */
export type PuzzlePieceMap = Record<string, PieceState>;

interface PuzzleBuilderProps {
  assets: SimpleAsset[];
  /** If provided, initialises piece positions from imported JSON (keyed by cardid) */
  initialPieceState?: PuzzlePieceMap | null;
  /** Called whenever piece state changes so parent can track it for export */
  onPiecesChange?: (state: PuzzlePieceMap) => void;
}

function isPuzzlePiece(asset: SimpleAsset): boolean {
  if (!asset.cardid) return false;
  const id = typeof asset.cardid === 'string' ? parseInt(asset.cardid, 10) : asset.cardid;
  return PUZZLE_CARD_IDS.includes(id);
}

/** Deduplicate: keep only the first asset per cardid */
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

function getCardId(asset: SimpleAsset): number {
  return typeof asset.cardid === 'string' ? parseInt(asset.cardid, 10) : (asset.cardid ?? 0);
}

function buildDefaultLayout(puzzleAssets: SimpleAsset[]): Map<string, PieceState> {
  const m = new Map<string, PieceState>();
  const cols = 6;
  puzzleAssets.forEach((a, i) => {
    m.set(a.id, { x: 20 + (i % cols) * 150, y: 20 + Math.floor(i / cols) * 210, rotation: 0 });
  });
  return m;
}

function applyImportedState(puzzleAssets: SimpleAsset[], imported: PuzzlePieceMap): Map<string, PieceState> {
  const m = new Map<string, PieceState>();
  const cols = 6;
  puzzleAssets.forEach((a, i) => {
    const cid = String(getCardId(a));
    const saved = imported[cid];
    if (saved) {
      m.set(a.id, { x: saved.x, y: saved.y, rotation: saved.rotation });
    } else {
      m.set(a.id, { x: 20 + (i % cols) * 150, y: 20 + Math.floor(i / cols) * 210, rotation: 0 });
    }
  });
  return m;
}

/** Convert internal Map<assetId, PieceState> to portable Record<cardid, PieceState> */
function toCardIdMap(pieces: Map<string, PieceState>, puzzleAssets: SimpleAsset[]): PuzzlePieceMap {
  const result: PuzzlePieceMap = {};
  for (const a of puzzleAssets) {
    const s = pieces.get(a.id);
    if (s) result[String(getCardId(a))] = s;
  }
  return result;
}

export function PuzzleBuilder({ assets, initialPieceState, onPiecesChange }: PuzzleBuilderProps) {
  const puzzleAssets = deduplicateByCardId(assets.filter(isPuzzlePiece));

  const [pieces, setPieces] = useState<Map<string, PieceState>>(() => {
    if (initialPieceState && Object.keys(initialPieceState).length > 0) {
      return applyImportedState(puzzleAssets, initialPieceState);
    }
    return buildDefaultLayout(puzzleAssets);
  });

  // Re-apply when initialPieceState changes (e.g. new import)
  const prevInitial = useRef(initialPieceState);
  useEffect(() => {
    if (initialPieceState !== prevInitial.current) {
      prevInitial.current = initialPieceState;
      if (initialPieceState && Object.keys(initialPieceState).length > 0) {
        const next = applyImportedState(puzzleAssets, initialPieceState);
        setPieces(next);
        onPiecesChange?.(toCardIdMap(next, puzzleAssets));
      }
    }
  }, [initialPieceState, puzzleAssets, onPiecesChange]);

  // Report changes to parent
  const notifyParent = useCallback((map: Map<string, PieceState>) => {
    onPiecesChange?.(toCardIdMap(map, puzzleAssets));
  }, [onPiecesChange, puzzleAssets]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const getState = (id: string): PieceState => pieces.get(id) ?? { x: 0, y: 0, rotation: 0 };

  const rotate = useCallback((id: string, dir: 'cw' | 'ccw') => {
    setPieces(prev => {
      const next = new Map(prev);
      const s = next.get(id) ?? { x: 0, y: 0, rotation: 0 };
      next.set(id, { ...s, rotation: (s.rotation + (dir === 'cw' ? 90 : 270)) % 360 });
      notifyParent(next);
      return next;
    });
  }, [notifyParent]);

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
      dragging.current = null;
      // Notify parent after drag ends
      setPieces(prev => {
        notifyParent(prev);
        return prev;
      });
    }
  }, [notifyParent]);

  const scramble = useCallback(() => {
    const canvasW = canvasRef.current?.clientWidth ?? 800;
    const canvasH = canvasRef.current?.clientHeight ?? 500;
    const rotations = [0, 90, 180, 270];
    setPieces(prev => {
      const next = new Map(prev);
      for (const [id] of next) {
        next.set(id, {
          x: Math.floor(Math.random() * Math.max(canvasW - 140, 100)),
          y: Math.floor(Math.random() * Math.max(canvasH - 190, 100)),
          rotation: rotations[Math.floor(Math.random() * 4)],
        });
      }
      notifyParent(next);
      return next;
    });
  }, [notifyParent]);

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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {puzzleAssets.length} puzzle piece{puzzleAssets.length !== 1 ? 's' : ''} · Drag to position · Click arrows to rotate 90°
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10"
          onClick={scramble}
        >
          <Shuffle className="h-4 w-4 mr-1" />
          Scramble
        </Button>
      </div>
      <div
        ref={canvasRef}
        className="relative border border-border rounded-lg bg-muted/20 overflow-auto"
        style={{ width: '100%', height: '70vh', minHeight: 500 }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {puzzleAssets.map(asset => {
          const s = getState(asset.id);
          const cardid = getCardId(asset);
          const backUrl = buildGpkCardBackUrl('gpktwoeight', cardid);
          const isSelected = selectedId === asset.id;

          return (
            <div
              key={asset.id}
              className={`absolute cursor-grab active:cursor-grabbing select-none group ${isSelected ? 'z-20' : 'z-10'}`}
              style={{
                left: s.x,
                top: s.y,
                width: 120,
                height: 168,
                transform: `rotate(${s.rotation}deg)`,
                transformOrigin: 'center center',
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
