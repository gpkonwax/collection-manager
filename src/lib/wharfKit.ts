import { SessionKit, ChainDefinition, Session } from '@wharfkit/session';
import { WebRenderer } from '@wharfkit/web-renderer';
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor';
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet';
import { TransactPluginResourceProvider } from '@wharfkit/transact-plugin-resource-provider';

const webRenderer = new WebRenderer();

export const WAX_CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';

const waxChain = ChainDefinition.from({
  id: WAX_CHAIN_ID,
  url: 'https://wax.eosphere.io',
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

export function isAnchorSession(session: Session): boolean {
  const walletId = session.walletPlugin?.id || '';
  const walletName = (session.walletPlugin as any)?.metadata?.name || '';
  const isAnchor = walletId.toLowerCase().includes('anchor');
  const isCloudWallet = walletId.toLowerCase().includes('cloud') || 
                        walletId.toLowerCase().includes('wax-cloud') ||
                        walletName.toLowerCase().includes('cloud');
  return isAnchor && !isCloudWallet;
}

export function getTransactPlugins(session: Session) {
  if (isAnchorSession(session)) {
    return [
      new TransactPluginResourceProvider({
        endpoints: { [WAX_CHAIN_ID]: 'https://wax.greymass.com' },
        allowFees: false,
      }),
    ];
  }
  return [];
}

let isLoginInProgress = false;
let loginProtectionTimeout: ReturnType<typeof setTimeout> | null = null;

export function setLoginInProgress(value: boolean) {
  isLoginInProgress = value;
  if (loginProtectionTimeout) {
    clearTimeout(loginProtectionTimeout);
    loginProtectionTimeout = null;
  }
  if (value) {
    loginProtectionTimeout = setTimeout(() => {
      isLoginInProgress = false;
      loginProtectionTimeout = null;
    }, 60000);
  }
}

export function isLoginActive() {
  return isLoginInProgress;
}

export function closeWharfkitModals() {
  if (isLoginInProgress) return;

  const wharfkitEl = document.getElementById('wharfkit-web-ui');
  
  if (wharfkitEl?.shadowRoot) {
    const openDialogs = wharfkitEl.shadowRoot.querySelectorAll('dialog[open]');
    openDialogs.forEach((dialog) => {
      try {
        (dialog as HTMLDialogElement).close();
      } catch (e) {}
    });
  }
  
  const modalSelectors = [
    'wharf-modal', '.wharf-modal',
    '[class*="wharfkit"]:not(#wharfkit-web-ui)',
    '[class*="wharf-"]', 'wharfkit-modal', '.wharfkit-modal',
    '[data-wharfkit]', '.prompt-modal', '.prompt-overlay',
    '[class*="prompt-"]', '[class*="anchor-link"]', '.anchor-link-modal',
  ];
  
  modalSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el.id !== 'wharfkit-web-ui') el.remove();
      });
    } catch (e) {}
  });
  
  document.querySelectorAll('body > div').forEach(el => {
    const style = window.getComputedStyle(el);
    if (
      (style.position === 'fixed' || style.position === 'absolute') &&
      style.zIndex && parseInt(style.zIndex) > 9000 &&
      el.id !== 'root' &&
      el.id !== 'wharfkit-web-ui' &&
      !el.closest('[data-radix-portal]')
    ) {
      if (style.backgroundColor?.includes('rgba') || el.querySelector('[class*="modal"]')) {
        el.remove();
      }
    }
  });
  
  document.body.style.overflow = '';
  document.body.style.pointerEvents = '';
  document.body.style.position = '';
  document.body.classList.remove('overflow-hidden', 'modal-open');
  
  document.querySelectorAll('[data-radix-portal], [role="dialog"]').forEach(el => {
    (el as HTMLElement).style.pointerEvents = '';
  });
}

if (typeof window !== 'undefined') {
  const initObserver = () => {
    if (!document.body) {
      setTimeout(initObserver, 50);
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit')) {
              node.style.setProperty('z-index', '999999', 'important');
              node.style.setProperty('position', 'fixed', 'important');
              node.style.setProperty('pointer-events', 'auto', 'important');
              
              const styleShadowDOM = () => {
                if (node.shadowRoot) {
                  const dialog = node.shadowRoot.querySelector('dialog');
                  if (dialog) {
                    (dialog as HTMLElement).style.setProperty('z-index', '999999', 'important');
                    (dialog as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
                  }
                  node.shadowRoot.querySelectorAll('button, a, input, [role="button"]').forEach(el => {
                    (el as HTMLElement).style.setProperty('pointer-events', 'auto', 'important');
                  });
                }
              };
              
              styleShadowDOM();
              setTimeout(styleShadowDOM, 50);
              setTimeout(styleShadowDOM, 150);
              setTimeout(styleShadowDOM, 300);
              setTimeout(styleShadowDOM, 500);
            }
          }
        }
        
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement && (node.id === 'wharfkit-web-ui' || node.id?.startsWith('wharfkit'))) {
            document.querySelectorAll('[data-radix-portal]').forEach(el => {
              (el as HTMLElement).style.pointerEvents = '';
            });
          }
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initObserver, 100));
  } else {
    setTimeout(initObserver, 100);
  }
}

export { webRenderer };
