import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { IPFS_GATEWAYS, extractIpfsHash } from '@/lib/ipfsGateways';
import type { BinderTemplate } from '@/hooks/useBinderTemplates';

interface MissingCardPlaceholderProps {
  template: BinderTemplate;
}

function getAtomicHubUrl(templateId: string): string {
  return `https://atomichub.io/market?collection_name=gpk.topps&template_id=${templateId}&order=asc&sort=price`;
}

function swapGateway(url: string, gatewayIndex: number): string | null {
  const hash = extractIpfsHash(url);
  if (!hash || gatewayIndex >= IPFS_GATEWAYS.length) return null;
  return `${IPFS_GATEWAYS[gatewayIndex]}${hash}`;
}

export function MissingCardPlaceholder({ template }: MissingCardPlaceholderProps) {
  const buyUrl = getAtomicHubUrl(template.templateId);
  const [gwIndex, setGwIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  const imgSrc = gwIndex === 0
    ? template.image
    : swapGateway(template.image, gwIndex) || template.image;

  const handleError = useCallback(() => {
    const next = gwIndex + 1;
    if (next < IPFS_GATEWAYS.length) {
      setGwIndex(next);
    } else {
      setFailed(true);
    }
  }, [gwIndex]);

  return (
    <Card className="overflow-hidden bg-card/30 border-border/30 opacity-50 hover:opacity-80 transition-opacity">
      <a
        href={buyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="aspect-square bg-muted/10 flex items-center justify-center overflow-hidden relative">
          {!failed ? (
            <img
              src={imgSrc}
              alt={template.name}
              className="w-full h-full object-contain grayscale brightness-50"
              loading="lazy"
              onError={handleError}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted/20">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60">
            <ExternalLink className="h-6 w-6 text-cheese mb-1" />
            <span className="text-xs font-medium text-cheese">Buy on AtomicHub</span>
          </div>
        </div>
        <CardContent className="p-3 space-y-1">
          <p className="text-sm font-semibold text-foreground/50 truncate">{template.name}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground/50">{template.variant || template.schema}</span>
            <span className="text-[10px] text-muted-foreground/50">#{template.cardid}{template.quality ? template.quality.toUpperCase() : ''}</span>
          </div>
        </CardContent>
      </a>
    </Card>
  );
}
