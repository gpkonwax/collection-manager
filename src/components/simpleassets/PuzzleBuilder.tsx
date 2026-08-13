import { useState, useCallback, useRef, useEffect, useMemo, PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { RotateCw, RotateCcw, Shuffle, Timer, Flag, Puzzle, BookOpen, X, Image as ImageIcon, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buildGpkCardBackUrl } from '@/lib/gpkCardImages';
import { PUZZLE_CARD_IDS } from '@/lib/puzzlePieces';
import { EXTRA_PUZZLES, NFT_SERIES2_REFERENCE_URL, getExtraPuzzle } from '@/lib/extraPuzzles';
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
  /**
   * Optional slot for a JSON import/export control rendered in the toolbar.
   * Pass the unified <JsonMenu /> from the parent so import/export is consistent across views.
   * When provided, the built-in Save/Load JSON buttons are hidden.
   */
  jsonMenuSlot?: ReactNode;
}

const TOTAL_PUZZLE_PIECES = 18;
const NFT_PUZZLE_ID = 'nft';

/** A single draggable tile on the canvas, from either an NFT or a static image */
interface CanvasPiece {
  key: string;
  label: string;
  /** IPFS-backed url (NFT puzzle) */
  ipfsUrl?: string | null;
  /** Plain https url (extra puzzles) */
  imageUrl?: string;
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

function columnsFor(count: number): number {
  return count > 18 ? 7 : 6;
}

/** Frame geometry per puzzle artwork orientation */
interface PieceFrame {
  w: number;
  h: number;
  defaultRotation: number;
  /** Extra puzzle scans are landscape and must never be cropped */
  contain: boolean;
}

/** NFT Series 2 pieces are portrait card backs that lie down when rotated 90deg */
const PORTRAIT_FRAME: PieceFrame = { w: 120, h: 168, defaultRotation: 90, contain: false };
/** Classic geepeekay scans are already landscape (350x250) */
const LANDSCAPE_FRAME: PieceFrame = { w: 168, h: 120, defaultRotation: 0, contain: true };

function frameFor(puzzleId: string): PieceFrame {
  return puzzleId === NFT_PUZZLE_ID ? PORTRAIT_FRAME : LANDSCAPE_FRAME;
}

function defaultSlot(index: number, count: number, frame: PieceFrame): PieceState {
  const cols = columnsFor(count);
  return {
    x: 20 + (index % cols) * (frame.w + 30),
    y: 20 + Math.floor(index / cols) * (frame.h + 42),
    rotation: frame.defaultRotation,
  };
}

function buildDefaultLayout(pieces: CanvasPiece[], frame: PieceFrame): Map<string, PieceState> {
  const m = new Map<string, PieceState>();
  pieces.forEach((p, i) => {
    m.set(p.key, defaultSlot(i, pieces.length, frame));
  });
  return m;
}

function applyImportedState(
  pieces: CanvasPiece[],
  imported: PuzzlePieceMap,
  keyOf: (p: CanvasPiece) => string,
  frame: PieceFrame,
): Map<string, PieceState> {
  const m = new Map<string, PieceState>();
  pieces.forEach((p, i) => {
    const saved = imported[keyOf(p)];
    if (saved) {
      m.set(p.key, { x: saved.x, y: saved.y, rotation: saved.rotation });
    } else {
      m.set(p.key, defaultSlot(i, pieces.length, frame));
    }
  });
  return m;
}


export function PuzzleBuilder({ assets, initialPieceState, onPiecesChange, onSwitchToBinder, jsonMenuSlot }: PuzzleBuilderProps) {
  const puzzleAssets = useMemo(() => deduplicateByCardId(assets.filter(isPuzzlePiece)), [assets]);
  const nftUnlocked = puzzleAssets.length >= TOTAL_PUZZLE_PIECES;

  const [activeId, setActiveId] = useState<string>(NFT_PUZZLE_ID);
  const activePuzzle = activeId === NFT_PUZZLE_ID ? null : getExtraPuzzle(activeId);

  /** cardid map for the NFT puzzle (portable/export shape) */
  const nftCardIdByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of puzzleAssets) m.set(a.id, String(getCardId(a)));
    return m;
  }, [puzzleAssets]);

  const canvasPieces: CanvasPiece[] = useMemo(() => {
    if (activePuzzle) {
      return activePuzzle.pieces.map(p => ({ key: p.key, label: p.label, imageUrl: p.url }));
    }
    return puzzleAssets.map(a => {
      const cardid = getCardId(a);
      return { key: a.id, label: String(cardid), ipfsUrl: buildGpkCardBackUrl('gpktwoeight', cardid) };
    });
  }, [activePuzzle, puzzleAssets]);

  const keyToCardId = useCallback((p: CanvasPiece) => nftCardIdByKey.get(p.key) ?? p.key, [nftCardIdByKey]);

  const [pieces, setPieces] = useState<Map<string, PieceState>>(() => {
    const initialPieces: CanvasPiece[] = puzzleAssets.map(a => ({ key: a.id, label: '' }));
    if (initialPieceState && Object.keys(initialPieceState).length > 0) {
      const cardIdMap = new Map(puzzleAssets.map(a => [a.id, String(getCardId(a))]));
      return applyImportedState(initialPieces, initialPieceState, p => cardIdMap.get(p.key) ?? p.key, PORTRAIT_FRAME);
    }
    return buildDefaultLayout(initialPieces, PORTRAIT_FRAME);

  });

  /** Per-puzzle layout memory so switching back and forth keeps progress */
  const layoutsRef = useRef<Map<string, Map<string, PieceState>>>(new Map());

  const referenceUrl = activePuzzle ? activePuzzle.referenceUrl : NFT_SERIES2_REFERENCE_URL;
  const [referenceOpen, setReferenceOpen] = useState(false);

  // Report changes to parent (export only tracks the NFT puzzle)
  const notifyParent = useCallback((map: Map<string, PieceState>) => {
    if (activeId !== NFT_PUZZLE_ID) return;
    const result: PuzzlePieceMap = {};
    for (const [key, state] of map) {
      const cid = nftCardIdByKey.get(key);
      if (cid) result[cid] = state;
    }
    onPiecesChange?.(result);
  }, [activeId, nftCardIdByKey, onPiecesChange]);

  // Re-apply when initialPieceState changes (e.g. new import) — always targets the NFT puzzle
  const prevInitial = useRef(initialPieceState);
  useEffect(() => {
    if (initialPieceState !== prevInitial.current) {
      prevInitial.current = initialPieceState;
      if (initialPieceState && Object.keys(initialPieceState).length > 0) {
        const nftPieces: CanvasPiece[] = puzzleAssets.map(a => ({ key: a.id, label: '' }));
        const next = applyImportedState(nftPieces, initialPieceState, p => nftCardIdByKey.get(p.key) ?? p.key, PORTRAIT_FRAME);
        layoutsRef.current.set(NFT_PUZZLE_ID, next);
        setActiveId(NFT_PUZZLE_ID);
        setScrambled(false);
        setPieces(next);
        const result: PuzzlePieceMap = {};
        for (const [key, state] of next) {
          const cid = nftCardIdByKey.get(key);
          if (cid) result[cid] = state;
        }
        onPiecesChange?.(result);
      }
    }
  }, [initialPieceState, puzzleAssets, nftCardIdByKey, onPiecesChange]);

  const handleSelectPuzzle = useCallback((nextId: string) => {
    if (nextId === activeId) return;
    setPieces(current => {
      layoutsRef.current.set(activeId, current);
      return current;
    });
    const saved = layoutsRef.current.get(nextId);
    const nextPuzzle = nextId === NFT_PUZZLE_ID ? null : getExtraPuzzle(nextId);
    const nextPieces: CanvasPiece[] = nextPuzzle
      ? nextPuzzle.pieces.map(p => ({ key: p.key, label: p.label }))
      : puzzleAssets.map(a => ({ key: a.id, label: '' }));
    setActiveId(nextId);
    setScrambled(false);
    setPieces(saved ?? buildDefaultLayout(nextPieces, frameFor(nextId)));
  }, [activeId, puzzleAssets]);

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

  // Pieces stay locked (no drag/rotate) until Scramble is pressed at least once
  const [scrambled, setScrambled] = useState(false);

  

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
    if (!scrambled) return;
    setPieces(prev => {
      const next = new Map(prev);
      const s = next.get(id) ?? { x: 0, y: 0, rotation: 0 };
      next.set(id, { ...s, rotation: (s.rotation + (dir === 'cw' ? 90 : 270)) % 360 });
      notifyParent(next);
      return next;
    });
  }, [notifyParent, scrambled]);

  const handlePointerDown = useCallback((id: string, e: RPointerEvent<HTMLDivElement>) => {
    if (!scrambled) return;
    e.preventDefault();
    const s = pieces.get(id) ?? { x: 0, y: 0, rotation: 0 };
    dragging.current = { id, startX: e.clientX, startY: e.clientY, origX: s.x, origY: s.y };
    setSelectedId(id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pieces, scrambled]);

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
    const data: PuzzlePieceMap = {};
    for (const [key, state] of pieces) {
      data[activeId === NFT_PUZZLE_ID ? (nftCardIdByKey.get(key) ?? key) : key] = state;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `puzzle-layout-${activeId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pieces, activeId, nftCardIdByKey]);

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
        const next = applyImportedState(canvasPieces, data, activeId === NFT_PUZZLE_ID ? keyToCardId : (p) => p.key, frameFor(activeId));
        setPieces(next);
        setScrambled(false);
        notifyParent(next);
        setLoadedFileName(file.name);
      } catch {
        console.error('Invalid puzzle JSON file');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-loaded
    e.target.value = '';
  }, [canvasPieces, activeId, keyToCardId, notifyParent]);

  const frame = frameFor(activeId);

  const handleClearJson = useCallback(() => {
    const next = buildDefaultLayout(canvasPieces, frameFor(activeId));
    setPieces(next);
    setScrambled(false);
    notifyParent(next);
    setLoadedFileName(null);
  }, [canvasPieces, activeId, notifyParent]);

  const scramble = useCallback(() => {
    const canvasW = canvasRef.current?.clientWidth ?? 800;
    const canvasH = canvasRef.current?.clientHeight ?? 500;
    const f = frameFor(activeId);
    const rotations = [0, 90, 180, 270];
    setPieces(prev => {
      const next = new Map(prev);
      for (const [id] of next) {
        next.set(id, {
          x: Math.floor(Math.random() * Math.max(canvasW - (f.w + 20), 100)),
          y: Math.floor(Math.random() * Math.max(canvasH - (f.h + 22), 100)),
          rotation: rotations[Math.floor(Math.random() * 4)],
        });
      }

      notifyParent(next);
      return next;
    });
    setScrambled(true);
    if (timerEnabled) {
      timerStart.current = Date.now();
      setElapsedMs(0);
      setTimerRunning(true);
    }
  }, [notifyParent, timerEnabled, activeId]);

  const referenceControl = (
    <>
      <button
        type="button"
        onClick={() => setReferenceOpen(true)}
        className="flex items-center gap-2 rounded-md border border-cheese/30 bg-muted/40 px-2 py-1 hover:border-cheese transition-colors"
        title="See what the completed puzzle looks like"
      >
        <img
          src={referenceUrl}
          alt="Completed puzzle reference"
          loading="lazy"
          className="h-8 w-8 rounded object-cover"
        />
        <span className="text-xs font-medium text-cheese flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> Reference
        </span>
      </button>
      <Dialog open={referenceOpen} onOpenChange={setReferenceOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {activePuzzle ? `${activePuzzle.series} — ${activePuzzle.name}` : 'OS2 — Leaky Lindsay / Messy Tessie'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              The completed picture and the exact card numbers needed to build it.
            </DialogDescription>
          </DialogHeader>
          <img
            src={referenceUrl}
            alt="Completed puzzle reference sheet"
            className="w-full max-h-[75vh] object-contain rounded-md"
          />
        </DialogContent>
      </Dialog>
    </>
  );

  if (!nftUnlocked) {
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
        <p className="text-xs text-muted-foreground max-w-md mx-auto flex items-center justify-center gap-1.5">
          <Lock className="h-3.5 w-3.5" />
          {EXTRA_PUZZLES.length} classic GPK puzzles (OS2 2nd/3rd printing, OS3, OS4, OS5) unlock with it.
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
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={activeId} onValueChange={handleSelectPuzzle}>
            <SelectTrigger className="w-[280px] border-cheese/30 text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectGroup>
                <SelectLabel>Your NFTs</SelectLabel>
                <SelectItem value={NFT_PUZZLE_ID}>Series 2 — Leaky Lindsay / Messy Tessie (18)</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Classic GPK puzzles</SelectLabel>
                {EXTRA_PUZZLES.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.series} — {p.name} ({p.pieces.length})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {referenceControl}
        </div>
        <p className="text-sm text-muted-foreground">
          {canvasPieces.length} piece{canvasPieces.length !== 1 ? 's' : ''} · Drag to position · Click arrows to rotate 90°
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
          {jsonMenuSlot && activeId === NFT_PUZZLE_ID ? (
            jsonMenuSlot
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10"
                onClick={handleSaveJson}
              >
                Save JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10"
                onClick={handleLoadJson}
              >
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
            </>
          )}
        </div>
      </div>

      <div
        ref={canvasRef}
        className="relative border border-border rounded-lg bg-muted/20 overflow-auto"
        style={{ width: '100%', height: '70vh', minHeight: 500 }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {!scrambled && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
            <div className="rounded-lg bg-background/70 backdrop-blur-sm border border-cheese/40 px-5 py-3 text-center">
              <span className="text-cheese font-semibold text-base sm:text-lg drop-shadow">
                Press the Scramble button to start the puzzle
              </span>
            </div>
          </div>
        )}
        {canvasPieces.map(piece => {
          const s = getState(piece.key);
          const isSelected = selectedId === piece.key;

          return (
            <div
              key={piece.key}
              className={`absolute select-none group ${isSelected ? 'z-50 hover:z-50' : 'z-10 hover:z-40'}`}
              style={{
                left: s.x,
                top: s.y,
                width: frame.w,
                height: frame.h,

              }}
              onClick={() => setSelectedId(piece.key)}
            >
              <div
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{
                  transform: `rotate(${s.rotation}deg)`,
                  transformOrigin: 'center center',
                }}
                onPointerDown={(e) => handlePointerDown(piece.key, e)}
              >
                <div className={`w-full h-full rounded-md overflow-hidden border-2 transition-colors ${isSelected ? 'border-cheese shadow-lg shadow-cheese/20' : 'border-border'}`}>
                  {piece.imageUrl ? (
                    <img
                      src={piece.imageUrl}
                      alt={`Puzzle piece ${piece.label}`}
                      loading="lazy"
                      draggable={false}
                      className={`w-full h-full pointer-events-none ${frame.contain ? 'object-fill' : 'object-cover'}`}

                    />
                  ) : piece.ipfsUrl ? (
                    <IpfsMedia
                      url={piece.ipfsUrl}
                      alt={`Card ${piece.label}`}
                      className="w-full h-full object-cover pointer-events-none"
                      context="card"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">No image</div>
                  )}
                </div>
              </div>

              <div
                className={`absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-1 z-30 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6 bg-background border-border"
                  onClick={(e) => { e.stopPropagation(); rotate(piece.key, 'ccw'); }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-6 w-6 bg-background border-border"
                  onClick={(e) => { e.stopPropagation(); rotate(piece.key, 'cw'); }}
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
