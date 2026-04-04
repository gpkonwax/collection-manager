// ============================================================================
// Template Cache - Shared NFT template metadata cache
// Provides in-memory caching with batch fetching for performance
// ============================================================================

import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { getIpfsUrl, isVideoUrl } from '@/lib/ipfsGateways';

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_SIZE = 500; // Limit memory usage

interface TemplateData {
  name: string;
  image: string;
  isVideo?: boolean;
  timestamp: number;
}

// In-memory cache for fast access
const memoryCache = new Map<string, TemplateData>();

/**
 * Generate cache key from template and collection
 */
function makeKey(templateId: string, collectionName: string): string {
  return `${collectionName}:${templateId}`;
}

/**
 * Evict oldest entries if cache exceeds max size
 */
function evictOldestIfNeeded(): void {
  if (memoryCache.size <= MAX_CACHE_SIZE) return;
  
  // Sort by timestamp and remove oldest 20%
  const entries = Array.from(memoryCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  const toRemove = Math.floor(entries.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    memoryCache.delete(entries[i][0]);
  }
  
  console.log(`[TemplateCache] Evicted ${toRemove} oldest entries`);
}

/**
 * Get cached template data if valid (not expired)
 */
export function getCachedTemplate(templateId: string, collectionName: string): TemplateData | null {
  const key = makeKey(templateId, collectionName);
  const cached = memoryCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  
  // Expired - remove from cache
  if (cached) {
    memoryCache.delete(key);
  }
  
  return null;
}

/**
 * Set template data in cache
 */
export function setCachedTemplate(
  templateId: string, 
  collectionName: string, 
  data: Omit<TemplateData, 'timestamp'>
): void {
  evictOldestIfNeeded();
  
  const key = makeKey(templateId, collectionName);
  memoryCache.set(key, { ...data, timestamp: Date.now() });
}

// Helper to resolve image URL
function resolveImageUrl(raw: string | undefined): string {
  if (!raw) return '/placeholder.svg';
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('Qm') || raw.startsWith('bafy') || raw.startsWith('bafk')) return getIpfsUrl(raw);
  return raw;
}

// Helper to extract media URL from NFT data
function getMediaUrl(data: Record<string, string>): { url: string; isVideo: boolean } {
  const imageField = data.img || data.image;
  if (imageField) {
    return { url: resolveImageUrl(imageField), isVideo: false };
  }
  const videoField = data.video;
  if (videoField) {
    return { url: resolveImageUrl(videoField), isVideo: true };
  }
  return { url: '/placeholder.svg', isVideo: false };
}

// Helper to split array into chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch fetch templates from AtomicAssets API
 */
async function fetchTemplatesBatch(
  requests: { templateId: string; collectionName: string }[]
): Promise<Map<string, { name: string; image: string; isVideo?: boolean }>> {
  const uniqueRequests = new Map<string, { templateId: string; collectionName: string }>();
  for (const req of requests) {
    if (!uniqueRequests.has(req.templateId)) {
      uniqueRequests.set(req.templateId, req);
    }
  }

  const results = new Map<string, { name: string; image: string; isVideo?: boolean }>();
  const allIds = Array.from(uniqueRequests.keys());
  
  console.log(`[TemplateCache Batch] Fetching ${allIds.length} unique templates`);

  const chunks = chunkArray(allIds, 100);
  
  for (const chunk of chunks) {
    try {
      const params = new URLSearchParams({
        ids: chunk.join(','),
        limit: '100',
      });
      const path = `${ATOMIC_API.paths.templates}?${params}`;
      const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
      const json = await response.json();

      if (json.success && json.data) {
        for (const template of json.data) {
          const data = template.immutable_data || {};
          const collectionName = template.collection?.collection_name || '';
          const key = `${collectionName}:${template.template_id}`;
          const media = getMediaUrl(data);
          results.set(key, {
            name: data.name || template.name || `Template #${template.template_id}`,
            image: media.url,
            isVideo: media.isVideo,
          });
        }
      }
    } catch (error) {
      console.warn(`[TemplateCache Batch] Batch fetch failed:`, error);
    }
  }

  // Fallback: fetch missing templates individually
  const missingTemplates = Array.from(uniqueRequests.values()).filter(req => {
    const key = `${req.collectionName}:${req.templateId}`;
    return !results.has(key);
  });

  if (missingTemplates.length > 0) {
    console.log(`[TemplateCache Batch] Fetching ${missingTemplates.length} missing templates individually`);
    
    await Promise.allSettled(
      missingTemplates.map(async ({ templateId, collectionName }) => {
        try {
          const path = `${ATOMIC_API.paths.templates}/${collectionName}/${templateId}`;
          const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 10000);
          const json = await response.json();
          if (json.success && json.data) {
            const data = json.data.immutable_data || {};
            const media = getMediaUrl(data);
            const key = `${collectionName}:${templateId}`;
            results.set(key, {
              name: data.name || `Template #${templateId}`,
              image: media.url,
              isVideo: media.isVideo,
            });
          }
        } catch {
          // Ignore individual fetch errors
        }
      })
    );
  }

  console.log(`[TemplateCache Batch] Successfully fetched ${results.size} templates`);
  return results;
}

/**
 * Batch get templates - checks cache first, fetches missing from API
 * Returns Map with keys in format "collection:templateId"
 */
export async function batchGetOrFetch(
  requests: { templateId: string; collectionName: string }[]
): Promise<Map<string, TemplateData>> {
  const results = new Map<string, TemplateData>();
  const toFetch: { templateId: string; collectionName: string }[] = [];
  
  // Check cache first
  for (const req of requests) {
    const cached = getCachedTemplate(req.templateId, req.collectionName);
    if (cached) {
      results.set(makeKey(req.templateId, req.collectionName), cached);
    } else {
      toFetch.push(req);
    }
  }
  
  console.log(`[TemplateCache] Cache hit: ${results.size}, need to fetch: ${toFetch.length}`);
  
  // Batch fetch missing from API
  if (toFetch.length > 0) {
    try {
      const fetched = await fetchTemplatesBatch(toFetch);
      
      for (const [key, data] of fetched) {
        const withTimestamp: TemplateData = { ...data, timestamp: Date.now() };
        memoryCache.set(key, withTimestamp);
        results.set(key, withTimestamp);
      }
      
      evictOldestIfNeeded();
    } catch (error) {
      console.error('[TemplateCache] Batch fetch failed:', error);
    }
  }
  
  return results;
}

/**
 * Clear all cached templates (useful for manual refresh)
 */
export function clearTemplateCache(): void {
  memoryCache.clear();
  console.log('[TemplateCache] Cache cleared');
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: memoryCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
