import { useState, useEffect, useCallback } from 'react';
import { fetchTableRows } from '@/lib/waxRpcFallback';

export interface GpkPack {
  symbol: string;
  amount: number;
  precision: number;
  label: string;
}

const GPK_LABELS: Record<string, string> = {
  GPKFIVE: 'GPK Series 1 Pack',
  GPKMEGA: 'GPK Mega Pack',
  GPKTWOA: 'GPK Series 2A Pack',
  GPKTWOB: 'GPK Series 2B Pack',
  GPKTWOC: 'GPK Series 2C Pack',
  EXOFIVE: 'Exotic Series 1 Pack',
  EXOMEGA: 'Exotic Mega Pack',
};

const ALWAYS_VISIBLE: string[] = ['GPKFIVE', 'GPKMEGA', 'GPKTWOA', 'GPKTWOB', 'GPKTWOC', 'EXOFIVE', 'EXOMEGA'];

export function useGpkPacks(accountName: string | null) {
  const [packs, setPacks] = useState<GpkPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPacks = useCallback(async () => {
    if (!accountName) { setPacks([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchTableRows<{ balance: string }>({
        code: 'packs.topps', scope: accountName, table: 'accounts', limit: 100,
      });
      const parsed = new Map<string, GpkPack>();
      for (const row of res.rows) {
        const parts = row.balance.split(' ');
        const amount = parseFloat(parts[0]) || 0;
        const symbol = parts[1] || '';
        const precision = parts[0].includes('.') ? parts[0].split('.')[1].length : 0;
        if (GPK_LABELS[symbol]) {
          parsed.set(symbol, { symbol, amount, precision, label: GPK_LABELS[symbol] });
        }
      }
      for (const sym of ALWAYS_VISIBLE) {
        if (!parsed.has(sym)) {
          parsed.set(sym, { symbol: sym, amount: 0, precision: 0, label: GPK_LABELS[sym] });
        }
      }
      setPacks([...parsed.values()]);
    } catch (e) {
      console.warn('[GPK Packs] Fetch failed:', e);
      setError((e as Error).message);
      setPacks([]);
    } finally { setIsLoading(false); }
  }, [accountName]);

  useEffect(() => { fetchPacks(); }, [fetchPacks]);
  return { packs, isLoading, error, refetch: fetchPacks };
}
