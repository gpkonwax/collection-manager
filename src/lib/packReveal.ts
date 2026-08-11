// Shared types for pack reveal → collection deal matching.
// Reveal dialogs emit a RevealResult after successfully claiming, so the
// parent page can match the exact newly-minted assets in a refetched
// collection instead of blindly diffing asset ids (which can pick up
// unrelated background refetches and deal already-owned cards).

export type SaRevealMatcher = {
  kind: 'sa';
  cardid: string; // pendingnft.a.cardid
  side: string;   // pendingnft.a.quality (lowercased) — e.g. 'a' | 'b'
  variant: string; // normalizeGpkVariant(pendingnft.a.variant)
  category?: string | null;
  /** Exact minted asset id when known (chain-reconstructed history). */
  assetId?: string | null;
};


export type AaAssetMatcher = {
  kind: 'aa-asset';
  assetId: string; // atomicassets asset_id (unbox_nft mode — asset id is known)
};

export type AaTemplateMatcher = {
  kind: 'aa-template';
  templateId: string; // atomicassets template_id (standard claimunboxed mode)
};

export type RevealMatcher = SaRevealMatcher | AaAssetMatcher | AaTemplateMatcher;

/** Frozen snapshot of one revealed card, used for the pack-opening history log. */
export interface RevealCardSnapshot {
  id?: string | null;
  name: string;
  image: string | null;
  cardid?: string | null;
  side?: string | null;
  variant?: string | null;
  category?: string | null;
  templateId?: string | null;
}

export interface RevealResult {
  source: 'simpleassets' | 'atomicassets';
  expectedCategory?: string | null;
  matchers: RevealMatcher[];
  /** Pack identity, forwarded so the opening can be written to pack history. */
  pack?: { id?: string | null; name: string; image?: string | null };
  /** What actually came out of the pack, captured at reveal time. */
  cards?: RevealCardSnapshot[];
}

/**
 * Given a set of matchers and a refetched asset list, find the concrete
 * assets that satisfy each matcher. An asset only matches if its id is
 * NOT in `preCollectIds` (i.e. it was minted after the pack opened).
 * Each asset is consumed by at most one matcher.
 *
 * Returns `{ matched, unresolved }` where `matched.length + unresolved.length`
 * always equals `matchers.length`.
 */
function normalizeAssetCategory(category: string | undefined): string {
  if (category === 'five') return 'series1';
  return category ?? '';
}

export function matchRevealedAssets<A extends { id: string; cardid?: string; side?: string; quality?: string; category?: string; idata?: Record<string, unknown>; source?: 'simpleassets' | 'atomicassets' }>(
  matchers: RevealMatcher[],
  assets: A[],
  preCollectIds: Set<string>,
): { matched: A[]; unresolved: RevealMatcher[] } {
  const matched: A[] = [];
  const unresolved: RevealMatcher[] = [];
  const used = new Set<string>();

  const candidates = assets.filter(a => !preCollectIds.has(a.id) && !used.has(a.id));

  for (const m of matchers) {
    let hit: A | undefined;
    if (m.kind === 'sa') {
      hit = candidates.find(a =>
        !used.has(a.id) &&
        a.source === 'simpleassets' &&
        (!m.category || normalizeAssetCategory(a.category) === m.category) &&
        String(a.cardid ?? '') === String(m.cardid) &&
        String(a.side ?? '').toLowerCase() === String(m.side).toLowerCase() &&
        String(a.quality ?? '').toLowerCase() === String(m.variant).toLowerCase(),
      );
    } else if (m.kind === 'aa-asset') {
      hit = candidates.find(a => !used.has(a.id) && a.id === m.assetId);
    } else if (m.kind === 'aa-template') {
      hit = candidates.find(a =>
        !used.has(a.id) &&
        a.source === 'atomicassets' &&
        String((a.idata as Record<string, unknown> | undefined)?._template_id ?? '') === String(m.templateId),
      );
    }
    if (hit) {
      matched.push(hit);
      used.add(hit.id);
    } else {
      unresolved.push(m);
    }
  }

  return { matched, unresolved };
}
