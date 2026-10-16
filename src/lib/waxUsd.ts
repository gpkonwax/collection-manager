import bundled from '@/data/wax-usd-daily.json';

/** Daily WAX/USD close by UTC day. CheeseHub's consolidated index on the
 *  token-price-data branch (2019-12 → today, flat {"YYYY-MM-DD": usd}) is the
 *  source of truth, fetched once per session. The bundled table
 *  (2020-06 → 2026-10-14) is the offline fallback, and CheeseHub's per-day
 *  files cover token prices and any days after the index. */
const TABLE: Record<string, number> = (bundled as { prices: Record<string, number> }).prices;
const DATA = 'https://raw.githubusercontent.com/cheesehubwax/cheesehub/token-price-data/data/';

export const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function bundledWaxUsd(ms: number): number | undefined {
  return TABLE[utcDay(ms)];
}

async function fetchJson(url: string): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let historyPromise: Promise<Record<string, number> | null> | null = null;
function waxHistory(): Promise<Record<string, number> | null> {
  if (!historyPromise) {
    historyPromise = fetchJson(`${DATA}wax-usd-history.json`).then((j) =>
      j && typeof j === 'object' ? (j as Record<string, number>) : null,
    );
  }
  return historyPromise;
}

const dayCache = new Map<string, Promise<Record<string, number> | null>>();
function cheeseDay(d: string) {
  let p = dayCache.get(d);
  if (!p) {
    p = fetchJson(`${DATA}days/${d}.json`).then((j) => {
      if (!j || typeof j !== 'object') return null;
      const prices: Record<string, number> = { ...((j as { prices?: Record<string, number> }).prices ?? {}) };
      const wax = (j as { waxUsd?: unknown }).waxUsd;
      if (typeof wax === 'number') prices.__waxUsd = wax;
      return prices;
    });
    dayCache.set(d, p);
  }
  return p;
}

/** USD value of a sale on its UTC day, or undefined when no price exists. */
export async function saleUsd(amount: number, token: string | undefined, ms: number, contract?: string): Promise<number | undefined> {
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const sym = (token || 'WAX').toUpperCase();
  const day = utcDay(ms);
  if (sym === 'WAX') {
    const h = (await waxHistory())?.[day];
    if (typeof h === 'number') return amount * h;
    const b = TABLE[day];
    if (b != null) return amount * b;
  }
  const rec = await cheeseDay(day);
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
