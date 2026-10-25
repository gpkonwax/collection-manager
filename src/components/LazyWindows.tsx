import { lazy, Suspense, useRef, type ComponentProps, type ComponentType } from 'react';

// Rarely used windows are split out of the first page load. Each one is only
// fetched the first time it opens, then stays mounted exactly as before, so
// its internal state between openings behaves the same as an eager import.

function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as unknown as ComponentType<any> }));
}

const ChainMessagingDialogLazy = lazyNamed(() => import('@/components/messaging/ChainMessagingDialog'), 'ChainMessagingDialog');
const PackHistoryDialogLazy = lazyNamed(() => import('@/components/simpleassets/PackHistoryDialog'), 'PackHistoryDialog');
const CollectionHistoryDialogLazy = lazyNamed(() => import('@/components/simpleassets/CollectionHistoryDialog'), 'CollectionHistoryDialog');
const BridgeDialogLazy = lazyNamed(() => import('@/components/simpleassets/BridgeDialog'), 'BridgeDialog');
const PuzzleBuilderLazy = lazyNamed(() => import('@/components/simpleassets/PuzzleBuilder'), 'PuzzleBuilder');

/** True from the first render where `open` is true onwards. */
export function useOpenedOnce(open: boolean) {
  const opened = useRef(false);
  if (open) opened.current = true;
  return opened.current;
}

function gated<T extends ComponentType<any>>(Inner: ComponentType<any>) {
  return function Gated(props: ComponentProps<T>) {
    const opened = useOpenedOnce(Boolean((props as { open?: boolean }).open));
    if (!opened) return null;
    return <Suspense fallback={null}><Inner {...props} /></Suspense>;
  };
}

type Messaging = typeof import('@/components/messaging/ChainMessagingDialog').ChainMessagingDialog;
type PackHistory = typeof import('@/components/simpleassets/PackHistoryDialog').PackHistoryDialog;
type CollectionHistory = typeof import('@/components/simpleassets/CollectionHistoryDialog').CollectionHistoryDialog;
type Bridge = typeof import('@/components/simpleassets/BridgeDialog').BridgeDialog;
type Puzzle = typeof import('@/components/simpleassets/PuzzleBuilder').PuzzleBuilder;

export const ChainMessagingDialog = gated<Messaging>(ChainMessagingDialogLazy);
export const PackHistoryDialog = gated<PackHistory>(PackHistoryDialogLazy);
export const CollectionHistoryDialog = gated<CollectionHistory>(CollectionHistoryDialogLazy);
export const BridgeDialog = gated<Bridge>(BridgeDialogLazy);

/** Puzzle tab content only renders while its tab is active, so load on render. */
export function PuzzleBuilder(props: ComponentProps<Puzzle>) {
  return <Suspense fallback={null}><PuzzleBuilderLazy {...props} /></Suspense>;
}
