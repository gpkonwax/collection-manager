import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ChainMemo, MAX_PLAINTEXT_BYTES, MESSAGE_TOKENS, MessageToken, MessagingKey, KEY_PUBLISH_TO,
  decryptMemo, encryptMemo, fetchMessages, generateKey, keyMemo, loadContacts, loadKey,
  lookupPublishedKey, parseKeyFile, plaintextBytes, saveContact, saveKey, toPublicFile, transferAction,
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
  const [token, setToken] = useState<MessageToken>('WAX');
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
    await execute([transferAction(token, account, KEY_PUBLISH_TO, keyMemo(key.publicKey), [permission])], { successTitle: 'Public key published' });
    setBusy(false);
  };

  const send = async () => {
    if (!key || !active || !contacts[active]) return;
    setBusy(true);
    try {
      const memo = encryptMemo(text, contacts[active], key.secretKey);
      const r = await execute([transferAction(token, account, active, memo, [permission])], { successTitle: 'Message sent' });
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
          <DialogDescription>Encrypted notes sent as tiny WAX or CHEESE transfers. Anyone can see that a message was sent, only you and the other person can read it.</DialogDescription>
        </DialogHeader>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <div className="grid grid-cols-[240px_1fr] gap-4 flex-1 min-h-0">
          <aside className="flex flex-col gap-3 min-h-0 border-r border-border pr-4">
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Your key</p>
              {key ? <p className="text-xs text-muted-foreground break-all">{key.publicKey}</p> : <p className="text-xs text-muted-foreground">No key yet.</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={makeKey}>{key ? 'New key' : 'Create key'}</Button>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Load file</Button>
                {key && <Button size="sm" variant="outline" onClick={() => download(`${account}-gpk-msg-public.json`, toPublicFile(key))}>Share public</Button>}
                {key && <Button size="sm" variant="outline" onClick={() => download(`${account}-gpk-msg-key-PRIVATE.json`, key)}>Back up private</Button>}
                {key && <Button size="sm" variant="secondary" disabled={busy} onClick={publish}>Publish to chain</Button>}
              </div>
            </div>
            <div className="flex gap-2">
              <Input value={newContact} onChange={(e) => setNewContact(e.target.value)} placeholder="account.wam" onKeyDown={(e) => e.key === 'Enter' && addContact()} />
              <Button size="sm" disabled={busy} onClick={addContact}>Add</Button>
            </div>
            <ul className="flex-1 overflow-y-auto space-y-1">
              {partners.map((p) => (
                <li key={p}>
                  <button onClick={() => setActive(p)} className={`w-full text-left px-2 py-1 rounded text-sm ${active === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                    {p}{!contacts[p] && <span className="ml-1 text-xs opacity-70">(no key)</span>}
                  </button>
                </li>
              ))}
              {!partners.length && <li className="text-xs text-muted-foreground">{loading ? 'Loading…' : 'No conversations yet.'}</li>}
            </ul>
            <Button size="sm" variant="ghost" disabled={loading} onClick={refresh}>{loading ? 'Loading…' : 'Refresh'}</Button>
          </aside>
          <section className="flex flex-col min-h-0">
            {!active ? <p className="text-sm text-muted-foreground m-auto">Pick or add a contact.</p> : (
              <>
                <ol className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {thread.map((m) => (
                    <li key={m.txId + m.memo} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.from === account ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="whitespace-pre-wrap break-words">{m.text ?? <em className="opacity-70">Can't decrypt (missing or different key)</em>}</p>
                      <p className="text-[10px] opacity-70 mt-1">{new Date(m.time).toLocaleString()} · {m.quantity}</p>
                    </li>
                  ))}
                  {!thread.length && <li className="text-sm text-muted-foreground">No messages with {active} yet.</li>}
                </ol>
                {!key ? <p className="text-sm text-muted-foreground">Create or load your key to send.</p>
                  : !contacts[active] ? <p className="text-sm text-muted-foreground">You need {active}'s public key. Add them by name or load their public file.</p>
                  : (
                    <div className="space-y-2 pt-3">
                      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={`Message ${active}`} />
                      <div className="flex items-center gap-2 text-xs">
                        <span className={bytes > MAX_PLAINTEXT_BYTES ? 'text-destructive' : 'text-muted-foreground'}>{bytes}/{MAX_PLAINTEXT_BYTES}</span>
                        <div className="ml-auto flex gap-1">
                          {(Object.keys(MESSAGE_TOKENS) as MessageToken[]).map((t) => (
                            <Button key={t} size="sm" variant={token === t ? 'default' : 'outline'} onClick={() => setToken(t)}>{MESSAGE_TOKENS[t].quantity}</Button>
                          ))}
                        </div>
                        <Button size="sm" disabled={busy || !text.trim() || bytes > MAX_PLAINTEXT_BYTES} onClick={send}>Send</Button>
                      </div>
                    </div>
                  )}
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
