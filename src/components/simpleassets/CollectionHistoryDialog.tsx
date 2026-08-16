import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCollectionHistory } from '@/lib/collectionHistory';


interface CollectionHistoryDialogProps {
  /** Category key, e.g. 'series1'. */
  categoryKey: string;
  /** Display name shown in the title. */
  categoryLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h4 className="font-semibold text-cheese">{title}</h4>
      <div className="text-sm text-foreground leading-relaxed theme-bright-text">{children}</div>
    </section>
  );
}

/** Story of a collection: release, size of the drop, sell-out, reception, oddities. */
export function CollectionHistoryDialog({ categoryKey, categoryLabel, open, onOpenChange }: CollectionHistoryDialogProps) {
  const history = getCollectionHistory(categoryKey);
  const [zoomed, setZoomed] = useState<number | null>(null);
  const images = history?.images ?? [];

  // Close the enlarged view on Escape without closing the dialog itself.
  useEffect(() => {
    if (zoomed === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setZoomed(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoomed]);

  useEffect(() => { if (!open) setZoomed(null); }, [open]);

  if (!history) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-cheese">{categoryLabel} — the story</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-5">
            <p className="text-sm italic text-muted-foreground theme-bright-text-muted">{history.tagline}</p>

            <Section title="📅 Released">{history.released}</Section>
            <Section title="📦 Size of the drop">{history.dropSize}</Section>
            <Section title="⚡ Sell-out & demand">{history.sellOut}</Section>
            <Section title="🗣️ Reception">{history.reception}</Section>

            <Section title="🔍 Notes & oddities">
              <ul className="list-disc pl-5 space-y-1">
                {history.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>

              {images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-4">
                  {images.map((image, index) => (
                    <figure key={image.src} className="w-32 space-y-1">
                      <button
                        type="button"
                        onClick={() => setZoomed(index)}
                        className="block w-full overflow-hidden rounded-md border border-border hover:border-cheese transition-colors"
                        aria-label="Enlarge image"
                      >
                        <img
                          src={image.src}
                          alt={image.caption}
                          loading="lazy"
                          className="w-full h-auto block"
                        />
                      </button>
                      <figcaption className="text-[11px] leading-snug text-muted-foreground theme-bright-text-muted">
                        Click to enlarge
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </Section>

            <p className="text-xs text-muted-foreground theme-bright-text-muted border-t border-border pt-3">
              Sources: {history.sources.join(' · ')}. Figures are best-effort community records — most card
              totals are estimates, because cards were minted when packs were opened rather than up front.
            </p>
          </div>
        </ScrollArea>

        {zoomed !== null && images[zoomed] && (
          <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 rounded-lg"
            onClick={() => setZoomed(null)}
            role="dialog"
            aria-label="Enlarged image"
          >
            <button
              type="button"
              onClick={() => setZoomed(null)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-cheese"
              aria-label="Close enlarged image"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={images[zoomed].src}
              alt={images[zoomed].caption}
              className="max-h-[65vh] w-auto rounded-md border border-border"
            />
            <p className="max-w-md text-center text-xs text-muted-foreground theme-bright-text-muted">
              {images[zoomed].caption}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

}
