#!/usr/bin/env node
/**
 * build-image-mirror.mjs — one-time snapshot builder for the GPK image mirror.
 *
 * Reads `scripts/mirror-config.json`, enumerates every card front/back across
 * every configured series/variant/side, fetches each from public IPFS gateways
 * (rotating on failure), writes them to `<outDir>/<hash>/<variant>/<id><side>.<ext>`,
 * emits a sha256 `manifest.json`, and zips the tree.
 *
 * Resumable: re-running skips files already present on disk with a valid sha256.
 * 404s are recorded as "missing" in the manifest so a subsequent run doesn't retry them.
 *
 * Zero external runtime dependencies — only `jszip` (already a devDependency).
 */
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readConfig(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/**
 * Attempt to download one IPFS path from a list of gateway bases, in order.
 * Returns { ok, status, bytes?, gateway? }.
 */
async function fetchWithGateways(ipfsPath, gateways, timeoutMs) {
  let lastStatus = 0;
  for (const gw of gateways) {
    const url = `${gw}${ipfsPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 404) {
        // Definitive miss on this gateway — try next in case they disagree.
        lastStatus = 404;
        continue;
      }
      if (!res.ok) { lastStatus = res.status; continue; }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0) { lastStatus = 204; continue; }
      return { ok: true, status: res.status, bytes: buf, gateway: gw };
    } catch (err) {
      clearTimeout(timer);
      lastStatus = 0;
    }
  }
  return { ok: false, status: lastStatus };
}

function* enumerate(config) {
  for (const series of config.series) {
    const [lo, hi] = series.cardIdRange;
    for (let id = lo; id <= hi; id += 1) {
      for (const side of series.sides) {
        for (const v of series.variants) {
          yield {
            ipfsPath: `${series.hash}/${v.name}/${id}${side}.${v.ext}`,
            relPath:  path.posix.join(series.hash, v.name, `${id}${side}.${v.ext}`),
            kind: 'front',
            series: series.id,
          };
        }
      }
      if (series.includeBacks) {
        yield {
          ipfsPath: `${series.hash}/back/${id}.jpg`,
          relPath:  path.posix.join(series.hash, 'back', `${id}.jpg`),
          kind: 'back',
          series: series.id,
        };
      }
    }
  }
}

async function loadExistingManifest(outDir) {
  const p = path.join(outDir, 'manifest.json');
  try {
    const raw = await fs.readFile(p, 'utf8');
    const m = JSON.parse(raw);
    if (!m.errorCounts) m.errorCounts = {};
    if (!m.missing) m.missing = [];
    if (!m.files) m.files = {};
    return m;
  } catch {
    return { generatedAt: null, files: {}, missing: [], errorCounts: {} };
  }
}

async function saveManifest(outDir, manifest) {
  const p = path.join(outDir, 'manifest.json');
  await fs.writeFile(p, JSON.stringify(manifest, null, 2));
}

async function processOne(item, config, outDir, manifest, opts) {
  const absPath = path.join(outDir, item.relPath);
  // Skip if we already have this file with a valid hash on disk.
  const existing = manifest.files[item.relPath];
  if (existing && existsSync(absPath)) {
    try {
      const buf = await fs.readFile(absPath);
      if (sha256(buf) === existing.sha256) return { status: 'skip' };
    } catch { /* fall through and re-fetch */ }
  }
  // Skip if a prior run recorded this as definitively missing.
  if (manifest.missing.includes(item.relPath)) return { status: 'missing-cached' };

  // Optional inter-request pacing (used by --retry-errors slow pass).
  if (opts && opts.perRequestDelayMs) {
    await new Promise((r) => setTimeout(r, opts.perRequestDelayMs));
  }

  const res = await fetchWithGateways(item.ipfsPath, config.gateways, config.requestTimeoutMs);
  if (!res.ok) {
    if (res.status === 404) {
      manifest.missing.push(item.relPath);
      delete manifest.errorCounts[item.relPath];
      return { status: 'missing' };
    }
    // Track transient/timeout failures. During the explicit --retry-errors slow
    // pass, treat any file that still fails on every gateway as missing so the
    // build can finish instead of looping forever on likely-nonexistent CIDs.
    if (opts?.finalizeTimeoutFailures) {
      manifest.missing.push(item.relPath);
      delete manifest.errorCounts[item.relPath];
      return { status: 'missing-timeout' };
    }

    // After maxErrorRetries normal attempts across runs where every gateway
    // failed, treat the file as missing so we stop wasting time on it.
    // (Non-existent CIDs often hang instead of 404ing.)
    const prev = manifest.errorCounts[item.relPath] ?? 0;
    const next = prev + 1;
    manifest.errorCounts[item.relPath] = next;
    const cap = config.maxErrorRetries ?? 2;
    if (next >= cap) {
      manifest.missing.push(item.relPath);
      delete manifest.errorCounts[item.relPath];
      return { status: 'missing-timeout' };
    }
    return { status: 'error', httpStatus: res.status };
  }
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, res.bytes);
  manifest.files[item.relPath] = {
    sha256: sha256(res.bytes),
    bytes: res.bytes.length,
    gateway: res.gateway,
    fetchedAt: new Date().toISOString(),
  };
  delete manifest.errorCounts[item.relPath];
  return { status: 'ok', bytes: res.bytes.length };
}

async function runPool(items, config, outDir, manifest, onProgress, opts = {}) {
  const queue = [...items];
  let inFlight = 0;
  let done = 0;
  const total = queue.length;
  const errors = [];
  const concurrency = opts.concurrency ?? config.concurrency;

  return new Promise((resolve) => {
    const tick = () => {
      while (inFlight < concurrency && queue.length > 0) {
        const item = queue.shift();
        inFlight += 1;
        processOne(item, config, outDir, manifest, opts)
          .then((r) => { if (r.status === 'error') errors.push({ item, ...r }); })
          .catch((err) => errors.push({ item, status: 'throw', message: String(err) }))
          .finally(() => {
            inFlight -= 1; done += 1;
            onProgress(done, total);
            // Periodic manifest checkpoint every 250 files.
            if (done % 250 === 0) {
              saveManifest(outDir, manifest).catch(() => {});
            }
            if (queue.length === 0 && inFlight === 0) resolve({ errors });
            else tick();
          });
      }
    };
    tick();
  });
}

const ZIP_FILE_NAME = 'gpk-image-mirror.zip';

async function buildZip(outDir, zipPath) {
  const zip = new JSZip();
  const skipTopLevel = new Set([ZIP_FILE_NAME]);
  async function walk(dir, base) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      // Never include the ZIP itself when the ZIP lives inside outDir.
      if (base === '' && skipTopLevel.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      const rel = path.posix.join(base, e.name);
      if (e.isDirectory()) await walk(abs, rel);
      else if (e.isFile()) {
        const buf = await fs.readFile(abs);
        zip.file(rel, buf);
      }
    }
  }
  await walk(outDir, '');

  // Stream the ZIP to disk AND into a sha256 hash simultaneously. This avoids
  // holding the entire archive in a single Buffer, which breaks past ~2 GB
  // (JSZip nodebuffer cap and Node's Hash.update argument cap).
  return await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const out = createWriteStream(zipPath);
    let bytes = 0;
    const stream = zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'STORE',
    });
    stream.on('data', (chunk) => {
      hash.update(chunk);
      bytes += chunk.length;
    });
    stream.on('error', reject);
    out.on('error', reject);
    out.on('finish', () => {
      resolve({ bytes, sha256: hash.digest('hex') });
    });
    stream.pipe(out);
  });
}

export async function build(configPath = path.join(__dirname, 'mirror-config.json'), opts = {}) {
  const config = await readConfig(configPath);
  const outDir = path.resolve(path.dirname(configPath), config.outDir);
  // The ZIP is deployed alongside the folder so every mirror host serves it
  // (GitHub Pages, Cloudflare Pages, GitLab Pages). Keep it inside outDir.
  const zipPath = opts.zipPath
    ? path.resolve(opts.zipPath)
    : path.join(outDir, ZIP_FILE_NAME);
  if (opts.gatewaysOverride) config.gateways = opts.gatewaysOverride;
  if (opts.concurrencyOverride) config.concurrency = opts.concurrencyOverride;
  if (opts.timeoutOverride) config.requestTimeoutMs = opts.timeoutOverride;
  await fs.mkdir(outDir, { recursive: true });
  const manifest = await loadExistingManifest(outDir);

  // --retry-errors: clear cached "missing-timeout" entries so they get one
  // more chance under a slower, single-connection pass. Real 404s stay marked
  // missing because the errorCounts map never held them.
  if (opts.retryErrors) {
    const retryable = new Set(Object.keys(manifest.errorCounts || {}));
    // Also retry entries that got promoted from timeouts into `missing` on the
    // previous run (they have no file on disk and no 404 confirmation).
    manifest.missing = manifest.missing.filter((rel) => {
      // Keep it as missing unless the caller explicitly wants a full retry.
      if (opts.retryAllMissing) return false;
      return !retryable.has(rel);
    });
    manifest.errorCounts = {};
  }

  const items = Array.from(enumerate(config));
  const log = opts.quiet ? () => {} : (msg) => process.stdout.write(msg);
  log(`Enumerated ${items.length} candidate files across ${config.series.length} series.\n`);
  if (manifest.missing.length) log(`Skipping ${manifest.missing.length} previously-missing entries.\n`);

  let lastLine = 0;
  const poolOpts = opts.retryErrors
    ? { concurrency: 1, perRequestDelayMs: 2000, finalizeTimeoutFailures: true }
    : {};
  const { errors } = await runPool(items, config, outDir, manifest, (done, total) => {
    if (opts.quiet) return;
    const now = Date.now();
    if (now - lastLine > 500 || done === total) {
      lastLine = now;
      process.stdout.write(`\r  ${done}/${total} processed`);
    }
  }, poolOpts);
  log('\n');

  manifest.generatedAt = new Date().toISOString();
  manifest.seriesCount = config.series.length;
  manifest.fileCount = Object.keys(manifest.files).length;
  manifest.missingCount = manifest.missing.length;
  await saveManifest(outDir, manifest);

  if (opts.skipZip !== true) {
    log(`Zipping ${manifest.fileCount} files → ${zipPath}\n`);
    const { bytes, sha256: zipHash } = await buildZip(outDir, zipPath);
    manifest.zipFileName = ZIP_FILE_NAME;
    manifest.zipBytes = bytes;
    manifest.zipSha256 = zipHash;
    await saveManifest(outDir, manifest);
    const sizeMb = bytes / 1024 / 1024;
    log(`Wrote ZIP (${sizeMb.toFixed(1)} MB) sha256=${zipHash}\n`);
    if (sizeMb > 1900) {
      log(`\nNote: ZIP is ${(sizeMb / 1024).toFixed(2)} GB — too large for a normal 'git push'.\n` +
          `Upload it as a GitHub Release asset instead, and push the folder contents in batches.\n`);
    }
  }

  // Copy the manifest into the public folder so the app can pin it at build time.
  const publicDir = path.resolve(process.cwd(), 'public');
  await fs.mkdir(publicDir, { recursive: true });
  await fs.copyFile(path.join(outDir, 'manifest.json'), path.join(publicDir, 'gpk-manifest.json'));
  log(`Copied pinned manifest → public/gpk-manifest.json\n`);

  return { outDir, zipPath, manifest, errors };
}

// Entrypoint
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--config');
  const configPath = idx >= 0 ? args[idx + 1] : path.join(__dirname, 'mirror-config.json');
  const skipZip = args.includes('--no-zip');
  const retryErrors = args.includes('--retry-errors');
  const retryAllMissing = args.includes('--retry-all-missing');
  build(configPath, { skipZip, retryErrors, retryAllMissing })
    .then(({ manifest, errors }) => {
      const pendingRetry = Object.keys(manifest.errorCounts || {}).length;
      console.log(
        `Done. files=${manifest.fileCount} missing=${manifest.missingCount} ` +
        `pending-retry=${pendingRetry} errors-this-run=${errors.length}`,
      );
      if (pendingRetry > 0 && !retryErrors) {
        console.log(
          `\n${pendingRetry} file(s) failed on this run but will be retried on the next run.\n` +
          `If they keep failing, run:  node scripts/build-image-mirror.mjs --retry-errors`,
        );
      }
      if (retryErrors) {
        console.log(
          '\nSlow retry pass finished. Any files that still timed out on every gateway were marked missing.\n' +
          'Next run:  node scripts/verify-mirror.mjs scripts/mirror-output',
        );
      }
      if (pendingRetry > 0 && retryErrors) {
        console.log(
          `\nWarning: ${pendingRetry} file(s) are still pending retry. ` +
          'Run the retry command again only if verify-mirror reports missing/corrupt files.',
        );
      }
      if (errors.length) {
        console.log('First 10 errors this run:');
        for (const e of errors.slice(0, 10)) console.log('  ', e.item.relPath, e.status, e.httpStatus ?? '');
      }
    })
    .catch((err) => { console.error(err); process.exit(2); });
}
