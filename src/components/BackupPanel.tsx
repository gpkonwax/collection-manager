import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Download, HardDrive, Loader2, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  TRUSTED_MIRRORS,
  getCommunityMirrorUrl,
  setCommunityMirrorUrl,
} from '@/lib/ipfsGateways';

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

export function BackupPanel({ triggerClassName }: Props) {
  const status = useSyncExternalStore(
    subscribeLocalMirror,
    getLocalMirrorStatus,
    getLocalMirrorStatus,
  );

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [persist, setPersistState] = useState(false);
  const [community, setCommunity] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setPersistState(getPersistPreference());
    setCommunity(getCommunityMirrorUrl() ?? '');
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

  const onSaveCommunity = () => {
    const trimmed = community.trim();
    if (trimmed && !/^https:\/\//i.test(trimmed)) {
      toast({
        title: 'Only https:// URLs accepted',
        description: 'The community mirror URL must start with https://',
        variant: 'destructive',
      });
      return;
    }
    setCommunityMirrorUrl(trimmed || null);
    toast({
      title: trimmed ? 'Community mirror saved' : 'Community mirror cleared',
      description: trimmed || 'Only public gateways and the built-in backup will be used.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={triggerClassName ?? 'text-cheese/70 hover:text-cheese hover:underline text-sm inline-flex items-center gap-1'}
          title="Offline image backup"
        >
          <HardDrive className="w-3.5 h-3.5" aria-hidden />
          Offline backup
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Offline image backup</DialogTitle>
          <DialogDescription>
            If IPFS gateways go down, card artwork can still be loaded from a local ZIP
            or from a community mirror.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Local ZIP</p>
                <p className="text-muted-foreground">
                  {status.fileCount > 0
                    ? `${status.fileCount.toLocaleString()} files loaded (${formatBytes(status.totalBytes)})`
                    : 'No backup loaded — cards use public IPFS gateways.'}
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
              <a
                href="https://github.com/gpkonwaxbackup/gpk-backup/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-cheese hover:underline text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download latest ZIP
              </a>
            </div>
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

          <section className="space-y-2 border-t border-border pt-4">
            <div>
              <p className="font-medium">Built-in mirror</p>
              <p className="text-muted-foreground break-all text-xs">
                {TRUSTED_MIRRORS[0]}
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Used automatically when public IPFS gateways fail. No action needed.
              </p>
            </div>
          </section>

          <section className="space-y-2 border-t border-border pt-4">
            <p className="font-medium">Community mirror URL (optional)</p>
            <p className="flex items-start gap-1 text-xs text-muted-foreground">
              <ShieldAlert className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Only paste URLs you trust. Verify content against the canonical
                <code className="mx-1">manifest.json</code> before use.
              </span>
            </p>
            <div className="flex gap-2">
              <Input
                value={community}
                onChange={(e) => setCommunity(e.target.value)}
                placeholder="https://example.com/gpk-mirror/"
                className="text-xs"
              />
              <Button size="sm" onClick={onSaveCommunity}>Save</Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
