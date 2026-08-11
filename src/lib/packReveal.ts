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
  const used = new Set<string>();
  const candidates = assets.filter(a => !preCollectIds.has(a.id));
  const byIndex = new Map<number, A>();

  const sameSa = (a: A, m: SaRevealMatcher) =>
    a.source === 'simpleassets' &&
    (!m.category || normalizeAssetCategory(a.category) === m.category);

  // Tiers, strongest first. Each pass only looks at matchers still unresolved,
  // so a loose tier can never steal an asset an exact match needs.
  const tiers: ((a: A, m: SaRevealMatcher) => boolean)[] = [
    // exact asset id (chain-reconstructed history knows the minted id)
    (a, m) => !!m.assetId && a.id === String(m.assetId),
    // cardid + side + variant
    (a, m) => sameSa(a, m) && !!m.cardid &&
      String(a.cardid ?? '') === String(m.cardid) &&
      String(a.side ?? '').toLowerCase() === String(m.side ?? '').toLowerCase() &&
      String(a.quality ?? '').toLowerCase() === String(m.variant ?? '').toLowerCase(),
    // cardid + side
    (a, m) => sameSa(a, m) && !!m.cardid &&
      String(a.cardid ?? '') === String(m.cardid) &&
      String(a.side ?? '').toLowerCase() === String(m.side ?? '').toLowerCase(),
    // cardid only
    (a, m) => sameSa(a, m) && !!m.cardid &&
      String(a.cardid ?? '') === String(m.cardid),
  ];

  // Non-SA matchers resolve in a single pass.
  matchers.forEach((m, i) => {
    let hit: A | undefined;
    if (m.kind === 'aa-asset') {
      hit = candidates.find(a => !used.has(a.id) && a.id === m.assetId);
    } else if (m.kind === 'aa-template') {
      hit = candidates.find(a =>
        !used.has(a.id) &&
        a.source === 'atomicassets' &&
        String((a.idata as Record<string, unknown> | undefined)?._template_id ?? '') === String(m.templateId),
      );
    } else {
      return;
    }
    if (hit) {
      byIndex.set(i, hit);
      used.add(hit.id);
    }
  });

  for (const test of tiers) {
    matchers.forEach((m, i) => {
      if (m.kind !== 'sa' || byIndex.has(i)) return;
      const hit = candidates.find(a => !used.has(a.id) && test(a, m));
      if (hit) {
        byIndex.set(i, hit);
        used.add(hit.id);
      }
    });
  }

  const matched: A[] = [];
  const unresolved: RevealMatcher[] = [];
  matchers.forEach((m, i) => {
    const hit = byIndex.get(i);
    if (hit) matched.push(hit);
    else unresolved.push(m);
  });

  return { matched, unresolved };

}
