#!/usr/bin/env node
/**
 * build-atomic-mirror.mjs — download every AtomicAssets GPK image to the mirror.
 *
 * Enumerates every template in the gpk.topps collection (all schemas, including
 * packs), downloads the front image (img) and back image (backimg) for each
 * template, and saves them under mirror-output/atomic/.
 *
 * Manifest entries use the IPFS lookup key (bare CID or CID/path) and include a
 * "path" field pointing to the actual file under atomic/. This lets the app
 * resolve bare CIDs that have no file extension in the metadata.
 *
 * Resumable: re-running skips files already present with a matching sha256.
 * Dry-run mode (--dry-run) counts templates/images without downloading.
 */
import { createHash } from 'node:crypto';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build as buildImageMirror } from './build-image-mirror.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLLECTION = 'gpk.topps';
const ATOMIC_API_BASES = [
  'https://wax.api.atomicassets.io',
  'https://aa.dapplica.io',
  'https://atomic.wax.eosrio.io',
];
const SCHEMAS = [
  'series1',
  'series2',
  'exotic',
  'crashgordon',
  'bernventures',
  'mittens',
  'gamestonk',
  'foodfightb',
  'originalart',
  'promo',
  'bonus',
  'packs',
];

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function readConfig(configPath) {
  const raw = await fs.readFile(configPath, 'utf8');
  return JSON.parse(raw);
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

async function fetchWithFallback(bases, path, timeoutMs = 15000) {
  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
    } catch {
      clearTimeout(timer);
    }
  }
  throw new Error(`All AtomicAssets endpoints failed for ${path}`);
}

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
        lastStatus = 404;
        continue;
      }
      if (!res.ok) { lastStatus = res.status; continue; }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length === 0) { lastStatus = 204; continue; }
      return { ok: true, status: res.status, bytes: buf, gateway: gw, contentType: res.headers.get('content-type') };
    } catch (err) {
      clearTimeout(timer);
      lastStatus = 0;
    }
  }
  return { ok: false, status: lastStatus };
}

function detectExtension(contentType, bytes) {
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('image/gif')) return 'gif';
    if (ct.includes('image/png')) return 'png';
    if (ct.includes('image/webp')) return 'webp';
    if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return 'jpg';
  }
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  }
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg';
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpg';
  return 'jpg';
}

function hasExtension(ipfsPath) {
  const base = path.posix.basename(ipfsPath);
  return /\.[a-zA-Z0-9]{2,6}$/.test(base);
}

function normalizeIpfsPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let v = raw.trim();
  if (!v) return null;

  if (v.startsWith('http://') || v.startsWith('https://')) {
    const m = v.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/);
    if (m) return m[1];
    return null;
  }

  if (v.startsWith('ipfs://')) {
    v = v.replace('ipfs://', '');
  }

  if (/^(Qm|bafy|bafk)/.test(v)) return v;
  return null;
}

function getAtomicFilePath(ipfsPath, ext) {
  if (hasExtension(ipfsPath)) {
    return path.posix.join('atomic', ipfsPath);
  }
  return path.posix.join('atomic', `${ipfsPath}.${ext}`);
}

async function fetchTemplatesForSchema(schema, config) {
  const all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const path = `/atomicassets/v1/templates?collection_name=${COLLECTION}&schema_name=${schema}&limit=100&page=${page}&order=asc&sort=created`;

    const res = await fetchWithFallback(ATOMIC_API_BASES, path, 15000);
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
      throw new Error(`AtomicAssets templates API failed for ${schema}: ${JSON.stringify(json)}`);
    }
    all.push(...json.data);
    hasMore = json.data.length === 100;
    page++;
  }
  return all;
}

function collectImages(templates) {
  const images = [];
  const seen = new Set();
  for (const t of templates) {
    const data = t.immutable_data || {};
    for (const key of ['img', 'backimg', 'image', 'back', 'backimage']) {
      const raw = data[key];
      if (!raw) continue;
      const ipfsPath = normalizeIpfsPath(raw);
      if (!ipfsPath) continue;
      if (seen.has(ipfsPath)) continue;
      seen.add(ipfsPath);
      images.push({
        templateId: t.template_id,
        schema: t.schema_name || data.schema || '',
        key,
        ipfsPath,
      });
    }
  }
  return images;
}

async function processImage(item, config, outDir, manifest, opts) {
  // If the manifest already has a verified entry and the file exists, skip.
  const existing = manifest.files[item.ipfsPath];
  if (existing && existing.path) {
    const absPath = path.join(outDir, existing.path);
    if (existsSync(absPath)) {
      try {
        const buf = await fs.readFile(absPath);
        if (sha256(buf) === existing.sha256) return { status: 'skip' };
      } catch { /* fall through */ }
    }
  }

  if (opts.dryRun) {
    return { status: 'dry-run' };
  }

  const res = await fetchWithGateways(item.ipfsPath, config.gateways, config.requestTimeoutMs);
  if (!res.ok) {
    return { status: 'error', httpStatus: res.status };
  }

  const ext = hasExtension(item.ipfsPath) ? '' : detectExtension(res.contentType, res.bytes);
  const filePath = getAtomicFilePath(item.ipfsPath, ext);
  const absPath = path.join(outDir, filePath);

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, res.bytes);

  manifest.files[item.ipfsPath] = {
    sha256: sha256(res.bytes),
    bytes: res.bytes.length,
    path: filePath,
    gateway: res.gateway,
    fetchedAt: new Date().toISOString(),
  };

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
        processImage(item, config, outDir, manifest, opts)
          .then((r) => { if (r.status === 'error') errors.push({ item, ...r }); })
          .catch((err) => errors.push({ item, status: 'throw', message: String(err) }))
          .finally(() => {
            inFlight -= 1; done += 1;
            onProgress(done, total);
            if (done % 100 === 0) {
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

async function buildAtomic(opts = {}) {
  const configPath = opts.configPath || path.join(__dirname, 'mirror-config.json');
  const config = await readConfig(configPath);
  const outDir = path.resolve(path.dirname(configPath), config.outDir);
  await fs.mkdir(outDir, { recursive: true });
  const manifest = await loadExistingManifest(outDir);

  const log = opts.quiet ? () => {} : (msg) => process.stdout.write(msg);

  log('Discovering AtomicAssets templates...\n');
  const schemaStats = [];
  const allImages = [];
  for (const schema of SCHEMAS) {
    const templates = await fetchTemplatesForSchema(schema, config);
    const images = collectImages(templates);
    schemaStats.push({ schema, templates: templates.length, images: images.length });
    allImages.push(...images);
  }

  log(`\nDiscovered ${allImages.length} unique images across ${SCHEMAS.length} schemas:\n`);
  for (const s of schemaStats) {
    log(`  ${s.schema}: ${s.templates} templates, ${s.images} images\n`);
  }

  if (opts.dryRun) {
    log('\nDry run complete — no files were downloaded.\n');
    return { outDir, manifest, images: allImages, downloaded: 0, errors: [] };
  }

  log('\nDownloading...\n');
  let lastLine = 0;
  const { errors } = await runPool(allImages, config, outDir, manifest, (done, total) => {
    if (opts.quiet) return;
    const now = Date.now();
    if (now - lastLine > 500 || done === total) {
      lastLine = now;
      process.stdout.write(`\r  ${done}/${total} processed`);
    }
  }, opts);
  log('\n');

  manifest.generatedAt = new Date().toISOString();
  manifest.atomicSchemas = SCHEMAS;
  manifest.atomicImageCount = allImages.length;
  manifest.fileCount = Object.keys(manifest.files).length;
  manifest.missingCount = (manifest.missing || []).length;
  await saveManifest(outDir, manifest);

  // Rebuild the ZIP and copy the pinned manifest into the app so the new
  // atomic entries are immediately available to the frontend.
  log('Rebuilding mirror ZIP and copying pinned manifest...\n');
  await buildImageMirror(configPath, { skipZip: false, quiet: opts.quiet });

  return { outDir, manifest, images: allImages, downloaded: allImages.length, errors };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const quiet = args.includes('--quiet');
  buildAtomic({ dryRun, quiet })
    .then(({ manifest, images, errors }) => {
      const totalFiles = Object.keys(manifest.files || {}).length;
      console.log(`\nDone. atomicImages=${images.length} totalFiles=${totalFiles} errors=${errors.length}`);
      if (errors.length) {
        console.log('First 10 errors:');
        for (const e of errors.slice(0, 10)) {
          console.log('  ', e.item?.ipfsPath, e.status, e.httpStatus ?? '', e.message ?? '');
        }
      }
    })

    .catch((err) => { console.error(err); process.exit(2); });
}
