import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  ChainMemo, MAX_PLAINTEXT_BYTES, MESSAGE_TOTAL_QUANTITY, MESSAGE_BURN_QUANTITY, MessagingKey,
  buildSendMessageActions, buildPublishKeyActions, decryptMemo, encryptMemo, fetchMessages, generateKey, loadContacts, loadKey,
  lookupPublishedKey, parseKeyFile, plaintextBytes, saveContact, saveKey, toPublicFile,
} from '@/lib/chainMessaging';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account: string;
  permission: unknown;
  execute: (actions: any[], opts?: { successTitle?: string }) => Promise<{ success: boolean }>;
}

const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function ChainMessagingDialog({ open, onOpenChange, account, permission, execute }: Props) {
  const { toast } = useToast();
  const [key, setKey] = useState<MessagingKey | null>(() => loadKey(account));
  const [contacts, setContacts] = useState<Record<string, string>>(() => loadContacts(account));
  const [active, setActive] = useState<string | null>(null);
  const [newContact, setNewContact] = useState('');
  const [memos, setMemos] = useState<ChainMemo[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setKey(loadKey(account)); setContacts(loadContacts(account)); setActive(null); }, [account]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setMemos(await fetchMessages(account)); }
    catch { toast({ title: 'Could not load messages', description: 'History servers did not answer. Try again shortly.', variant: 'destructive' }); }
    finally { setLoading(false); }
  }, [account, toast]);

  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const partners = useMemo(() => {
    const s = new Set(Object.keys(contacts));
    memos.forEach((m) => s.add(m.from === account ? m.to : m.from));
    return [...s].sort();
  }, [contacts, memos, account]);

  const thread = useMemo(() => {
    if (!active) return [];
    const pub = contacts[active];
    return memos
      .filter((m) => (m.from === account && m.to === active) || (m.from === active && m.to === account))
      .map((m) => ({ ...m, text: pub && key ? decryptMemo(m.memo, pub, key.secretKey) : null }))
      .sort((a, b) => a.time - b.time);
  }, [active, memos, contacts, key, account]);

  const makeKey = () => {
    if (key && !confirm('Replace your existing key? Messages encrypted with the old key can no longer be read unless you kept its file.')) return;
    const k = generateKey(account);
    saveKey(k); setKey(k);
    download(`${account}-gpk-msg-key-PRIVATE.json`, k);
    toast({ title: 'Messaging key created', description: 'A private backup file was downloaded. Keep it safe and never share it.' });
  };

  const addContact = async () => {
    const name = newContact.trim().toLowerCase();
    if (!ACCOUNT_RE.test(name) || name === account) { toast({ title: 'Enter a valid WAX account', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const pub = await lookupPublishedKey(name);
      if (!pub) { toast({ title: `${name} has not published a key`, description: 'Ask them for their public key file and load it here.' }); return; }
      saveContact(account, name, pub); setContacts(loadContacts(account)); setActive(name); setNewContact('');
      toast({ title: `Found ${name}'s key` });
    } catch { toast({ title: 'Key lookup failed', variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const onFile = async (f: File) => {
    try {
      const parsed = parseKeyFile(JSON.parse(await f.text()));
      if (!parsed) throw new Error();
      if (parsed.type === 'gpk-msg-key') {
        if (parsed.account !== account) { toast({ title: `That private key belongs to ${parsed.account}`, variant: 'destructive' }); return; }
        saveKey(parsed); setKey(parsed); toast({ title: 'Your messaging key was loaded' });
      } else {
        if (parsed.account === account) { toast({ title: 'That is your own public key' }); return; }
        saveContact(account, parsed.account, parsed.publicKey); setContacts(loadContacts(account)); setActive(parsed.account);
        toast({ title: `Added ${parsed.account}` });
      }
    } catch { toast({ title: 'Not a messaging key file', variant: 'destructive' }); }
  };

  const publish = async () => {
    if (!key) return;
    setBusy(true);
    try {
      await execute(buildPublishKeyActions(account, key.publicKey, [permission]), { successTitle: 'Public key published' });
    } catch (e) { toast({ title: 'Could not publish', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!key || !active || !contacts[active]) return;
    setBusy(true);
    try {
      const memo = encryptMemo(text, contacts[active], key.secretKey);
      const r = await execute(buildSendMessageActions(account, active, memo, [permission]), { successTitle: 'Message sent' });
      if (r.success) { setText(''); setTimeout(refresh, 3000); }
    } catch (e) { toast({ title: 'Could not send', description: (e as Error).message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const bytes = plaintextBytes(text);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Messages (preview)</DialogTitle>
          <DialogDescription>Encrypted notes sent with CHEESE. Anyone can see that a message was sent, only you and the other person can read it.</DialogDescription>
        </DialogHeader>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        {!key ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full space-y-5 text-center">
              <div className="space-y-2">
                <p className="text-lg font-semibold">Step 1: Unlock your messages</p>
                <p className="text-sm text-muted-foreground">
                  Messages for <span className="font-semibold text-foreground">{account}</span> are encrypted. To read or send anything, load your own private key file first.
                  It stays on this device and is never sent anywhere.
                </p>
              </div>
              <div className="rounded-lg border border-primary p-4 space-y-2 text-left">
                <p className="font-semibold text-sm">I already have a key</p>
                <p className="text-xs text-muted-foreground">Look in your Downloads for <span className="font-mono break-all">{account}-gpk-msg-key-PRIVATE.json</span>.</p>
                <Button className="w-full" onClick={() => fileRef.current?.click()}>Load my private key</Button>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2 text-left">
                <p className="font-semibold text-sm">I'm new here</p>
                <p className="text-xs text-muted-foreground">Creates a new key and downloads a private backup file. Keep it safe. If you already made a key before, a new one cannot read your old messages.</p>
                <Button className="w-full" variant="outline" onClick={makeKey}>Create a new key</Button>
              </div>
            </div>
          </div>
        ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="min-w-[180px] justify-between">
                  {active ?? 'Conversations'} <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto min-w-[220px]">
                <DropdownMenuLabel>Conversations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {partners.map((p) => (
                  <DropdownMenuItem key={p} onSelect={() => setActive(p)} className={active === p ? 'font-semibold text-primary' : ''}>
                    {p}{!contacts[p] && <span className="ml-1 text-xs opacity-70">(no key)</span>}
                  </DropdownMenuItem>
                ))}
                {!partners.length && <DropdownMenuItem disabled>{loading ? 'Loading…' : 'No conversations yet.'}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex gap-2">
              <Input className="h-9 w-40" value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="account.wam" onKeyDown={(e) => e.key === 'Enter' && addContact()} />
              <Button size="sm" disabled={busy} onClick={addContact}>Add</Button>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" disabled={loading} onClick={refresh}>{loading ? 'Loading…' : 'Refresh'}</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">Your key <span className="ml-1 text-xs text-primary">✓</span> <ChevronDown className="h-4 w-4 opacity-70" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel className="space-y-1">
                    <span className="block text-xs text-primary">✓ loaded for {account}</span>
                    <span className="block text-[11px] font-normal text-muted-foreground break-all">{key.publicKey}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => download(`${account}-gpk-msg-public.json`, toPublicFile(key))}>Share public key</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => download(`${account}-gpk-msg-key-PRIVATE.json`, key)}>Back up private key</DropdownMenuItem>
                  <DropdownMenuItem disabled={busy} onSelect={publish}>Publish to chain ({MESSAGE_BURN_QUANTITY} to eosio.null)</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => fileRef.current?.click()}>Load file (your key or a contact's)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={makeKey}>New key</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <section className="flex flex-col flex-1 min-h-0">
            {!active ? <p className="text-sm text-muted-foreground m-auto">Pick or add a contact.</p> : (
              <>
                <ol className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {thread.map((m) => (
                    <li key={m.txId + m.memo} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.from === account ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="text-[10px] font-semibold tracking-wide opacity-80">{m.from === account ? `you · ${account}` : m.from}</p>
                      <p className="whitespace-pre-wrap break-words">{m.text ?? <em className="opacity-70">{contacts[active] ? "Can't read this one: it was sent with a different key (an older key of yours or theirs)." : `Can't read yet: load ${active}'s public key first.`}</em>}</p>
                      <p className="text-[10px] opacity-70 mt-1">{new Date(m.time).toLocaleString()} · {m.quantity}</p>
                    </li>
                  ))}
                  {!thread.length && <li className="text-sm text-muted-foreground">No messages with {active} yet.</li>}
                </ol>
                {!contacts[active] ? <p className="text-sm text-muted-foreground">You need {active}'s public key. Add them by name or load their public file.</p>
                  : (
                    <div className="space-y-2 pt-3">
                      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`Message ${active}`} />
                      <div className="flex items-center gap-2 text-xs">
                        <span className={bytes > MAX_PLAINTEXT_BYTES ? 'text-destructive' : 'text-muted-foreground'}>{bytes}/{MAX_PLAINTEXT_BYTES}</span>
                        <span className="ml-auto text-muted-foreground">{MESSAGE_TOTAL_QUANTITY} per message</span>
                        <Button size="sm" disabled={busy || !text.trim() || bytes > MAX_PLAINTEXT_BYTES} onClick={send}>Send</Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">0.0010 CHEESE to {active} with your encrypted message + 0.0100 CHEESE to eosio.null, together in one transaction.</p>
                    </div>
                  )}
              </>
            )}
          </section>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
