#!/usr/bin/env node
/**
 * Test sample: reads one week of SimpleAssets market activity from the
 * full-history node, to learn the action shapes and how fast a full scan
 * would be. Writes nothing to manifests/; prints a summary and saves the raw
 * sample to /tmp/sa-market-sample.json.
 *
 *   node scripts/sample-sa-market.mjs [--from 2020-05-20T00:00:00] [--days 7]
 *
 * Sources sampled:
 *   - simplemarket:*            (list / buy / cancel on the SimpleMarket contract)
 *   - simpleassets:transfer sent by gpkmarket111 (memo "Purchased for N WAX")
 */
import fs from 'node:fs/promises';

const NODE = 'https://wax.eosdac.io';
const LIMIT = 100;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const from = arg('--from', '2020-05-20T00:00:00');
const days = Number(arg('--days', '7'));
const before = new Date(Date.parse(`${from}Z`) + days * 864e5).toISOString().slice(0, 19);

async function getJson(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 10000 * (a + 1))); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) { if (a === 3) throw e; await new Promise((s) => setTimeout(s, 2000)); }
  }
  throw new Error('rate limited');
}

async function pageAll(query) {
  const out = []; const seen = new Set(); let after = from; let requests = 0;
  for (;;) {
    const body = await getJson(`${NODE}/v2/history/get_actions?${query}&sort=asc&limit=${LIMIT}&after=${after}&before=${before}`);
    requests++; await new Promise((s) => setTimeout(s, 700));
    const acts = body.actions || [];
    for (const a of acts) {
      const key = `${a.global_sequence}`;
      if (!seen.has(key)) { seen.add(key); out.push(a); }
    }
    const last = acts.at(-1)?.['@timestamp'];
    if (acts.length < LIMIT || !last || last === after) break;
    after = last;
  }
  return { actions: out, requests };
}

const t0 = Date.now();
const market = await pageAll('filter=simplemarket:*');
const gpkm = await pageAll('filter=simpleassets:transfer&act.authorization.actor=gpkmarket111');
const secs = (Date.now() - t0) / 1000;

const byName = {};
for (const a of market.actions) byName[a.act.name] = (byName[a.act.name] || 0) + 1;
const gpkSales = gpkm.actions.filter((a) => /^Purchased for/i.test(a.act.data?.memo || ''));

console.log(`Window ${from} → ${before} (${days} days)`);
console.log(`simplemarket actions: ${market.actions.length}`, byName);
console.log(`gpkmarket111 transfers: ${gpkm.actions.length} (sales by memo: ${gpkSales.length})`);
console.log(`requests: ${market.requests + gpkm.requests}, time: ${secs.toFixed(1)}s`);
for (const [name] of Object.entries(byName)) {
  const ex = market.actions.find((a) => a.act.name === name);
  console.log(`\nexample simplemarket:${name}`, JSON.stringify(ex.act.data));
}
if (gpkSales[0]) console.log('\nexample gpkmarket111 sale', JSON.stringify(gpkSales[0].act.data));

await fs.writeFile('/tmp/sa-market-sample.json', JSON.stringify({ from, before, market: market.actions, gpkmarket: gpkm.actions }));
