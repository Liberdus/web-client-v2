import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateTotalBalanceUsd,
  createPortfolioJson,
  createWalletProbe,
  formatPortfolioText,
} from '../../server/wallet-probe.js';

const ADDRESS = '0x0000000000000000000000000000000000000001';
const NETWORKS = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    ankrId: 'eth',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum.test'],
  },
  {
    id: 'polygon',
    name: 'Polygon',
    chainId: 137,
    ankrId: 'polygon',
    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
    rpcUrls: ['https://polygon.test'],
  },
];

function asset(overrides = {}) {
  return {
    assetType: 'native',
    provider: 'public-rpc',
    networkId: 'ethereum',
    networkName: 'Ethereum',
    chainId: 1,
    contractAddress: null,
    tokenName: 'Ether',
    tokenSymbol: 'ETH',
    tokenDecimals: 18,
    balanceRawInteger: '1000000000000000000',
    balance: '1',
    balanceUsd: null,
    tokenPriceUsd: null,
    thumbnail: null,
    ...overrides,
  };
}

test('calculates a rounded portfolio total without floating point arithmetic', () => {
  assert.equal(calculateTotalBalanceUsd([
    asset({ balanceUsd: '1.005' }),
    asset({ balanceUsd: '2.004' }),
    asset({ balanceUsd: null }),
  ]), '3.01');
});

test('combines indexed tokens with native monitoring results', async () => {
  const rpcPool = {
    async getNativeBalances() {
      return {
        assets: [
          asset(),
          asset({
            networkId: 'polygon',
            networkName: 'Polygon',
            chainId: 137,
            tokenName: 'POL',
            tokenSymbol: 'POL',
            balance: '0',
            balanceRawInteger: '0',
          }),
        ],
        failures: [],
      };
    },
  };
  const tokenProvider = {
    async discoverAssets() {
      return {
        totalBalanceUsd: '2501.249',
        assets: [
          asset({ provider: 'ankr', balanceUsd: '2500.00' }),
          asset({
            assetType: 'erc20',
            provider: 'ankr',
            contractAddress: '0x0000000000000000000000000000000000000002',
            tokenName: 'USD Coin',
            tokenSymbol: 'USDC',
            tokenDecimals: 6,
            balanceRawInteger: '1250000',
            balance: '1.25',
            balanceUsd: '1.25',
            tokenPriceUsd: '1',
          }),
        ],
      };
    },
  };
  const probe = createWalletProbe({ rpcPool, tokenProvider, networks: NETWORKS });

  const result = await probe(ADDRESS);

  assert.equal(result.totalBalanceUsd, '2501.25');
  assert.equal(result.networks[0].assets.length, 2);
  assert.equal(result.networks[1].assets.length, 1);
  assert.equal(result.indexedTokenDiscovery, true);
});

test('formats native-only output with a clear indexed-discovery notice', async () => {
  const rpcPool = {
    async getNativeBalances() {
      return { assets: [asset()], failures: [], complete: true };
    },
  };
  const probe = createWalletProbe({ rpcPool, networks: NETWORKS });

  const output = formatPortfolioText(await probe(ADDRESS));

  assert.match(output, /Total value across all chains: unavailable/);
  assert.match(output, /Ethereum \(1 token\):\n  1 ETH/);
  assert.match(output, /Polygon \(0 tokens\):\n  No balances reported/);
  assert.match(output, /configure ANKR_API_TOKEN/);
});

test('creates a frontend-ready JSON portfolio without percentages', async () => {
  const rpcPool = {
    async getNativeBalances() {
      return {
        assets: [asset({
          provider: 'ankr',
          tokenPriceUsd: '2000.50',
          balanceUsd: '2000.50',
        })],
        failures: [],
        complete: true,
      };
    },
  };
  const probe = createWalletProbe({ rpcPool, networks: NETWORKS });
  const portfolio = await probe(ADDRESS);

  const json = createPortfolioJson(portfolio, {
    updatedAt: '2026-07-17T12:00:00.000Z',
  });

  assert.deepEqual(json.chains, [
    {
      chain: 'Ethereum',
      networkId: 'ethereum',
      chainId: 1,
      tokenCount: 1,
      totalValueUsd: '2000.50',
    },
    {
      chain: 'Polygon',
      networkId: 'polygon',
      chainId: 137,
      tokenCount: 0,
      totalValueUsd: null,
    },
  ]);
  assert.deepEqual(json.tokens[0], {
    chain: 'Ethereum',
    networkId: 'ethereum',
    chainId: 1,
    contractAddress: null,
    tokenType: 'native',
    tokenName: 'Ether',
    tokenSymbol: 'ETH',
    tokenPriceUsd: '2000.50',
    tokenAmount: '1',
    tokenValueUsd: '2000.50',
    tokenDecimals: 18,
    rawAmount: '1000000000000000000',
    logoUrl: null,
  });
  assert.equal(json.totalValueUsd, '2000.50');
  assert.equal(json.chainCount, 2);
  assert.equal(json.tokenCount, 1);
  assert.equal('portfolioPercentage' in json.tokens[0], false);
});
