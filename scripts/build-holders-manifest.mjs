#!/usr/bin/env node
/**
 * Build gpk-topps-holders.json — a static manifest of every WAX account that
 * holds gpk.topps NFTs, split by contract:
 *
 *   SA = SimpleAssets (simpleassets contract, author == 'gpk.topps')
 *   AA = AtomicAssets (collection_name == 'gpk.topps')
 *
 * Output: mirror-output/manifests/gpk-topps-holders.json
 *
 * Run manually whenever you want a fresh snapshot:
 *   node scripts/build-holders-manifest.mjs
 *
 * Then re-publish `mirror-output/manifests/` alongside the image mirror.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'mirror-output', 'manifests', 'gpk-topps-holders.json');

const WAX_RPCS = [
  'https://wax.api.eosnation.io',
  'https://api.waxsweden.org',
  'https://wax.eosphere.io',
  'https://api.hivebp.io',
  'https://wax.cryptolions.io',
  'https://wax.eosdac.io',
  'https://wax.eu.eosamsterdam.net',
  'https://api-wax.eosauthority.com',
  'https://wax.dapplica.io',
  'https://api.wax.alohaeos.com',
  'https://wax.pink.gg',
];

const AA_APIS = [
  'https://wax-aa.eu.eosamsterdam.net',
  'https://wax.api.atomicassets.io',
  'https://atomic.wax.eosrio.io',
  'https://aa.wax.blacklusion.io',
  'https://wax-aa.eosdac.io',
  'https://aa-wax-public1.neftyblocks.com',
  'https://wax-atomic.alcor.exchange',
  'https://wax-atomic-api.eosphere.io',
  'https://atomic.hivebp.io',
];

const SA_CONCURRENCY = 8;
const REQUEST_TIMEOUT_MS = 12_000;

function log(msg) {
  process.stdout.write(msg + '\n');
}

async function fetchWithFallback(bases, path, init, timeout = REQUEST_TIMEOUT_MS) {
  let lastErr;
  for (const base of bases) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
      clearTimeout(t);
      if (res.ok) return res;
      lastErr = new Error(`${base}${path} -> ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('all endpoints failed');
}

async function rpcPost(path, body) {
  const res = await fetchWithFallback(WAX_RPCS, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * Scan every scope in simpleassets.sassets, then per-scope count rows where
 * author === 'gpk.topps'. Returns Map<account, count>.
 */
async function scanSimpleAssets() {
  log('[SA] enumerating simpleassets.sassets scopes…');
  const scopes = [];
  let lower = '';
  for (let page = 0; page < 5000; page++) {
    const res = await rpcPost('/v1/chain/get_table_by_scope', {
      code: 'simpleassets',
      table: 'sassets',
      limit: 1000,
      lower_bound: lower,
    });
    for (const r of res.rows || []) {
      if (r.count > 0) scopes.push(r.scope);
    }
    process.stdout.write(`\r[SA]   scopes: ${scopes.length}`);
    if (!res.more || res.more === lower) break;
    lower = res.more;
  }
  process.stdout.write('\n');
  log(`[SA] ${scopes.length} scopes with rows — counting gpk.topps per scope…`);

  const holders = new Map();
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < scopes.length) {
      const idx = cursor++;
      const account = scopes[idx];
      try {
        let saCount = 0;
        let lb = '';
        let more = true;
        while (more) {
          const res = await rpcPost('/v1/chain/get_table_rows', {
            json: true,
            code: 'simpleassets',
            scope: account,
            table: 'sassets',
            limit: 100,
            lower_bound: lb || undefined,
          });
          for (const row of res.rows || []) {
            if (row.author === 'gpk.topps') saCount++;
          }
          more = !!res.more;
          if (more && res.rows?.length) {
            const lastId = res.rows[res.rows.length - 1].id;
            lb = String(BigInt(lastId) + 1n);
          } else {
            more = false;
          }
        }
        if (saCount > 0) holders.set(account, saCount);
      } catch (e) {
        process.stderr.write(`\n[SA] ${account} failed: ${e.message}\n`);
      } finally {
        done++;
        if (done % 25 === 0 || done === scopes.length) {
          process.stdout.write(
            `\r[SA]   ${done}/${scopes.length} scanned · ${holders.size} holders`,
          );
        }
      }
    }
  }

  await Promise.all(Array.from({ length: SA_CONCURRENCY }, worker));
  process.stdout.write('\n');
  return holders;
}

/**
 * AtomicAssets accounts endpoint for collection_name=gpk.topps.
 * Returns Map<account, assetsCount>.
 */
async function scanAtomicAssets() {
  log('[AA] paging /atomicassets/v1/accounts?collection_name=gpk.topps…');
  const holders = new Map();
  for (let page = 1; page <= 200; page++) {
    const path = `/atomicassets/v1/accounts?collection_name=gpk.topps&limit=1000&page=${page}&order=desc&sort=assets`;
    const res = await fetchWithFallback(AA_APIS, path, {});
    const body = await res.json();
    const rows = body?.data || [];
    for (const r of rows) {
      const n = parseInt(r.assets, 10) || 0;
      if (n > 0) holders.set(r.account, (holders.get(r.account) || 0) + n);
    }
    process.stdout.write(`\r[AA]   page ${page} · ${holders.size} holders`);
    if (rows.length < 1000) break;
  }
  process.stdout.write('\n');
  return holders;
}

async function main() {
  const startedAt = Date.now();
  const [saMap, aaMap] = await Promise.all([scanSimpleAssets(), scanAtomicAssets()]);

  const merged = new Map();
  for (const [account, sa] of saMap) merged.set(account, { account, sa, aa: 0 });
  for (const [account, aa] of aaMap) {
    const existing = merged.get(account) || { account, sa: 0, aa: 0 };
    existing.aa = aa;
    merged.set(account, existing);
  }
  const holders = Array.from(merged.values())
    .map((h) => ({ ...h, total: h.sa + h.aa }))
    .sort((a, b) => b.total - a.total);

  const totals = holders.reduce(
    (acc, h) => ({ accounts: acc.accounts + 1, sa: acc.sa + h.sa, aa: acc.aa + h.aa }),
    { accounts: 0, sa: 0, aa: 0 },
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    totals,
    holders,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  log('');
  log(`Wrote ${OUT_PATH}`);
  log(`  accounts: ${totals.accounts.toLocaleString()}`);
  log(`  SA total: ${totals.sa.toLocaleString()}`);
  log(`  AA total: ${totals.aa.toLocaleString()}`);
  log(`  elapsed:  ${elapsed}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
