import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViewingBannerProps {
  viewedAccount: string;
  onClear: () => void;
}

export function ViewingBanner({ viewedAccount, onClear }: ViewingBannerProps) {
  return (
    <div className="sticky top-12 z-30 border-b border-cheese/30 bg-cheese/10 backdrop-blur-md">
      <div className="container flex items-center justify-between gap-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-cheese min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <span className="truncate">
            Viewing <strong className="font-semibold">{viewedAccount}</strong>
            <span className="ml-1 text-cheese/70">(read-only)</span>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="h-7 gap-1 border-cheese/40 text-cheese hover:bg-cheese/20 whitespace-nowrap"
        >
          <X className="h-3.5 w-3.5" />
          Return to my collection
        </Button>
      </div>
    </div>
  );
}
