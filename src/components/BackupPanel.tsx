import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Download,
  HardDrive,
  Loader2,
  Server,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  clearLocalMirror,
  getLocalMirrorStatus,
  getPersistPreference,
  ingestMirrorZip,
  setPersistPreference,
  subscribeLocalMirror,
} from '@/lib/localMirror';
import {
  MIRRORS,
  type MirrorKey,
  OFFLINE_APP_RELEASE_ASSET_URL,
  ZIP_GITHUB_RELEASE_URL,
  checkMirrorHealth,
  getMirrorDisplayLabel,
  getMirrorProviderName,
  getRemoteMirrorState,
  getZipDownloadUrls,
  getZipManifest,
  isMirrorConfigured,
  resetActiveMirror,
  setActiveMirror,
  subscribeRemoteMirror,
  type MirrorStatus,
  type ZipManifestInfo,
} from '@/lib/remoteMirror';
import { isOfflineBundle } from '@/lib/offlineBundle';

function formatBytes(n: number): string {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)} ${units[i]}`;
}

interface Props {
  triggerClassName?: string;
}

const STEP_BADGES: Record<MirrorStatus, { label: string; className: string }> = {
  idle: { label: 'Ready', className: 'bg-emerald-500/20 text-emerald-400' },
  checking: { label: 'Checking…', className: 'bg-blue-500/20 text-blue-400' },
  ok: { label: 'Working', className: 'bg-emerald-500/20 text-emerald-400' },
  failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive' },
};

const NOT_CONFIGURED_CLASS = 'bg-muted text-muted-foreground';

export function BackupPanel({ triggerClassName }: Props) {
  const status = useSyncExternalStore(
    subscribeLocalMirror,
    getLocalMirrorStatus,
    getLocalMirrorStatus,
  );

  const remoteState = useSyncExternalStore(
    subscribeRemoteMirror,
    getRemoteMirrorState,
    getRemoteMirrorState,
  );

  // Auto-open the panel on first launch of the offline bundle so users see
  // the "Load backup ZIP" step immediately — the viewer is empty without it.
  const [open, setOpen] = useState(() => isOfflineBundle() && getLocalMirrorStatus().fileCount === 0);
  const [busy, setBusy] = useState(false);
  const [persist, setPersistState] = useState(false);
  const [zipInfo, setZipInfo] = useState<ZipManifestInfo | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPersistState(getPersistPreference());
    getZipManifest().then(setZipInfo).catch(() => setZipInfo(null));
    // Health-check the built-in primary mirror every time the panel opens so
    // users get an obvious green/red indicator without having to click anything.
    checkMirrorHealth('primary');
  }, [open]);

  const onPickFile = () => inputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setBusy(true);
    try {
      const { added, bytes } = await ingestMirrorZip(file);
      toast({
        title: 'Backup loaded',
        description: `${added.toLocaleString()} images (${formatBytes(bytes)}) available offline.`,
      });
    } catch (err) {
      console.error('[BackupPanel] ingest failed', err);
      toast({
        title: 'Could not read ZIP',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const onClear = () => {
    clearLocalMirror();
    toast({ title: 'Offline backup cleared' });
  };

  const onPersistChange = (v: boolean) => {
    setPersistState(v);
    setPersistPreference(v);
  };

  const onUseMirror = (key: MirrorKey) => {
    if (!isMirrorConfigured(key)) {
      toast({
        title: 'Mirror not configured',
        description: 'This backup mirror URL is still a placeholder. Set it in the code after creating the mirror.',
        variant: 'destructive',
      });
      return;
    }
    setActiveMirror(key);
    toast({
      title: `Switched to ${MIRRORS.find((m) => m.key === key)?.label}`,
      description: 'The app will verify every image against the pinned manifest before using it.',
    });
  };

  const onReset = () => {
    resetActiveMirror();
    toast({
      title: 'Reset to automatic fallback',
      description: 'The app will use public IPFS gateways, then the built-in primary mirror.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'whitespace-nowrap border-cheese/50 text-cheese hover:bg-cheese/10 h-8',
            triggerClassName,
          )}
          title="Offline image backup"
        >
          <HardDrive className="h-4 w-4 mr-1" aria-hidden />
          Offline backup
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pr-12 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cheese" />
            Offline image backup
          </DialogTitle>
          <DialogDescription>
            If card images stop loading, work through these steps in order. Every mirror file is
            checked against a published list of hashes, so you don't have to trust the host — only
            the math.
          </DialogDescription>
        </DialogHeader>

        {/* Recommended: proactive ZIP download — pinned in the fixed header */}
        <div className="px-6 pt-4 text-sm">
          <RecommendedZipCard
            protectedOnDevice={status.fileCount > 0 && (status.persisted || persist)}
            fileCount={status.fileCount}
            totalBytes={status.totalBytes}
            zipInfo={zipInfo}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5 space-y-5 text-sm">


          {/* Step 1: built-in primary mirror */}
          <section className="space-y-2 rounded-lg border border-cheese/20 bg-cheese/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cheese text-cheese-foreground text-xs font-bold flex-shrink-0">
                  1
                </span>
                <p className="font-medium truncate">Built-in primary mirror</p>
              </div>
              {(() => {
                const s = remoteState.statuses.primary;
                const configured = isMirrorConfigured('primary');
                const badge = STEP_BADGES[s];
                const label = !configured
                  ? 'Not configured'
                  : s === 'ok'
                    ? 'Reachable'
                    : s === 'failed'
                      ? 'Unreachable'
                      : s === 'checking'
                        ? 'Checking…'
                        : 'Ready';
                const className = !configured ? NOT_CONFIGURED_CLASS : badge.className;
                return (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}
                  >
                    {s === 'checking' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {s === 'ok' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {s === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                    {label}
                  </span>
                );
              })()}
            </div>
            <p className="text-muted-foreground text-xs">
              Used automatically when public IPFS gateways fail. No action needed.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground break-all">
              <Server className="w-3.5 h-3.5 flex-shrink-0" />
              {MIRRORS[0].url || 'Not configured'}
            </div>
          </section>

          {/* Step 2: backup mirrors */}
          <section className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cheese text-cheese-foreground text-xs font-bold">
                2
              </span>
              <p className="font-medium">Backup mirrors</p>
            </div>
            <p className="text-muted-foreground text-xs">
              If the primary mirror is also down, click a backup mirror to use it. Each file is
              hash-verified before it is shown.
            </p>

            <div className="space-y-2">
              {(['backupA', 'backupB'] as MirrorKey[]).map((key) => {
                const cfg = MIRRORS.find((m) => m.key === key)!;
                const configured = isMirrorConfigured(key);
                const statusBadge = remoteState.statuses[key];
                const isActive = remoteState.active === key;
                const { label, className } = STEP_BADGES[statusBadge];
                const provider = getMirrorProviderName(cfg.url);
                const displayLabel = getMirrorDisplayLabel(cfg);
                return (
                  <div
                    key={key}
                    className={`flex flex-col gap-2 rounded-md border p-2 ${
                      isActive ? 'border-cheese bg-cheese/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-xs">{displayLabel}</p>
                        <p className="text-[10px] text-muted-foreground break-all">
                          {cfg.url || 'Not configured yet'}
                        </p>
                        {provider && (
                          <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full ${provider.colorClass}`}>
                            {provider.name}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${configured ? className : NOT_CONFIGURED_CLASS}`}>
                        {configured ? label : 'Not configured'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      className="w-full h-8"
                      disabled={!configured || statusBadge === 'checking'}
                      onClick={() => onUseMirror(key)}
                    >
                      {statusBadge === 'checking' && (
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      )}
                      {isActive ? 'Active' : `Use ${displayLabel}`}
                    </Button>
                  </div>
                );
              })}
            </div>

            {remoteState.active && (
              <Button size="sm" variant="ghost" className="w-full h-8" onClick={onReset}>
                <X className="w-3.5 h-3.5 mr-2" />
                Reset to automatic (primary mirror)
              </Button>
            )}
          </section>

          {/* Step 3: load ZIP */}
          <section className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cheese text-cheese-foreground text-xs font-bold">
                3
              </span>
              <p className="font-medium">Load backup ZIP</p>
            </div>
            <p className="text-muted-foreground text-xs">
              The ultimate fallback: load a ZIP of the mirror directly from your device. Works fully
              offline once loaded.
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {status.fileCount > 0
                    ? `${status.fileCount.toLocaleString()} files loaded (${formatBytes(status.totalBytes)})`
                    : 'No backup loaded.'}
                </p>
              </div>
              {status.fileCount > 0 && (
                <Button size="sm" variant="ghost" onClick={onClear} title="Clear loaded backup">
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onPickFile} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {busy ? 'Reading ZIP…' : 'Load backup ZIP'}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Don't have a ZIP yet? Grab one from the "Recommended" card above.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={onFileChange}
            />
            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="persist-mirror" className="text-xs text-muted-foreground">
                Remember on this device (IndexedDB)
              </Label>
              <Switch id="persist-mirror" checked={persist} onCheckedChange={onPersistChange} />
            </div>
          </section>

          <hr className="border-border" />

          {/* Run the manager itself offline (hidden inside the offline bundle build) */}
          {!isOfflineBundle() && <OfflineAppCard />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RecommendedZipCardProps {
  protectedOnDevice: boolean;
  fileCount: number;
  totalBytes: number;
  zipInfo: ZipManifestInfo | null;
}

function RecommendedZipCard({
  protectedOnDevice,
  fileCount,
  totalBytes,
  zipInfo,
}: RecommendedZipCardProps) {
  const options = getZipDownloadUrls();

  if (protectedOnDevice) {
    return (
      <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-4 h-4" />
          You're protected — offline backup loaded ({fileCount.toLocaleString()} files,{' '}
          {formatBytes(totalBytes)}).
        </div>
      </section>
    );
  }

  const approxSize = zipInfo?.bytes ? formatBytes(zipInfo.bytes) : null;
  const shortHash = zipInfo?.sha256 ? `${zipInfo.sha256.slice(0, 12)}…` : null;

  const primaryOption = options.find((o) => o.key === 'primary');
  const backupAlternates = options.filter((o) => o.key === 'backupA' || o.key === 'backupB');
  const hasBackupAlternates = backupAlternates.length > 0;

  return (
    <section className="rounded-lg border border-cheese/40 bg-cheese/10 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-cheese" />
        <p className="font-medium text-cheese">Recommended: keep a copy on your device</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Save the offline backup ZIP{approxSize ? ` (~${approxSize})` : ''} now while
        everything's working. If every mirror ever goes down, you can load this file
        back into the app (Step 3 below) and every image still works.
      </p>

      {/* One big obvious button */}
      {primaryOption && (
        <Button asChild size="lg" className="w-full h-11 text-base">
          <a href={primaryOption.url} target="_blank" rel="noopener noreferrer">
            <Download className="w-4 h-4 mr-2" />
            Download from GitHub Release{approxSize ? ` (${approxSize})` : ''}
          </a>
        </Button>
      )}

      {hasBackupAlternates && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            If GitHub is down, try another source (same file):
          </p>
          <div className="flex flex-wrap gap-2">
            {backupAlternates.map((opt) => {
              const mirror = MIRRORS.find((m) => m.key === opt.key);
              const provider = mirror ? getMirrorProviderName(mirror.url) : null;
              return (
                <Button
                  key={opt.key}
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                >
                  <a href={opt.url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-3 h-3 mr-1.5" />
                    From {provider?.name ?? opt.label}
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {!hasBackupAlternates && (
        <p className="text-[10px] text-muted-foreground">
          Backup A and Backup B download links will appear here once those mirrors are online.
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        <a
          href={ZIP_GITHUB_RELEASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-cheese"
        >
          Can't download directly? Open the release page
        </a>
      </p>

      {shortHash && (
        <p className="text-[10px] text-muted-foreground font-mono break-all" title={zipInfo?.sha256 ?? ''}>
          Verified SHA-256: {shortHash}
        </p>
      )}
    </section>
  );
}

function OfflineAppCard() {
  return (
    <section className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-cheese" />
        <p className="font-medium">Run the manager itself offline</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Download the manager as a ZIP. Unzip it, open <span className="font-mono">open-me.html</span>{' '}
        (or run the tiny local server it explains), then load the image backup ZIP below.
        Everything image-driven keeps working even if this site, GitHub, and every mirror
        disappear. Wallet and live NFT features need internet and won't work offline.
      </p>
      <Button asChild size="sm" variant="outline" className="w-full h-8">
        <a href={OFFLINE_APP_RELEASE_ASSET_URL} target="_blank" rel="noopener noreferrer">
          <Download className="w-3.5 h-3.5 mr-2" />
          Download the offline app
        </a>
      </Button>
    </section>
  );
}
