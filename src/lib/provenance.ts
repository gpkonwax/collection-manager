/**
 * Pack-opening provenance lookups: who opened the pack a card came from, when
 * the card was minted, which pack, and (for bridged copies) who bridged it.
 * Built by scripts/backfill-pack-provenance.mjs into manifests/provenance/.
 *
 * Lookup order: user-loaded records ZIP → data mirror shard. Missing records
 * resolve to null; callers hide the lines rather than guess.
 */
import { getDataMirrorBases } from './dataMirror';
import { getLoadedRecords, getRecordsProvenanceShard } from './recordsZip';
import { isOfflineBundle } from './offlineBundle';

export interface ProvenanceEntry {
  /** Account that opened the pack. */
  o?: string;
  /** Epoch ms the card was minted. */
  t?: number;
  /** Pack code. */
  p?: string;
  /** Cards in that pack opening. */
  n?: number;
  /** Account that bridged this AtomicAssets copy. */
  b?: string;
}

type Shard = Record<string, ProvenanceEntry>;
const DIR = 'manifests/provenance/';
const TIMEOUT_MS = 8000;
const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

let indexPromise: Promise<{ shards?: Record<string, unknown> } | null> | null = null;
const shardCache = new Map<string, Promise<Shard | null>>();

export const provenanceShardOf = (id: string) => String(id).slice(-3).padStart(3, '0');

async function fetchMirrorJson<T>(file: string): Promise<T | null> {
  if (isOfflineBundle()) return null;
  for (const base of getDataMirrorBases()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${DIR}${file}`, { signal: controller.signal });
      if (res.ok) return (await res.json()) as T;
    } catch { /* next base */ } finally { clearTimeout(timer); }
  }
  return null;
}

function loadShard(key: string): Promise<Shard | null> {
  let p = shardCache.get(key);
  if (!p) {
    p = (async () => {
      indexPromise ??= fetchMirrorJson<{ shards?: Record<string, unknown> }>('index.json');
      const index = await indexPromise;
      if (!index) { indexPromise = null; return null; }
      if (index.shards && !(key in index.shards)) return {};
      return fetchMirrorJson<Shard>(`${key}.json`);
    })().catch(() => null);
    p.then((v) => { if (v === null) shardCache.delete(key); });
    shardCache.set(key, p);
  }
  return p;
}

/** Validate a raw record; drop any field that isn't well-formed. */
export function sanitizeProvenance(raw: unknown): ProvenanceEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: ProvenanceEntry = {};
  if (typeof r.o === 'string' && ACCOUNT_RE.test(r.o)) out.o = r.o;
  if (typeof r.t === 'number' && Number.isFinite(r.t) && r.t > 0) out.t = r.t;
  if (typeof r.p === 'string' && r.p) out.p = r.p;
  if (typeof r.n === 'number' && Number.isInteger(r.n) && r.n > 0) out.n = r.n;
  if (typeof r.b === 'string' && ACCOUNT_RE.test(r.b)) out.b = r.b;
  return Object.keys(out).length ? out : null;
}

export async function getProvenance(id: string): Promise<ProvenanceEntry | null> {
  if (!/^\d+$/.test(id)) return null;
  const key = provenanceShardOf(id);
  const shard = getLoadedRecords()?.provenance ? getRecordsProvenanceShard(key) : await loadShard(key);
  return sanitizeProvenance(shard?.[id]);
}

const PACK_NAMES: Record<string, string> = {
  series1: 'Series 1',
  series2: 'Series 2',
  exotic: 'Exotic',
  crashgordon: 'Crash Gordon',
  mittens: 'Mittens',
  bernventures: 'Bernventures',
};

const PACK_CODES: Record<string, Record<number, string>> = {
  series1: { 5: 'GPKFIVE', 30: 'GPKMEGA' },
  five: { 5: 'GPKFIVE', 30: 'GPKMEGA' },
  series2: { 8: 'GPKTWOA', 25: 'GPKTWOB', 55: 'GPKTWOC' },
  gpktwoa: { 8: 'GPKTWOA', 25: 'GPKTWOB', 55: 'GPKTWOC' },
  gpktwob: { 8: 'GPKTWOA', 25: 'GPKTWOB', 55: 'GPKTWOC' },
  gpktwoc: { 8: 'GPKTWOA', 25: 'GPKTWOB', 55: 'GPKTWOC' },
  exotic: { 5: 'EXOFIVE', 25: 'EXOMEGA' },
};

export function formatPackLabel(p?: string, n?: number): string | null {
  if (!p) return null;
  const code = n ? PACK_CODES[p.toLowerCase()]?.[n] : undefined;
  if (code) return `${code} (${n} card pack)`;
  const name = PACK_NAMES[p] ?? p;
  return n ? `${name} (${n}-card pack)` : name;
}

export function formatProvenanceDate(ms?: number): string | null {
  if (!ms) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Test-only. */
export function __resetProvenanceForTests(): void {
  indexPromise = null;
  shardCache.clear();
}
