import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FileJson, Upload, Download, Clock, RefreshCw, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  loadRecentJsons,
  removeRecentJson,
  kindLabel,
  type RecentJsonEntry,
} from '@/lib/jsonRouter';

interface JsonMenuProps {
  /** Bumped by parent after each successful import so the menu re-reads localStorage. */
  refreshKey?: number;
  alertsCount: number;
  alertsMax: number;
  triggeredCount: number;
  alertsCheckingNow: boolean;
  alertsCooldownMs: number;
  onImportFiles: (e: ChangeEvent<HTMLInputElement>) => void;
  onApplyRecent: (entry: RecentJsonEntry) => void;
  onCheckAlertsNow: () => void;
  onExportAlerts: () => void;
  onExportLayout: () => void;
  onExportPuzzle?: () => void;
  layoutHasData: boolean;
  puzzleHasData: boolean;
}

const KIND_BADGE_CLASSES: Record<string, string> = {
  alerts: 'bg-cheese/20 text-cheese border-cheese/30',
  layout: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  puzzle: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

export function JsonMenu({
  refreshKey,
  alertsCount,
  alertsMax,
  triggeredCount,
  alertsCheckingNow,
  alertsCooldownMs,
  onImportFiles,
  onApplyRecent,
  onCheckAlertsNow,
  onExportAlerts,
  onExportLayout,
  onExportPuzzle,
  layoutHasData,
  puzzleHasData,
}: JsonMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<RecentJsonEntry[]>(() => loadRecentJsons());

  useEffect(() => {
    setRecents(loadRecentJsons());
  }, [refreshKey, open]);

  const handleImportClick = useCallback(() => {
    setOpen(false);
    // Defer so the menu close animation doesn't swallow the click on Safari.
    setTimeout(() => inputRef.current?.click(), 0);
  }, []);

  const handleRecentRemove = useCallback((id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    setRecents(removeRecentJson(id));
  }, []);

  const handleRecentApply = useCallback((entry: RecentJsonEntry) => {
    setOpen(false);
    onApplyRecent(entry);
  }, [onApplyRecent]);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onImportFiles(e);
  }, [onImportFiles]);

  const cooldownActive = alertsCooldownMs > 0;
  const cooldownSec = Math.ceil(alertsCooldownMs / 1000);
  const checkDisabled = alertsCheckingNow || cooldownActive || alertsCount === 0;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="whitespace-nowrap border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10 h-8"
            title="Import, export, and recent JSON files"
          >
            <FileJson className="h-4 w-4 mr-1" />
            JSON
            {triggeredCount > 0 && (
              <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-destructive" aria-label={`${triggeredCount} alerts triggered`} />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Import
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleImportClick} className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            <span>Import file(s)…</span>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              disabled={recents.length === 0}
              className="cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
            >
              <Clock className="h-4 w-4 mr-2" />
              <span className="flex-1">Recent imports</span>
              {recents.length > 0 && (
                <span className="ml-2 text-[10px] rounded bg-cheese/20 text-cheese px-1.5 py-0.5">
                  {recents.length}
                </span>
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-80 p-0">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5">
                Click to re-apply. Cached locally — re-import the file if you've edited it elsewhere.
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recents.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No recent imports yet.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto py-1">
                  {recents.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => handleRecentApply(entry)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent text-left group"
                    >
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
                          KIND_BADGE_CLASSES[entry.kind] || KIND_BADGE_CLASSES.unknown
                        }`}
                      >
                        {kindLabel(entry.kind)}
                      </span>
                      <span className="flex-1 truncate text-foreground" title={entry.filename}>
                        {entry.filename}
                      </span>
                      <button
                        type="button"
                        onClick={(ev) => handleRecentRemove(entry.id, ev)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        title="Remove from recent"
                        aria-label="Remove from recent"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Export
          </DropdownMenuLabel>

          <DropdownMenuItem
            onClick={onExportAlerts}
            disabled={alertsCount === 0}
            className="cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="flex-1">Export alerts</span>
            {alertsCount > 0 && (
              <span className="ml-2 text-[10px] text-muted-foreground">{alertsCount}</span>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={onExportLayout}
            disabled={!layoutHasData}
            className="cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
          >
            <Download className="h-4 w-4 mr-2" />
            <span>Export saved layout</span>
          </DropdownMenuItem>

          {onExportPuzzle && (
            <DropdownMenuItem
              onClick={onExportPuzzle}
              disabled={!puzzleHasData}
              className="cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
            >
              <Download className="h-4 w-4 mr-2" />
              <span>Export puzzle layout</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Alerts ({alertsCount}/{alertsMax})
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={onCheckAlertsNow}
            disabled={checkDisabled}
            className="cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${alertsCheckingNow ? 'animate-spin' : ''}`} />
            <span className="flex-1">
              {cooldownActive ? `Check alerts (wait ${cooldownSec}s)` : 'Check alerts now'}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
