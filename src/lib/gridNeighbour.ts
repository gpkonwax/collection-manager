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
    // Reading order: rows top to bottom (grouped by centre-Y), then left to right,
    // so left/right wrap across row ends and walk the whole collection.
    const sortedY = [...cells].sort((a, b) => centre(a).y - centre(b).y);
    const rowOf = new Map<CellRect, number>();
    let row = -1; let rowY = -Infinity;
    for (const c of sortedY) {
      const y = centre(c).y;
      if (y - rowY >= c.h / 2) { row += 1; rowY = y; }
      rowOf.set(c, row);
    }
    const ordered = [...cells].sort((a, b) => (rowOf.get(a)! - rowOf.get(b)!) || (centre(a).x - centre(b).x));
    const i = ordered.indexOf(cur);
    return ordered[dir === 'right' ? i + 1 : i - 1]?.id ?? null;
  }
  const beyond = others.filter((c) => (dir === 'down' ? centre(c).y > cy + tol : centre(c).y < cy - tol));
  if (beyond.length === 0) return null;
  // Same column first (skipping empty slots), nearest in that direction.
  const col = beyond.filter((c) => Math.abs(centre(c).x - cx) < cur.w / 2);
  if (col.length) {
    col.sort((a, b) => Math.abs(centre(a).y - cy) - Math.abs(centre(b).y - cy));
    return col[0].id;
  }
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
