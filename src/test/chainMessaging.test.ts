import { describe, it, expect } from 'vitest';
import { generateKey, encryptMemo, decryptMemo, MAX_PLAINTEXT_BYTES, MEMO_MAX_BYTES, transferAction, parseKeyFile, toPublicFile } from '@/lib/chainMessaging';

describe('chain messaging', () => {
  const a = generateKey('alice.wam'), b = generateKey('bob.wam');
  it('recipient and sender can both read; others cannot', () => {
    const memo = encryptMemo('hi bob', b.publicKey, a.secretKey);
    expect(decryptMemo(memo, a.publicKey, b.secretKey)).toBe('hi bob');
    expect(decryptMemo(memo, b.publicKey, a.secretKey)).toBe('hi bob');
    const c = generateKey('eve.wam');
    expect(decryptMemo(memo, a.publicKey, c.secretKey)).toBeNull();
  });
  it('longest allowed message fits the 256-byte memo', () => {
    const memo = encryptMemo('x'.repeat(MAX_PLAINTEXT_BYTES), b.publicKey, a.secretKey);
    expect(new TextEncoder().encode(memo).length).toBeLessThanOrEqual(MEMO_MAX_BYTES);
    expect(() => encryptMemo('x'.repeat(MAX_PLAINTEXT_BYTES + 1), b.publicKey, a.secretKey)).toThrow();
  });
  it('costs 0.05 WAX or 0.01 CHEESE', () => {
    expect(transferAction('WAX', 'a', 'b', 'm', []).data.quantity).toBe('0.05000000 WAX');
    const c = transferAction('CHEESE', 'a', 'b', 'm', []);
    expect(c.account).toBe('cheeseburger');
    expect(c.data.quantity).toBe('0.0100 CHEESE');
  });
  it('rejects private key files whose public key does not match', () => {
    expect(parseKeyFile({ ...a, publicKey: b.publicKey })).toBeNull();
    expect(parseKeyFile(toPublicFile(b))?.type).toBe('gpk-msg-pubkey');
  });
});
