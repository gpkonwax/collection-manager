import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellRing, ExternalLink } from 'lucide-react';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { ExternalLinkWarningDialog, useExternalLinkWarning } from '@/components/ExternalLinkWarningDialog';
import { PriceAlertDialog } from '@/components/simpleassets/PriceAlertDialog';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { cn } from '@/lib/utils';
import type { BinderTemplate } from '@/hooks/useBinderTemplates';

interface MissingCardPlaceholderProps {
  template: BinderTemplate;
}

function getAtomicHubUrl(templateId: string): string {
  return `https://atomichub.io/market?collection_name=gpk.topps&template_id=${templateId}&order=asc&sort=price`;
}

export function MissingCardPlaceholder({ template }: MissingCardPlaceholderProps) {
  const buyUrl = getAtomicHubUrl(template.templateId);
  const { pendingUrl, requestNavigation, confirm, cancel } = useExternalLinkWarning();
  const { getAlert } = usePriceAlerts();
  const [alertOpen, setAlertOpen] = useState(false);

  const alert = getAlert(template.templateId);
  const hasAlert = Boolean(alert);
  const isTriggered = Boolean(alert?.triggered);

  return (
    <>
      <Card
        className="overflow-hidden bg-card/30 border-border/30 opacity-50 hover:opacity-80 transition-opacity cursor-pointer relative"
        onClick={() => requestNavigation(buyUrl)}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setAlertOpen(true); }}
          className={cn(
            "absolute top-1.5 left-1.5 z-20 h-7 w-7 rounded-full flex items-center justify-center bg-background/80 backdrop-blur-sm border transition-colors",
            isTriggered
              ? "border-destructive text-destructive animate-pulse"
              : hasAlert
                ? "border-cheese/50 text-cheese hover:bg-cheese/10"
                : "border-border/60 text-muted-foreground hover:text-cheese hover:border-cheese/50"
          )}
          aria-label={hasAlert ? "Edit price alert" : "Set price alert"}
          title={hasAlert ? `Alert: max ${alert!.maxPrice.toFixed(2)} WAX` : "Set price alert"}
        >
          {isTriggered ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        </button>
        <div className="aspect-square bg-muted/10 flex items-center justify-center overflow-hidden relative">
          <IpfsMedia
            url={template.image}
            alt={template.name}
            className="w-full h-full grayscale brightness-50"
            context="card"
            loading="lazy"
            showSkeleton
          />
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
      </Card>
      <ExternalLinkWarningDialog url={pendingUrl} onConfirm={confirm} onCancel={cancel} />
      <PriceAlertDialog template={template} open={alertOpen} onOpenChange={setAlertOpen} />
    </>
  );
}
