#!/usr/bin/env node
/**
 * audit-mirrors.mjs — one-shot audit of every backup mirror against the
 * canonical manifest(s). Reports which files are missing / wrong-size on
 * each mirror, and (optionally) sha256-verifies a sample.
 *
 * Usage:
 *   node scripts/audit-mirrors.mjs
 *   node scripts/audit-mirrors.mjs --sample 200
 *   node scripts/audit-mirrors.mjs --concurrency 12 --sample 0
 *   node scripts/audit-mirrors.mjs --only cloudflare
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Bump these whenever this script changes, so a stale local copy is obvious
// the moment it runs.
const SCRIPT_VERSION = 'v2';
const SCRIPT_UPDATED = '2026-08-02';

const MIRRORS = [
  {
    key: 'primary',
    label: 'Primary (GitHub Pages)',
    // Everything (SimpleAssets CID folders, manifest.json and atomic/) now
    // sits flat at the repo root — there is no nested mirror/ folder.
    baseUrl: 'https://bewbzz.github.io/gpkonwaxbackup/',
    atomicBaseUrl: 'https://bewbzz.github.io/gpkonwaxbackup/',
    // The split ZIP parts are too large for Pages — they are served from the
    // GitHub Release assets instead.
    zipBaseUrl: 'https://github.com/bewbzz/gpkonwaxbackup/releases/latest/download/',
    checkZips: true,
  },
  { key: 'netlify',    label: 'Backup A (Netlify)',    baseUrl: 'https://gpkonwaxbackup.netlify.app/', checkZips: false },
  {
    key: 'cloudflare',
    label: 'Backup B (Cloudflare)',
    baseUrl: 'https://gpkonwaxbackup.pages.dev/',
    checkZips: false,
    // Cloudflare Pages refuses any single file larger than 25 MiB. Those files
    // are expected exclusions rather than gaps — they are still served by the
    // primary mirror, Netlify and the ZIP release.
    maxFileBytes: 25 * 1024 * 1024,
    maxFileReason: 'over 25 MiB Cloudflare limit',
  },
];

// Dedicated data mirror (Netlify) — hosts manifests/ + puzzles/ + packs/.
// Set via env var or hardcode here once the site is live. Left blank until then;
// the data-mirror audit step is skipped when unconfigured.
const DATA_MIRROR_BASE = process.env.DATA_MIRROR_URL || '';


/**
 * Resolve the URL for a manifest entry on a given mirror. Manifest entries may
 * carry an explicit stored `path` (atomic assets live under atomic/ and may
 * have an extension appended); otherwise the manifest key is the path.
 */
function urlFor(mirror, rel, meta) {
  const storedPath = meta?.path ?? rel;
  const base = storedPath.startsWith('atomic/')
    ? (mirror.atomicBaseUrl ?? mirror.baseUrl)
    : mirror.baseUrl;
  return base + storedPath;
}


const MANIFEST_PATHS = [
  'public/gpk-manifest.json',
  'public/atomic-manifest.json',
];

const OUT_DIR = 'scripts/mirror-output/audit-report';
const TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const out = { sample: 25, concurrency: 8, only: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sample') out.sample = Number(argv[++i]);
    else if (a === '--concurrency') out.concurrency = Number(argv[++i]);
    else if (a === '--only') out.only = String(argv[++i]).toLowerCase();
  }
  return out;
}

async function fetchWithTimeout(url, init = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...init, signal: c.signal }); }
  finally { clearTimeout(t); }
}

async function headCheck(url) {
  try {
    let res = await fetchWithTimeout(url, { method: 'HEAD' });
    // Some CDNs don't like HEAD — fall back to a ranged GET of 1 byte.
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      const cr = res.headers.get('content-range');
      if (cr) {
        const m = cr.match(/\/(\d+)$/);
        return { ok: res.ok || res.status === 206, status: res.status, bytes: m ? Number(m[1]) : null };
      }
    }
    const len = res.headers.get('content-length');
    return { ok: res.ok, status: res.status, bytes: len != null ? Number(len) : null };
  } catch (e) {
    return { ok: false, status: 0, bytes: null, error: String(e?.message || e) };
  }
}

async function shaCheck(url, expectedSha) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { ok: false, status: res.status, reason: 'http' };
    const buf = new Uint8Array(await res.arrayBuffer());
    const sha = createHash('sha256').update(buf).digest('hex');
    return { ok: sha === expectedSha, status: res.status, sha };
  } catch (e) {
    return { ok: false, status: 0, reason: String(e?.message || e) };
  }
}

async function pool(items, concurrency, worker, onProgress) {
  const results = new Array(items.length);
  let i = 0, done = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
      done++;
      if (onProgress && (done % 50 === 0 || done === items.length)) onProgress(done, items.length);
    }
  });
  await Promise.all(runners);
  return results;
}

async function loadManifests() {
  const merged = {};
  for (const p of MANIFEST_PATHS) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      const m = JSON.parse(raw);
      const files = m.files || {};
      for (const [rel, meta] of Object.entries(files)) {
        // Later manifest wins if there's overlap.
        merged[rel] = { ...meta, source: p };
      }
      console.log(`Loaded ${Object.keys(files).length} entries from ${p}`);
    } catch (e) {
      if (e.code === 'ENOENT') console.log(`(skip) ${p} not present`);
      else throw e;
    }
  }
  // ZIP parts come from gpk-manifest only.
  let zipParts = [];
  try {
    const gpk = JSON.parse(await fs.readFile('public/gpk-manifest.json', 'utf8'));
    zipParts = Array.isArray(gpk.zipParts) ? gpk.zipParts : [];
  } catch {}
  return { files: merged, zipParts };
}

function pickSample(entries, sampleSize) {
  if (!sampleSize || sampleSize >= entries.length) return entries;
  const step = Math.max(1, Math.floor(entries.length / sampleSize));
  const out = [];
  for (let i = 0; i < entries.length && out.length < sampleSize; i += step) out.push(entries[i]);
  return out;
}

async function auditMirror(mirror, manifest, zipParts, opts, verifiedElsewhere) {
  console.log(`\n=== ${mirror.label} ===`);
  console.log(`base: ${mirror.baseUrl}`);
  const allEntries = Object.entries(manifest); // [path, {sha256, bytes, ...}]

  // Files a mirror physically cannot host (per-file size cap) are expected
  // exclusions — but only when we have confirmed the file exists on another
  // mirror. Exclusion must never hide a genuine loss.
  const excluded = [];
  const entries = [];
  for (const [rel, meta] of allEntries) {
    const tooBig = mirror.maxFileBytes != null && meta.bytes != null && meta.bytes > mirror.maxFileBytes;
    if (tooBig && (verifiedElsewhere == null || verifiedElsewhere.has(rel))) {
      excluded.push({ rel, bytes: meta.bytes, url: urlFor(mirror, rel, meta), reason: mirror.maxFileReason ?? 'exceeds mirror file size limit' });
    } else {
      entries.push([rel, meta]);
    }
  }
  if (excluded.length) {
    console.log(`  expected exclusions: ${excluded.length} (${mirror.maxFileReason ?? 'size limit'})`);
  }

  const missing = [];
  const wrongSize = [];
  const ok = [];

  await pool(entries, opts.concurrency, async ([rel, meta]) => {
    const url = urlFor(mirror, rel, meta);

    let r = await headCheck(url);
    if (!r.ok && !r.status) {
      // one retry on transient network error
      r = await headCheck(url);
    }
    if (!r.ok) {
      missing.push({ rel, status: r.status, error: r.error, url });
      return;
    }
    if (r.bytes != null && meta.bytes != null && r.bytes !== meta.bytes) {
      wrongSize.push({ rel, expected: meta.bytes, actual: r.bytes, url });
      return;
    }
    ok.push(rel);
  }, (done, total) => {
    process.stdout.write(`\r  HEAD ${done}/${total}`);
  });
  process.stdout.write('\n');

  // Sample SHA check on the OK subset.
  const shaMismatch = [];
  if (opts.sample > 0 && ok.length > 0) {
    const okEntries = ok.map((rel) => [rel, manifest[rel]]);
    const sample = pickSample(okEntries, opts.sample);
    console.log(`  sha256 sampling ${sample.length} files…`);
    await pool(sample, Math.min(opts.concurrency, 4), async ([rel, meta]) => {
      const url = urlFor(mirror, rel, meta);

      const r = await shaCheck(url, meta.sha256);
      if (!r.ok && r.reason !== 'http') shaMismatch.push({ rel, sha: r.sha, url });
      else if (!r.ok) shaMismatch.push({ rel, status: r.status, url });
    });
  }


  // ZIP parts audit.
  const zipReport = [];
  if (mirror.checkZips && zipParts.length) {
    console.log(`  zip parts: ${zipParts.length}`);
    for (const part of zipParts) {
      const url = (mirror.zipBaseUrl ?? mirror.baseUrl) + part.fileName;
      const r = await headCheck(url);
      const sizeOk = r.ok && (r.bytes == null || r.bytes === part.bytes);
      zipReport.push({ name: part.fileName, expected: part.bytes, actual: r.bytes, ok: sizeOk, status: r.status, error: r.error });
    }
  }

  return { mirror, total: entries.length, ok: ok.length, missing, wrongSize, shaMismatch, zipReport, excluded };
}

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MiB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

async function main() {
  const opts = parseArgs(process.argv);
  const targets = opts.only ? MIRRORS.filter((m) => m.key === opts.only) : MIRRORS;
  if (!targets.length) {
    console.error(`No mirror matched --only ${opts.only}`);
    process.exit(2);
  }

  const { files, zipParts } = await loadManifests();
  const total = Object.keys(files).length;
  if (!total) {
    console.error('No manifest entries loaded — nothing to audit.');
    process.exit(2);
  }
  console.log(`audit-mirrors.mjs ${SCRIPT_VERSION} — updated ${SCRIPT_UPDATED}`);
  console.log(`Total unique files to audit: ${total}`);
  console.log(`Sample size for sha256 verification: ${opts.sample}`);
  console.log(`Concurrency: ${opts.concurrency}`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const summaries = [];
  // Files confirmed present on an already-audited mirror. Used so that a
  // size-capped mirror may only "exclude" a file we know still exists.
  const verifiedElsewhere = new Set();
  for (const mirror of targets) {
    // With no prior mirror audited in this run (e.g. --only cloudflare) we
    // cannot cross-check, so the size cap alone decides.
    const rep = await auditMirror(mirror, files, zipParts, opts, verifiedElsewhere.size ? verifiedElsewhere : null);
    summaries.push(rep);
    const bad = new Set([
      ...rep.missing.map((m) => m.rel),
      ...rep.wrongSize.map((m) => m.rel),
      ...rep.excluded.map((m) => m.rel),
    ]);
    for (const rel of Object.keys(files)) {
      if (!bad.has(rel)) verifiedElsewhere.add(rel);
    }

    const missingList = rep.missing.map((m) => `${m.rel}\t${m.status || 'net'}\t${m.url}${m.error ? `\t${m.error}` : ''}`).join('\n');
    const wrongList = rep.wrongSize.map((m) => `${m.rel}\texpected=${m.expected}\tactual=${m.actual}\t${m.url}`).join('\n');
    const shaList = rep.shaMismatch.map((m) => `${m.rel}\t${m.sha || m.status}\t${m.url}`).join('\n');
    const exclList = rep.excluded.map((m) => `${m.rel}\t${fmtBytes(m.bytes)}\t${m.reason}\t${m.url}`).join('\n');
    await fs.writeFile(path.join(OUT_DIR, `missing-${mirror.key}.txt`), missingList + (missingList ? '\n' : ''));
    await fs.writeFile(path.join(OUT_DIR, `wrongsize-${mirror.key}.txt`), wrongList + (wrongList ? '\n' : ''));
    await fs.writeFile(path.join(OUT_DIR, `sha-mismatch-${mirror.key}.txt`), shaList + (shaList ? '\n' : ''));
    await fs.writeFile(path.join(OUT_DIR, `excluded-${mirror.key}.txt`), exclList + (exclList ? '\n' : ''));
  }

  // Summary.
  const lines = [];
  lines.push(`audit-mirrors.mjs ${SCRIPT_VERSION} — updated ${SCRIPT_UPDATED}`);
  lines.push(`Mirror audit — ${new Date().toISOString()}`);
  lines.push(`Manifest entries: ${total}`);
  lines.push('');
  for (const rep of summaries) {
    const m = rep.mirror;
    lines.push(`## ${m.label}`);
    lines.push(`  base:         ${m.baseUrl}`);
    if (m.atomicBaseUrl) lines.push(`  atomic base:  ${m.atomicBaseUrl}`);
    if (m.zipBaseUrl)    lines.push(`  zip base:     ${m.zipBaseUrl}`);
    lines.push(`  checked:      ${rep.total}`);
    lines.push(`  ok:           ${rep.ok}`);
    lines.push(`  missing:      ${rep.missing.length}`);
    if (rep.excluded.length) lines.push(`  excluded:     ${rep.excluded.length} (${m.maxFileReason ?? 'size limit'})`);
    lines.push(`  wrong size:   ${rep.wrongSize.length}`);
    lines.push(`  sha mismatch: ${rep.shaMismatch.length}`);
    if (rep.zipReport.length) {
      lines.push(`  zip parts:`);
      for (const z of rep.zipReport) {
        lines.push(`    - ${z.name}: ${z.ok ? 'OK' : 'FAIL'} status=${z.status ?? '-'} expected=${fmtBytes(z.expected)} actual=${fmtBytes(z.actual)}${z.error ? ` err=${z.error}` : ''}`);
      }
    }
    const zipFail = rep.zipReport.filter((z) => !z.ok).length;
    const clean = rep.missing.length === 0 && rep.wrongSize.length === 0 && rep.shaMismatch.length === 0 && zipFail === 0;
    const verdict = clean
      ? (rep.excluded.length
          ? `COMPLETE (${rep.excluded.length} expected exclusions — ${m.maxFileReason ?? 'size limit'})`
          : 'COMPLETE')
      : `GAPS (missing=${rep.missing.length}, wrongSize=${rep.wrongSize.length}, shaMismatch=${rep.shaMismatch.length}, zipFail=${zipFail})`;
    lines.push(`  verdict:      ${verdict}`);

    lines.push('');
  }
  lines.push(`Detailed lists written to ${OUT_DIR}/`);
  const summary = lines.join('\n');
  await fs.writeFile(path.join(OUT_DIR, 'summary.txt'), summary + '\n');
  console.log('\n' + summary);
}

main().catch((e) => { console.error(e); process.exit(1); });
