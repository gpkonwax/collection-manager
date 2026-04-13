export const WAX_CHAIN = {
  id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  url: 'https://wax.api.eosnation.io',
  rpcUrls: [
    'https://wax.api.eosnation.io',
    'https://api.waxsweden.org',
    'https://wax.eosphere.io',
    'https://api.hivebp.io',
    'https://wax.cryptolions.io',
    'https://wax.eosdac.io',
    'https://wax.eu.eosamsterdam.net',
    'https://api.wax.alohaeos.com',
    'https://wax.pink.gg',
  ],
};

export const CHEESE_CONFIG = {
  collectionName: 'cheesenftwax',
  tokenContract: 'cheeseburger',
  paymentWallet: 'cheesenftwax',
  tokenSymbol: 'CHEESE',
  tokenPrecision: 4,
};

export const NFTHIVE_CONFIG = {
  dropContract: 'nfthivedrops',
  boostContract: 'nft.hive',
  apiUrl: 'https://wax-api.hivebp.io',
};

export const ATOMIC_API = {
  baseUrls: [
    'https://wax-aa.eu.eosamsterdam.net',
    'https://wax.api.atomicassets.io',
    'https://atomic.wax.eosrio.io',
    'https://aa.wax.blacklusion.io',
    'https://wax-aa.eosdac.io',
    'https://aa-wax-public1.neftyblocks.com',
    'https://wax-atomic.alcor.exchange',
    'https://wax-atomic-api.eosphere.io',
    'https://atomic.hivebp.io',
  ],
  baseUrl: 'https://wax.api.atomicassets.io',
  paths: {
    sales: '/atomicmarket/v1/sales',
    templates: '/atomicassets/v1/templates',
    assets: '/atomicassets/v1/assets',
    collections: '/atomicassets/v1/collections',
    drops: '/atomicmarket/v2/drops',
  },
  endpoints: {
    sales: '/atomicmarket/v1/sales',
    templates: '/atomicassets/v1/templates',
    assets: '/atomicassets/v1/assets',
    collections: '/atomicassets/v1/collections',
  },
};

export const WAX_EXPLORER = 'https://waxblock.io/transaction/';
