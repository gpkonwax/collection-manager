
The user is right — pagination is a regression in UX vs. AtomicHub's infinite scroll. Let me explain why we moved to pages and what AtomicHub actually does, then propose getting infinite scroll back without the crashes.

## Why we moved to pages

The crash at ~150 cards wasn't IPFS being slow — it was that every card we'd ever scrolled past stayed mounted in the DOM. Each mounted card holds:
- An `<img>` element the browser keeps trying to keep "live"
- A concurrency slot in our IPFS limiter (until loaded)
- An IntersectionObserver
- Memory for decoded image data

By card #150 the browser was juggling 150+ live image elements competing for ~12 concurrent network slots and tens of MB of decoded pixels. Pagination "fixed" it by unmounting old cards — but at the cost of losing the scroll-and-keep-browsing feel.

## What AtomicHub actually does

It's not really "endless scrolling" in the naive sense. AtomicHub uses **windowed/virtualized rendering**: only the cards currently in (or near) the viewport exist in the DOM. Cards you've scrolled past get unmounted; cards far below haven't been mounted yet. The scroll bar is sized as if everything is rendered, but at any moment only ~30-60 cards are actually live.

This is the same pattern used by Twitter, Discord, and every large list on the web. The library term is "virtual scrolling" or "windowing."

## Proposed fix: virtualized infinite scroll

Replace the paginated grid with a virtualized grid using **`@tanstack/react-virtual`** (already a peer of libraries we use, tiny, framework-agnostic, no layout assumptions).

How it would work:
1. Compute row height + columns from current viewport (responsive: 2 / 3 / 4 / 5 / 6 columns).
2. Render only the rows currently visible plus a small overscan buffer (e.g. 2 rows above/below).
3. As the user scrolls, mounted rows get recycled — old cards unmount, new cards mount.
4. Scroll position, scroll-back behavior, and "feel" all match AtomicHub.
5. No "Show More" button, no Prev/Next, no page numbers.

Combined with the IPFS hardening already in place (slot limiter, retry, last-good-src preservation), this gives:
- AtomicHub-style endless scrolling
- Constant ~30-60 mounted cards regardless of collection size
- No more 150-card cliff
- Cards that scroll back into view re-mount and re-request — but the browser HTTP cache and our gateway cache make that nearly instant

## What changes

- `src/pages/Index.tsx` — replace pagination controls + sliced lists with a virtualized grid wrapper for Classic, Binder, and Saved views. Keep filters/sort/search exactly as they are.
- New small component `src/components/VirtualGrid.tsx` — generic virtualizer wrapping any card array, responsive columns, overscan tuned for IPFS.
- Add `@tanstack/react-virtual` to dependencies.
- Pagination memory rule (36 items/page) gets superseded — I'll update `mem://features/pagination` to record the move to virtualized infinite scroll.

## What stays

- Existing IPFS hook with retry/backoff/last-good-src
- Concurrency limiter (still important — virtualization reduces but doesn't eliminate contention)
- Retry button overlay on failed cards
- Card-fallback.svg neutral placeholder
- All filters, sorting, search, view modes

## What you'll feel

- Scroll smoothly through 1000+ cards like on AtomicHub
- No page buttons, no "Show More"
- Cards near the viewport load; cards far away don't waste resources
- Scroll-back stays smooth because previously-loaded gateways are cached per-hash

## Trade-off to acknowledge

Virtualization makes Ctrl+F / browser find-in-page only match what's currently mounted. AtomicHub has the same limitation. If you want global search the existing search bar already covers it.
