const networks = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    ankrId: 'eth',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
    ],
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    ankrId: 'polygon',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon.drpc.org',
    ],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    ankrId: 'arbitrum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arb1.arbitrum.io/rpc',
    ],
  },
  {
    id: 'optimism',
    name: 'OP Mainnet',
    chainId: 10,
    ankrId: 'optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://optimism-rpc.publicnode.com',
      'https://mainnet.optimism.io',
    ],
  },
  {
    id: 'base',
    name: 'Base',
    chainId: 8453,
    ankrId: 'base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: [
      'https://base-rpc.publicnode.com',
      'https://mainnet.base.org',
    ],
  },
  {
    id: 'bsc',
    name: 'BNB Smart Chain',
    chainId: 56,
    ankrId: 'bsc',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: [
      'https://bsc-rpc.publicnode.com',
      'https://bsc-dataseed.binance.org',
    ],
  },
];

function freezeNetwork(network) {
  return Object.freeze({
    ...network,
    nativeCurrency: Object.freeze({ ...network.nativeCurrency }),
    rpcUrls: Object.freeze([...network.rpcUrls]),
  });
}

export const DEFAULT_EVM_NETWORKS = Object.freeze(networks.map(freezeNetwork));

export function createNetworkMap(networkList = DEFAULT_EVM_NETWORKS) {
  const map = new Map();

  for (const network of networkList) {
    validateNetwork(network);
    if (map.has(network.id)) {
      throw new TypeError(`Duplicate EVM network id: ${network.id}`);
    }
    map.set(network.id, network);
  }

  return map;
}

export function validateNetwork(network) {
  if (!network || typeof network !== 'object') {
    throw new TypeError('EVM network configuration must be an object');
  }
  if (!/^[a-z0-9-]+$/.test(network.id || '')) {
    throw new TypeError('EVM network id must contain only lowercase letters, numbers, and hyphens');
  }
  if (!Number.isSafeInteger(network.chainId) || network.chainId <= 0) {
    throw new TypeError(`Invalid chain id for EVM network ${network.id}`);
  }
  if (!network.nativeCurrency || !Number.isInteger(network.nativeCurrency.decimals)) {
    throw new TypeError(`Invalid native currency for EVM network ${network.id}`);
  }
  if (!Array.isArray(network.rpcUrls) || network.rpcUrls.length === 0) {
    throw new TypeError(`EVM network ${network.id} must have at least one RPC URL`);
  }
  for (const rpcUrl of network.rpcUrls) {
    if (typeof rpcUrl !== 'string' || !/^https:\/\//.test(rpcUrl)) {
      throw new TypeError(`EVM network ${network.id} has an invalid RPC URL`);
    }
  }
}
