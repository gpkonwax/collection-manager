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
  idle: { label: 'Ready', className: 'bg-muted text-muted-foreground' },
  checking: { label: 'Checking…', className: 'bg-blue-500/20 text-blue-400' },
  ok: { label: 'Working', className: 'bg-emerald-500/20 text-emerald-400' },
  failed: { label: 'Failed', className: 'bg-destructive/20 text-destructive' },
};

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

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [persist, setPersistState] = useState(false);
  const [zipInfo, setZipInfo] = useState<ZipManifestInfo | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPersistState(getPersistPreference());
    getZipManifest().then(setZipInfo).catch(() => setZipInfo(null));
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
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

        <div className="space-y-5 text-sm">
          {/* Recommended: proactive ZIP download */}
          <RecommendedZipCard
            protectedOnDevice={status.fileCount > 0 && (status.persisted || persist)}
            fileCount={status.fileCount}
            totalBytes={status.totalBytes}
            zipInfo={zipInfo}
          />

          {/* Step 1: built-in primary mirror */}
          <section className="space-y-2 rounded-lg border border-cheese/20 bg-cheese/5 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cheese text-cheese-foreground text-xs font-bold">
                1
              </span>
              <p className="font-medium">Built-in primary mirror</p>
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
                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}>
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

  return (
    <section className="rounded-lg border border-cheese/40 bg-cheese/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-cheese" />
        <p className="font-medium text-cheese">Recommended: keep a copy on your device</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Grab the offline backup ZIP{approxSize ? ` (~${approxSize})` : ''} now while
        everything's working — it's your safety net if all mirrors ever go down. Every
        mirror below serves the same ZIP; the hash is checked against the pinned manifest.
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const mirror = MIRRORS.find((m) => m.key === opt.key);
          const provider = mirror ? getMirrorProviderName(mirror.url) : null;
          const buttonLabel = provider ? provider.name : opt.label;
          return (
            <Button
              key={opt.key}
              asChild
              size="sm"
              variant={opt.key === 'primary' ? 'default' : 'outline'}
              className="h-8"
            >
              <a href={opt.url} target="_blank" rel="noopener noreferrer">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {buttonLabel}
              </a>
            </Button>
          );
        })}
      </div>
      {shortHash && (
        <p className="text-[10px] text-muted-foreground font-mono break-all" title={zipInfo?.sha256 ?? ''}>
          SHA-256: {shortHash}
        </p>
      )}
    </section>
  );
}
