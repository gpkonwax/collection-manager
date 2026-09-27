import { useEffect, useState } from 'react';
import { Star, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FAVORITES_CHANGED_EVENT, exportFavoritesJson } from '@/lib/favoriteAccounts';

const REMINDED_KEY = 'gpk:fav-export-reminded';

/**
 * One-time-per-session popup shown after a user stars an account, reminding
 * them favourites live only in this browser's storage and can be exported as
 * JSON. Does not fire on imports (the user already has a file) or removals.
 */
export function FavoritesExportReminder() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string } | undefined;
      if (detail?.type !== 'added') return;
      try {
        if (sessionStorage.getItem(REMINDED_KEY)) return;
        sessionStorage.setItem(REMINDED_KEY, '1');
      } catch { /* sessionStorage unavailable — still show once */ }
      setOpen(true);
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FAVORITES_CHANGED_EVENT, handler);
  }, []);

  const handleExport = () => {
    const blob = new Blob([exportFavoritesJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.href = url;
    a.download = `gpk-favorite-accounts-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-cheese fill-cheese" />
            Back up your favourites
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-1 text-sm text-muted-foreground">
              <p>
                Your favourite accounts are saved only in this browser. If you clear your browser
                data or switch devices, the list is lost.
              </p>
              <p>
                Export it as a JSON file to keep a backup — you can re-import it anytime from the
                JSON menu or the View Wallet popover.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Got it
          </Button>
          <Button
            onClick={handleExport}
            className="gap-2 bg-cheese hover:bg-cheese/90 text-cheese-foreground font-semibold theme-bright-fill theme-bright-text"
          >
            <Download className="h-4 w-4" />
            Export now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
