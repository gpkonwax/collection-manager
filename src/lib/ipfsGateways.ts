// Unified IPFS gateway configuration
// Ordered by reliability and speed (based on real-world testing)
export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/', // Moved to last - experiencing tunnel errors
];

// Timeout configuration for different contexts
export const IMAGE_LOAD_TIMEOUT = {
  card: 12000,       // 12 seconds for cards (50 loading at once)
  detail: 15000,     // 15 seconds for detail page
  increment: 3000,   // Add 3s per retry
  max: 25000,        // Max 25 seconds
};

// Helper to get primary IPFS gateway URL
export function getIpfsUrl(hash: string): string {
  return `${IPFS_GATEWAYS[0]}${hash}`;
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
