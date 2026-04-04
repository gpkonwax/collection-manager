const CACHE_TTL = 15 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

interface TemplateData {
  name: string;
  image: string;
  isVideo?: boolean;
  timestamp: number;
}

const memoryCache = new Map<string, TemplateData>();

function makeKey(templateId: string, collectionName: string): string {
  return `${collectionName}:${templateId}`;
}

function evictOldestIfNeeded(): void {
  if (memoryCache.size <= MAX_CACHE_SIZE) return;
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  const toRemove = Math.floor(entries.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    memoryCache.delete(entries[i][0]);
  }
}

export function getCachedTemplate(templateId: string, collectionName: string): TemplateData | null {
  const key = makeKey(templateId, collectionName);
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  if (cached) {
    memoryCache.delete(key);
  }
  return null;
}

export function setCachedTemplate(
  templateId: string,
  collectionName: string,
  data: Omit<TemplateData, 'timestamp'>
): void {
  evictOldestIfNeeded();
  const key = makeKey(templateId, collectionName);
  memoryCache.set(key, { ...data, timestamp: Date.now() });
}
