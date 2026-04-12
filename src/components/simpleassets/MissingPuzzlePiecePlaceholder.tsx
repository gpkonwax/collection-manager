import { Card } from '@/components/ui/card';
import { ExternalLink, Puzzle } from 'lucide-react';
import { ExternalLinkWarningDialog, useExternalLinkWarning } from '@/components/ExternalLinkWarningDialog';
import { buildGpkCardImageUrl } from '@/lib/gpkCardImages';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';

interface MissingPuzzlePiecePlaceholderProps {
  cardId: number;
  templateId?: string;
}

function getAtomicHubUrl(templateId: string): string {
  return `https://atomichub.io/market?collection_name=gpk.topps&template_id=${templateId}&order=asc&sort=price`;
}

function getAtomicHubFallbackUrl(cardId: number): string {
  return `https://wax.atomichub.io/market?collection_name=gpk.topps&schema_name=series2&order=asc&sort=price&search_type=sales&immutable_data.cardid=${cardId}`;
}

export function MissingPuzzlePiecePlaceholder({ cardId, templateId }: MissingPuzzlePiecePlaceholderProps) {
  const buyUrl = templateId ? getAtomicHubUrl(templateId) : getAtomicHubFallbackUrl(cardId);
  const imageUrl = buildGpkCardImageUrl('gpktwoeight', 'base', cardId, 'a');
  const { pendingUrl, requestNavigation, confirm, cancel } = useExternalLinkWarning();

  return (
    <>
      <Card
        className="overflow-hidden bg-card/30 border-border/30 opacity-50 hover:opacity-80 transition-opacity cursor-pointer"
        onClick={() => requestNavigation(buyUrl)}
      >
        <div className="aspect-[5/7] bg-muted/10 flex items-center justify-center overflow-hidden relative">
          {imageUrl ? (
            <IpfsMedia
              url={imageUrl}
              alt={`Puzzle piece #${cardId}`}
              className="w-full h-full object-cover grayscale brightness-50"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Puzzle className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60">
            <ExternalLink className="h-6 w-6 text-cheese mb-1" />
            <span className="text-xs font-medium text-cheese">Buy on AtomicHub</span>
          </div>
        </div>
        <div className="p-2 text-center">
          <p className="text-xs font-medium text-foreground/50">Puzzle Piece #{cardId}</p>
        </div>
      </Card>
      <ExternalLinkWarningDialog url={pendingUrl} onConfirm={confirm} onCancel={cancel} />
    </>
  );
}
