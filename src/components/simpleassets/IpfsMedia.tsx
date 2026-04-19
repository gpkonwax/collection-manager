import { memo, useMemo, useState, useRef, useEffect } from 'react';
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

function useIntersectionVisible(rootMargin = '400px'): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return [ref, visible];
}

function IpfsMediaComponent({ url, alt, className = '', context = 'card', showSkeleton = false, videoUrl, style, loading }: IpfsMediaProps) {
  const hash = url ? extractIpfsHash(url) : null;
  const alreadyLoaded = !!getCachedLoadedUrl(hash);
  // If this hash has previously loaded successfully, skip lazy gating entirely so the cached URL renders instantly on remount.
  const isLazy = !alreadyLoaded && (loading === 'lazy' || (!loading && context === 'card'));
  const [sentinelRef, isVisible] = useIntersectionVisible('400px');
  
  // For eager, detail context, or already-cached hashes, always enabled. For lazy, wait for visibility.
  const enabled = alreadyLoaded || loading === 'eager' || context === 'detail' || isVisible;
  
  const { src, onError, onLoad, isLoading, failed } = useIpfsMedia(url, { context, enabled });

  const isVideo = useMemo(() => {
    return videoUrl || isVideoUrl(url) || isVideoUrl(src);
  }, [videoUrl, url, src]);

  const videoSrc = videoUrl || (isVideo ? src : null);

  if (videoSrc && !failed) {
    return (
      <div ref={isLazy ? sentinelRef : undefined} className={`relative ${className}`} style={style}>
        {showSkeleton && isLoading && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}
        {enabled && (
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
        )}
      </div>
    );
  }

  const isAnimated = src.toLowerCase().includes('.gif');

  return (
    <div ref={isLazy ? sentinelRef : undefined} className={`relative ${className}`} style={style}>
      {showSkeleton && isLoading && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      {enabled && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-contain ${isLoading && showSkeleton ? 'opacity-0' : ''}`}
          loading={loading === 'eager' ? 'eager' : 'lazy'}
          fetchPriority={context === 'detail' ? 'high' : 'auto'}
          decoding="async"
          onError={onError}
          onLoad={onLoad}
          style={
            context === 'card'
              ? { transform: 'translateZ(0)', backfaceVisibility: 'hidden', imageRendering: 'auto' as const, ...style }
              : isAnimated
                ? { transform: 'translateZ(0)', backfaceVisibility: 'hidden', ...style }
                : style
          }
        />
      )}
    </div>
  );
}

export const IpfsMedia = memo(IpfsMediaComponent);
