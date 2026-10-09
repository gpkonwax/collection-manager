/**
 * Pack transfers.
 *
 * SimpleAssets-era packs (Series 1/2/Exotic) are fungible TOKENS on the
 * packs.topps token contract — they move by quantity per symbol.
 * AtomicAssets packs (Food Fight, Crash Gordon, ...) are individual NFTs —
 * they move by asset ID via atomicassets::transfer.
 */

export const PACK_TOKEN_CONTRACT = 'packs.topps';

export interface PackTokenBalance {
  symbol: string;
  amount: number;
  precision: number;
}

export function formatPackQuantity(amount: number, precision: number, symbol: string): string {
  return precision > 0 ? `${amount.toFixed(precision)} ${symbol}` : `${amount} ${symbol}`;
}

export interface BuildPackTransferInput {
  actor: string;
  auth: unknown[];
  to: string;
  memo: string;
  /** symbol -> quantity to send */
  tokenQtys: Map<string, number>;
  /** owned token balances, used for precision + balance check */
  balances: PackTokenBalance[];
  /** AtomicAssets pack asset IDs to send */
  atomicIds: string[];
  /** every pack asset ID the user owns (guards against foreign IDs) */
  ownedAtomicIds: Set<string>;
}

export function buildPackTransferActions(input: BuildPackTransferInput) {
  const { actor, auth, to, memo, tokenQtys, balances, atomicIds, ownedAtomicIds } = input;
  const actions: Array<{ account: string; name: string; authorization: unknown[]; data: Record<string, unknown> }> = [];

  for (const [symbol, qty] of tokenQtys) {
    if (qty <= 0) continue;
    if (!Number.isInteger(qty)) throw new Error(`Pack quantity for ${symbol} must be a whole number`);
    const bal = balances.find(b => b.symbol === symbol);
    if (!bal) throw new Error(`You don't own any ${symbol} packs`);
    if (qty > bal.amount) throw new Error(`Only ${bal.amount} ${symbol} pack(s) available`);
    actions.push({
      account: PACK_TOKEN_CONTRACT,
      name: 'transfer',
      authorization: auth,
      data: { from: actor, to, quantity: formatPackQuantity(qty, bal.precision, symbol), memo },
    });
  }

  const ids = [...new Set(atomicIds)];
  for (const id of ids) {
    if (!ownedAtomicIds.has(id)) throw new Error(`Pack ${id} is not in your wallet`);
  }
  if (ids.length > 0) {
    actions.push({
      account: 'atomicassets',
      name: 'transfer',
      authorization: auth,
      data: { from: actor, to, asset_ids: ids, memo },
    });
  }

  if (actions.length === 0) throw new Error('No packs selected');
  return actions;
}

export type SelectionKind = 'none' | 'cards' | 'packs';

export function getSelectionKind(cardCount: number, packCount: number): SelectionKind {
  if (packCount > 0) return 'packs';
  if (cardCount > 0) return 'cards';
  return 'none';
}

/** Cards may be picked only when no packs are selected, and vice versa. */
export function canSelect(kind: 'cards' | 'packs', current: SelectionKind): boolean {
  return current === 'none' || current === kind;
}
