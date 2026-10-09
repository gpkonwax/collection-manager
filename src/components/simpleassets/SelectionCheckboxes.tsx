import { Checkbox } from '@/components/ui/checkbox';
import { MAX_BRIDGE_PER_TX } from '@/lib/bridgeActions';

interface SelectionCheckboxesProps {
  visibleIds: string[];
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
}

/**
 * Select All + Select 20 tick boxes shown in selection mode.
 * Select All toggles every visible card; Select 20 sets the selection to
 * exactly the first MAX_BRIDGE_PER_TX (20) visible cards so it can be used
 * directly for a bridge transaction (max 20 cards per transaction).
 */
export const SelectionCheckboxes = ({ visibleIds, selectedIds, onSelectionChange }: SelectionCheckboxesProps) => {
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const first20 = visibleIds.slice(0, MAX_BRIDGE_PER_TX);
  const first20Selected = first20.length > 0 && first20.every(id => selectedIds.has(id));

  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              const next = new Set(selectedIds);
              visibleIds.forEach(id => next.add(id));
              onSelectionChange(next);
            } else {
              onSelectionChange(new Set());
            }
          }}
        />
        <span className="text-sm text-cheese">Select All</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Checkbox
          checked={first20Selected}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectionChange(new Set(first20));
            } else {
              const next = new Set(selectedIds);
              first20.forEach(id => next.delete(id));
              onSelectionChange(next);
            }
          }}
        />
        <span className="text-sm text-cheese">Select 20</span>
      </label>
    </div>
  );
};
