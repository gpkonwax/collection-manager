/**
 * Discover freshly minted gpk.topps SimpleAssets cards from WAX history.
 *
 * Every claimed pack card logs `simpleassets::createlog` with the new
 * `assetid` and `author`. Hyperion ignores `act.author` filters, so we page
 * all createlog actions after a timestamp and filter by author client-side.
 */
export const HYPERION_ENDPOINTS = [
  'https://wax.eosusa.io',
  'https://wax.eosphere.io',
  'https://wax.eosdac.io',
  'https://wax.pink.gg',
  'https://api.wax.alohaeos.com',
];
export const AUTHOR = 'gpk.topps';
const PAGE_LIMIT = 1000;
const MAX_PAGES = 50;

/** Pure: pull gpk.topps asset ids + the newest timestamp out of one page. */
export function extractGpkCreatelogIds(actions) {
  const ids = [];
  let lastTs = null;
  for (const a of actions || []) {
    const ts = a?.['@timestamp'] || a?.timestamp;
    if (ts) lastTs = ts;
    if (a?.act?.account !== 'simpleassets' || a?.act?.name !== 'createlog') continue;
    const d = a.act.data || {};
    if (d.author !== AUTHOR) continue;
    const id = d.assetid != null ? String(d.assetid) : '';
    if (/^\d+$/.test(id)) ids.push(id);
  }
  return { ids, lastTs };
}

/**
 * Returns { ids, cursor, complete }. `cursor` only advances when the full
 * page-through succeeded (complete === true); on failure the caller keeps
 * its old bookmark and still uses whatever ids were found.
 */
export async function readRecentSaMints(afterIso, { fetchJson, endpoints = HYPERION_ENDPOINTS, log = () => {} }) {
  const found = new Set();
  let after = afterIso;
  let newest = afterIso;
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = `filter=simpleassets:createlog&sort=asc&limit=${PAGE_LIMIT}&after=${encodeURIComponent(after)}`;
    let body, lastErr;
    for (const base of endpoints) {
      try {
        body = await fetchJson(`${base}/v2/history/get_actions?${qs}`, 25_000);
        if (!Array.isArray(body?.actions)) throw new Error('unexpected response shape');
        break;
      } catch (e) { lastErr = e; body = undefined; }
    }
    if (!body) {
      log(`[SA-new] WARNING: history nodes unreachable (${lastErr?.message}); keeping old bookmark.`);
      return { ids: [...found], cursor: afterIso, complete: false };
    }
    const { ids, lastTs } = extractGpkCreatelogIds(body.actions);
    ids.forEach((id) => found.add(id));
    if (lastTs) newest = lastTs;
    if (body.actions.length < PAGE_LIMIT || !lastTs) {
      return { ids: [...found], cursor: newest, complete: true };
    }
    // Overlap by the same timestamp is fine: ids are de-duplicated.
    if (lastTs === after) {
      log('[SA-new] WARNING: >1000 actions share one timestamp; resuming next tick.');
      return { ids: [...found], cursor: afterIso, complete: false };
    }
    after = lastTs;
  }
  log(`[SA-new] page cap reached; continuing from ${newest} next tick.`);
  return { ids: [...found], cursor: newest, complete: true };
}
