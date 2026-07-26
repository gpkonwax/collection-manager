#!/usr/bin/env node
/**
 * test-reveal-pipeline.mjs — synthetic pack-reveal test.
 *
 * Simulates opening a GPK pack and races the same mirror-first image pipeline
 * the app uses, without touching a wallet or the blockchain.
 *
 * Usage:
 *   node scripts/test-reveal-pipeline.mjs --pack GPKMEGA
 *   node scripts/test-reveal-pipeline.mjs --pack GPKTWOC --browser
 *   node scripts/test-reveal-pipeline.mjs --all
 *   node scripts/test-reveal-pipeline.mjs --all --browser
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Mirror bases must stay in sync with src/lib/ipfsGateways.ts
const PRIMARY_MIRROR = 'https://bewbzz.github.io/gpkonwaxbackup/mirror/';
const BACKUP_MIRROR_A = 'https://gpkonwaxbackup.netlify.app/';
const BACKUP_MIRROR_B = 'https://gpkonwaxbackup.pages.dev/';

const PUBLIC_IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

const MIRROR_BASES = [
  { base: PRIMARY_MIRROR, label: 'primary mirror' },
  { base: BACKUP_MIRROR_A, label: 'backup mirror A' },
  { base: BACKUP_MIRROR_B, label: 'backup mirror B' },
].filter((m) => !!m.base && /^https:\/\//i.test(m.base));

// In sync with src/lib/gpkCardImages.ts
const SERIES_HASH = {
  five: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
  thirty: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
  gpktwoeight: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo25: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  gpktwo55: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
  exotic5: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
  exotic25: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
};

const GIF_VARIANTS = new Set([
  'prism', 'sketch', 'slime', 'raw', 'gum', 'vhs', 'collector', 'tiger stripe', 'tiger claw', 'originalart', 'relic',
]);

// User-corrected pack sizes (app's EXPECTED_CARDS currently has GPKTWOC=35).
const PACK_CONFIG = {
  GPKMEGA:  { boxtype: 'thirty',    count: 30, category: 'series1', idRange: [1, 180], sides: ['a', 'b'], variants: ['base', 'prism', 'sketch', 'collector', 'golden'] },
  GPKTWOC:  { boxtype: 'gpktwo55',  count: 55, category: 'series2', idRange: [1, 180], sides: ['a', 'b'], variants: ['base', 'raw', 'slime', 'gum', 'vhs', 'sketch', 'returning', 'error', 'originalart', 'relic', 'promo', 'collector', 'golden'] },
  EXOMEGA:  { boxtype: 'exotic25',  count: 25, category: 'exotic',  idRange: [1, 100], sides: ['a', 'b'], variants: ['base', 'prism', 'tiger stripe', 'tiger claw', 'golden', 'collector'] },
};

const MANIFEST_PATH = path.join(ROOT, 'public', 'gpk-manifest.json');
const HEAD_TIMEOUT_MS = 8000;
const HEAD_CONCURRENCY = 12;

function parseArgs(argv) {
  const out = { pack: null, all: false, browser: false, concurrency: HEAD_CONCURRENCY };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pack') out.pack = String(argv[++i]).toUpperCase();
    else if (a === '--all') out.all = true;
    else if (a === '--browser') out.browser = true;
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/test-reveal-pipeline.mjs [--pack GPKMEGA|GPKTWOC|EXOMEGA] [--all] [--browser] [--concurrency N]`);
      process.exit(0);
    }
  }
  return out;
}

function getIpfsUrl(hash) {
  return `${PUBLIC_IPFS_GATEWAYS[0]}${hash}`;
}

function extractIpfsHash(url) {
  if (!url) return null;
  if (url.startsWith('ipfs://')) return url.replace('ipfs://', '').split('/')[0];
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/);
  if (ipfsMatch) return ipfsMatch[1];
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) return url;
  const patterns = [
    /ipfs\.io\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /cloudflare-ipfs\.com\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /dweb\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /nftstorage\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function buildGpkCardImageUrl(boxtype, variant, cardid, quality = '') {
  const hash = SERIES_HASH[boxtype];
  if (!hash) return null;
  const ext = GIF_VARIANTS.has(variant) ? 'gif' : 'jpg';
  return getIpfsUrl(`${hash}/${variant}/${cardid}${quality}.${ext}`);
}

function buildRevealCandidates(originalUrl, manifest) {
  const candidates = [];
  const seen = new Set();
  function add(url, label, tier) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, label, tier });
  }

  const hash = originalUrl ? extractIpfsHash(originalUrl) : null;
  if (!hash) {
    if (originalUrl) add(originalUrl, 'original URL', 'gateway');
    return candidates;
  }

  const mirrorPath = manifest?.files?.[hash]?.path ?? hash;
  for (const mirror of MIRROR_BASES) {
    add(`${mirror.base}${mirrorPath}`, mirror.label, 'mirror');
  }

  const manifestHasHash = !!manifest?.files?.[hash];
  if (!manifestHasHash) {
    for (const gateway of PUBLIC_IPFS_GATEWAYS) {
      add(`${gateway}${hash}`, new URL(gateway).hostname, 'gateway');
    }
    if (originalUrl) add(originalUrl, 'original URL', 'gateway');
  }

  return candidates;
}

async function loadManifest() {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data.files !== 'object') {
      console.warn('[test] manifest malformed');
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[test] could not load manifest', err.message);
    return null;
  }
}

async function fetchHead(url, timeoutMs = HEAD_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: controller.signal });
    }
    const elapsed = Date.now() - started;
    const len = res.headers.get('content-length');
    const cr = res.headers.get('content-range');
    const bytes = cr ? (cr.match(/\/(\d+)$/)?.[1] ? Number(cr.match(/\/(\d+)$/)[1]) : null) : len != null ? Number(len) : null;
    return { ok: res.ok || res.status === 206, status: res.status, bytes, elapsed, error: null };
  } catch (err) {
    return { ok: false, status: 0, bytes: null, elapsed: Date.now() - started, error: String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function raceHeadGroup(candidates, timeoutMs) {
  if (candidates.length === 0) return null;
  return new Promise((resolve) => {
    let settled = false;
    let losses = 0;
    const finish = (winner) => {
      if (settled) return;
      settled = true;
      resolve(winner);
    };
    for (const candidate of candidates) {
      fetchHead(candidate.url, timeoutMs).then((result) => {
        if (settled) return;
        if (result.ok) {
          finish({ ...candidate, elapsedMs: result.elapsed, bytes: result.bytes });
          return;
        }
        losses += 1;
        if (losses >= candidates.length) finish(null);
      });
    }
  });
}

function generatePackCards(packKey, manifest) {
  const cfg = PACK_CONFIG[packKey];
  if (!cfg) throw new Error(`Unknown pack ${packKey}`);

  // Sample from the manifest so the test exercises real, mirrored cards.
  const hash = SERIES_HASH[cfg.boxtype];
  const prefix = `${hash}/`;
  const available = Object.keys(manifest?.files || {})
    .filter((key) => {
      if (!key.startsWith(prefix)) return false;
      const rest = key.slice(prefix.length);
      const [variant] = rest.split('/');
      return cfg.variants.includes(variant);
    })
    .map((key) => {
      const rest = key.slice(prefix.length);
      const [variant, file] = rest.split('/');
      const cardid = file.replace(/\.[^.]+$/, '');
      return { packKey, cardid, variant, boxtype: cfg.boxtype, url: buildGpkCardImageUrl(cfg.boxtype, variant, cardid) };
    });

  if (available.length < cfg.count) {
    console.warn(`[test] ${packKey}: manifest only has ${available.length} matching cards, need ${cfg.count}`);
  }

  // Shuffle and pick the requested count.
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, cfg.count).map((c, i) => ({ ...c, index: i }));
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((sorted.length - 1) * p));
  return sorted[idx];
}

async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function runNodeTest(packKey, manifest) {
  const cards = generatePackCards(packKey, manifest);
  const cfg = PACK_CONFIG[packKey];

  console.log(`\n=== Node-layer test: ${packKey} (${cfg.count} cards, ${cfg.category}) ===`);

  // Build candidates for every card first so we can report manifest coverage.
  const enriched = cards.map((card) => ({
    ...card,
    candidates: buildRevealCandidates(card.url, manifest),
    hash: extractIpfsHash(card.url),
  }));

  const manifestHits = enriched.filter((c) => !!manifest?.files?.[c.hash]).length;
  console.log(`Manifest coverage: ${manifestHits}/${cfg.count} (${((manifestHits / cfg.count) * 100).toFixed(1)}%)`);

  const rows = [];
  await pool(enriched, HEAD_CONCURRENCY, async (card) => {
    const started = Date.now();
    const mirrors = card.candidates.filter((c) => c.tier === 'mirror');
    const gateways = card.candidates.filter((c) => c.tier === 'gateway');

    const mirrorWinner = await raceHeadGroup(mirrors, HEAD_TIMEOUT_MS);
    let winner = mirrorWinner;
    let gatewayWinner = null;
    if (!winner && gateways.length > 0) {
      gatewayWinner = await raceHeadGroup(gateways, HEAD_TIMEOUT_MS);
      winner = gatewayWinner;
    }

    const mirrorStatuses = await Promise.all(
      mirrors.map(async (m) => {
        const r = await fetchHead(m.url, HEAD_TIMEOUT_MS);
        return { label: m.label, ok: r.ok, status: r.status, bytes: r.bytes, elapsedMs: r.elapsed };
      }),
    );

    rows.push({
      cardid: card.cardid,
      variant: card.variant,
      hash: card.hash,
      manifestHit: !!manifest?.files?.[card.hash],
      winnerTier: winner?.tier ?? 'none',
      winnerHost: winner ? new URL(winner.url).hostname : '—',
      winnerMs: winner ? winner.elapsedMs ?? (Date.now() - started) : null,
      mirrorOkCount: mirrorStatuses.filter((s) => s.ok).length,
      mirrorStatuses,
      gatewayNeeded: !mirrorWinner && gateways.length > 0,
    });
  });

  // Summary
  const byTier = {};
  for (const r of rows) {
    byTier[r.winnerTier] = (byTier[r.winnerTier] || 0) + 1;
  }
  const latencies = rows.map((r) => r.winnerMs).filter((n) => n != null);
  console.log(`Winner distribution:`, byTier);
  console.log(`Latency p50: ${percentile(latencies, 0.5)}ms | p95: ${percentile(latencies, 0.95)}ms`);

  const missing = rows.filter((r) => r.winnerTier === 'none');
  if (missing.length) {
    console.log(`\n⚠️  ${missing.length} cards resolved from NO source (would be missing in a real reveal):`);
    for (const m of missing.slice(0, 10)) {
      console.log(`  #${m.cardid} ${m.variant} — hash ${m.hash} (manifest ${m.manifestHit ? 'hit' : 'miss'})`);
    }
    if (missing.length > 10) console.log(`  ... and ${missing.length - 10} more`);
  }

  // Per-mirror health
  const mirrorHealth = {};
  for (const r of rows) {
    for (const s of r.mirrorStatuses) {
      mirrorHealth[s.label] = mirrorHealth[s.label] || { ok: 0, fail: 0 };
      if (s.ok) mirrorHealth[s.label].ok += 1;
      else mirrorHealth[s.label].fail += 1;
    }
  }
  console.log(`\nPer-mirror HEAD health:`);
  for (const [label, h] of Object.entries(mirrorHealth)) {
    const total = h.ok + h.fail;
    console.log(`  ${label}: ${h.ok}/${total} OK (${((h.ok / total) * 100).toFixed(1)}%)`);
  }

  return { packKey, rows, manifestHits, total: cfg.count };
}

async function runBrowserTest(packKey, manifest) {
  const { chromium } = await import('playwright');
  const cfg = PACK_CONFIG[packKey];
  const cards = generatePackCards(packKey, manifest);

  console.log(`\n=== Browser-layer test: ${packKey} (${cfg.count} cards) ===`);
  console.log('Launching Chromium against http://localhost:8080 ...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });

    const results = await page.evaluate(async (packKey) => {
      const revealMod = await import('/src/lib/revealImageSources.ts');
      const gpkMod = await import('/src/lib/gpkCardImages.ts');

      const SERIES_HASH = {
        five: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
        thirty: 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p',
        gpktwoeight: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
        gpktwo25: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
        gpktwo55: 'QmcAkyEvUNgc6CDKn9yQP9my6pCz5Dk21amr2t6pdZocDZ',
        exotic5: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
        exotic25: 'QmYkMDkB1d8ToHNHnFwpeESF3Npfid671NrfbPKiKG8e25',
      };
      const GIF_VARIANTS = new Set([
        'prism', 'sketch', 'slime', 'raw', 'gum', 'vhs', 'collector', 'tiger stripe', 'tiger claw', 'originalart', 'relic',
      ]);
      const PACKS = {
        GPKMEGA: { boxtype: 'thirty', count: 30, idRange: [1, 180], sides: ['a', 'b'], variants: ['base', 'prism', 'sketch', 'collector', 'golden'] },
        GPKTWOC: { boxtype: 'gpktwo55', count: 55, idRange: [1, 180], sides: ['a', 'b'], variants: ['base', 'raw', 'slime', 'gum', 'vhs', 'sketch', 'returning', 'error', 'originalart', 'relic', 'promo', 'collector', 'golden'] },
        EXOMEGA: { boxtype: 'exotic25', count: 25, idRange: [1, 100], sides: ['a', 'b'], variants: ['base', 'prism', 'tiger stripe', 'tiger claw', 'golden', 'collector'] },
      };

      const cfg = PACKS[packKey];
      const [minId, maxId] = cfg.idRange;
      const cards = [];
      for (let i = 0; i < cfg.count; i++) {
        const variant = cfg.variants[Math.floor(Math.random() * cfg.variants.length)];
        const side = cfg.sides[Math.floor(Math.random() * cfg.sides.length)];
        const num = Math.floor(Math.random() * (maxId - minId + 1)) + minId;
        const cardid = `${num}${side}`;
        const hash = SERIES_HASH[cfg.boxtype];
        const ext = GIF_VARIANTS.has(variant) ? 'gif' : 'jpg';
        const url = `https://gateway.pinata.cloud/ipfs/${hash}/${variant}/${cardid}.${ext}`;
        cards.push({ index: i, num, side, cardid, variant, url });
      }

      // Load manifest inside browser so we pass the same object shape the app uses.
      const manifestRes = await fetch('/gpk-manifest.json', { cache: 'no-store' });
      const manifest = manifestRes.ok ? await manifestRes.json() : null;

      const started = performance.now();
      const controller = new AbortController();
      // Same cap the app uses in Index.tsx warmDealImagesWithoutBlocking.
      const maxTimer = setTimeout(() => controller.abort(), 6000);

      const results = await Promise.all(
        cards.map(async (card) => {
          const perStarted = performance.now();
          const result = await revealMod.preloadRevealImage(card.url, manifest, controller.signal);
          return {
            ...card,
            winnerUrl: result.url,
            winnerLabel: result.label,
            elapsedMs: result.elapsedMs,
            perStarted,
          };
        }),
      );
      clearTimeout(maxTimer);
      const totalMs = performance.now() - started;
      return { totalMs, results };
    }, packKey);

    const winners = results.results.filter((r) => r.winnerUrl);
    const byLabel = {};
    for (const r of results.results) {
      const key = r.winnerLabel ?? 'none';
      byLabel[key] = (byLabel[key] || 0) + 1;
    }
    const latencies = winners.map((r) => r.elapsedMs);

    console.log(`Browser preload complete: ${winners.length}/${cfg.count} images resolved`);
    console.log(`Total wall time (6s cap): ${results.totalMs.toFixed(0)}ms`);
    console.log(`Winner labels:`, byLabel);
    console.log(`Latency p50: ${percentile(latencies, 0.5)?.toFixed(0) ?? '—'}ms | p95: ${percentile(latencies, 0.95)?.toFixed(0) ?? '—'}ms`);

    const missing = results.results.filter((r) => !r.winnerUrl);
    if (missing.length) {
      console.log(`\n⚠️  ${missing.length} cards failed browser preload:`);
      for (const m of missing.slice(0, 10)) {
        console.log(`  #${m.cardid} ${m.variant}`);
      }
    }

    return { packKey, ...results };
  } finally {
    await browser.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  const packs = opts.all ? Object.keys(PACK_CONFIG) : opts.pack ? [opts.pack] : [];
  if (packs.length === 0) {
    console.error('No pack specified. Use --pack GPKMEGA | GPKTWOC | EXOMEGA or --all');
    process.exit(2);
  }
  for (const p of packs) {
    if (!PACK_CONFIG[p]) {
      console.error(`Unknown pack: ${p}`);
      process.exit(2);
    }
  }

  const manifest = await loadManifest();
  if (!manifest) {
    console.error(`Could not load manifest from ${MANIFEST_PATH}`);
    process.exit(2);
  }
  console.log(`Loaded manifest: ${Object.keys(manifest.files).length} files`);

  const nodeResults = [];
  for (const packKey of packs) {
    nodeResults.push(await runNodeTest(packKey, manifest));
  }

  if (opts.browser) {
    for (const packKey of packs) {
      await runBrowserTest(packKey);
    }
  }

  // Final verdict
  console.log(`\n========== FINAL VERDICT ==========`);
  let allGood = true;
  for (const r of nodeResults) {
    const unresolved = r.rows.filter((row) => row.winnerTier === 'none').length;
    const verdict = unresolved === 0 ? 'PASS' : 'FAIL';
    if (unresolved > 0) allGood = false;
    console.log(`${r.packKey}: ${verdict} — ${r.total - unresolved}/${r.total} resolvable via mirrors/gateways (${r.manifestHits} manifest hits)`);
  }
  process.exit(allGood ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
