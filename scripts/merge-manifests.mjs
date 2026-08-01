#!/usr/bin/env node
/**
 * merge-manifests.mjs — combine the AtomicAssets manifest that lives in the
 * ZIP staging folder with the SimpleAssets manifest from the published mirror
 * repo, producing one manifest that accounts for every file on disk.
 *
 * Why this exists
 * ---------------
 * The staging folder holds 2575 images (1545 under `atomic/`, 1030 in the
 * SimpleAssets CID folders) but its `manifest.json` only lists the
 * AtomicAssets half. Anything that trusts the manifest — the offline ZIP
 * import, `verify-mirror.mjs`, the mirror audit — therefore believes the
 * SimpleAssets images do not exist.
 *
 * Key rules (these matter, do not "simplify" them)
 * ------------------------------------------------
 * - `remoteMirror.ts` looks up `manifest.files[ipfsPath]`, where `ipfsPath` is
 *   `<cid>/<variant>/<file>`. So SimpleAssets entries keep their relative-path
 *   key and carry no `path` field: the file sits exactly at the key.
 * - AtomicAssets entries keep their `path` field (`atomic/...`), which both the
 *   app and `verify-mirror.mjs` use to resolve the real on-disk location.
 * - Some AtomicAssets entries share an `ipfsPath` with a SimpleAssets entry
 *   (the same image mirrored twice: once at the CID path, once under
 *   `atomic/`). For those the SimpleAssets copy wins the canonical key, and the
 *   `atomic/` twin is recorded under its own `atomic/...` key so the file is
 *   still covered by the manifest and by ZIP verification.
 *
 * Usage:
 *   node scripts/merge-manifests.mjs
 *   node scripts/merge-manifests.mjs <atomicManifest> <simpleManifest>
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_ATOMIC = 'C:\\Users\\User\\Desktop\\gpk-zip-src\\manifest.json';
const DEFAULT_SIMPLE = 'C:\\Users\\User\\Desktop\\gpkonwaxbackup-repo\\manifest.json';

function pad(label) {
  return `${label}${' '.repeat(Math.max(0, 17 - label.length))}`;
}

function log(label, value) {
  console.log(`${pad(label)}: ${value}`);
}

async function readManifest(p) {
  let raw;
  try {
    raw = await fs.readFile(p, 'utf8');
  } catch (err) {
    throw new Error(`Could not read manifest at ${p}\n  ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Manifest at ${p} is not valid JSON\n  ${err.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.files !== 'object') {
    throw new Error(`Manifest at ${p} has no "files" object`);
  }
  return parsed;
}

export async function merge(atomicPath, simplePath) {
  const atomic = await readManifest(atomicPath);
  const simple = await readManifest(simplePath);

  const atomicFiles = atomic.files || {};
  const simpleFiles = simple.files || {};

  const atomicCount = Object.keys(atomicFiles).length;
  const simpleCount = Object.keys(simpleFiles).length;

  const merged = {};
  const shaConflicts = [];
  const relocated = [];

  // SimpleAssets first: they own the canonical `<cid>/<variant>/<file>` key.
  for (const [key, rec] of Object.entries(simpleFiles)) {
    const copy = { ...rec };
    // The file lives at the key itself; a stray `path` would misdirect lookups.
    delete copy.path;
    merged[key] = copy;
  }

  for (const [key, rec] of Object.entries(atomicFiles)) {
    const existing = merged[key];
    if (!existing) {
      merged[key] = { ...rec };
      continue;
    }
    if (existing.sha256 && rec.sha256 && existing.sha256 !== rec.sha256) {
      shaConflicts.push(key);
    }
    // Duplicate image. Keep the SimpleAssets entry on the canonical key and
    // record the atomic/ copy under its own key so the file is still covered.
    const diskPath = rec.path || key;
    if (diskPath !== key && !merged[diskPath]) {
      merged[diskPath] = { ...rec };
      relocated.push(diskPath);
    }
  }

  const out = {
    ...atomic,
    ...(simple.seriesCount != null ? { seriesCount: simple.seriesCount } : {}),
    generatedAt: new Date().toISOString(),
    mergedFrom: {
      atomic: atomicPath,
      simple: simplePath,
      atomicEntries: atomicCount,
      simpleEntries: simpleCount,
    },
    files: merged,
    missing: [
      ...new Set([...(simple.missing || []), ...(atomic.missing || [])]),
    ],
    errorCounts: { ...(simple.errorCounts || {}), ...(atomic.errorCounts || {}) },
  };

  if (atomic.atomicSchemas) out.atomicSchemas = atomic.atomicSchemas;
  if (atomic.atomicImageCount != null) out.atomicImageCount = atomic.atomicImageCount;

  // Stale ZIP metadata from the previous split run must not survive; the next
  // build-image-mirror.mjs --zip-only --split-zip run rewrites it.
  delete out.zipParts;
  delete out.zipPartCount;
  delete out.zipBytes;
  delete out.zipFileName;
  delete out.zipSha256;

  out.fileCount = Object.keys(merged).length;
  out.missingCount = out.missing.length;

  return { out, atomicCount, simpleCount, shaConflicts, relocated };
}

async function main() {
  const [atomicArg, simpleArg] = process.argv.slice(2);
  const atomicPath = path.resolve(atomicArg || DEFAULT_ATOMIC);
  const simplePath = path.resolve(simpleArg || DEFAULT_SIMPLE);

  console.log(`atomic manifest  : ${atomicPath}`);
  console.log(`simple manifest  : ${simplePath}\n`);

  const { out, atomicCount, simpleCount, shaConflicts, relocated } =
    await merge(atomicPath, simplePath);

  if (shaConflicts.length) {
    console.error(
      `\nSHA-256 conflict on ${shaConflicts.length} shared key(s). ` +
      `The two manifests disagree about the contents of the same image.\n` +
      `First few:\n  ${shaConflicts.slice(0, 10).join('\n  ')}\n\n` +
      `Nothing was written. Send this output before continuing.`
    );
    process.exitCode = 1;
    return;
  }

  // Back up the original outside the staging folder so it is never zipped.
  const stagingDir = path.dirname(atomicPath);
  const backupPath = path.join(
    path.dirname(stagingDir),
    `${path.basename(stagingDir)}-manifest.atomic.json`
  );
  await fs.copyFile(atomicPath, backupPath);
  await fs.writeFile(atomicPath, `${JSON.stringify(out, null, 2)}\n`);

  log('atomic entries', atomicCount);
  log('simple entries', simpleCount);
  log('shared keys', atomicCount + simpleCount - out.fileCount + relocated.length);
  log('atomic/ twins kept', relocated.length);
  log('merged entries', out.fileCount);
  log('missing', out.missingCount);
  log('backup written', backupPath);
  log('manifest written', atomicPath);

  if (out.fileCount !== 2575) {
    console.log(
      `\nNote: merged entry count is ${out.fileCount}, not the expected 2575. ` +
      `Send this output before moving on to the ZIP build.`
    );
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('merge-manifests.mjs');
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exitCode = 1;
  });
}
