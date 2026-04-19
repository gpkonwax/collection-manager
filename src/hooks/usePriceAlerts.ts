import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchWithFallback } from '@/lib/fetchWithFallback';
import { ATOMIC_API } from '@/lib/waxConfig';

export const MAX_ALERTS = 5;
const STORAGE_KEY = 'gpk:price-alerts:v1';
const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MANUAL_COOLDOWN_MS = 60 * 1000; // 60 seconds

export interface PriceAlert {
  templateId: string;
  name: string;
  image: string;
  schema: string;
  maxPrice: number; // WAX
  createdAt: string; // ISO
  triggered: boolean;
  lowestPrice?: number; // WAX, last observed
  lastChecked?: string; // ISO
}

interface AlertExportFile {
  version: number;
  exportedAt: string;
  alerts: Array<Pick<PriceAlert, 'templateId' | 'name' | 'image' | 'schema' | 'maxPrice' | 'createdAt'>>;
}

function loadAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(a => a && typeof a.templateId === 'string' && typeof a.maxPrice === 'number');
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch (err) {
    console.warn('Failed to persist price alerts', err);
  }
}

// Module-level singleton state so multiple components share alert data.
let moduleAlerts: PriceAlert[] = loadAlerts();
let moduleLastCheckedAt: number | null = null;
let moduleLastManualCheckAt: number | null = null;
const moduleEtagCache: { etag?: string; payload?: any } = {};
const moduleSessionTriggered = new Set<string>(); // dedupe toast per session
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

function setModuleAlerts(next: PriceAlert[]) {
  moduleAlerts = next;
  saveAlerts(next);
  notify();
}

function parsePriceWax(price: { amount: string; token_precision: number; token_symbol?: string } | undefined): number | null {
  if (!price || !price.amount) return null;
  const amt = Number(price.amount);
  if (!Number.isFinite(amt)) return null;
  return amt / Math.pow(10, price.token_precision || 8);
}

async function runBatchedCheck(force = false): Promise<void> {
  const candidates = moduleAlerts.filter(a => !a.triggered);
  if (candidates.length === 0) {
    moduleLastCheckedAt = Date.now();
    notify();
    return;
  }

  // Template IDs are numeric — safe to leave commas unencoded so AtomicMarket parses
  // `template_whitelist=1,2,3` as a list (encoding commas to %2C breaks this).
  const ids = candidates.map(a => String(a.templateId)).join(',');
  const path = `${ATOMIC_API.paths.sales}?state=1&symbol=WAX&template_whitelist=${ids}&sort=price&order=asc&limit=100`;

  const headers: Record<string, string> = {};
  if (!force && moduleEtagCache.etag) headers['If-None-Match'] = moduleEtagCache.etag;

  console.info('[priceAlerts] checking', { ids, force, url: path });

  let payload: any = null;
  try {
    const resp = await fetchWithFallback(ATOMIC_API.baseUrls, path, { headers });
    if (resp.status === 304 && moduleEtagCache.payload) {
      payload = moduleEtagCache.payload;
      console.info('[priceAlerts] 304 — using cached payload');
    } else {
      const etag = resp.headers.get('etag');
      payload = await resp.json();
      if (etag) {
        moduleEtagCache.etag = etag;
        moduleEtagCache.payload = payload;
      } else if (force) {
        // Clear cache on forced check if no etag returned, to avoid stale 304 next time.
        moduleEtagCache.etag = undefined;
        moduleEtagCache.payload = undefined;
      }
    }
  } catch (err) {
    console.warn('[priceAlerts] check failed:', err);
    moduleLastCheckedAt = Date.now();
    notify();
    return;
  }

  const sales: any[] = Array.isArray(payload?.data) ? payload.data : [];
  // Group by template_id (string keys), keep cheapest WAX listing.
  const cheapestByTemplate = new Map<string, number>();
  for (const sale of sales) {
    const rawTplId = sale?.assets?.[0]?.template?.template_id ?? sale?.template?.template_id;
    if (rawTplId === undefined || rawTplId === null) continue;
    const tplId = String(rawTplId);
    const wax = parsePriceWax(sale?.price);
    if (wax === null) continue;
    const prev = cheapestByTemplate.get(tplId);
    if (prev === undefined || wax < prev) cheapestByTemplate.set(tplId, wax);
  }

  console.info('[priceAlerts] sales returned:', sales.length, 'cheapestByTemplate:', Object.fromEntries(cheapestByTemplate));

  const nowIso = new Date().toISOString();
  const next = moduleAlerts.map(a => {
    if (a.triggered) return a;
    const key = String(a.templateId);
    const lowest = cheapestByTemplate.get(key);
    const updated: PriceAlert = { ...a, lastChecked: nowIso };
    if (lowest !== undefined) updated.lowestPrice = lowest;
    console.info('[priceAlerts] alert', { templateId: key, max: a.maxPrice, lowest });
    if (lowest !== undefined && lowest <= a.maxPrice) {
      updated.triggered = true;
      if (!moduleSessionTriggered.has(a.templateId)) {
        moduleSessionTriggered.add(a.templateId);
        toast.success(`Price alert: ${a.name}`, {
          description: `Listed at ${lowest.toFixed(2)} WAX (your max ${a.maxPrice.toFixed(2)} WAX).`,
          duration: 10000,
        });
      }
    }
    return updated;
  });

  moduleLastCheckedAt = Date.now();
  setModuleAlerts(next);
}

let runningPromise: Promise<void> | null = null;
function checkOnce(force = false): Promise<void> {
  if (runningPromise) return runningPromise;
  runningPromise = runBatchedCheck(force).finally(() => { runningPromise = null; });
  return runningPromise;
}

// Global scheduler — only one across all hook consumers.
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let visibilityBound = false;

function ensureScheduler() {
  if (intervalHandle === null) {
    intervalHandle = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (moduleAlerts.length === 0) return;
      checkOnce();
    }, POLL_INTERVAL_MS);
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (moduleAlerts.length === 0) return;
      const elapsed = moduleLastCheckedAt ? Date.now() - moduleLastCheckedAt : Infinity;
      if (elapsed >= POLL_INTERVAL_MS) checkOnce();
    });
  }
}

let initialChecked = false;
function ensureInitialCheck() {
  if (initialChecked) return;
  initialChecked = true;
  if (moduleAlerts.length > 0) checkOnce();
}

export interface SetAlertResult {
  ok: boolean;
  reason?: 'limit';
}

export function usePriceAlerts() {
  const [, setTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    ensureScheduler();
    ensureInitialCheck();
    return () => {
      mountedRef.current = false;
      listeners.delete(listener);
    };
  }, []);

  const getAlert = useCallback((templateId: string): PriceAlert | undefined => {
    return moduleAlerts.find(a => a.templateId === templateId);
  }, []);

  const setAlert = useCallback((input: {
    templateId: string;
    name: string;
    image: string;
    schema: string;
    maxPrice: number;
  }): SetAlertResult => {
    const existingIdx = moduleAlerts.findIndex(a => a.templateId === input.templateId);
    if (existingIdx >= 0) {
      // Update existing — does NOT count toward cap.
      const existing = moduleAlerts[existingIdx];
      const updated: PriceAlert = {
        ...existing,
        name: input.name,
        image: input.image,
        schema: input.schema,
        maxPrice: input.maxPrice,
        triggered: false, // reset on edit so it can re-fire
      };
      const next = [...moduleAlerts];
      next[existingIdx] = updated;
      moduleSessionTriggered.delete(input.templateId);
      setModuleAlerts(next);
      return { ok: true };
    }
    if (moduleAlerts.length >= MAX_ALERTS) {
      toast.error(`Alert limit reached (${MAX_ALERTS}/${MAX_ALERTS})`, {
        description: 'Remove one to add another.',
      });
      return { ok: false, reason: 'limit' };
    }
    const created: PriceAlert = {
      templateId: input.templateId,
      name: input.name,
      image: input.image,
      schema: input.schema,
      maxPrice: input.maxPrice,
      createdAt: new Date().toISOString(),
      triggered: false,
    };
    setModuleAlerts([...moduleAlerts, created]);
    return { ok: true };
  }, []);

  const removeAlert = useCallback((templateId: string) => {
    moduleSessionTriggered.delete(templateId);
    setModuleAlerts(moduleAlerts.filter(a => a.templateId !== templateId));
  }, []);

  const clearTriggered = useCallback((templateId: string) => {
    const next = moduleAlerts.map(a => a.templateId === templateId ? { ...a, triggered: false } : a);
    moduleSessionTriggered.delete(templateId);
    setModuleAlerts(next);
  }, []);

  const checkNow = useCallback(async (): Promise<{ ok: boolean; remainingMs?: number }> => {
    const now = Date.now();
    if (moduleLastManualCheckAt && now - moduleLastManualCheckAt < MANUAL_COOLDOWN_MS) {
      return { ok: false, remainingMs: MANUAL_COOLDOWN_MS - (now - moduleLastManualCheckAt) };
    }
    moduleLastManualCheckAt = now;
    notify();
    await checkOnce();
    return { ok: true };
  }, []);

  const exportJson = useCallback((): string => {
    const file: AlertExportFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      alerts: moduleAlerts.map(a => ({
        templateId: a.templateId,
        name: a.name,
        image: a.image,
        schema: a.schema,
        maxPrice: a.maxPrice,
        createdAt: a.createdAt,
      })),
    };
    return JSON.stringify(file, null, 2);
  }, []);

  const importJson = useCallback((raw: string): { added: number; updated: number; skipped: string[] } => {
    let parsed: AlertExportFile;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON file');
    }
    if (!parsed || !Array.isArray(parsed.alerts)) throw new Error('Invalid alerts file format');

    const byId = new Map(moduleAlerts.map(a => [a.templateId, a] as const));
    const skipped: string[] = [];
    let added = 0;
    let updated = 0;

    for (const incoming of parsed.alerts) {
      if (!incoming || typeof incoming.templateId !== 'string' || typeof incoming.maxPrice !== 'number') continue;
      const existing = byId.get(incoming.templateId);
      if (existing) {
        // Newer createdAt wins.
        const incomingTime = incoming.createdAt ? Date.parse(incoming.createdAt) : 0;
        const existingTime = existing.createdAt ? Date.parse(existing.createdAt) : 0;
        if (incomingTime > existingTime) {
          byId.set(incoming.templateId, {
            ...existing,
            name: incoming.name || existing.name,
            image: incoming.image || existing.image,
            schema: incoming.schema || existing.schema,
            maxPrice: incoming.maxPrice,
            createdAt: incoming.createdAt,
            triggered: false,
          });
          updated++;
        }
      } else {
        if (byId.size >= MAX_ALERTS) {
          skipped.push(incoming.name || incoming.templateId);
          continue;
        }
        byId.set(incoming.templateId, {
          templateId: incoming.templateId,
          name: incoming.name || `Template ${incoming.templateId}`,
          image: incoming.image || '',
          schema: incoming.schema || '',
          maxPrice: incoming.maxPrice,
          createdAt: incoming.createdAt || new Date().toISOString(),
          triggered: false,
        });
        added++;
      }
    }

    setModuleAlerts(Array.from(byId.values()));
    return { added, updated, skipped };
  }, []);

  return {
    alerts: moduleAlerts,
    maxAlerts: MAX_ALERTS,
    lastCheckedAt: moduleLastCheckedAt,
    lastManualCheckAt: moduleLastManualCheckAt,
    manualCooldownMs: MANUAL_COOLDOWN_MS,
    getAlert,
    setAlert,
    removeAlert,
    clearTriggered,
    checkNow,
    exportJson,
    importJson,
  };
}
