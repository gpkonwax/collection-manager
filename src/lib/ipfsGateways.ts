// Unified IPFS gateway configuration
// Ordered by reliability and speed (based on real-world testing)

/**
 * Public IPFS gateways — used for the parallel race and primary rotation.
 * Order matters: winners get promoted via lastGoodGatewayIndex.
 */
export const PUBLIC_IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/', // Moved to last - experiencing tunnel errors
];

/**
 * Static mirror base URLs — appended after all public gateways as pure fallbacks.
 * Excluded from the parallel race so they never generate speculative traffic.
 *
 * The `gpk-backup` GitHub Pages URL is a frozen one-time snapshot of every
 * card / pack / puzzle image. Because the folder mirrors IPFS paths exactly,
 * `${MIRROR}${hash}/prism/42lg.gif` resolves identically to a real gateway.
 */
export const TRUSTED_MIRRORS = [
  'https://gpkonwaxbackup.github.io/gpk-backup/mirror/',
];

const COMMUNITY_MIRROR_KEY = 'gpk-community-mirror-url';

/** User-supplied additional mirror base URL from localStorage. */
export function getCommunityMirrorUrl(): string | null {
  try {
    const raw = localStorage.getItem(COMMUNITY_MIRROR_KEY);
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Only allow https to avoid mixed-content issues and typos.
    if (!/^https:\/\//i.test(trimmed)) return null;
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  } catch { return null; }
}

export function setCommunityMirrorUrl(url: string | null): void {
  try {
    if (!url) { localStorage.removeItem(COMMUNITY_MIRROR_KEY); return; }
    localStorage.setItem(COMMUNITY_MIRROR_KEY, url);
  } catch { /* noop */ }
}

/**
 * Full rotation list, in priority order:
 *   [public gateways..., hardcoded mirrors..., community mirror if set]
 * Recomputed on access so a freshly-set community URL takes effect immediately.
 */
function computeGateways(): string[] {
  const list = [...PUBLIC_IPFS_GATEWAYS, ...TRUSTED_MIRRORS];
  const community = getCommunityMirrorUrl();
  if (community && !list.includes(community)) list.push(community);
  return list;
}

/**
 * Live proxy so existing `IPFS_GATEWAYS[i]` / `IPFS_GATEWAYS.length` reads keep
 * working, while the underlying list is always fresh (picks up a new community
 * URL without a page reload).
 */
export const IPFS_GATEWAYS: readonly string[] = new Proxy([] as string[], {
  get(_target, prop, receiver) {
    const arr = computeGateways();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (arr as any)[prop];
    return typeof val === 'function' ? val.bind(arr) : val;
  },
  has(_target, prop) { return prop in computeGateways(); },
  ownKeys() { return Reflect.ownKeys(computeGateways()); },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(computeGateways(), prop);
  },
});

/** Number of leading gateways that participate in the parallel race. */
export function getPublicGatewayCount(): number {
  return PUBLIC_IPFS_GATEWAYS.length;
}

// Timeout configuration for different contexts
export const IMAGE_LOAD_TIMEOUT = {
  card: 6000,        // 6 seconds for cards – skip dead gateways faster
  detail: 3500,      // 3.5s per gateway after the parallel race falls back to serial
  increment: 1500,   // Add 1.5s per retry
  max: 8000,         // Max 8 seconds
};

// Parallel gateway race (used for detail-context images and prefetch)
// Capped at the number of public gateways so mirrors never get raced.
export const RACE_GATEWAY_COUNT = 3;
export const RACE_TIMEOUT_MS = 4000;

// Helper to get primary IPFS gateway URL
export function getIpfsUrl(hash: string): string {
  return `${PUBLIC_IPFS_GATEWAYS[0]}${hash}`;
}

// Helper to extract IPFS hash from various URL formats
export function extractIpfsHash(url: string): string | null {
  if (!url) return null;
  
  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', '').split('/')[0];
  }
  
  // Handle /ipfs/ paths - capture hash and any path after it
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/);
  if (ipfsMatch) return ipfsMatch[1];
  
  // Handle bare CID (Qm... or bafy...)
  if (/^Qm[a-zA-Z0-9]{44}/.test(url) || /^bafy[a-zA-Z0-9]+/.test(url)) {
    return url;
  }
  
  // Original patterns for URLs
  const patterns = [
    /ipfs\.io\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /gateway\.pinata\.cloud\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /cloudflare-ipfs\.com\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /dweb\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /nftstorage\.link\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Helper to check if URL is likely a video file by extension
export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}
