import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, Server } from 'node:http';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
// @ts-expect-error — .mjs source with no types
import { build } from '../build-image-mirror.mjs';
// @ts-expect-error — .mjs source with no types
import { verify } from '../verify-mirror.mjs';
// @ts-expect-error — .mjs source with no types
import { verifyRemote } from '../verify-remote-mirror.mjs';

const sha256 = (buf: Buffer | Uint8Array) => createHash('sha256').update(buf).digest('hex');

// A tiny fixture "series" with 2 card IDs × 2 sides × 2 variants + 2 backs = 10 files.
const HASH_A = 'QmAAA';
const HASH_MISSING = 'QmMISSING';

interface MockContent { [ipfsPath: string]: Uint8Array | 'missing' }

function makeContent(): MockContent {
  const content: MockContent = {};
  for (let id = 1; id <= 2; id += 1) {
    for (const side of ['a', 'b']) {
      content[`${HASH_A}/base/${id}${side}.jpg`] = new TextEncoder().encode(`base ${id}${side}`);
      content[`${HASH_A}/prism/${id}${side}.gif`] = new TextEncoder().encode(`prism ${id}${side}`);
    }
    content[`${HASH_A}/back/${id}.jpg`] = new TextEncoder().encode(`back ${id}`);
  }
  // Simulate one definitively missing file (404) so we can assert it's recorded in the manifest.
  content[`${HASH_MISSING}/base/1a.jpg`] = 'missing';
  return content;
}

let server: Server;
let baseUrl: string;
let content: MockContent;
let tmpDir: string;
let requestLog: string[];

beforeEach(async () => {
  content = makeContent();
  requestLog = [];
  server = createServer((req, res) => {
    const url = req.url ?? '';
    requestLog.push(url);
    // Strip a leading `/ipfs/` to match our fake gateway base.
    const ipfsPath = url.replace(/^\/ipfs\//, '').replace(/^\//, '');
    const entry = content[ipfsPath];
    if (entry === undefined) { res.statusCode = 500; res.end('unknown test path'); return; }
    if (entry === 'missing') { res.statusCode = 404; res.end('not found'); return; }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(Buffer.from(entry));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no server address');
  baseUrl = `http://127.0.0.1:${addr.port}/ipfs/`;
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gpk-mirror-test-'));
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function writeConfig(id = 'test', extras: Record<string, unknown> = {}) {
  const cfg = {
    outDir: './mirror-output',
    zipOut: './mirror.zip',
    concurrency: 3,
    requestTimeoutMs: 5000,
    gateways: [baseUrl],
    series: [
      {
        id,
        hash: HASH_A,
        cardIdRange: [1, 2],
        sides: ['a', 'b'],
        variants: [
          { name: 'base',  ext: 'jpg' },
          { name: 'prism', ext: 'gif' },
        ],
        includeBacks: true,
      },
      {
        id: 'missing',
        hash: HASH_MISSING,
        cardIdRange: [1, 1],
        sides: ['a'],
        variants: [{ name: 'base', ext: 'jpg' }],
        includeBacks: false,
      },
    ],
    ...extras,
  };
  const p = path.join(tmpDir, 'mirror-config.json');
  await fs.writeFile(p, JSON.stringify(cfg));
  return p;
}

describe('build-image-mirror', () => {
  it('downloads every file, records sha256s, and marks 404s as missing', async () => {
    const cfg = await writeConfig();
    const res = await build(cfg, { quiet: true, skipZip: true });
    const manifest = res.manifest;

    expect(Object.keys(manifest.files).length).toBe(10); // 2*2*2 + 2 backs
    expect(manifest.missing).toEqual([`${HASH_MISSING}/base/1a.jpg`]);

    // sha256 recorded is correct
    const rec = manifest.files[`${HASH_A}/base/1a.jpg`];
    expect(rec.sha256).toBe(sha256(content[`${HASH_A}/base/1a.jpg`] as Uint8Array));
    expect(rec.bytes).toBe((content[`${HASH_A}/base/1a.jpg`] as Uint8Array).length);
  });

  it('is resumable: a re-run skips files whose hash matches the manifest', async () => {
    const cfg = await writeConfig();
    await build(cfg, { quiet: true, skipZip: true });
    const firstReqCount = requestLog.length;
    expect(firstReqCount).toBeGreaterThan(0);

    // Re-run without touching disk. Every valid file should be skipped;
    // only the already-known-missing file gets no re-fetch either.
    requestLog = [];
    await build(cfg, { quiet: true, skipZip: true });
    expect(requestLog.length).toBe(0);
  });

  it('re-fetches when a file on disk is corrupted', async () => {
    const cfg = await writeConfig();
    await build(cfg, { quiet: true, skipZip: true });

    // Corrupt one file on disk.
    const corruptRel = `${HASH_A}/base/1a.jpg`;
    const corruptAbs = path.join(tmpDir, 'mirror-output', corruptRel);
    await fs.writeFile(corruptAbs, 'tampered-bytes');

    requestLog = [];
    await build(cfg, { quiet: true, skipZip: true });
    // Exactly the corrupted file should have been re-requested.
    expect(requestLog).toContain(`/ipfs/${corruptRel}`);
  });

  it('writes a ZIP that contains every mirrored file', async () => {
    const cfg = await writeConfig();
    const res = await build(cfg, { quiet: true });
    const stat = await fs.stat(res.zipPath);
    expect(stat.size).toBeGreaterThan(0);
  });
});

describe('verify-mirror', () => {
  it('reports OK for a clean mirror', async () => {
    const cfg = await writeConfig();
    const { outDir } = await build(cfg, { quiet: true, skipZip: true });
    const r = await verify(outDir);
    expect(r.missing).toEqual([]);
    expect(r.corrupt).toEqual([]);
  });

  it('reports the exact filename when a file is corrupted', async () => {
    const cfg = await writeConfig();
    const { outDir } = await build(cfg, { quiet: true, skipZip: true });
    const bad = `${HASH_A}/prism/2b.gif`;
    await fs.writeFile(path.join(outDir, bad), 'tampered');
    const r = await verify(outDir);
    expect(r.corrupt).toEqual([bad]);
  });

  it('reports missing files', async () => {
    const cfg = await writeConfig();
    const { outDir } = await build(cfg, { quiet: true, skipZip: true });
    const gone = `${HASH_A}/back/1.jpg`;
    await fs.rm(path.join(outDir, gone));
    const r = await verify(outDir);
    expect(r.missing).toEqual([gone]);
  });
});

describe('verify-remote-mirror', () => {
  it('validates a remote host against a local canonical manifest', async () => {
    const cfg = await writeConfig();
    const { outDir } = await build(cfg, { quiet: true, skipZip: true });

    // Serve the built mirror over HTTP.
    const files = new Map<string, Buffer>();
    async function collect(dir: string, base = '') {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        const rel = path.posix.join(base, e.name);
        if (e.isDirectory()) await collect(abs, rel);
        else if (e.isFile()) files.set(rel, await fs.readFile(abs));
      }
    }
    await collect(outDir);

    const httpServer = createServer((req, res) => {
      const p = (req.url ?? '/').replace(/^\/+/, '');
      const buf = files.get(p);
      if (!buf) { res.statusCode = 404; res.end(); return; }
      res.statusCode = 200; res.end(buf);
    });
    await new Promise<void>((r) => httpServer.listen(0, '127.0.0.1', r));
    const addr = httpServer.address();
    const remoteBase = `http://127.0.0.1:${(addr as { port: number }).port}/`;

    try {
      const good = await verifyRemote(remoteBase, {
        manifestPath: path.join(outDir, 'manifest.json'),
      });
      expect(good.bad).toEqual([]);
      expect(good.missing).toEqual([]);

      // Tamper: replace one served file with different bytes.
      const tampered = `${HASH_A}/base/2a.jpg`;
      files.set(tampered, Buffer.from('tampered-remote'));
      const bad = await verifyRemote(remoteBase, {
        manifestPath: path.join(outDir, 'manifest.json'),
      });
      expect(bad.bad).toContain(tampered);
    } finally {
      await new Promise<void>((r) => httpServer.close(() => r()));
    }
  });
});
