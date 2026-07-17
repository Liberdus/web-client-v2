import assert from 'node:assert/strict';
import test from 'node:test';

import { AnkrPortfolioProvider, MultiChainWalletService } from '../../evm/portfolio.js';

const ADDRESS = '0x0000000000000000000000000000000000000001';
const NETWORK = {
  id: 'ethereum',
  name: 'Ethereum',
  chainId: 1,
  ankrId: 'eth',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://ethereum.test'],
};

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    },
  };
}

test('normalizes and paginates Ankr account-balance results', async () => {
  const requests = [];
  const fetchFn = async (_url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    const secondPage = Boolean(request.params.pageToken);
    return jsonResponse({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        totalBalanceUsd: '12.50',
        nextPageToken: secondPage ? '' : 'page-2',
        assets: secondPage ? [{
          blockchain: 'eth',
          tokenName: 'USD Coin',
          tokenSymbol: 'USDC',
          tokenDecimals: 6,
          tokenType: 'ERC20',
          contractAddress: '0x0000000000000000000000000000000000000002',
          balance: '12.5',
          balanceRawInteger: '12500000',
          balanceUsd: '12.5',
          tokenPrice: '1',
          thumbnail: 'https://assets.test/usdc.png',
        }] : [{
          blockchain: 'eth',
          tokenName: 'Ether',
          tokenSymbol: 'ETH',
          tokenDecimals: 18,
          tokenType: 'NATIVE',
          contractAddress: '',
          balance: '0',
          balanceRawInteger: '0',
          balanceUsd: '0',
          tokenPrice: '3000',
          thumbnail: '',
        }],
      },
    });
  };
  const provider = new AnkrPortfolioProvider({
    endpoint: '/api/evm/portfolio',
    networks: [NETWORK],
    fetchFn,
    pageSize: 1,
  });

  const result = await provider.discoverAssets(ADDRESS, ['ethereum']);

  assert.equal(result.assets.length, 2);
  assert.equal(result.assets[0].assetType, 'native');
  assert.equal(result.assets[1].assetType, 'erc20');
  assert.equal(result.assets[1].contractAddress, '0x0000000000000000000000000000000000000002');
  assert.equal(result.pagesFetched, 2);
  assert.equal(requests[1].params.pageToken, 'page-2');
  assert.deepEqual(requests[0].params.blockchain, ['eth']);
});

test('falls back to public native balances when indexed token discovery fails', async () => {
  const rpcResult = {
    address: ADDRESS,
    assets: [{ assetType: 'native', networkId: 'ethereum' }],
    failures: [],
    complete: true,
  };
  const rpcPool = {
    async getNativeBalances() {
      return rpcResult;
    },
  };
  const tokenProvider = {
    async discoverAssets() {
      throw Object.assign(new Error('indexer unavailable'), { code: 'INDEXER_DOWN' });
    },
  };
  const service = new MultiChainWalletService({ rpcPool, tokenProvider });

  const result = await service.discoverAssets(ADDRESS, ['ethereum']);

  assert.equal(result.provider, 'public-rpc-fallback');
  assert.equal(result.assets.length, 1);
  assert.equal(result.failures[0].code, 'INDEXER_DOWN');
  assert.equal(result.complete, false);
});
