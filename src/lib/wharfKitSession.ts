// Heavy wallet-kit pieces. Loaded on demand through loadWharfKit() in
// wharfKit.ts so visitors who never connect a wallet don't download them.
import { SessionKit, ChainDefinition, Session } from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';
import { TransactPluginResourceProvider } from '@wharfkit/transact-plugin-resource-provider';
import { WAX_CHAIN_ID } from '@/lib/wharfKitConstants';

export const webRenderer = new WebRenderer();

const waxChain = ChainDefinition.from({
  id: WAX_CHAIN_ID,
  url: 'https://wax.api.eosnation.io',
});

export const sessionKit = new SessionKit({
  appName: 'GPK Topps Viewer',
  chains: [waxChain],
  ui: webRenderer,
  walletPlugins: [
    new WalletPluginAnchor(),
    new WalletPluginCloudWallet(),
  ],
});

export function buildAnchorTransactPlugins(_session: Session) {
  return [
    new TransactPluginResourceProvider({
      endpoints: { [WAX_CHAIN_ID]: 'https://wax.greymass.com' },
      allowFees: false,
    }),
  ];
}
