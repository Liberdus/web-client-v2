import assert from 'node:assert/strict';
import test from 'node:test';

import { EvmRpcPool, formatUnits, hexQuantityToBigInt } from '../../evm/rpc.js';

const ADDRESS = '0x0000000000000000000000000000000000000001';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function testNetwork(rpcUrls = ['https://rpc-one.test', 'https://rpc-two.test']) {
  return {
    id: 'testnet',
    name: 'Test Network',
    chainId: 1337,
    ankrId: 'testnet',
    nativeCurrency: { name: 'Test Ether', symbol: 'TETH', decimals: 18 },
    rpcUrls,
  };
}

test('formats exact integer balances without floating point loss', () => {
  assert.equal(formatUnits(1n, 18), '0.000000000000000001');
  assert.equal(formatUnits(1234500000000000000n, 18), '1.2345');
  assert.equal(hexQuantityToBigInt('0x112210f47de98115'), 1234567890123456789n);
});

test('falls back to the next RPC endpoint and verifies its chain id', async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url, method: request.method });
    if (url.endsWith('rpc-one.test')) {
      throw new Error('first endpoint unavailable');
    }
    if (request.method === 'eth_chainId') {
      return jsonResponse({ jsonrpc: '2.0', id: request.id, result: '0x539' });
    }
    return jsonResponse({ jsonrpc: '2.0', id: request.id, result: '0xde0b6b3a7640000' });
  };
  const pool = new EvmRpcPool({ networks: [testNetwork()], fetchFn });

  const balance = await pool.getNativeBalance(ADDRESS, 'testnet');

  assert.equal(balance.balance, '1');
  assert.equal(balance.balanceRawInteger, '1000000000000000000');
  assert.deepEqual(calls.map(({ url, method }) => `${url}:${method}`), [
    'https://rpc-one.test:eth_chainId',
    'https://rpc-two.test:eth_chainId',
    'https://rpc-two.test:eth_getBalance',
  ]);
});

test('rejects wrong-chain RPC endpoints before requesting a balance', async () => {
  const balanceCalls = [];
  const fetchFn = async (url, options) => {
    const request = JSON.parse(options.body);
    if (request.method === 'eth_chainId') {
      const result = url.endsWith('rpc-one.test') ? '0x1' : '0x539';
      return jsonResponse({ jsonrpc: '2.0', id: request.id, result });
    }
    balanceCalls.push(url);
    return jsonResponse({ jsonrpc: '2.0', id: request.id, result: '0x0' });
  };
  const pool = new EvmRpcPool({ networks: [testNetwork()], fetchFn });

  await pool.getNativeBalance(ADDRESS, 'testnet');

  assert.deepEqual(balanceCalls, ['https://rpc-two.test']);
});

test('returns partial multi-chain results instead of hiding successful balances', async () => {
  const networks = [
    testNetwork(['https://good.test']),
    { ...testNetwork(['https://bad.test']), id: 'broken', chainId: 1338 },
  ];
  const fetchFn = async (url, options) => {
    if (url.endsWith('bad.test')) {
      throw new Error('offline');
    }
    const request = JSON.parse(options.body);
    return jsonResponse({
      jsonrpc: '2.0',
      id: request.id,
      result: request.method === 'eth_chainId' ? '0x539' : '0x0',
    });
  };
  const pool = new EvmRpcPool({ networks, fetchFn, timeoutMs: 50 });

  const result = await pool.getNativeBalances(ADDRESS, ['testnet', 'broken']);

  assert.equal(result.assets.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].networkId, 'broken');
  assert.equal(result.complete, false);
});
