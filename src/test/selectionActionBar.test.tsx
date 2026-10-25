import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionActionBar } from '@/components/SelectionActionBar';

const noop = () => {};

describe('selection action bar', () => {
  it('shows nothing outside selection mode', () => {
    const { container } = render(
      <SelectionActionBar selectionMode={false} packSelectedCount={0} selectedCount={2} selectedAssets={[]}
        onTransfer={noop} onBridge={noop} onBurn={noop} onCancel={noop} />,
    );
    expect(container.textContent).toBe('');
  });

  it('pack selection offers only Transfer and Cancel', () => {
    const onTransfer = vi.fn();
    render(
      <SelectionActionBar selectionMode packSelectedCount={3} selectedCount={0} selectedAssets={[]}
        onTransfer={onTransfer} onBridge={noop} onBurn={noop} onCancel={noop} />,
    );
    expect(screen.getByText('3 packs selected')).toBeTruthy();
    expect(screen.queryByText('Burn')).toBeNull();
    fireEvent.click(screen.getByText('Transfer'));
    expect(onTransfer).toHaveBeenCalledTimes(1);
  });

  it('card selection wires Transfer, Burn and Cancel', () => {
    const onTransfer = vi.fn(); const onBurn = vi.fn(); const onCancel = vi.fn();
    render(
      <SelectionActionBar selectionMode packSelectedCount={0} selectedCount={2} selectedAssets={[]}
        onTransfer={onTransfer} onBridge={noop} onBurn={onBurn} onCancel={onCancel} />,
    );
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByText('Transfer'));
    fireEvent.click(screen.getByText('Burn'));
    fireEvent.click(screen.getByText('Cancel'));
    expect([onTransfer, onBurn, onCancel].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
