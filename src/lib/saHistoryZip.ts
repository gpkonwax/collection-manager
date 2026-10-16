/**
 * Session-only "history ZIPs": per-card history shards (<prefix>/by-asset/*.json)
 * loaded from a user-selected ZIP. When loaded, card history reads from here
 * before raw GitHub — the same rule the records ZIP follows for mints and
 * holders. Raw shard bytes are kept and parsed lazily per shard so loading
 * stays fast. One instance per history: SimpleAssets (sa-history) and
 * AtomicAssets (aa-history).
 */
import { unzipSync, strFromU8 } from 'fflate';

export interface SaHistoryZipIndex {
  generatedAt?: string;
  complete?: boolean;
  upTo?: string | null;
  cards?: number;
  shards?: Record<string, { sha256?: string; count?: number }>;
}

export interface LoadedSaHistory {
  fileName: string;
  loadedAt: number;
  generatedAt: string | null;
  complete: boolean;
  upTo: string | null;
  cardCount: number;
  shardKeys: Set<string>;
  shards: Map<string, Uint8Array>;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createHistoryZip<Shard = Record<string, unknown>>(prefix: string, defaultName: string) {
  let current: LoadedSaHistory | null = null;
  const parsedCache = new Map<string, Shard>();
  const listeners = new Set<() => void>();
  const keyRe = new RegExp(`(?:^|/)${prefix}/by-asset/(\\d{3}|index)\\.json$`);
  const shardKey = (p: string): string | null => p.replace(/\\/g, '/').match(keyRe)?.[1] ?? null;

  return {
    subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
    get(): LoadedSaHistory | null { return current; },
    clear(): void { current = null; parsedCache.clear(); listeners.forEach((l) => l()); },
    /** Parse + verify. Throws a plain-language Error on failure; never replaces the current load on failure. */
    async load(file: Blob & { name?: string }): Promise<LoadedSaHistory> {
      let entries: Record<string, Uint8Array>;
      try {
        // The ZIP also carries the large raw event log; only per-card shards are decompressed.
        entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => shardKey(f.name) !== null });
      } catch {
        throw new Error("That file isn't a readable ZIP.");
      }
      const files = new Map<string, Uint8Array>();
      for (const [name, data] of Object.entries(entries)) {
        const key = shardKey(name);
        if (key) files.set(key, data);
      }
      const indexBytes = files.get('index');
      if (!indexBytes) throw new Error(`This ZIP doesn't contain the card history (${prefix}/by-asset/index.json missing).`);
      let index: SaHistoryZipIndex;
      try { index = JSON.parse(strFromU8(indexBytes)); } catch { throw new Error('The history index inside the ZIP is damaged.'); }
      const expected = index.shards ?? {};
      const shards = new Map<string, Uint8Array>();
      for (const [key, meta] of Object.entries(expected)) {
        const bytes = files.get(key);
        if (!bytes) throw new Error(`The ZIP is incomplete — history file ${key}.json is missing.`);
        if (meta?.sha256 && (await sha256Hex(bytes)) !== meta.sha256) throw new Error(`History file ${key}.json is damaged (checksum mismatch).`);
        shards.set(key, bytes);
      }
      current = {
        fileName: file.name ?? defaultName,
        loadedAt: Date.now(),
        generatedAt: index.generatedAt ?? null,
        complete: !!index.complete,
        upTo: index.upTo ?? null,
        cardCount: typeof index.cards === 'number' ? index.cards : 0,
        shardKeys: new Set(Object.keys(expected)),
        shards,
      };
      parsedCache.clear();
      listeners.forEach((l) => l());
      return current;
    },
    /** Parsed shard: object, `{}` if the index lists no cards here, or null if no ZIP. */
    shard(key: string): Shard | null {
      if (!current) return null;
      if (!current.shardKeys.has(key)) return {} as Shard;
      const cached = parsedCache.get(key);
      if (cached) return cached;
      const bytes = current.shards.get(key);
      if (!bytes) return {} as Shard;
      try {
        const parsed = JSON.parse(strFromU8(bytes)) as Shard;
        parsedCache.set(key, parsed);
        return parsed;
      } catch {
        return {} as Shard;
      }
    },
  };
}

export const SA_HISTORY_ZIP_NAME = 'gpk-sa-history.zip';
export const SA_HISTORY_ZIP_URL =
  `https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/${SA_HISTORY_ZIP_NAME}`;

const sa = createHistoryZip<Record<string, unknown[]>>('sa-history', SA_HISTORY_ZIP_NAME);
export const subscribeSaHistoryZip = sa.subscribe;
export const getLoadedSaHistory = sa.get;
export const clearSaHistoryZip = sa.clear;
export const loadSaHistoryZip = sa.load;
export const getSaHistoryZipShard = sa.shard;
