import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

/** Selection-mode state passed to a pack tile. Undefined = not in selection mode. */
export interface PackSelectionProps {
  /** How many of this pack are currently selected. */
  selectedCount: number;
  /** True while cards are selected (packs and cards are sent separately). */
  disabled: boolean;
  /** Toggle the single owned pack (used when the user owns exactly 1). */
  onToggle: () => void;
  /** Open the chooser (used when the user owns 2 or more). */
  onOpenPicker: () => void;
}

const DISABLED_HINT = 'Packs and cards are sent separately — clear your card selection first';

/** Full-tile click target + tick for a pack the user owns exactly one of. */
export function PackSelectOverlay({ selection, label }: { selection: PackSelectionProps; label: string }) {
  const selected = selection.selectedCount > 0;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${selected ? 'Deselect' : 'Select'} ${label}`}
      title={selection.disabled ? DISABLED_HINT : undefined}
      disabled={selection.disabled}
      onClick={selection.onToggle}
      className={`absolute inset-0 z-10 rounded-lg ${selected ? 'ring-2 ring-cheese bg-cheese/10' : ''} ${selection.disabled ? 'cursor-not-allowed bg-background/50' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded border ${selected ? 'bg-cheese border-cheese text-primary-foreground' : 'border-border bg-background/80'}`}>
        {selected && <Check className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

export function PackSelectButton({ selection, owned }: { selection: PackSelectionProps; owned: number }) {
  if (owned <= 0) {
    return <Button size="sm" variant="outline" className="w-full text-xs" disabled>No Packs</Button>;
  }
  if (owned === 1) {
    return (
      <Button size="sm" variant="outline" className="w-full text-xs border-cheese/50 text-cheese" tabIndex={-1} aria-hidden>
        {selection.selectedCount > 0 ? 'Selected' : 'Tap to select'}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      className="w-full text-xs bg-cheese hover:bg-cheese/90 text-cheese-foreground"
      disabled={selection.disabled}
      title={selection.disabled ? DISABLED_HINT : undefined}
      onClick={selection.onOpenPicker}
    >
      {selection.selectedCount > 0 ? `Select Packs (${selection.selectedCount})` : 'Select Packs'}
    </Button>
  );
}
