// Lightweight preflight so users get a friendly warning instead of a raw
// contract assertion (e.g. "overdrawn balance") when their account can't
// afford to push a transaction.

import { waxRpcCall } from '@/lib/waxRpcFallback';

export interface AccountResources {
  cpuAvailableUs: number;
  netAvailableBytes: number;
  ramFreeBytes: number;
  liquidWax: number;
}

interface AccountResp {
  cpu_limit?: { available?: number | string };
  net_limit?: { available?: number | string };
  ram_quota?: number;
  ram_usage?: number;
  core_liquid_balance?: string;
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getAccountResources(account: string): Promise<AccountResources | null> {
  try {
    const res = await waxRpcCall<AccountResp>('/v1/chain/get_account', { account_name: account }, 10000);
    return {
      cpuAvailableUs: num(res?.cpu_limit?.available),
      netAvailableBytes: num(res?.net_limit?.available),
      ramFreeBytes: num(res?.ram_quota) - num(res?.ram_usage),
      liquidWax: num((res?.core_liquid_balance || '0 WAX').split(' ')[0]),
    };
  } catch {
    return null;
  }
}

/** Rough floor for a two-transfer msig proposal. */
export const MIN_CPU_US = 1500;
export const MIN_NET_BYTES = 800;
export const MIN_RAM_BYTES = 2000;

/**
 * Returns a human-readable reason the transaction is likely to fail, or null
 * when the account looks fine (or the check itself could not run).
 */
export function describeResourceProblem(
  r: AccountResources | null,
  opts: { requiresWax?: number } = {},
): string | null {
  if (!r) return null;
  const needWax = opts.requiresWax ?? 0;
  if (needWax > 0 && r.liquidWax < needWax) {
    return `This action needs ${needWax} WAX of liquid balance, but your account has ${r.liquidWax} WAX.`;
  }
  if (r.cpuAvailableUs < MIN_CPU_US) {
    return 'Not enough CPU. Stake a little more WAX to CPU (or wait a few minutes) and try again.';
  }
  if (r.netAvailableBytes < MIN_NET_BYTES) {
    return 'Not enough NET. Stake a little more WAX to NET and try again.';
  }
  if (r.ramFreeBytes < MIN_RAM_BYTES) {
    return 'Not enough RAM. Buy a small amount of RAM for your account and try again.';
  }
  return null;
}
