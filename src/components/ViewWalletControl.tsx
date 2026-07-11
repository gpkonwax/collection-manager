import { useState, useCallback, KeyboardEvent } from 'react';
import { Eye, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WAX_CHAIN } from '@/lib/waxConfig';

interface ViewWalletControlProps {
  currentAccount: string | null;
  viewedAccount: string | null;
  onView: (account: string) => void;
  onClear: () => void;
}

// WAX account naming rules: a-z, 1-5, and '.', length 1..12, no leading/trailing/double dots.
const WAX_NAME_RE = /^[a-z1-5]+(\.[a-z1-5]+)*$/;

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function validateWaxName(name: string): string | null {
  if (!name) return 'Enter a WAX account name';
  if (name.length > 12) return 'Max 12 characters';
  if (!WAX_NAME_RE.test(name)) return 'Only a–z, 1–5 and single dots';
  return null;
}

async function accountExists(name: string): Promise<boolean> {
  for (const url of WAX_CHAIN.rpcUrls.slice(0, 3)) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/v1/chain/get_account`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ account_name: name }),
        signal: controller.signal,
      });
      clearTimeout(t);
      if (res.status === 200) return true;
      if (res.status === 500) {
        // eosio typically returns 500 with error body for unknown account
        try {
          const body = await res.json();
          const what = body?.error?.what || '';
          if (typeof what === 'string' && /unknown/i.test(what)) return false;
        } catch { /* ignore */ }
        return false;
      }
      // other statuses: try next endpoint
    } catch { /* try next */ }
  }
  // If all endpoints failed, be permissive — let the fetch hooks report empty later.
  return true;
}

export function ViewWalletControl({ currentAccount, viewedAccount, onView, onClear }: ViewWalletControlProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = useCallback(async () => {
    const name = normalize(value);
    const validation = validateWaxName(name);
    if (validation) { setError(validation); return; }
    if (currentAccount && name === currentAccount) {
      onClear();
      setOpen(false);
      setValue('');
      setError(null);
      return;
    }
    setError(null);
    setChecking(true);
    try {
      const exists = await accountExists(name);
      if (!exists) { setError('Account not found on WAX'); return; }
      onView(name);
      setOpen(false);
      setValue('');
    } finally {
      setChecking(false);
    }
  }, [value, currentAccount, onView, onClear]);

  const onKey = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  }, [submit]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); } }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1.5 border-cheese/30 hover:border-cheese hover:bg-cheese/10 ${viewedAccount ? 'border-cheese bg-cheese/10 text-cheese' : 'text-cheese'}`}
          title={viewedAccount ? `Viewing ${viewedAccount}` : 'View another wallet (read-only)'}
        >
          <Eye className="h-4 w-4" />
          <span className="text-sm hidden sm:inline">
            {viewedAccount ? `Viewing ${viewedAccount}` : 'View Wallet'}
          </span>
          {viewedAccount && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onClear(); } }}
              className="ml-1 inline-flex items-center justify-center rounded hover:bg-cheese/20 p-0.5 cursor-pointer"
              aria-label="Stop viewing this wallet"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-2">
        <div>
          <p className="text-sm font-medium text-cheese">View another wallet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse any WAX account's GPK collection. Read-only — no actions available.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="e.g. someuser.wam"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            onKeyDown={onKey}
            maxLength={12}
            className="h-8 text-sm border-cheese/40"
          />
          <Button
            size="sm"
            className="h-8 bg-cheese hover:bg-cheese/90 text-cheese-foreground"
            onClick={submit}
            disabled={checking}
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'View'}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {viewedAccount && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-cheese hover:bg-cheese/10"
            onClick={() => { onClear(); setOpen(false); }}
          >
            Return to my collection
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
