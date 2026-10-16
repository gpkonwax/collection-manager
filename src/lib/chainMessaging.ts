/**
 * On-chain encrypted messaging (hidden while in development).
 * Messages are memos on tiny WAX / CHEESE transfers, encrypted with
 * nacl.box (X25519 + XSalsa20-Poly1305). Box keys are symmetric between the
 * pair, so the sender can also read their own sent messages.
 */
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';
import { HYPERION_ENDPOINTS } from '@/lib/waxRpcFallback';

export const MSG_PREFIX = 'GPKM1:';
export const KEY_PREFIX = 'GPKMKEY1:';
export const MEMO_MAX_BYTES = 256;
export const KEY_PUBLISH_TO = 'eosio.null';

export const MESSAGE_TOKENS = {
  WAX: { contract: 'eosio.token', symbol: 'WAX', quantity: '0.05000000 WAX' },
  CHEESE: { contract: 'cheeseburger', symbol: 'CHEESE', quantity: '0.0100 CHEESE' },
} as const;
export type MessageToken = keyof typeof MESSAGE_TOKENS;

export interface MessagingKey {
  type: 'gpk-msg-key';
  version: 1;
  account: string;
  publicKey: string;
  secretKey: string;
  created: string;
}
export interface PublicKeyFile {
  type: 'gpk-msg-pubkey';
  version: 1;
  account: string;
  publicKey: string;
}

const keyStore = (a: string) => `gpk-msg-key-${a}`;
const contactStore = (a: string) => `gpk-msg-contacts-${a}`;

export function generateKey(account: string): MessagingKey {
  const kp = nacl.box.keyPair();
  return {
    type: 'gpk-msg-key', version: 1, account,
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
    created: new Date().toISOString(),
  };
}

const validKey = (b64: string, len: number) => {
  try { return decodeBase64(b64).length === len; } catch { return false; }
};

export function parseKeyFile(raw: unknown): MessagingKey | PublicKeyFile | null {
  const o = raw as Record<string, unknown>;
  if (!o || typeof o.account !== 'string' || typeof o.publicKey !== 'string') return null;
  if (!validKey(o.publicKey, 32)) return null;
  if (o.type === 'gpk-msg-key') {
    if (typeof o.secretKey !== 'string' || !validKey(o.secretKey, 32)) return null;
    // the public key must belong to the secret key
    const derived = nacl.box.keyPair.fromSecretKey(decodeBase64(o.secretKey));
    if (encodeBase64(derived.publicKey) !== o.publicKey) return null;
    return o as unknown as MessagingKey;
  }
  if (o.type === 'gpk-msg-pubkey') return o as unknown as PublicKeyFile;
  return null;
}

export const toPublicFile = (k: MessagingKey): PublicKeyFile =>
  ({ type: 'gpk-msg-pubkey', version: 1, account: k.account, publicKey: k.publicKey });

export function loadKey(account: string): MessagingKey | null {
  try {
    const v = parseKeyFile(JSON.parse(localStorage.getItem(keyStore(account)) || 'null'));
    return v && v.type === 'gpk-msg-key' && v.account === account ? v : null;
  } catch { return null; }
}
export const saveKey = (k: MessagingKey) => localStorage.setItem(keyStore(k.account), JSON.stringify(k));

export function loadContacts(account: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(contactStore(account)) || '{}') || {}; } catch { return {}; }
}
export function saveContact(account: string, contact: string, publicKey: string) {
  const c = loadContacts(account);
  c[contact] = publicKey;
  localStorage.setItem(contactStore(account), JSON.stringify(c));
}

const utf8Len = (s: string) => new TextEncoder().encode(s).length;

/** Largest plaintext (UTF-8 bytes) that fits one memo. */
export const MAX_PLAINTEXT_BYTES = (() => {
  // memo = prefix + b64(nonce 24) + ':' + b64(len + 16)
  for (let n = 256; n > 0; n--) {
    const len = MSG_PREFIX.length + 32 + 1 + 4 * Math.ceil((n + 16) / 3);
    if (len <= MEMO_MAX_BYTES) return n;
  }
  return 0;
})();

export const plaintextBytes = utf8Len;

export function encryptMemo(text: string, theirPublic: string, mySecret: string): string {
  if (!text) throw new Error('Message is empty');
  if (utf8Len(text) > MAX_PLAINTEXT_BYTES) throw new Error(`Message is longer than ${MAX_PLAINTEXT_BYTES} bytes`);
  const nonce = nacl.randomBytes(24);
  const box = nacl.box(decodeUTF8(text), nonce, decodeBase64(theirPublic), decodeBase64(mySecret));
  return `${MSG_PREFIX}${encodeBase64(nonce)}:${encodeBase64(box)}`;
}

export function decryptMemo(memo: string, theirPublic: string, mySecret: string): string | null {
  if (!memo.startsWith(MSG_PREFIX)) return null;
  const [n, c] = memo.slice(MSG_PREFIX.length).split(':');
  try {
    const out = nacl.box.open(decodeBase64(c), decodeBase64(n), decodeBase64(theirPublic), decodeBase64(mySecret));
    return out ? encodeUTF8(out) : null;
  } catch { return null; }
}

export const keyMemo = (publicKey: string) => `${KEY_PREFIX}${publicKey}`;

export function transferAction(token: MessageToken, from: string, to: string, memo: string, auth: unknown[]) {
  const t = MESSAGE_TOKENS[token];
  return { account: t.contract, name: 'transfer', authorization: auth, data: { from, to, quantity: t.quantity, memo } };
}

export interface ChainMemo { txId: string; time: number; from: string; to: string; memo: string; quantity: string }

async function hyperionTransfers(query: string): Promise<ChainMemo[]> {
  let lastErr: unknown = null;
  for (const base of HYPERION_ENDPOINTS) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      const r = await fetch(`${base}/v2/history/get_actions?${query}`, { signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return (j.actions || []).map((a: any) => ({
        txId: a.trx_id, time: Date.parse((a['@timestamp'] || a.timestamp) + 'Z'),
        from: a.act?.data?.from, to: a.act?.data?.to, memo: a.act?.data?.memo || '',
        quantity: a.act?.data?.quantity || '',
      }));
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error('History lookup failed');
}

const FILTER = 'filter=eosio.token:transfer,cheeseburger:transfer';

/** Newest key the account published on chain, if any. */
export async function lookupPublishedKey(account: string): Promise<string | null> {
  const rows = await hyperionTransfers(`account=${account}&${FILTER}&transfer.to=${KEY_PUBLISH_TO}&sort=desc&limit=100`);
  for (const r of rows) {
    if (r.from !== account || !r.memo.startsWith(KEY_PREFIX)) continue;
    const k = r.memo.slice(KEY_PREFIX.length).trim();
    if (validKey(k, 32)) return k;
  }
  return null;
}

/** Encrypted messages sent or received by the account (newest first, deduped). */
export async function fetchMessages(account: string): Promise<ChainMemo[]> {
  const rows = await hyperionTransfers(`account=${account}&${FILTER}&sort=desc&limit=500`);
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (!r.memo.startsWith(MSG_PREFIX) || (r.from !== account && r.to !== account)) return false;
    const id = `${r.txId}:${r.memo}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
