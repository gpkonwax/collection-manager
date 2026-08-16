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
            </Section>

            <p className="text-xs text-muted-foreground theme-bright-text-muted border-t border-border pt-3">
              Sources: {history.sources.join(' · ')}. Figures are best-effort community records — most card
              totals are estimates, because cards were minted when packs were opened rather than up front.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
