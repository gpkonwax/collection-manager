/**
 * Session-only "shared pack history" view.
 *
 * When someone loads a pack history JSON exported by another account (a friend
 * sharing their pulls, or your own history from before you moved wallets), the
 * entries are NOT merged into the device's store. They live here, in memory
 * only, and the Pack History dialog shows them as a clearly-labelled shared
 * view with a "Back to my history" exit. Closing the dialog or reloading the
 * page drops them.
 */

import type { PackHistoryEntry } from './packOpenHistory';

export interface SharedPackHistoryView {
  /** The account that opened these packs (shown in the banner). */
  account: string;
  entries: PackHistoryEntry[];
}

let view: SharedPackHistoryView | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try { fn(); } catch { /* listener errors never break a write */ }
  }
}

export function getSharedPackHistory(): SharedPackHistoryView | null {
  return view;
}

export function setSharedPackHistory(next: SharedPackHistoryView | null): void {
  view = next;
  notify();
}

export function subscribeSharedPackHistory(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Split loaded entries into the ones that belong to the connected account
 * (safe to merge into the device store) and a shared view for everyone
 * else's. Returns null for the shared view when there is nothing foreign.
 * De-dupes shared entries by transaction id, newest first.
 */
export function splitSharedEntries(
  entries: PackHistoryEntry[],
  account: string,
): { own: PackHistoryEntry[]; shared: SharedPackHistoryView | null } {
  const own = entries.filter((e) => e.account === account);
  const others = entries.filter((e) => e.account !== account);
  if (others.length === 0) return { own, shared: null };

  const seen = new Set<string>();
  const sharedEntries = others
    .filter((e) => (seen.has(e.txId) ? false : (seen.add(e.txId), true)))
    .sort((a, b) => b.openedAt - a.openedAt);
  return { own, shared: { account: others[0].account, entries: sharedEntries } };
}
