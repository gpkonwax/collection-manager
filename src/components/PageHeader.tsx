import type { SerializedSession } from '@wharfkit/session';
import { Wallet, ChevronDown, Check, Sun, Moon, Info, RefreshCw, X, ArrowLeftRight, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BackupPanel } from '@/components/BackupPanel';
import { ImageSourceIndicator } from '@/components/ImageSourceIndicator';
import { ViewWalletControl } from '@/components/ViewWalletControl';
import { FavoriteAccountButton } from '@/components/FavoriteAccountButton';

const HEADER_BTN_CLASS = 'whitespace-nowrap h-9 px-4 bg-cheese hover:bg-cheese/90 text-cheese-foreground font-semibold theme-bright-fill theme-bright-text';

// Sticky top bar: backup, recovery, theme, info, wallet menu, trades, pack
// history and view-wallet. Moved out of pages/Index.tsx unchanged.
export function PageHeader(props: {
  isConnected: boolean;
  accountName: string | null;
  isViewing: boolean;
  handleCollectUnclaimed: () => void;
  isCollecting: boolean;
  handleShowReceivedCards: () => void;
  hasReceivedCardsToShow: boolean;
  receivedCardsCount: number;
  theme: string;
  toggleTheme: () => void;
  onShowInfo: () => void;
  waxBalance: number;
  allSessions: SerializedSession[];
  switchAccount: (s: SerializedSession) => void;
  removeAccount: (s: SerializedSession) => void;
  addAccount: () => void;
  logout: () => void;
  login: () => void;
  onShowTrades: () => void;
  tradesBadgeTitle: string | undefined;
  tradesUnread: number;
  onShowPackHistory: () => void;
  viewedAccount: string | null;
  handleViewWallet: (account: string) => void;
  handleClearViewing: () => void;
  viewWalletSignal: number;
  viewWalletPrefill: string | null;
}) {
  const {
    isConnected, accountName, isViewing, handleCollectUnclaimed, isCollecting, handleShowReceivedCards, hasReceivedCardsToShow, receivedCardsCount, theme, toggleTheme, onShowInfo, waxBalance, allSessions, switchAccount, removeAccount, addAccount, logout, login, onShowTrades, tradesBadgeTitle, tradesUnread, onShowPackHistory, viewedAccount, handleViewWallet, handleClearViewing, viewWalletSignal, viewWalletPrefill,
  } = props;
  return (
    <div className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/50 theme-bright-header">
      <div className="container flex flex-col">
        {/* Line 1: backup/recovery (left) + status/theme/account (right) */}
        <div className="flex min-h-12 py-1 items-center justify-center gap-2 flex-wrap">
          {/* Left: offline backup trigger + recovery buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <BackupPanel />
            {isConnected && accountName && !isViewing && (
              <>
                <Button
                  onClick={handleCollectUnclaimed}
                  disabled={isCollecting}
                  variant="default"
                  size="sm"
                  className={HEADER_BTN_CLASS}
                  title="Scan pendingnft.a and claim any cards that were minted but never delivered."
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${isCollecting ? 'animate-spin' : ''}`} />
                  {isCollecting ? 'Collecting...' : 'Recover Stuck Cards'}
                </Button>
                <Button
                  type="button"
                  onClick={handleShowReceivedCards}
                  disabled={!hasReceivedCardsToShow}
                  variant="default"
                  size="sm"
                  className={`${HEADER_BTN_CLASS} disabled:opacity-60`}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Show Received Cards{hasReceivedCardsToShow ? ` (${receivedCardsCount})` : ''}
                </Button>
              </>
            )}
          </div>

          {/* Right: Image source status + Info button + wallet controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ImageSourceIndicator />
            <Button
              variant="default"
              size="sm"
              className={`${HEADER_BTN_CLASS} px-2.5`}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Bright skin' : 'Switch to Dark skin'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className={`${HEADER_BTN_CLASS} px-2.5`}
              onClick={onShowInfo}
            >
              <Info className="h-4 w-4" />
              <span className="sr-only">GPK Collection Manager Info</span>
            </Button>

            {isConnected && accountName ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className={`${HEADER_BTN_CLASS} gap-2`}>
                    <Wallet className="h-4 w-4" />
                    <span className="max-w-[120px] truncate text-sm text-white">{accountName}</span>
                    <span className="ml-1 font-semibold text-sm">
                      {waxBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} WAX
                    </span>
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {allSessions.length > 0 && (
                    <>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <span className="mr-2 text-sm leading-none">👥</span>
                          Switch Account
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuSubContent className="w-56">
                            <DropdownMenuItem disabled className="opacity-100">
                              <Check className="mr-2 h-4 w-4 text-cheese" />
                              <span className="font-medium">{accountName}</span>
                              <span className="ml-auto text-xs text-muted-foreground">(active)</span>
                            </DropdownMenuItem>
                            {allSessions.filter(s => String(s.actor) !== accountName).map((s) => (
                              <DropdownMenuItem
                                key={`${String(s.actor)}-${s.permission}`}
                                className="cursor-pointer group"
                                onClick={() => switchAccount(s)}
                              >
                                <div className="w-4 mr-2" />
                                <span>{String(s.actor)}</span>
                                <button
                                  className="ml-auto opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
                                  onClick={(e) => { e.stopPropagation(); removeAccount(s); }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={addAccount} className="cursor-pointer">
                              <span className="mr-2 text-sm leading-none">➕</span>
                              Add Account
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={logout} className="cursor-pointer">
                    <span className="mr-2 text-sm leading-none">🔌</span>
                    Disconnect
                  </DropdownMenuItem>
                </DropdownMenuContent>

              </DropdownMenu>
            ) : (
              <Button onClick={login} size="sm" className={HEADER_BTN_CLASS}>
                <Wallet className="h-4 w-4 mr-1.5" />
                Connect Wallet
              </Button>
            )}
          </div>
        </div>

        {/* Line 2: trades + pack history + view wallet (centred) */}
        {isConnected && accountName && (
          <div className="flex items-center justify-center gap-2 py-1.5 border-t border-border/30">
            {!isViewing && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className={`relative ${HEADER_BTN_CLASS}`}
                  onClick={onShowTrades}
                  title={tradesBadgeTitle}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-1.5" />
                  Trades
                  {tradesUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center leading-none border-2 border-background">
                      {tradesUnread > 9 ? '9+' : tradesUnread}
                    </span>
                  )}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className={HEADER_BTN_CLASS}
                  onClick={onShowPackHistory}
                  title="Every pack you've opened — with a replay button"
                >
                  <History className="h-4 w-4 mr-1.5" />
                  Pack History
                </Button>
              </>
            )}
            <ViewWalletControl
              currentAccount={accountName}
              viewedAccount={viewedAccount}
              onView={handleViewWallet}
              onClear={handleClearViewing}
              openSignal={viewWalletSignal}
              openAccount={viewWalletPrefill}
            />
            {isViewing && viewedAccount && (
              <FavoriteAccountButton account={viewedAccount} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
