import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SelectionCheckboxes } from '@/components/simpleassets/SelectionCheckboxes';

const makeIds = (n: number) => Array.from({ length: n }, (_, i) => `id-${i + 1}`);

describe('SelectionCheckboxes', () => {
  it('Select 20 sets the selection to exactly the first 20 visible cards', () => {
    const ids = makeIds(30);
    const onChange = vi.fn();
    render(<SelectionCheckboxes visibleIds={ids} selectedIds={new Set()} onSelectionChange={onChange} />);

    fireEvent.click(screen.getByText('Select 20'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Set<string>;
    expect(next.size).toBe(20);
    expect([...next]).toEqual(ids.slice(0, 20));
  });

  it('Select 20 ignores cards beyond the 20th', () => {
    const ids = makeIds(25);
    const onChange = vi.fn();
    render(<SelectionCheckboxes visibleIds={ids} selectedIds={new Set()} onSelectionChange={onChange} />);

    fireEvent.click(screen.getByText('Select 20'));
    const next = onChange.mock.calls[0][0] as Set<string>;
    expect(next.has('id-21')).toBe(false);
    expect(next.has('id-25')).toBe(false);
  });

  it('Unticking Select 20 removes only those 20 and keeps other selections', () => {
    const ids = makeIds(30);
    const selected = new Set([...ids.slice(0, 20), 'extra-1']);
    const onChange = vi.fn();
    render(<SelectionCheckboxes visibleIds={ids} selectedIds={selected} onSelectionChange={onChange} />);

    fireEvent.click(screen.getByText('Select 20'));
    const next = onChange.mock.calls[0][0] as Set<string>;
    expect(next.size).toBe(1);
    expect(next.has('extra-1')).toBe(true);
  });

  it('Select All still selects every visible card', () => {
    const ids = makeIds(30);
    const onChange = vi.fn();
    render(<SelectionCheckboxes visibleIds={ids} selectedIds={new Set()} onSelectionChange={onChange} />);

    fireEvent.click(screen.getByText('Select All'));
    const next = onChange.mock.calls[0][0] as Set<string>;
    expect(next.size).toBe(30);
  });
});
