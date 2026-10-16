import { describe, it, expect } from 'vitest';
import { findNeighbour, type CellRect } from '@/lib/gridNeighbour';

// 3-column grid, 100px cells, 10px gap. Slot "e" (row 1, col 2) is empty and not passed in.
const at = (id: string, col: number, row: number): CellRect => ({ id, x: col * 110, y: row * 110, w: 100, h: 100 });
const cells = [at('a', 0, 0), at('b', 1, 0), at('c', 2, 0), at('d', 0, 1), at('f', 2, 1), at('g', 1, 2)];

describe('findNeighbour', () => {
  it('moves left and right within the same row', () => {
    expect(findNeighbour(cells, 'b', 'right')).toBe('c');
    expect(findNeighbour(cells, 'b', 'left')).toBe('a');
  });
  it('returns nothing at the grid edge', () => {
    expect(findNeighbour(cells, 'g', 'right')).toBeNull();
    expect(findNeighbour(cells, 'a', 'left')).toBeNull();
    expect(findNeighbour(cells, 'a', 'up')).toBeNull();
  });
  it('matches the column when moving up and down', () => {
    expect(findNeighbour(cells, 'a', 'down')).toBe('d');
    expect(findNeighbour(cells, 'f', 'up')).toBe('c');
  });
  it('skips empty slots', () => {
    expect(findNeighbour(cells, 'd', 'right')).toBe('f');
    expect(findNeighbour(cells, 'b', 'down')).toBe('g');
  });
  it('wraps left and right across row ends in reading order', () => {
    expect(findNeighbour(cells, 'c', 'right')).toBe('d');
    expect(findNeighbour(cells, 'd', 'left')).toBe('c');
    expect(findNeighbour(cells, 'f', 'right')).toBe('g');
    expect(findNeighbour(cells, 'g', 'left')).toBe('f');
  });
  it('walks every card from first to last with right', () => {
    const seen = ['a'];
    let id: string | null = 'a';
    while ((id = findNeighbour(cells, id, 'right'))) seen.push(id);
    expect(seen).toEqual(['a', 'b', 'c', 'd', 'f', 'g']);
  });
});
