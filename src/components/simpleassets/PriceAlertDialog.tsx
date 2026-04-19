import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bell, BellRing, ExternalLink, Trash2 } from 'lucide-react';
import { usePriceAlerts, MAX_ALERTS } from '@/hooks/usePriceAlerts';
import { ExternalLinkWarningDialog, useExternalLinkWarning } from '@/components/ExternalLinkWarningDialog';
import type { BinderTemplate } from '@/hooks/useBinderTemplates';
import { toast } from 'sonner';

interface PriceAlertDialogProps {
  template: BinderTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getAtomicHubUrl(templateId: string): string {
  return `https://atomichub.io/market?collection_name=gpk.topps&template_id=${templateId}&order=asc&sort=price`;
}

function formatRelative(iso?: string): string {
  if (!iso) return 'never';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function PriceAlertDialog({ template, open, onOpenChange }: PriceAlertDialogProps) {
  const { alerts, getAlert, setAlert, removeAlert } = usePriceAlerts();
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const { pendingUrl, requestNavigation, confirm, cancel } = useExternalLinkWarning();

  const existing = template ? getAlert(template.templateId) : undefined;

  useEffect(() => {
    if (open && template) {
      setMaxPriceInput(existing ? String(existing.maxPrice) : '');
    }
  }, [open, template, existing]);

  if (!template) return null;

  const handleSave = () => {
    const parsed = Number(maxPriceInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error('Enter a valid max price greater than 0');
      return;
    }
    const result = setAlert({
      templateId: template.templateId,
      name: template.name,
      image: template.image,
      schema: template.schema,
      maxPrice: parsed,
    });
    if (result.ok) {
      toast.success(existing ? 'Alert updated' : 'Alert created', {
        description: `${template.name} — max ${parsed.toFixed(2)} WAX`,
      });
      onOpenChange(false);
    }
  };

  const handleRemove = () => {
    removeAlert(template.templateId);
    toast.success('Alert removed');
    onOpenChange(false);
  };

  const buyUrl = getAtomicHubUrl(template.templateId);
  const atCap = !existing && alerts.length >= MAX_ALERTS;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {existing?.triggered ? (
                <BellRing className="h-5 w-5 text-destructive" />
              ) : (
                <Bell className="h-5 w-5 text-cheese" />
              )}
              Price Alert
            </DialogTitle>
            <DialogDescription>
              Get notified when this card is listed below your max price. Alerts are checked once per hour while a tab is open.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3">
            {template.image && (
              <img
                src={template.image}
                alt={template.name}
                className="w-16 h-16 rounded object-cover border border-border"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{template.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {template.variant || template.schema} · #{template.cardid}{template.quality ? template.quality.toUpperCase() : ''}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-max-price">Max price (WAX)</Label>
            <Input
              id="alert-max-price"
              type="number"
              min="0"
              step="0.01"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              placeholder="e.g. 50"
              disabled={atCap}
            />
            <p className="text-xs text-muted-foreground">
              {alerts.length} / {MAX_ALERTS} alerts used
              {atCap && ' — limit reached. Remove one to add another.'}
            </p>
          </div>

          {existing && (
            <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-xs space-y-1">
              <p>
                <span className="text-muted-foreground">Lowest seen: </span>
                <span className="text-foreground font-medium">
                  {existing.lowestPrice !== undefined ? `${existing.lowestPrice.toFixed(2)} WAX` : 'no listing yet'}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Last checked: </span>
                <span className="text-foreground">{formatRelative(existing.lastChecked)}</span>
              </p>
              {existing.triggered && (
                <p className="text-destructive font-medium pt-1">Alert triggered — listing is at or below your max.</p>
              )}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-cheese/30 text-cheese hover:bg-cheese/10 w-full"
            onClick={() => requestNavigation(buyUrl)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View on AtomicHub
          </Button>

          <DialogFooter className="gap-2 sm:gap-2">
            {existing && (
              <Button variant="outline" onClick={handleRemove} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />Remove
              </Button>
            )}
            <Button onClick={handleSave} disabled={atCap} className="bg-cheese hover:bg-cheese/90 text-primary-foreground">
              {existing ? 'Update Alert' : 'Set Alert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExternalLinkWarningDialog url={pendingUrl} onConfirm={confirm} onCancel={cancel} />
    </>
  );
}
