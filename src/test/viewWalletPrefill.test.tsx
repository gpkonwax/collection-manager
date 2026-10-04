import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ViewWalletControl } from '@/components/ViewWalletControl';

describe('ViewWalletControl openAccount prefill', () => {
  it('opens the popover and prefills the search box when openSignal fires with an account', async () => {
    render(
      <ViewWalletControl
        currentAccount="alice.wam"
        viewedAccount={null}
        onView={() => {}}
        onClear={() => {}}
        openSignal={1}
        openAccount="o.vaw.wam"
      />,
    );
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. someuser.wam')).toBeTruthy());
    expect((screen.getByPlaceholderText('e.g. someuser.wam') as HTMLInputElement).value).toBe('o.vaw.wam');
  });

  it('leaves the search box empty when no account is provided', async () => {
    render(
      <ViewWalletControl
        currentAccount="alice.wam"
        viewedAccount={null}
        onView={() => {}}
        onClear={() => {}}
        openSignal={1}
      />,
    );
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. someuser.wam')).toBeTruthy());
    expect((screen.getByPlaceholderText('e.g. someuser.wam') as HTMLInputElement).value).toBe('');
  });
});
