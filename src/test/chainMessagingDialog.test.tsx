import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChainMessagingDialog } from '@/components/messaging/ChainMessagingDialog';
import { decryptMemo, generateKey, saveContact, saveKey } from '@/lib/chainMessaging';

vi.mock('@/lib/chainMessaging', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/chainMessaging')>(),
  fetchMessages: vi.fn().mockResolvedValue([]),
}));

describe('message payment submission', () => {
  beforeEach(() => localStorage.clear());
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
});