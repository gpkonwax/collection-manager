import { useEffect, useState } from 'react';
import { ExternalLink, Play, X } from 'lucide-react';
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
  const [playing, setPlaying] = useState(false);
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [playerBlocked, setPlayerBlocked] = useState(false);
  const images = history?.images ?? [];
  const heroIndex = Math.min(history?.heroImageIndex ?? 0, Math.max(images.length - 1, 0));
  const heroImage = images[heroIndex];


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

  useEffect(() => {
    if (!open) { setZoomed(null); setPlaying(false); setPlayerLoaded(false); setPlayerBlocked(false); }
  }, [open]);

  // If the embed never loads (blocker / restrictive frame policy), surface a link out.
  useEffect(() => {
    if (!playing) return;
    setPlayerLoaded(false);
    setPlayerBlocked(false);
    const t = window.setTimeout(() => {
      setPlayerLoaded((loaded) => { if (!loaded) setPlayerBlocked(true); return loaded; });
    }, 6000);
    return () => window.clearTimeout(t);
  }, [playing]);

  if (!history) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-cheese">{categoryLabel} — the story</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-5">
            {heroImage && (
              <button
                type="button"
                onClick={() => setZoomed(heroIndex)}
                className="block w-full overflow-hidden rounded-lg border border-border hover:border-cheese transition-colors"
                aria-label="Enlarge promotional image"
              >
                <img
                  src={heroImage.src}
                  alt={heroImage.caption}
                  className="w-full h-auto max-h-64 object-contain bg-black/20"
                />
              </button>
            )}

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

            {history.video && (
              <Section title="🎬 Watch the original promo">
                <p className="mb-2">{history.video.note}</p>
                {playing ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-black">
                    <iframe
                      key={history.video.embedUrl}
                      src={`${history.video.embedUrl}${history.video.embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                      title={history.video.title}
                      className="absolute inset-0 h-full w-full"
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      onLoad={() => setPlayerLoaded(true)}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                      allowFullScreen
                    />
                    {!playerLoaded && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white/70">
                        Loading player…
                      </div>
                    )}
                    {playerBlocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-4 text-center text-xs text-white">
                        <span>The embedded player couldn’t load here (browser or extension blocked it).</span>
                        <a
                          href={history.video.watchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-cheese px-3 py-1.5 font-semibold text-cheese-foreground"
                        >
                          Watch on YouTube <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 hover:border-cheese transition-colors"
                    aria-label="Play the promo video here"
                  >
                    {history.video.thumbnailUrl && (
                      <img
                        src={history.video.thumbnailUrl}
                        alt=""
                        aria-hidden
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-90"
                      />
                    )}
                    <span className="relative flex items-center gap-2 rounded-full bg-cheese px-4 py-2 text-sm font-semibold text-cheese-foreground theme-bright-fill theme-bright-text">
                      <Play className="h-4 w-4" /> Play preview
                    </span>
                    <span className="absolute bottom-2 left-3 right-3 truncate text-left text-xs text-white/90 drop-shadow">
                      {history.video.title}
                    </span>
                  </button>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <a
                    href={history.video.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-cheese hover:underline"
                  >
                    Watch on YouTube <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={history.video.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground theme-bright-text-muted hover:underline"
                  >
                    Found on {history.video.sourceLabel} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </Section>
            )}

            {history.links && history.links.length > 0 && (
              <Section title="🔗 Links">
                <ul className="space-y-1.5">
                  {history.links.map((link) => (
                    <li key={link.url} className="flex flex-wrap items-center gap-2">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-cheese hover:underline"
                      >
                        {link.label} <ExternalLink className="h-3 w-3" />
                      </a>
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground theme-bright-text-muted">
                        {link.kind === 'official' ? 'Official' : 'Coverage'}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}




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
