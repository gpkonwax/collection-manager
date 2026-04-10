import { useState, useEffect, memo } from 'react';
import { useBannerAds, type ActiveBanner } from '@/hooks/useBannerAds';
import { IPFS_GATEWAYS } from '@/lib/ipfsGateways';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

const ROTATION_INTERVAL = 30_000; // 30 seconds for shared slot rotation

function getIpfsImageUrl(hash: string, gatewayIndex = 0): string {
  const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
  return `${gateway}${hash}`;
}

interface BannerSlotProps {
  banner: ActiveBanner;
  className?: string;
}

function BannerSlot({ banner, className = '' }: BannerSlotProps) {
  const [showShared, setShowShared] = useState(false);
  const [gatewayIdx, setGatewayIdx] = useState(0);
  const [sharedGatewayIdx, setSharedGatewayIdx] = useState(0);

  // Rotate shared banners every 30 seconds
  useEffect(() => {
    if (!banner.isShared || !banner.sharedIpfsHash) return;
    const interval = setInterval(() => setShowShared(prev => !prev), ROTATION_INTERVAL);
    return () => clearInterval(interval);
  }, [banner.isShared, banner.sharedIpfsHash]);

  const currentHash = showShared && banner.sharedIpfsHash ? banner.sharedIpfsHash : banner.ipfsHash;
  const currentUrl = showShared && banner.sharedWebsiteUrl ? banner.sharedWebsiteUrl : banner.websiteUrl;
  const currentGatewayIdx = showShared ? sharedGatewayIdx : gatewayIdx;
  const safeUrl = sanitizeUrl(currentUrl);

  const handleError = () => {
    if (showShared) {
      setSharedGatewayIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    } else {
      setGatewayIdx(prev => (prev + 1) % IPFS_GATEWAYS.length);
    }
  };

  const content = (
    <div className={`relative group overflow-hidden rounded-lg border border-cheese/20 bg-card ${className}`}>
      <img
        src={getIpfsImageUrl(currentHash, currentGatewayIdx)}
        alt="Advertisement"
        className="w-full h-full object-cover transition-opacity duration-300"
        onError={handleError}
        loading="lazy"
      />
      <Badge
        variant="secondary"
        className="absolute top-1 right-1 text-[10px] px-1.5 py-0 opacity-60 group-hover:opacity-100 transition-opacity"
      >
        Ad
      </Badge>
      {safeUrl && (
        <ExternalLink className="absolute bottom-1 right-1 h-3 w-3 text-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );

  if (safeUrl) {
    return (
      <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}

function BannerAdComponent() {
  const { data: banners, isLoading } = useBannerAds();

  if (isLoading || !banners || banners.length === 0) {
    // Show placeholder linking to CheeseHub
    return (
      <div className="w-full max-w-5xl mx-auto px-4 mb-4">
        <div className="flex justify-center gap-4">
          <a
            href="https://cheesehub.io/bannerads"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 max-w-[468px] h-[60px] rounded-lg border border-dashed border-cheese/20 bg-card/50 flex items-center justify-center text-xs text-muted-foreground hover:border-cheese/40 transition-colors"
          >
            Advertise here — CheeseHub Banner Ads
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 mb-4">
      <div className={`flex justify-center gap-4 ${banners.length === 1 ? '' : ''}`}>
        {banners.map(banner => (
          <BannerSlot
            key={banner.position}
            banner={banner}
            className={`${banners.length === 1 ? 'max-w-[468px] h-[60px]' : 'flex-1 max-w-[468px] h-[60px]'}`}
          />
        ))}
      </div>
    </div>
  );
}

export const BannerAd = memo(BannerAdComponent);
