import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOpenedOnce } from '@/components/LazyWindows';

describe('useOpenedOnce (on-demand windows)', () => {
  it('stays false until the window first opens', () => {
    const { result } = renderHook(({ open }) => useOpenedOnce(open), { initialProps: { open: false } });
    expect(result.current).toBe(false);
  });

  it('stays true after the window closes again, so its state is kept like before', () => {
    const { result, rerender } = renderHook(({ open }) => useOpenedOnce(open), { initialProps: { open: false } });
    rerender({ open: true });
    expect(result.current).toBe(true);
    rerender({ open: false });
    expect(result.current).toBe(true);
  });
});
