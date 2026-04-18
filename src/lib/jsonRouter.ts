import type { PuzzlePieceMap } from '@/components/simpleassets/PuzzleBuilder';

export type JsonKind = 'alerts' | 'layout' | 'puzzle' | 'unknown';

export interface DetectedAlerts {
  kind: 'alerts';
  raw: string;
  parsed: unknown;
}
export interface DetectedLayout {
  kind: 'layout';
  raw: string;
  parsed: { account?: string; category?: string; orders?: unknown; puzzle?: PuzzlePieceMap };
}
export interface DetectedPuzzle {
  kind: 'puzzle';
  raw: string;
  parsed: PuzzlePieceMap;
}
export interface DetectedUnknown {
  kind: 'unknown';
  raw: string;
  parsed: unknown;
}

export type Detected = DetectedAlerts | DetectedLayout | DetectedPuzzle | DetectedUnknown;

const KIND_LABELS: Record<JsonKind, string> = {
  alerts: 'Alerts',
  layout: 'Saved Layout',
  puzzle: 'Puzzle',
  unknown: 'Unknown',
};

export function kindLabel(kind: JsonKind): string {
  return KIND_LABELS[kind];
}

/**
 * Detect the shape of a parsed JSON payload.
 *  - alerts: { alerts: [...] } (typically also has version/exportedAt)
 *  - layout: { orders: ... } and/or { account, category }
 *  - puzzle: a flat record where every value looks like { x, y, rotation }
 */
export function detectKind(parsed: unknown): JsonKind {
  if (!parsed || typeof parsed !== 'object') return 'unknown';
  const obj = parsed as Record<string, any>;

  if (Array.isArray(obj.alerts)) return 'alerts';
  if (obj.orders && typeof obj.orders === 'object') return 'layout';

  // Puzzle: every value is { x:number, y:number, rotation:number }
  const entries = Object.entries(obj);
  if (entries.length > 0) {
    const allPieces = entries.every(([, v]) =>
      v && typeof v === 'object' &&
      typeof (v as any).x === 'number' &&
      typeof (v as any).y === 'number' &&
      typeof (v as any).rotation === 'number'
    );
    if (allPieces) return 'puzzle';
  }

  return 'unknown';
}

export function parseAndDetect(raw: string): Detected {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unknown', raw, parsed: null };
  }
  const kind = detectKind(parsed);
  switch (kind) {
    case 'alerts':
      return { kind, raw, parsed };
    case 'layout':
      return { kind, raw, parsed: parsed as DetectedLayout['parsed'] };
    case 'puzzle':
      return { kind, raw, parsed: parsed as PuzzlePieceMap };
    default:
      return { kind: 'unknown', raw, parsed };
  }
}

export interface RouterHandlers {
  onAlerts: (raw: string) => { added: number; updated: number; skipped: string[] };
  onLayout: (parsed: DetectedLayout['parsed'], filename: string) => { cards: number; hasPuzzle: boolean };
  onPuzzle: (parsed: PuzzlePieceMap) => { pieces: number };
}

export interface RouteResult {
  filename: string;
  kind: JsonKind;
  ok: boolean;
  message?: string;
  // Per-kind summaries
  alerts?: { added: number; updated: number; skipped: string[] };
  layout?: { cards: number; hasPuzzle: boolean };
  puzzle?: { pieces: number };
}

export function routeOne(
  filename: string,
  raw: string,
  handlers: RouterHandlers
): RouteResult {
  const detected = parseAndDetect(raw);
  try {
    switch (detected.kind) {
      case 'alerts': {
        const r = handlers.onAlerts(raw);
        return { filename, kind: 'alerts', ok: true, alerts: r };
      }
      case 'layout': {
        const r = handlers.onLayout(detected.parsed, filename);
        return { filename, kind: 'layout', ok: true, layout: r };
      }
      case 'puzzle': {
        const r = handlers.onPuzzle(detected.parsed);
        return { filename, kind: 'puzzle', ok: true, puzzle: r };
      }
      default:
        return { filename, kind: 'unknown', ok: false, message: 'Unrecognized JSON shape' };
    }
  } catch (err) {
    return {
      filename,
      kind: detected.kind,
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to apply file',
    };
  }
}

// ---------- Recent files cache ----------

const RECENT_KEY = 'gpk:recent-jsons';
const RECENT_CAP = 8;

export interface RecentJsonEntry {
  id: string;            // unique key for React lists / removal
  filename: string;
  kind: JsonKind;
  raw: string;           // cached parsed JSON serialized as text
  importedAt: string;    // ISO
}

export function loadRecentJsons(): RecentJsonEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e) =>
        e &&
        typeof e.id === 'string' &&
        typeof e.filename === 'string' &&
        typeof e.kind === 'string' &&
        typeof e.raw === 'string'
    );
  } catch {
    return [];
  }
}

function saveRecentJsons(entries: RecentJsonEntry[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('Failed to persist recent JSONs', err);
  }
}

export function addRecentJson(entry: Omit<RecentJsonEntry, 'id' | 'importedAt'>): RecentJsonEntry[] {
  const list = loadRecentJsons();
  // Dedupe by filename + kind: the newer one wins, bumped to front.
  const filtered = list.filter((e) => !(e.filename === entry.filename && e.kind === entry.kind));
  const next: RecentJsonEntry = {
    ...entry,
    id: `${entry.kind}:${entry.filename}:${Date.now()}`,
    importedAt: new Date().toISOString(),
  };
  const out = [next, ...filtered].slice(0, RECENT_CAP);
  saveRecentJsons(out);
  return out;
}

export function removeRecentJson(id: string): RecentJsonEntry[] {
  const list = loadRecentJsons().filter((e) => e.id !== id);
  saveRecentJsons(list);
  return list;
}

export const RECENT_JSONS_CAP = RECENT_CAP;
