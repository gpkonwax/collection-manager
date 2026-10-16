#!/usr/bin/env node
// One-off: builds src/data/wax-usd-daily.json — daily WAX/USD close by UTC day.
// Binance WAXPUSDT (deep liquidity, from Aug 2021) wins; Bitfinex tWAXUSD fills
// earlier days. Days without a trade carry the previous close for up to 7 days.
// Newer days come from CheeseHub's token-price-data branch at runtime.
import { writeFileSync } from 'node:fs';

const START = Date.UTC(2020, 5, 1);
const END = Date.UTC(2026, 9, 15); // exclusive; CheeseHub records from 2026-10-15
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const j = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };

const closes = new Map();
for (let t = START; t < END;) {
  const rows = await j(`https://api.bitfinex.com/v2/candles/trade:1D:tWAXUSD/hist?start=${t}&end=${END - 1}&sort=1&limit=1000`);
  if (!rows.length) break;
  for (const [ms, , close] of rows) closes.set(day(ms), close);
  t = rows.at(-1)[0] + 86_400_000;
  await new Promise((r) => setTimeout(r, 1500));
}
for (let t = START; t < END;) {
  const rows = await j(`https://api.binance.com/api/v3/klines?symbol=WAXPUSDT&interval=1d&startTime=${t}&endTime=${END - 1}&limit=1000`);
  if (!rows.length) break;
  for (const r of rows) closes.set(day(r[0]), Number(r[4]));
  t = rows.at(-1)[0] + 86_400_000;
}

const out = {};
let last = null; let gap = 0;
for (let t = START; t < END; t += 86_400_000) {
  const d = day(t);
  if (closes.has(d)) { last = closes.get(d); gap = 0; } else gap++;
  if (last != null && gap <= 7) out[d] = Number(last.toPrecision(6));
}
writeFileSync('src/data/wax-usd-daily.json', JSON.stringify({ source: 'Binance WAXPUSDT / Bitfinex tWAXUSD daily close (UTC)', prices: out }));
console.log(Object.keys(out).length, 'days');
