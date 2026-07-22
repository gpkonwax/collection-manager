#!/usr/bin/env node
/**
 * Prebuild step: pull the latest pinned manifest from the live primary mirror
 * into public/gpk-manifest.json.
 *
 * - Never breaks the build: on any failure, keep the existing file.
 * - Zero manual maintenance: whatever is currently live on the primary mirror
 *   is what the app ships with.
 */
import { writeFile, stat, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_URL =
  process.env.PINNED_MANIFEST_URL ||
  'https://bewbzz.github.io/gpkonwaxbackup/mirror/manifest.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'public', 'gpk-manifest.json');
const TIMEOUT_MS = 15_000;

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
    await mkdir(dirname(OUT_PATH), { recursive: true });
    await writeFile(OUT_PATH, text);
    console.log(
      `[sync-pinned-manifest] wrote ${OUT_PATH} (${fileCount} files, ${(text.length / 1024).toFixed(1)} KB)`
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
