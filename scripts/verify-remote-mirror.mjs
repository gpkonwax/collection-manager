#!/usr/bin/env node
/**
 * verify-remote-mirror.mjs — check a live mirror URL against a canonical manifest.
 *
 * Fetches `<baseUrl>manifest.json`, then fetches each listed file, sha256s it,
 * and compares. Optionally load the canonical manifest from a local file for
 * cross-verification.
 *
 * Usage:
 *   node scripts/verify-remote-mirror.mjs <baseUrl> [--manifest ./mirror-output/manifest.json] [--sample 100]
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

async function fetchBuf(url, timeoutMs = 30000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return new Uint8Array(await res.arrayBuffer());
  } finally { clearTimeout(t); }
}

export async function verifyRemote(baseUrl, opts = {}) {
  if (!baseUrl.endsWith('/')) baseUrl = `${baseUrl}/`;

  let manifest;
  if (opts.manifestPath) {
    manifest = JSON.parse(await fs.readFile(opts.manifestPath, 'utf8'));
  } else {
    manifest = JSON.parse(new TextDecoder().decode(await fetchBuf(`${baseUrl}manifest.json`)));
  }

  let entries = Object.entries(manifest.files || {});
  if (opts.sample && opts.sample < entries.length) {
    // Deterministic sample: every Nth entry.
    const step = Math.floor(entries.length / opts.sample);
    entries = entries.filter((_, i) => i % step === 0).slice(0, opts.sample);
  }

  const bad = [];
  const missing = [];
  let checked = 0;
  const concurrency = opts.concurrency ?? 6;
  let idx = 0;

  await Promise.all(new Array(concurrency).fill(0).map(async () => {
    while (true) {
      const my = idx++;
      if (my >= entries.length) return;
      const [rel, rec] = entries[my];
      try {
        const buf = await fetchBuf(`${baseUrl}${rel}`);
        checked += 1;
        if (sha256(buf) !== rec.sha256) bad.push(rel);
      } catch (err) {
        missing.push(rel);
      }
      if (opts.onProgress) opts.onProgress(checked + bad.length + missing.length, entries.length);
    }
  }));

  return { total: entries.length, checked, bad, missing };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const baseUrl = args[0];
  if (!baseUrl) { console.error('Usage: verify-remote-mirror.mjs <baseUrl> [--manifest path] [--sample N]'); process.exit(2); }
  const mIdx = args.indexOf('--manifest');
  const sIdx = args.indexOf('--sample');
  const opts = {};
  if (mIdx >= 0) opts.manifestPath = args[mIdx + 1];
  if (sIdx >= 0) opts.sample = Number(args[sIdx + 1]);
  verifyRemote(baseUrl, opts)
    .then(({ total, checked, bad, missing }) => {
      console.log(`Checked ${checked}/${total} at ${baseUrl}`);
      if (bad.length)     console.log(`  MISMATCH (${bad.length}):`, bad.slice(0, 10));
      if (missing.length) console.log(`  UNREACHABLE (${missing.length}):`, missing.slice(0, 10));
      if (bad.length || missing.length) process.exit(1);
      console.log('OK');
    })
    .catch((err) => { console.error(err); process.exit(2); });
}
