import { useState } from 'react';
import { Bell, BellRing, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IpfsMedia } from '@/components/simpleassets/IpfsMedia';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import { cn } from '@/lib/utils';

interface AlertsManagerPopoverProps {
  triggeredCount: number;
}

export function AlertsManagerPopover({ triggeredCount }: AlertsManagerPopoverProps) {
  const { alerts, maxAlerts, removeAlert, clearAll } = usePriceAlerts();
  const [open, setOpen] = useState(false);

  const interactive = alerts.length >= 1;

  const triggerContent = triggeredCount > 0 ? (
    <span className="font-medium inline-flex items-center gap-1">
      <BellRing className="h-3 w-3" />{triggeredCount} triggered
    </span>
  ) : (
    <span className="inline-flex items-center gap-1">
      <Bell className="h-3 w-3" />{alerts.length}/{maxAlerts}
    </span>
  );

  if (!interactive) {
    return (
      <span
        className="text-xs text-muted-foreground px-2 py-1"
        title={`${alerts.length} of ${maxAlerts} alerts used`}
      >
        {triggerContent}
      </span>
    );
  }

  const sorted = [...alerts].sort((a, b) => {
    if (a.triggered !== b.triggered) return a.triggered ? -1 : 1;
    return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "text-xs px-2 py-1 rounded-md border-2 transition-colors",
            triggeredCount > 0
              ? "border-black bg-red-600 text-white hover:bg-red-500 animate-pulse"
              : "border-cheese bg-emerald-500 text-white hover:bg-emerald-400"
          )}
          title={`${alerts.length} of ${maxAlerts} alerts — click to manage`}
        >
          {triggerContent}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <p className="text-sm font-semibold text-foreground">
            Active alerts ({alerts.length}/{maxAlerts})
          </p>
          <button
            type="button"
            className="text-[11px] text-destructive hover:underline"
            onClick={() => {
              const count = alerts.length;
              clearAll();
              toast.success(`Cleared ${count} alert${count !== 1 ? 's' : ''}`);
              setOpen(false);
            }}
          >
            Clear all
          </button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-border/40">
          {sorted.map((a) => {
            const lowest = a.lowestPrice;
            const lowestMet = lowest !== undefined && lowest <= a.maxPrice;
            return (
              <div key={a.templateId} className="flex items-center gap-2 p-2">
                <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-muted/20 border border-border/40">
                  {a.image ? (
                    <IpfsMedia
                      url={a.image}
                      alt={a.name}
                      className="w-full h-full"
                      context="card"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-foreground truncate">{a.name}</p>
                    {a.triggered && (
                      <span className="text-[9px] uppercase tracking-wide px-1 rounded bg-destructive/20 text-destructive font-bold animate-pulse">
                        Hit
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    ≤ {a.maxPrice.toFixed(2)} WAX
                    {lowest !== undefined && (
                      <span className={cn("ml-1", lowestMet ? "text-emerald-500 font-medium" : "")}>
                        · low {lowest.toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    removeAlert(a.templateId);
                    toast.success(`Removed alert for ${a.name}`);
                  }}
                  className="flex-shrink-0 h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label={`Remove alert for ${a.name}`}
                  title="Remove alert"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-border/50 text-[10px] text-muted-foreground">
          Tip: click the bell on any card to edit its alert.
        </div>
      </PopoverContent>
    </Popover>
  );
}
