import { memo, useMemo } from 'react';
import { useIpfsMedia } from '@/hooks/useIpfsMedia';
import { isVideoUrl } from '@/lib/ipfsGateways';
import { Skeleton } from '@/components/ui/skeleton';

interface IpfsMediaProps {
  url: string | undefined;
  alt: string;
  className?: string;
  context?: 'card' | 'detail';
  /** Show skeleton while loading */
  showSkeleton?: boolean;
  /** Additional video URL (e.g. from metadata) */
  videoUrl?: string;
  style?: React.CSSProperties;
  loading?: 'lazy' | 'eager';
}

function IpfsMediaComponent({ url, alt, className = '', context = 'card', showSkeleton = false, videoUrl, style, loading }: IpfsMediaProps) {
  const { src, onError, onLoad, isLoading, failed } = useIpfsMedia(url, { context });

  const isVideo = useMemo(() => {
    return videoUrl || isVideoUrl(url) || isVideoUrl(src);
  }, [videoUrl, url, src]);

  const videoSrc = videoUrl || (isVideo ? src : null);

  if (videoSrc && !failed) {
    return (
      <div className={`relative ${className}`} style={style}>
        {showSkeleton && isLoading && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain"
          onLoadedData={onLoad}
          onError={onError}
          preload={context === 'detail' ? 'auto' : 'metadata'}
        />
      </div>
    );
  }

  const isAnimated = src.toLowerCase().includes('.gif');

  return (
    <div className={`relative ${className}`} style={style}>
      {showSkeleton && isLoading && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-contain ${isLoading && showSkeleton ? 'opacity-0' : ''}`}
        loading={loading ?? (isAnimated || context === 'detail' ? 'eager' : 'lazy')}
        fetchPriority={context === 'detail' ? 'high' : 'auto'}
        decoding="async"
        onError={onError}
        onLoad={onLoad}
        style={isAnimated ? { transform: 'translateZ(0)', backfaceVisibility: 'hidden', ...style } : style}
      />
    </div>
  );
}

export const IpfsMedia = memo(IpfsMediaComponent);
