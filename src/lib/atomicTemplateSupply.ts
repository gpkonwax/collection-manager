import { ATOMIC_API } from '@/lib/waxConfig';
import { fetchWithFallback } from '@/lib/fetchWithFallback';

export interface AtomicTemplateSupply {
  minted: number;
  circulating: number;
  burned: number;
}

const cache = new Map<string, { time: number; supply: AtomicTemplateSupply }>();
const pending = new Map<string, Promise<AtomicTemplateSupply>>();
const TTL = 5 * 60 * 1000;

export function parseAtomicTemplateSupply(data: { assets?: unknown; burned?: unknown }): AtomicTemplateSupply {
  const count = (value: unknown) => {
    if (value === undefined || value === null || String(value).trim() === '') throw new Error('Missing template supply');
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid template supply');
    return n;
  };
  const minted = count(data.assets);
  const burned = count(data.burned);
  if (burned > minted) throw new Error('Burned supply exceeds minted supply');
  return { minted, burned, circulating: minted - burned };
}

export function getAtomicTemplateSupply(collection: string, templateId: string): Promise<AtomicTemplateSupply> {
  const key = `${collection}:${templateId}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < TTL) return Promise.resolve(cached.supply);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const request = (async () => {
    try {
      const path = `${ATOMIC_API.paths.templates}/${encodeURIComponent(collection)}/${encodeURIComponent(templateId)}/stats`;
      const response = await fetchWithFallback(ATOMIC_API.baseUrls, path, undefined, 8000);
      const json = await response.json();
      if (!json.success || !json.data) throw new Error('Template supply unavailable');
      const supply = parseAtomicTemplateSupply(json.data);
      cache.set(key, { time: Date.now(), supply });
      return supply;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, request);
  return request;
}