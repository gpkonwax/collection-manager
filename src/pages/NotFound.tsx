import { useState } from "react";
import { SelectionCheckboxes } from "@/components/simpleassets/SelectionCheckboxes";

const DEMO_IDS = Array.from({ length: 24 }, (_, i) => `demo-${i + 1}`);

const NotFound = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-3xl">
        <div className="mb-4 text-sm text-muted-foreground">Selected: {selected.size}</div>
        <SelectionCheckboxes visibleIds={DEMO_IDS} selectedIds={selected} onSelectionChange={setSelected} />
        <div className="mt-4 flex flex-wrap gap-2">
          {DEMO_IDS.map(id => (
            <span key={id} className={`rounded px-2 py-1 text-xs ${selected.has(id) ? 'bg-cheese text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{id}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
