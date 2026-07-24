/**
 * Always-visible pill in the header showing which image source is currently
 * healthy. Click opens the Offline backup dialog via a custom DOM event that
 * BackupPanel listens for.
 */
import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useImageSourceStatus,
  runImageSourceChecks,
  SOURCE_LABELS,
  type CheckStatus,
  type SourceKey,
} from '@/hooks/useImageSourceStatus';
import { cn } from '@/lib/utils';

const DOT_COLOR: Record<SourceKey, string> = {
  ipfs: 'bg-emerald-400',
  primary: 'bg-yellow-400',
  backupA: 'bg-yellow-400',
  backupB: 'bg-yellow-400',
  local: 'bg-sky-400',
  none: 'bg-red-500',
};

const STATUS_DOT: Record<CheckStatus, string> = {
  idle: 'bg-muted-foreground/50',
  checking: 'bg-muted-foreground/70 animate-pulse',
  ok: 'bg-emerald-400',
  failed: 'bg-red-500',
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  idle: 'Not checked',
  checking: 'Checking…',
  ok: 'Reachable',
  failed: 'Unreachable',
};

function openBackupPanel() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('open-backup-panel'));
}

export function ImageSourceIndicator() {
  const status = useImageSourceStatus();
  const label = SOURCE_LABELS[status.active];
  const dot = DOT_COLOR[status.active];

  const rows = useMemo(
    () => [
      { key: 'ipfs' as const, name: 'Public IPFS gateways', s: status.ipfs },
      { key: 'primary' as const, name: 'Primary mirror (GitHub Pages)', s: status.primary },
      { key: 'backupA' as const, name: 'Backup A (Cloudflare Pages)', s: status.backupA },
      { key: 'backupB' as const, name: 'Backup B (GitLab Pages)', s: status.backupB },
      { key: 'local' as const, name: 'Offline ZIP (this device)', s: status.local },
    ],
    [status.ipfs, status.primary, status.backupA, status.backupB, status.local],
  );

  const isChecking =
    status.ipfs === 'checking' ||
    status.primary === 'checking' ||
    status.backupA === 'checking' ||
    status.backupB === 'checking';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openBackupPanel}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 rounded-md border border-cheese/40',
              'px-2 text-xs font-medium text-cheese/90 hover:bg-cheese/10 transition-colors',
              'whitespace-nowrap',
            )}
            aria-label={`Image source status: ${label}. Click to open Offline backup.`}
          >
            <span
              className={cn(
                'inline-block h-2 w-2 rounded-full',
                dot,
                isChecking && 'animate-pulse',
              )}
              aria-hidden
            />
            <span className="hidden sm:inline">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs">
          <div className="space-y-2">
            <div className="text-xs font-semibold">
              Active source: <span className="text-cheese">{label}</span>
            </div>
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-2 text-xs">
                  <span className={cn('inline-block h-2 w-2 rounded-full', STATUS_DOT[r.s])} aria-hidden />
                  <span className="flex-1">{r.name}</span>
                  <span className="text-muted-foreground">{STATUS_LABEL[r.s]}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); void runImageSourceChecks(); }}
                className="inline-flex items-center gap-1 text-xs text-cheese hover:underline"
              >
                <RefreshCw className={cn('h-3 w-3', isChecking && 'animate-spin')} />
                Recheck now
              </button>
              <span className="text-[10px] text-muted-foreground">
                Click pill for Offline backup
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
