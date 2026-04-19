import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

/**
 * A virtualized grid that uses the page (window) as the scroll container so
 * the existing sticky header and page-level scrollbar keep working.
 *
 * Rows can be either:
 *  - 'cards':   a row of up to N card cells (N = current responsive column count)
 *  - 'full':    a single full-width node (e.g. a section heading)
 *
 * The caller provides a flat list of "items" — either card data + a renderer,
 * or full-width nodes. We pack the cards into rows according to the current
 * column count and render only the rows currently in (or near) the viewport.
 *
 * Column breakpoints match the Tailwind classes already used in the grid:
 *   grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6
 */

export type VirtualItem<T> =
  | { kind: 'card'; key: string; data: T }
  | { kind: 'full'; key: string; node: ReactNode };

interface VirtualGridProps<T> {
  items: VirtualItem<T>[];
  renderCard: (data: T, index: number) => ReactNode;
  /** Estimated row height in px before measurement. */
  estimateRowHeight?: number;
  /** Estimated heading height in px before measurement. */
  estimateHeadingHeight?: number;
  /** How many extra rows to render above/below the viewport. */
  overscan?: number;
  /** Gap between rows in px (matches Tailwind gap-4 = 16). */
  gap?: number;
  /** Optional className applied to the wrapper. */
  className?: string;
}

function getColumnsForWidth(width: number): number {
  // Mirror Tailwind: base 2, sm:3 (>=640), md:4 (>=768), lg:5 (>=1024), xl:6 (>=1280)
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

export function VirtualGrid<T>({
  items,
  renderCard,
  estimateRowHeight = 320,
  estimateHeadingHeight = 56,
  overscan = 4,
  gap = 16,
  className,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState<number>(() =>
    typeof window === 'undefined' ? 6 : getColumnsForWidth(window.innerWidth),
  );

  // Track viewport width so column count and row height stay in sync with breakpoints.
  useEffect(() => {
    const onResize = () => setColumns(getColumnsForWidth(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Pack items into rows: full-width items get their own row, cards are chunked by `columns`.
  type Row =
    | { kind: 'cards'; key: string; cards: { key: string; data: T; absoluteIndex: number }[] }
    | { kind: 'full'; key: string; node: ReactNode };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let buffer: { key: string; data: T; absoluteIndex: number }[] = [];
    let cardCounter = 0;

    const flush = () => {
      if (buffer.length === 0) return;
      out.push({ kind: 'cards', key: `cards-${out.length}-${buffer[0].key}`, cards: buffer });
      buffer = [];
    };

    for (const it of items) {
      if (it.kind === 'full') {
        flush();
        out.push({ kind: 'full', key: it.key, node: it.node });
      } else {
        buffer.push({ key: it.key, data: it.data, absoluteIndex: cardCounter++ });
        if (buffer.length === columns) flush();
      }
    }
    flush();
    return out;
  }, [items, columns]);

  // Estimate row height responsively: cards are square + name/footer overhead.
  // Container width / columns gives card width; add ~80px for the metadata footer
  // shown by SimpleAssetCard / binder cards.
  const estimatedCardRowHeight = useMemo(() => {
    if (typeof window === 'undefined') return estimateRowHeight;
    // We can't easily know the parent width before render; approximate using a
    // typical content max width (1536px container minus padding). In practice
    // the virtualizer remeasures real DOM heights via measureElement, so this
    // only affects the very first frame.
    const approxWidth = Math.min(window.innerWidth, 1536) - 64;
    const cardWidth = (approxWidth - gap * (columns - 1)) / columns;
    return Math.max(180, Math.round(cardWidth + 80));
  }, [columns, gap, estimateRowHeight]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) return estimatedCardRowHeight;
      if (row.kind === 'full') return estimateHeadingHeight;
      return estimatedCardRowHeight;
    },
    overscan,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  // When column count changes, the row count and heights change — reset measurements.
  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows.length]);

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const scrollMargin = virtualizer.options.scrollMargin;

  return (
    <div ref={parentRef} className={className} style={{ position: 'relative' }}>
      <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
        {virtualRows.map((vRow) => {
          const row = rows[vRow.index];
          if (!row) return null;
          const top = vRow.start - scrollMargin;

          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${top}px)`,
                paddingBottom: gap,
              }}
            >
              {row.kind === 'full' ? (
                row.node
              ) : (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  }}
                >
                  {row.cards.map((c) => (
                    <div key={c.key}>{renderCard(c.data, c.absoluteIndex)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
