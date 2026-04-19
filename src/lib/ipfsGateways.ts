// Unified IPFS gateway configuration
// Ordered by reliability and speed (based on real-world testing, April 2026)
// atomichub-ipfs is the official AtomicHub gateway — most reliable for GPK assets
// NOTE: Cloudflare removed from default rotation — its tunnel errors were poisoning the
// shared session cache and biasing new image loads toward a failing endpoint.
export const IPFS_GATEWAYS = [
  'https://atomichub-ipfs.com/ipfs/',
  'https://ipfs.atomichub.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.io/ipfs/',
];

// The preferred starting gateway index for any new image load.
// Kept stable so unrelated successes on slower gateways do not bias new loads.
export const DEFAULT_GATEWAY_INDEX = 0;

// Timeout configuration for different contexts
// More forgiving — IPFS gateways routinely take 3-5s on first hit; failing earlier
// just causes unnecessary rotation and visible placeholder flicker.
export const IMAGE_LOAD_TIMEOUT = {
  card: 6000,        // 6 seconds for cards
  detail: 6000,      // 6 seconds for detail page
  increment: 1500,   // Add 1.5s per retry
  max: 9000,         // Max 9 seconds
};

// Helper to get primary IPFS gateway URL
export function getIpfsUrl(hash: string): string {
  return `${IPFS_GATEWAYS[DEFAULT_GATEWAY_INDEX]}${hash}`;
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
    /atomichub-ipfs\.com\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
    /ipfs\.atomichub\.io\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#]*)?)/,
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
