import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChainMessagingDialog } from '@/components/messaging/ChainMessagingDialog';
import { decryptMemo, encryptMemo, fetchMessages, generateKey, saveContact, saveKey } from '@/lib/chainMessaging';

vi.mock('@/lib/chainMessaging', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/chainMessaging')>(),
  fetchMessages: vi.fn().mockResolvedValue([]),
}));

describe('message payment submission', () => {
  beforeEach(() => { localStorage.clear(); vi.mocked(fetchMessages).mockResolvedValue([]); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

  it('submits both CHEESE transfers in one wallet request and preserves text on rejection', async () => {
    const sender = generateKey('alice.wam');
    const recipient = generateKey('bob.wam');
    saveKey(sender);
    saveContact('alice.wam', 'bob.wam', recipient.publicKey);
    const execute = vi.fn().mockResolvedValue({ success: false });
    render(<ChainMessagingDialog open onOpenChange={() => {}} account="alice.wam"
      permission={{ actor: 'alice.wam', permission: 'active' }} execute={execute} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Conversations/ }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'bob.wam' }));
    fireEvent.change(screen.getByPlaceholderText('Message bob.wam'), { target: { value: 'hello bob' } });
    fireEvent.click(screen.getByRole('button', { name: /^Send$/ }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    const actions = execute.mock.calls[0][0];
    expect(actions).toHaveLength(2);
    expect(actions[0].data.to).toBe('bob.wam');
    expect(actions[0].data.quantity).toBe('0.0010 CHEESE');
    expect(actions[1].data.to).toBe('eosio.null');
    expect(actions[1].data.quantity).toBe('0.0100 CHEESE');
    expect(decryptMemo(actions[0].data.memo, sender.publicKey, recipient.secretKey)).toBe('hello bob');
    expect(screen.getByPlaceholderText('Message bob.wam')).toHaveValue('hello bob');
  });

  it('labels every message in a thread with the account that sent it', async () => {
    const alice = generateKey('alice.wam');
    const bob = generateKey('bob.wam');
    saveKey(alice);
    saveContact('alice.wam', 'bob.wam', bob.publicKey);
    vi.mocked(fetchMessages).mockResolvedValue([
      { txId: 't1', time: 1000, from: 'bob.wam', to: 'alice.wam', memo: encryptMemo('hi alice', alice.publicKey, bob.secretKey), quantity: '0.0010 CHEESE' },
      { txId: 't2', time: 2000, from: 'alice.wam', to: 'bob.wam', memo: encryptMemo('hi bob', bob.publicKey, alice.secretKey), quantity: '0.0010 CHEESE' },
    ]);
    render(<ChainMessagingDialog open onOpenChange={() => {}} account="alice.wam"
      permission={{ actor: 'alice.wam', permission: 'active' }} execute={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /Conversations/ }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'bob.wam' }));
    const theirs = screen.getByText('hi alice').closest('li')!;
    const mine = screen.getByText('hi bob').closest('li')!;
    expect(theirs).toHaveTextContent('bob.wam');
    expect(mine).toHaveTextContent('you · alice.wam');
    expect(mine).not.toHaveTextContent('bob.wam');
  });
});