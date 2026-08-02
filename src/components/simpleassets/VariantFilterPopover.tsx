import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getVariantsForCategory, nextVariantFilter, variantFilterLabel } from '@/lib/gpkCategories';
import { cn } from '@/lib/utils';

interface VariantFilterPopoverProps {
  category: string;
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
  size?: 'sm' | 'default';
}

export function VariantFilterPopover({ category, value, onChange, className, size = 'sm' }: VariantFilterPopoverProps) {
  const variants = getVariantsForCategory(category);
  if (variants.length === 0) return null;

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
        {variants.map(v => (
          <label key={v.value} className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm">
            <Checkbox checked={isAll || value.includes(v.value)} onCheckedChange={() => toggleVariant(v.value)} />
            {v.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}
