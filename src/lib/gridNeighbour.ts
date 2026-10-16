export type NavDir = 'left' | 'right' | 'up' | 'down';
export interface CellRect { id: string; x: number; y: number; w: number; h: number }

/**
 * Pure: the visually adjacent cell in a rendered grid. Rows are grouped by centre-Y
 * (within half a cell height), so wrapping is read from the real layout, never guessed.
 * Only real cards should be passed in, so empty slots/unowned spaces are skipped.
 */
export function findNeighbour(cells: CellRect[], id: string, dir: NavDir): string | null {
  const cur = cells.find((c) => c.id === id);
  if (!cur) return null;
  const cx = cur.x + cur.w / 2;
  const cy = cur.y + cur.h / 2;
  const tol = cur.h / 2;
  const others = cells.filter((c) => c !== cur);
  const centre = (c: CellRect) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });
  if (dir === 'left' || dir === 'right') {
    const row = others.filter((c) => Math.abs(centre(c).y - cy) < tol)
      .filter((c) => (dir === 'right' ? centre(c).x > cx : centre(c).x < cx));
    row.sort((a, b) => Math.abs(centre(a).x - cx) - Math.abs(centre(b).x - cx));
    return row[0]?.id ?? null;
  }
  const beyond = others.filter((c) => (dir === 'down' ? centre(c).y > cy + tol : centre(c).y < cy - tol));
  if (beyond.length === 0) return null;
  // Nearest row in that direction that holds a card, then the closest column within it.
  const rowY = beyond.reduce((best, c) => {
    const y = centre(c).y;
    return Math.abs(y - cy) < Math.abs(best - cy) ? y : best;
  }, centre(beyond[0]).y);
  const row = beyond.filter((c) => Math.abs(centre(c).y - rowY) < tol);
  row.sort((a, b) => Math.abs(centre(a).x - cx) - Math.abs(centre(b).x - cx));
  return row[0]?.id ?? null;
}

/** Collects the rendered grid cards (outside any dialog) for the neighbour lookup. */
export function readGridCells(root: ParentNode = document): CellRect[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-detail-cell]'))
    .filter((el) => !el.closest('[role="dialog"]'))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.detailCell!, x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
    })
    .filter((c) => c.w > 0 && c.h > 0);
}
