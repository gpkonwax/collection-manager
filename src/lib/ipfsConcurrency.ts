// Browser-wide concurrency limiter for IPFS image loads.
// Browsers cap ~6 connections per origin. By limiting how many <img> elements
// we mount/activate at once, we avoid overwhelming any single gateway.

const MAX_CONCURRENT = 20;

let active = 0;
const queue: Array<() => void> = [];

export function acquireSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (active < MAX_CONCURRENT) {
      active++;
      resolve();
    } else {
      queue.push(() => {
        active++;
        resolve();
      });
    }
  });
}

export function releaseSlot(): void {
  active = Math.max(0, active - 1);
  const next = queue.shift();
  if (next) next();
}

// Hash-based gateway sharding: distribute initial gateway pick across the
// healthy gateways (skip the last one which is the known-degraded fallback).
export function shardIndexForHash(hash: string, gatewayCount: number): number {
  const healthy = Math.max(1, gatewayCount - 1);
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % healthy;
}
