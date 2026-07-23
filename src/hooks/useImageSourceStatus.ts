/**
 * Image source status — background canary that tells the user which layer of
 * the image-fallback stack is currently healthy. Purely observational; does
 * not influence which source `useIpfsMedia` actually picks.
 *
 * Priority order (highest → lowest):
 *   1. IPFS live  — at least one public gateway responds
 *   2. Primary mirror (GitHub Pages)
 *   3. Backup A (Cloudflare Pages)
 *   4. Offline ZIP loaded in the browser
 *   5. All sources down
 */
import { useSyncExternalStore } from 'react';
import {
  PUBLIC_IPFS_GATEWAYS,
  PRIMARY_MIRROR,
  BACKUP_MIRROR_A,
} from '@/lib/ipfsGateways';
import {
  getLocalMirrorStatus,
  subscribeLocalMirror,
} from '@/lib/localMirror';

export type SourceKey = 'ipfs' | 'primary' | 'backupA' | 'local' | 'none';
export type CheckStatus = 'idle' | 'checking' | 'ok' | 'failed';

export interface SourceStatus {
  ipfs: CheckStatus;
  primary: CheckStatus;
  backupA: CheckStatus;
  local: CheckStatus;
  active: SourceKey;
  lastCheckedAt: number | null;
}

const CANARY_CID = 'QmSRti2HK95NXWYG3t3he7UK7hkgw8w9TdqPc6hi5euV1p/base/1a.jpg';
const POLL_INTERVAL_MS = 60_000;
const CHECK_TIMEOUT_MS = 4500;

let state: SourceStatus = {
  ipfs: 'idle',
  primary: 'idle',
  backupA: 'idle',
  local: 'idle',
  active: 'none',
  lastCheckedAt: null,
};

const listeners = new Set<() => void>();
function emit() {
  for (const fn of listeners) fn();
}

function computeActive(next: Omit<SourceStatus, 'active' | 'lastCheckedAt'>): SourceKey {
  if (next.ipfs === 'ok') return 'ipfs';
  if (next.primary === 'ok') return 'primary';
  if (next.backupA === 'ok') return 'backupA';
  if (next.local === 'ok') return 'local';
  return 'none';
}

function update(patch: Partial<SourceStatus>) {
  const merged = { ...state, ...patch };
  merged.active = computeActive(merged);
  state = merged;
  emit();
}

async function probe(url: string, timeoutMs = CHECK_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function checkIpfs(): Promise<boolean> {
  // Race the top 2 public gateways; first success wins.
  const gws = PUBLIC_IPFS_GATEWAYS.slice(0, 2);
  if (gws.length === 0) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let remaining = gws.length;
    for (const gw of gws) {
      probe(`${gw}${CANARY_CID}`).then((ok) => {
        if (settled) return;
        if (ok) { settled = true; resolve(true); return; }
        remaining -= 1;
        if (remaining === 0) { settled = true; resolve(false); }
      });
    }
  });
}

async function checkPrimary(): Promise<boolean> {
  if (!PRIMARY_MIRROR) return false;
  return probe(`${PRIMARY_MIRROR}manifest.json`);
}

async function checkBackupA(): Promise<boolean> {
  if (!BACKUP_MIRROR_A) return false;
  return probe(`${BACKUP_MIRROR_A}manifest.json`);
}

function checkLocal(): boolean {
  return getLocalMirrorStatus().fileCount > 0;
}

let inFlight: Promise<void> | null = null;
export function runImageSourceChecks(): Promise<void> {
  if (inFlight) return inFlight;
  update({
    ipfs: 'checking',
    primary: 'checking',
    backupA: 'checking',
    local: checkLocal() ? 'ok' : 'failed',
  });
  inFlight = (async () => {
    const [ipfs, primary, backupA] = await Promise.all([
      checkIpfs(),
      checkPrimary(),
      checkBackupA(),
    ]);
    update({
      ipfs: ipfs ? 'ok' : 'failed',
      primary: primary ? 'ok' : 'failed',
      backupA: backupA ? 'ok' : 'failed',
      local: checkLocal() ? 'ok' : 'failed',
      lastCheckedAt: Date.now(),
    });
  })().finally(() => { inFlight = null; });
  return inFlight;
}

let bootstrapped = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  void runImageSourceChecks();
  pollTimer = setInterval(() => { void runImageSourceChecks(); }, POLL_INTERVAL_MS);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void runImageSourceChecks();
    });
  }
  // Reflect local-mirror changes immediately (ZIP loaded/cleared).
  subscribeLocalMirror(() => {
    update({ local: checkLocal() ? 'ok' : 'failed' });
  });
}

function subscribe(fn: () => void): () => void {
  bootstrap();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function getSnapshot(): SourceStatus {
  return state;
}

export function useImageSourceStatus(): SourceStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const SOURCE_LABELS: Record<SourceKey, string> = {
  ipfs: 'IPFS live',
  primary: 'Primary mirror',
  backupA: 'Backup A',
  local: 'Offline ZIP',
  none: 'All sources down',
};
