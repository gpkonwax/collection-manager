import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { ImageWithModes, type HandwritingCanvasHandle } from '@/components/simpleassets/InteractiveArtwork';

vi.mock('@/components/simpleassets/IpfsMedia', () => ({ IpfsMedia: () => null }));
vi.mock('@/hooks/useCardTilt', () => ({ useCardTilt: () => ({}) }));

const ctx = { clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 150 } as DOMRect);
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup() {
  let handle: HandwritingCanvasHandle | undefined;
  const { container } = render(<ImageWithModes url="/test.png" alt="Card" isLandscape={false} mode="draw" canvasRegister={(_, h) => { handle = h; }} />);
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('Drawing canvas missing');
  canvas.width = 300;
  canvas.height = 150;
  // Ignore the initial resize, which legitimately replays saved artwork.
  vi.clearAllMocks();
  return { canvas, getHandle: () => handle };
}

describe('live artwork ink', () => {
  it('paints immediately while held down without erasing earlier segments', () => {
    const { canvas } = setup();
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, button: 0 });
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 40 });
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
    expect(ctx.moveTo).toHaveBeenLastCalledWith(30, 20);
    expect(ctx.lineTo).toHaveBeenLastCalledWith(60, 40);
    expect(ctx.clearRect).not.toHaveBeenCalled();
    fireEvent.pointerUp(canvas);
    expect(ctx.clearRect).not.toHaveBeenCalled();
  });

  it('retains finished strokes and typed text through undo', () => {
    const { canvas, getHandle } = setup();
    const handle = getHandle();
    if (!handle) throw new Error('Drawing handle missing');
    act(() => handle.placeText('Friend', 'Caveat', 38, 'blue'));
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerDown(canvas, { clientX: 20, clientY: 20, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: 50, clientY: 30 });
    fireEvent.pointerUp(canvas);
    vi.clearAllMocks();
    handle.undo();
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledWith('Friend', 10, 10);
    expect(ctx.stroke).not.toHaveBeenCalled();
    handle.undo();
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it('commits cancelled gestures only once and ignores subsequent movement', () => {
    const { canvas, getHandle } = setup();
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerCancel(canvas);
    fireEvent.lostPointerCapture(canvas);
    fireEvent.pointerMove(canvas, { clientX: 60, clientY: 40 });
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    vi.clearAllMocks();
    getHandle()?.undo();
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });
});