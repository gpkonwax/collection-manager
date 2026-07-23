import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getLocalMirrorStatus,
  getPersistPreference,
  subscribeLocalMirror,
} from '@/lib/localMirror';
import { getZipDownloadUrls, getZipManifest, type ZipManifestInfo } from '@/lib/remoteMirror';

const DISMISS_KEY = 'gpk-backup-nudge-dismissed-v1';

function isDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}
function markDismissed(): void {
  try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ }
}

/**
 * Thin, dismissible bar shown under the header on first visit.
 * Recommends downloading the offline ZIP while everything's working.
 * Auto-hides once a persisted local mirror is loaded or the user dismisses.
 */
export function BackupNudgeBanner() {
  const status = useSyncExternalStore(
    subscribeLocalMirror,
    getLocalMirrorStatus,
    getLocalMirrorStatus,
  );

  const [dismissed, setDismissed] = useState(true);
  const [zipInfo, setZipInfo] = useState<ZipManifestInfo | null>(null);

  useEffect(() => {
    setDismissed(isDismissed());
    getZipManifest().then(setZipInfo).catch(() => setZipInfo(null));
  }, []);

  const protectedOnDevice =
    status.fileCount > 0 && (status.persisted || getPersistPreference());

  if (dismissed || protectedOnDevice) return null;

  const zipOptions = getZipDownloadUrls(zipInfo);
  const primary = zipOptions[0];
  const firstPart = primary?.parts[0];
  if (!primary || !firstPart) return null;

  const onDismiss = () => {
    markDismissed();
    setDismissed(true);
  };

  const onDownload = () => {
    // Downloading is a strong signal they're taking the tip — remember dismissal.
    markDismissed();
    setDismissed(true);
  };

  return (
    <div className="bg-cheese/10 border-b border-cheese/30 text-sm">
      <div className="container flex flex-wrap items-center gap-2 py-2">
        <ShieldCheck className="h-4 w-4 text-cheese flex-shrink-0" aria-hidden />
        <p className="text-cheese/90 flex-1 min-w-[16rem]">
          <span className="font-medium">Recommended:</span>{' '}
          download the offline backup ZIP parts now while everything's working — it's
          your safety net if all mirrors ever go down.
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            asChild
            size="sm"
            className="h-8"
            onClick={onDownload}
          >
            <a href={firstPart.url} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download ZIP{primary.parts.length > 1 ? ' part 1' : ''}
            </a>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-cheese/70 hover:text-cheese"
            onClick={onDismiss}
          >
            Maybe later
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="p-1 text-cheese/60 hover:text-cheese"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
