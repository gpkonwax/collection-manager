import { describe, it, expect } from 'vitest';
import { generateKey, encryptMemo, decryptMemo, MAX_PLAINTEXT_BYTES, MEMO_MAX_BYTES, buildSendMessageActions, buildPublishKeyActions, MESSAGE_TOTAL_QUANTITY, keyMemo, parseKeyFile, toPublicFile } from '@/lib/chainMessaging';

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
  it('sends 0.0010 CHEESE with the encrypted memo to the recipient', () => {
    const memo = encryptMemo('hi bob', b.publicKey, a.secretKey);
    const auth = [{ actor: 'alice.wam', permission: 'active' }];
    const [message] = buildSendMessageActions('alice.wam', 'bob.wam', memo, auth);
    expect(message).toEqual({ account: 'cheeseburger', name: 'transfer', authorization: auth,
      data: { from: 'alice.wam', to: 'bob.wam', quantity: '0.0010 CHEESE', memo } });
  });
  it('bundles the 0.0100 CHEESE burn to eosio.null in the same action list', () => {
    const auth = [{ actor: 'alice.wam', permission: 'active' }];
    const actions = buildSendMessageActions('alice.wam', 'bob.wam', 'encrypted', auth);
    expect(actions).toHaveLength(2);
    expect(actions[1]).toEqual({ account: 'cheeseburger', name: 'transfer', authorization: auth,
      data: { from: 'alice.wam', to: 'eosio.null', quantity: '0.0100 CHEESE', memo: 'GPK messaging fee' } });
  });
  it('totals 0.0110 CHEESE and never includes a WAX action', () => {
    const actions = buildSendMessageActions('alice.wam', 'bob.wam', 'encrypted', []);
    const units = actions.reduce((sum, action) => sum + Math.round(Number(action.data.quantity.split(' ')[0]) * 10000), 0);
    expect(units).toBe(110);
    expect(MESSAGE_TOTAL_QUANTITY).toBe('0.0110 CHEESE');
    expect(actions.every(action => action.account === 'cheeseburger' && action.data.quantity.endsWith(' CHEESE'))).toBe(true);
  });
  it('publishes a discoverable key with one CHEESE transfer to eosio.null', () => {
    const actions = buildPublishKeyActions('alice.wam', a.publicKey, []);
    expect(actions).toHaveLength(1);
    expect(actions[0].data).toEqual({ from: 'alice.wam', to: 'eosio.null', quantity: '0.0100 CHEESE', memo: keyMemo(a.publicKey) });
  });
  it('rejects private key files whose public key does not match', () => {
    expect(parseKeyFile({ ...a, publicKey: b.publicKey })).toBeNull();
    expect(parseKeyFile(toPublicFile(b))?.type).toBe('gpk-msg-pubkey');
  });
});
