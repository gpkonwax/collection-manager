import type { ReactNode } from 'react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { getPackSpec } from '@/lib/packSpecs';

interface PackInfoPopoverProps {
  /** Pack symbol (SA) or template id (AA) used to look up the spec sheet. */
  specKey?: string;
  children: ReactNode;
}

/** Wraps a pack tile with a hover popup showing the original Topps spec sheet. */
export function PackInfoPopover({ specKey, children }: PackInfoPopoverProps) {
  const spec = getPackSpec(specKey);
  if (!spec) return <>{children}</>;

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div>{children}</div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-72 bg-card border-border">
        <p className="font-bold text-foreground theme-bright-text">{spec.packType}</p>
        <p className="text-sm text-primary">(Originally Priced {spec.price})</p>
        <dl className="mt-2 space-y-1 text-xs">
          {[
            ['Pack', spec.packType],
            ['Series', spec.series],
            ['Release Date', spec.releaseDate],
            ['Contains', spec.contains],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-24 shrink-0 font-semibold text-foreground theme-bright-text">{label}:</dt>
              <dd className="text-muted-foreground theme-bright-text-muted">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs font-semibold text-foreground theme-bright-text">Includes:</p>
        <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs text-muted-foreground theme-bright-text-muted">
          {spec.includes.map(line => <li key={line}>{line}</li>)}
        </ul>
      </HoverCardContent>
    </HoverCard>
  );
}
