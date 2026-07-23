#!/usr/bin/env node
/**
 * Prebuild step: pull the latest pinned manifest from the live primary mirror
 * into public/gpk-manifest.json.
 *
 * - Never breaks the build: on any failure, keep the existing file.
 * - Zero manual maintenance: whatever is currently live on the primary mirror
 *   is what the app ships with.
 */
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_URL =
  process.env.PINNED_MANIFEST_URL ||
  'https://bewbzz.github.io/gpkonwaxbackup/mirror/manifest.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'public', 'gpk-manifest.json');
const TIMEOUT_MS = 15_000;

const RELEASE_ZIP_PARTS = [
  { index: 1, fileName: 'gpk-image-mirror-part-001.zip', bytes: 1885365317, sha256: '' },
  { index: 2, fileName: 'gpk-image-mirror-part-002.zip', bytes: 1887321761, sha256: '' },
  { index: 3, fileName: 'gpk-image-mirror-part-003.zip', bytes: 487481462, sha256: '' },
];

const RELEASE_ZIP_TOTAL_BYTES = RELEASE_ZIP_PARTS.reduce((sum, part) => sum + part.bytes, 0);

async function readExistingManifest() {
  try {
    const existing = await readFile(OUT_PATH, 'utf8');
    return JSON.parse(existing);
  } catch {
    return null;
  }
}

function normalizeZipMetadata(manifest, existingManifest) {
  const existingParts = Array.isArray(existingManifest?.zipParts) && existingManifest.zipParts.length > 1
    ? existingManifest.zipParts
    : null;
  const partsToUse = existingParts ?? RELEASE_ZIP_PARTS;
  const totalBytes = partsToUse.reduce((sum, part) => sum + (Number(part.bytes) || 0), 0) || RELEASE_ZIP_TOTAL_BYTES;

  // The live mirror manifest can legitimately be older than the GitHub Release
  // ZIP assets. Never let that stale single-ZIP shape revive a dead
  // `gpk-image-mirror.zip` download in the app build.
  if (!Array.isArray(manifest.zipParts) || manifest.zipParts.length <= 1) {
    manifest.zipFileName = null;
    manifest.zipBytes = totalBytes;
    manifest.zipSha256 = null;
    manifest.zipPartCount = partsToUse.length;
    manifest.zipParts = partsToUse.map((part) => ({
      index: Number(part.index),
      fileName: String(part.fileName),
      bytes: Number(part.bytes) || 0,
      sha256: typeof part.sha256 === 'string' ? part.sha256 : '',
      ...(typeof part.fileCount === 'number' ? { fileCount: part.fileCount } : {}),
    }));
  }

  return manifest;
}

async function main() {
  console.log(`[sync-pinned-manifest] fetching ${MANIFEST_URL}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(MANIFEST_URL, {
      signal: controller.signal,
      headers: { 'cache-control': 'no-cache' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    // Validate it parses as JSON with a files map before writing.
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed.files !== 'object') {
      throw new Error('manifest missing "files" object');
    }
    const fileCount = Object.keys(parsed.files).length;
    if (fileCount === 0) {
      throw new Error('manifest "files" is empty');
    }
    const existingManifest = await readExistingManifest();
    const normalized = normalizeZipMetadata(parsed, existingManifest);
    const output = `${JSON.stringify(normalized, null, 2)}\n`;
    await mkdir(dirname(OUT_PATH), { recursive: true });
    await writeFile(OUT_PATH, output);
    console.log(
      `[sync-pinned-manifest] wrote ${OUT_PATH} (${fileCount} files, ${(output.length / 1024).toFixed(1)} KB, ${normalized.zipParts?.length ?? 0} ZIP parts)`
    );
  } catch (err) {
    clearTimeout(timer);
    let existing = null;
    try {
      existing = await stat(OUT_PATH);
    } catch { /* noop */ }
    console.warn(
      `[sync-pinned-manifest] WARN: could not refresh manifest (${err instanceof Error ? err.message : err}).`
    );
    if (existing) {
      console.warn(`[sync-pinned-manifest] keeping existing ${OUT_PATH} (${existing.size} bytes).`);
    } else {
      console.warn(`[sync-pinned-manifest] no existing manifest at ${OUT_PATH}; app will treat mirrors as unverifiable until next successful sync.`);
    }
    // Never fail the build.
  }
}

main();
