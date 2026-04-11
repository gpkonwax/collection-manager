import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';

export interface CachedTemplate {
  template_id: string;
  schema_name: string;
  immutable_data: Record<string, any>;
}

const CACHE_KEY = 'gpk_templates_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let memoryCache: CachedTemplate[] | null = null;
let memoryCacheTime = 0;
let inflightPromise: Promise<CachedTemplate[]> | null = null;

function loadFromSession(): CachedTemplate[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data as CachedTemplate[];
  } catch {
    return null;
  }
}

function saveToSession(data: CachedTemplate[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // quota exceeded — memory cache still works
  }
}

async function fetchAllTemplates(): Promise<CachedTemplate[]> {
  const all: CachedTemplate[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      collection_name: 'gpk.topps',
      limit: '1000',
      page: String(page),
      order: 'asc',
      sort: 'created',
    });
    const path = `${ATOMIC_API.paths.templates}?${params}`;
    const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 15000);
    const json = await response.json();
    if (!json.success || !json.data || json.data.length === 0) break;

    for (const t of json.data) {
      all.push({
        template_id: t.template_id,
        schema_name: t.schema?.schema_name || '',
        immutable_data: t.immutable_data || {},
      });
    }

    hasMore = json.data.length === 1000;
    page++;
  }

  return all;
}

/**
 * Returns all gpk.topps templates, fetching only if not cached.
 * Deduplicates concurrent calls so only one fetch happens.
 */
export async function getAllTemplates(): Promise<CachedTemplate[]> {
  // 1. Memory cache
  if (memoryCache && Date.now() - memoryCacheTime < CACHE_TTL) {
    return memoryCache;
  }

  // 2. Session storage cache
  const fromSession = loadFromSession();
  if (fromSession) {
    memoryCache = fromSession;
    memoryCacheTime = Date.now();
    return fromSession;
  }

  // 3. Fetch (deduplicate concurrent calls)
  if (!inflightPromise) {
    inflightPromise = fetchAllTemplates().then((data) => {
      memoryCache = data;
      memoryCacheTime = Date.now();
      saveToSession(data);
      inflightPromise = null;
      return data;
    }).catch((err) => {
      inflightPromise = null;
      throw err;
    });
  }

  return inflightPromise;
}

/** Get templates filtered by schema name */
export async function getTemplatesBySchema(schema: string): Promise<CachedTemplate[]> {
  const all = await getAllTemplates();
  return all.filter((t) => t.schema_name === schema);
}
