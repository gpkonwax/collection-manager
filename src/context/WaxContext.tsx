import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session, SerializedSession } from '@wharfkit/session';
import { sessionKit, closeWharfkitModals, setLoginInProgress, getTransactPlugins } from '@/lib/wharfKit';
import { CHEESE_CONFIG, WAX_CHAIN } from '@/lib/waxConfig';
import { useToast } from '@/hooks/use-toast';

interface WaxContextType {
  session: Session | null;
  isConnected: boolean;
  isLoading: boolean;
  accountName: string | null;
  cheeseBalance: number;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  allSessions: SerializedSession[];
  switchAccount: (session: SerializedSession) => Promise<void>;
  addAccount: () => Promise<void>;
  removeAccount: (session: SerializedSession) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const WaxContext = createContext<WaxContextType | undefined>(undefined);

export function WaxProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cheeseBalance, setCheeseBalance] = useState(0);
  const [allSessions, setAllSessions] = useState<SerializedSession[]>([]);
  const { toast } = useToast();

  const accountName = session?.actor?.toString() || null;
  const isConnected = !!session;

  const refreshBalance = useCallback(async () => {
    if (!session) { setCheeseBalance(0); return; }
    const endpoints = WAX_CHAIN.rpcUrls || [WAX_CHAIN.url];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}/v1/chain/get_currency_balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: CHEESE_CONFIG.tokenContract,
            account: session.actor.toString(),
            symbol: CHEESE_CONFIG.tokenSymbol,
          }),
        });
        if (!response.ok) continue;
        const balances = await response.json();
        if (balances && balances.length > 0) {
          setCheeseBalance(parseFloat(balances[0].split(' ')[0]));
          return;
        } else {
          setCheeseBalance(0);
          return;
        }
      } catch (error) {
        console.error(`Failed to fetch CHEESE balance from ${endpoint}:`, error);
      }
    }
    setCheeseBalance(0);
  }, [session]);

  const refreshSessions = useCallback(async () => {
    try {
      const sessions = await sessionKit.getSessions();
      setAllSessions(sessions);
    } catch (error) {
      console.error('Failed to get sessions:', error);
      setAllSessions([]);
    }
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const restored = await sessionKit.restore();
        if (restored) setSession(restored);
        await refreshSessions();
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    };
    restoreSession();
  }, [refreshSessions]);

  useEffect(() => { refreshBalance(); }, [session, refreshBalance]);

  useEffect(() => {
    if (!session) return;
    const intervalId = setInterval(() => refreshBalance(), 30000);
    return () => clearInterval(intervalId);
  }, [session, refreshBalance]);

  const login = async () => {
    setIsLoading(true);
    setLoginInProgress(true);
    try {
      const response = await sessionKit.login();
      setSession(response.session);
      await refreshSessions();
      toast({ title: 'Wallet Connected', description: `Connected as ${response.session.actor}` });
    } catch (error) {
      console.error('Login failed:', error);
      toast({ title: 'Login Failed', description: error instanceof Error ? error.message : 'Failed to connect wallet', variant: 'destructive' });
    } finally {
      setLoginInProgress(false);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (session) {
      setSession(null);
      setCheeseBalance(0);
      toast({ title: 'Wallet Disconnected', description: 'Your account is saved for quick switching.' });
    }
  };

  const switchAccount = async (serializedSession: SerializedSession) => {
    try {
      setIsLoading(true);
      const restored = await sessionKit.restore(serializedSession);
      if (restored) {
        setSession(restored);
        toast({ title: 'Account Switched', description: `Now using ${restored.actor}` });
      }
    } catch (error) {
      console.error('Switch account failed:', error);
      toast({ title: 'Switch Failed', description: error instanceof Error ? error.message : 'Failed to switch account', variant: 'destructive' });
      await refreshSessions();
    } finally {
      setIsLoading(false);
    }
  };

  const addAccount = async () => {
    setIsLoading(true);
    setLoginInProgress(true);
    try {
      const response = await sessionKit.login();
      setSession(response.session);
      await refreshSessions();
      toast({ title: 'Account Added', description: `Added and switched to ${response.session.actor}` });
    } catch (error) {
      console.error('Add account failed:', error);
      toast({ title: 'Add Account Failed', description: error instanceof Error ? error.message : 'Failed to add account', variant: 'destructive' });
    } finally {
      setLoginInProgress(false);
      setIsLoading(false);
    }
  };

  const removeAccount = async (serializedSession: SerializedSession) => {
    try {
      const sessionToRemove = await sessionKit.restore(serializedSession);
      if (sessionToRemove) {
        await sessionKit.logout(sessionToRemove);
        if (session?.actor?.toString() === serializedSession.actor) {
          setSession(null);
          setCheeseBalance(0);
        }
        await refreshSessions();
        toast({ title: 'Account Removed', description: `Removed ${serializedSession.actor}` });
      }
    } catch (error) {
      console.error('Remove account failed:', error);
      toast({ title: 'Remove Failed', description: error instanceof Error ? error.message : 'Failed to remove account', variant: 'destructive' });
    }
  };

  return (
    <WaxContext.Provider value={{
      session, isConnected, isLoading, accountName, cheeseBalance,
      login, logout, refreshBalance,
      allSessions, switchAccount, addAccount, removeAccount, refreshSessions,
    }}>
      {children}
    </WaxContext.Provider>
  );
}

export function useWax() {
  const context = useContext(WaxContext);
  if (!context) throw new Error('useWax must be used within a WaxProvider');
  return context;
}
