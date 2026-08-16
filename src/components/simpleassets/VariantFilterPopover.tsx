import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { VariantOption, getVariantDescription, getVariantsForCategory, nextVariantFilter, variantFilterLabel } from '@/lib/gpkCategories';
import { cn } from '@/lib/utils';

interface VariantFilterPopoverProps {
  category: string;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  size?: 'sm' | 'default';
  /** Optional explicit option list (e.g. derived from the wallet's assets). */
  variants?: VariantOption[];
}

export function VariantFilterPopover({ category, value, onChange, className, size = 'sm', variants: variantsProp }: VariantFilterPopoverProps) {
  const variants = variantsProp ?? getVariantsForCategory(category);
  if (variants.length < 2) return null;

  const isAll = value.includes('all');
  const toggleVariant = (val: string) => onChange(nextVariantFilter(value, val, variants));
  const label = variantFilterLabel(value, variants);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={cn(
            'justify-between border-cheese/50 text-cheese hover:bg-cheese/10 theme-bright-border theme-bright-text theme-bright-hover theme-bright-fill',
            className,
          )}
        >
          {label}
          <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2 max-h-[300px] overflow-y-auto" align="start">
        <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm">
          <Checkbox checked={isAll} onCheckedChange={() => toggleVariant('all')} />
          All Variants
        </label>
        <div className="my-1 h-px bg-border" />
        {variants.map(v => {
          const description = getVariantDescription(category, v.value);
          const row = (
            <label className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm">
              <Checkbox checked={isAll || value.includes(v.value)} onCheckedChange={() => toggleVariant(v.value)} />
              {v.label}
            </label>
          );
          if (!description) return <div key={v.value}>{row}</div>;
          return (
            <HoverCard key={v.value} openDelay={150} closeDelay={80}>
              <HoverCardTrigger asChild>
                <div>{row}</div>
              </HoverCardTrigger>
              <HoverCardContent side="right" align="start" className="w-64 bg-card border-border">
                <p className="font-bold text-foreground theme-bright-text">{v.label}</p>
                <p className="mt-1 text-xs text-muted-foreground theme-bright-text-muted">{description}</p>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
