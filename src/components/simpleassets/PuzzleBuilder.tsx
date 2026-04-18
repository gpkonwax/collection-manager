import { useState, useCallback, useRef, useEffect, useMemo, PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { RotateCw, RotateCcw, Shuffle, Timer, Flag, Puzzle, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { buildGpkCardBackUrl } from '@/lib/gpkCardImages';
import { PUZZLE_CARD_IDS } from '@/lib/puzzlePieces';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
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
  /** Called when user wants to switch to binder view to find missing pieces */
  onSwitchToBinder?: () => void;
}

const TOTAL_PUZZLE_PIECES = 18;

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
    m.set(a.id, { x: 20 + (i % cols) * 150, y: 20 + Math.floor(i / cols) * 210, rotation: 90 });
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
      m.set(a.id, { x: 20 + (i % cols) * 150, y: 20 + Math.floor(i / cols) * 210, rotation: 90 });
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

export function PuzzleBuilder({ assets, initialPieceState, onPiecesChange, onSwitchToBinder }: PuzzleBuilderProps) {
  const puzzleAssets = useMemo(() => deduplicateByCardId(assets.filter(isPuzzlePiece)), [assets]);

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
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const piecesRef = useRef(pieces);
  useEffect(() => { piecesRef.current = pieces; }, [pieces]);

  // Timer race mode
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerStart = useRef<number>(0);
  

  useEffect(() => {
    if (!timerRunning) return;
    const iv = setInterval(() => {
      setElapsedMs(Date.now() - timerStart.current);
    }, 100);
    return () => clearInterval(iv);
  }, [timerRunning]);

  const formatTime = (ms: number) => {
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = Math.floor(totalSec % 60);
    const tenths = Math.floor((totalSec * 10) % 10);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${tenths}`;
  };

  const handleFinish = useCallback(() => {
    setTimerRunning(false);
  }, []);

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

  const handleSaveJson = useCallback(() => {
    const data = toCardIdMap(pieces, puzzleAssets);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'puzzle-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [pieces, puzzleAssets]);

  const handleLoadJson = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as PuzzlePieceMap;
        const next = applyImportedState(puzzleAssets, data);
        setPieces(next);
        notifyParent(next);
        setLoadedFileName(file.name);
      } catch {
        console.error('Invalid puzzle JSON file');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-loaded
    e.target.value = '';
  }, [puzzleAssets, notifyParent]);

  const handleClearJson = useCallback(() => {
    const next = buildDefaultLayout(puzzleAssets);
    setPieces(next);
    notifyParent(next);
    setLoadedFileName(null);
  }, [puzzleAssets, notifyParent]);

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
    if (timerEnabled) {
      timerStart.current = Date.now();
      setElapsedMs(0);
      setTimerRunning(true);
    }
  }, [notifyParent, timerEnabled]);

  if (puzzleAssets.length < TOTAL_PUZZLE_PIECES) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="mx-auto h-20 w-20 rounded-full bg-cheese/10 flex items-center justify-center">
          <Puzzle className="h-10 w-10 text-cheese" />
        </div>
        <p className="text-lg font-medium text-foreground">
          You have {puzzleAssets.length} of {TOTAL_PUZZLE_PIECES} puzzle pieces
        </p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Collect all {TOTAL_PUZZLE_PIECES} Series 2 puzzle pieces to unlock the Puzzle Builder. Once unlocked, your collected pieces auto-populate onto the canvas. Check the Collection Binder to see which pieces you're missing!
        </p>
        {onSwitchToBinder && (
          <Button
            variant="outline"
            className="border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10"
            onClick={onSwitchToBinder}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            View in Collection Binder
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {puzzleAssets.length} puzzle piece{puzzleAssets.length !== 1 ? 's' : ''} · Drag to position · Click arrows to rotate 90°
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="timer-toggle"
              checked={timerEnabled}
              onCheckedChange={(v) => {
                setTimerEnabled(!!v);
                if (!v) { setTimerRunning(false); setElapsedMs(0); }
              }}
            />
            <Label htmlFor="timer-toggle" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" /> Timer
            </Label>
          </div>
          {timerEnabled && !timerRunning && elapsedMs === 0 && (
            <span className="text-xs text-muted-foreground italic">*Press Scramble to start the timer</span>
          )}
          {timerEnabled && (
            <span className={`font-mono text-sm tabular-nums ${timerRunning ? 'text-cheese' : 'text-muted-foreground'}`}>
              {formatTime(elapsedMs)}
            </span>
          )}
          {timerRunning && (
            <Button
              variant="outline"
              size="sm"
              className="border-green-500/30 text-green-400 hover:border-green-500 hover:bg-green-500/10"
              onClick={handleFinish}
            >
              <Flag className="h-4 w-4 mr-1" />
              Finish
            </Button>
          )}
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
        <div className="flex items-center gap-2 flex-wrap">
          {loadedFileName && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded flex items-center gap-1">
              📄 {loadedFileName}
              <button onClick={handleClearJson} className="hover:text-foreground ml-1" title="Clear layout">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10"
            onClick={handleSaveJson}
          >
            <Download className="h-4 w-4 mr-1" />
            Save JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10"
            onClick={handleLoadJson}
          >
            <Upload className="h-4 w-4 mr-1" />
            Load JSON
          </Button>
          {loadedFileName && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/30 text-destructive hover:border-destructive hover:bg-destructive/10"
              onClick={handleClearJson}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
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
                  <IpfsMedia
                    url={backUrl}
                    alt={`Card ${cardid}`}
                    className="w-full h-full object-cover pointer-events-none"
                    context="card"
                    loading="eager"
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
