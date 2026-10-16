import bundled from '@/data/wax-usd-daily.json';

/** Daily WAX/USD close by UTC day. Bundled table (2020-06 → 2026-10-14) first,
 *  then CheeseHub's token-price-data branch for newer days. */
const TABLE: Record<string, number> = (bundled as { prices: Record<string, number> }).prices;
const CHEESEHUB = 'https://raw.githubusercontent.com/cheesehubwax/cheesehub/token-price-data/data/days/';

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function bundledWaxUsd(ms: number): number | undefined {
  return TABLE[utcDay(ms)];
}

const cache = new Map<string, Promise<Record<string, number> | null>>();
function cheeseDay(d: string) {
  let p = cache.get(d);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(`${CHEESEHUB}${d}.json`, { signal: AbortSignal.timeout(6000) });
        if (!r.ok) return null;
        const j = await r.json();
        const prices: Record<string, number> = { ...(j.prices ?? {}) };
        if (typeof j.waxUsd === 'number') prices.__waxUsd = j.waxUsd;
        return prices;
      } catch { return null; }
    })();
    cache.set(d, p);
  }
  return p;
}

/** USD value of a sale on its UTC day, or undefined when no price exists. */
export async function saleUsd(amount: number, token: string | undefined, ms: number, contract?: string): Promise<number | undefined> {
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const sym = (token || 'WAX').toUpperCase();
  if (sym === 'WAX') {
    const b = bundledWaxUsd(ms);
    if (b != null) return amount * b;
  }
  const rec = await cheeseDay(utcDay(ms));
  const wax = rec?.__waxUsd;
  if (!rec || typeof wax !== 'number') return undefined;
  if (sym === 'WAX') return amount * wax;
  // CheeseHub prices are quoted in WAX per token.
  const key = contract ? `${contract}:${sym}` : Object.keys(rec).find((k) => k.endsWith(`:${sym}`));
  const inWax = key ? rec[key] : undefined;
  return typeof inWax === 'number' ? amount * inWax * wax : undefined;
}

export const fmtUsd = (v: number) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })}`;
