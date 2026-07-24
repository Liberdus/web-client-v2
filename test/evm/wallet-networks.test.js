import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCatalogTotalUsd,
  createWalletNetworkCatalog,
  walletProbeAddress,
} from '../../wallet-networks.js';

test('always exposes Liberdus, Ethereum, BSC, and Polygon', () => {
  const catalog = createWalletNetworkCatalog();

  assert.deepEqual(catalog.map((network) => network.id), [
    'liberdus',
    'ethereum',
    'bsc',
    'polygon',
  ]);
  assert.equal(catalog[1].assets[0].tokenSymbol, 'ETH');
  assert.equal(catalog[2].assets[0].tokenSymbol, 'BNB');
  assert.equal(catalog[3].assets[0].tokenSymbol, 'POL');
  assert.equal(calculateCatalogTotalUsd(catalog), null);
});

test('adds other EVM networks only when the wallet has a positive asset balance', () => {
  const catalog = createWalletNetworkCatalog({
    portfolio: {
      chains: [
        { networkId: 'arbitrum', chain: 'Arbitrum One', chainId: 42161 },
        { networkId: 'base', chain: 'Base', chainId: 8453 },
      ],
      tokens: [
        {
          networkId: 'arbitrum',
          chain: 'Arbitrum One',
          chainId: 42161,
          contractAddress: null,
          tokenName: 'Ether',
          tokenSymbol: 'ETH',
          tokenAmount: '0.25',
          tokenValueUsd: '750',
        },
        {
          networkId: 'base',
          chain: 'Base',
          chainId: 8453,
          contractAddress: null,
          tokenName: 'Ether',
          tokenSymbol: 'ETH',
          tokenAmount: '0',
          tokenValueUsd: '0',
        },
      ],
    },
  });

  assert.equal(catalog.some((network) => network.id === 'arbitrum'), true);
  assert.equal(catalog.some((network) => network.id === 'base'), false);
});

test('combines Liberdus and EVM USD values without changing precision inputs', () => {
  const catalog = createWalletNetworkCatalog({
    liberdusAsset: {
      balance: 50n * (10n ** 18n),
      price: 0.008,
    },
    portfolio: {
      chains: [{ networkId: 'ethereum', chain: 'Ethereum', chainId: 1 }],
      tokens: [{
        networkId: 'ethereum',
        chain: 'Ethereum',
        chainId: 1,
        contractAddress: null,
        tokenName: 'Ether',
        tokenSymbol: 'ETH',
        tokenAmount: '0.5',
        tokenValueUsd: '1500',
      }],
    },
  });

  assert.equal(calculateCatalogTotalUsd(catalog), 1500.4);
});

test('normalizes the shared Liberdus and EVM address', () => {
  assert.equal(
    walletProbeAddress('A'.repeat(40)),
    `0x${'a'.repeat(40)}`,
  );
  assert.throws(() => walletProbeAddress('not-an-address'), TypeError);
});
