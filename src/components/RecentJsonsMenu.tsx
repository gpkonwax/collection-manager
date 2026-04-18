import { useCallback, useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  loadRecentJsons,
  removeRecentJson,
  kindLabel,
  type RecentJsonEntry,
} from '@/lib/jsonRouter';

interface RecentJsonsMenuProps {
  /** Bumped by parent after each successful import so the menu re-reads localStorage. */
  refreshKey?: number;
  onApply: (entry: RecentJsonEntry) => void;
}

const KIND_BADGE_CLASSES: Record<string, string> = {
  alerts: 'bg-cheese/20 text-cheese border-cheese/30',
  layout: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  puzzle: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

export function RecentJsonsMenu({ refreshKey, onApply }: RecentJsonsMenuProps) {
  const [entries, setEntries] = useState<RecentJsonEntry[]>(() => loadRecentJsons());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEntries(loadRecentJsons());
  }, [refreshKey, open]);

  const handleRemove = useCallback((id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    ev.preventDefault();
    setEntries(removeRecentJson(id));
  }, []);

  const handleApply = useCallback((entry: RecentJsonEntry) => {
    setOpen(false);
    onApply(entry);
  }, [onApply]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="whitespace-nowrap border-cheese/30 text-cheese hover:border-cheese hover:bg-cheese/10 h-8"
          title="Recently imported JSON files (cached locally)"
        >
          <Clock className="h-4 w-4 mr-1" />Recent
          {entries.length > 0 && (
            <span className="ml-1 text-[10px] rounded bg-cheese/20 px-1.5 py-0.5">
              {entries.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Click to re-apply. Cached locally — re-import the file if you've edited it elsewhere.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {entries.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No recent imports yet.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto py-1">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleApply(entry)}
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
                  onClick={(ev) => handleRemove(entry.id, ev)}
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
