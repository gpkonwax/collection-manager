import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { ShieldAlert } from 'lucide-react';

export function useExternalLinkWarning() {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const requestNavigation = useCallback((url: string) => {
    setPendingUrl(url);
  }, []);

  const confirm = useCallback(() => {
    if (pendingUrl) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    }
    setPendingUrl(null);
  }, [pendingUrl]);

  const cancel = useCallback(() => {
    setPendingUrl(null);
  }, []);

  return { pendingUrl, requestNavigation, confirm, cancel };
}

interface ExternalLinkWarningDialogProps {
  url: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExternalLinkWarningDialog({ url, onConfirm, onCancel }: ExternalLinkWarningDialogProps) {
  return (
    <AlertDialog open={!!url} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>You are leaving this site</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              You are about to visit an external website. This link is not controlled by GPK Pack Opener. Please verify the URL before continuing.
            </span>
            <span className="block break-all rounded bg-muted p-2 text-xs font-mono text-foreground">
              {url}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
