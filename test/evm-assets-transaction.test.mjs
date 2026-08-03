import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {};

const {
  EvmTransactionService,
  buildAnkrChainRpcUrl,
  encodeErc20Transfer,
  parseEvmTokenAmount,
  signEvmTransaction,
} = await import('../evm-assets.js');

const PRIVATE_KEY = `${'0'.repeat(63)}1`;
const SENDER = '7e5f4552091a69125d5dfcb7b8c2659029395bdf';
const RECIPIENT = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const CONTRACT = '0x0000000000000000000000000000000000000010';
const TRANSACTION_HASH = `0x${'ab'.repeat(32)}`;

function jsonRpcResponse(request, result) {
  return {
    ok: true,
    async json() {
      return { jsonrpc: '2.0', id: request.id, result };
    },
  };
}

function createRpcFetch(calls) {
  return async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url, request });
    const gasEstimate = request.method === 'eth_estimateGas'
      ? (request.params[0].data === '0x' ? '0x5208' : '0x11170')
      : null;
    const results = {
      eth_chainId: '0x7a69',
      eth_getTransactionCount: '0x0',
      eth_getBalance: '0x8ac7230489e80000',
      eth_estimateGas: gasEstimate,
      eth_getBlockByNumber: { baseFeePerGas: '0x3b9aca00' },
      eth_maxPriorityFeePerGas: '0x59682f00',
      eth_sendRawTransaction: TRANSACTION_HASH,
      eth_getTransactionReceipt: {
        transactionHash: TRANSACTION_HASH,
        status: '0x1',
      },
    };
    if (!(request.method in results)) {
      throw new Error(`Unexpected RPC method: ${request.method}`);
    }
    return jsonRpcResponse(request, results[request.method]);
  };
}

function hardhatNetwork() {
  return {
    id: 'hardhat',
    name: 'Hardhat',
    shortName: 'ETH',
    nativeSymbol: 'ETH',
    source: 'evm',
    chainId: 31337,
    rpcUrls: ['http://127.0.0.1:8545'],
  };
}

function tokenAsset(overrides = {}) {
  return {
    key: `hardhat:${CONTRACT}:USDC`,
    source: 'evm',
    networkId: 'hardhat',
    contractAddress: CONTRACT,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenAmount: '100',
    rawAmount: '100000000',
    ...overrides,
  };
}

test('derives chain-specific Ankr RPC endpoints from one multichain endpoint', () => {
  const endpoint = 'https://rpc.ankr.com/multichain/test-api-key';
  assert.equal(
    buildAnkrChainRpcUrl(endpoint, 'ethereum'),
    'https://rpc.ankr.com/eth/test-api-key',
  );
  assert.equal(
    buildAnkrChainRpcUrl(endpoint, 'avalanche'),
    'https://rpc.ankr.com/avalanche/test-api-key',
  );
  assert.equal(buildAnkrChainRpcUrl(endpoint, 'unsupported-chain'), null);
  assert.equal(buildAnkrChainRpcUrl('https://example.com/multichain/test-api-key', 'bsc'), null);

  globalThis.window.LIBERDUS_ANKR_MULTICHAIN_URL = endpoint;
  const service = new EvmTransactionService({
    getAccount: () => null,
    refreshAssets: async () => {},
    showToast: () => {},
    confirmTransfer: async () => true,
  });
  assert.deepEqual(service.getRpcUrls({
    id: 'ethereum',
    name: 'Ethereum',
    rpcUrls: ['https://ethereum-rpc.publicnode.com'],
  }), [
    'https://rpc.ankr.com/eth/test-api-key',
    'https://ethereum-rpc.publicnode.com',
  ]);
  assert.deepEqual(service.getRpcUrls({
    id: 'avalanche',
    name: 'Avalanche',
    rpcUrls: [],
  }), ['https://rpc.ankr.com/avalanche/test-api-key']);
  delete globalThis.window.LIBERDUS_ANKR_MULTICHAIN_URL;
});

test('encodes exact ERC-20 amounts and transfer calldata', () => {
  assert.equal(parseEvmTokenAmount('12.5', 6), 12_500_000n);
  assert.throws(() => parseEvmTokenAmount('0.0000001', 6), /precision/);
  assert.equal(
    encodeErc20Transfer(RECIPIENT, 12_500_000n),
    `0xa9059cbb${RECIPIENT.slice(2).padStart(64, '0')}${(12_500_000n).toString(16).padStart(64, '0')}`.toLowerCase(),
  );
});

test('signs EIP-1559 transaction bytes locally', async () => {
  const rawTransaction = await signEvmTransaction({
    feeMode: 'eip1559',
    chainId: 31337,
    nonce: '0x0',
    maxPriorityFeePerGas: '0x59682f00',
    maxFeePerGas: '0xd09dc300',
    gasLimit: '0x6270',
    to: RECIPIENT,
    value: '0xde0b6b3a7640000',
    data: '0x',
  }, PRIVATE_KEY);

  assert.match(rawTransaction, /^0x02[0-9a-f]+$/);
  assert.equal(rawTransaction.includes(PRIVATE_KEY), false);
});

test('signs legacy transaction bytes locally', async () => {
  const rawTransaction = await signEvmTransaction({
    feeMode: 'legacy',
    chainId: 56,
    nonce: '0x0',
    gasPrice: '0xb2d05e00',
    gasLimit: '0x5208',
    to: RECIPIENT,
    value: '0xde0b6b3a7640000',
    data: '0x',
  }, PRIVATE_KEY);

  assert.match(rawTransaction, /^0xf8[0-9a-f]+$/);
  assert.equal(rawTransaction.includes(PRIVATE_KEY), false);
});

test('validates, signs, broadcasts, confirms, and refreshes an ERC-20 transfer', async () => {
  const calls = [];
  let refreshes = 0;
  let confirmations = 0;
  const service = new EvmTransactionService({
    getAccount: () => ({ keys: { address: SENDER, secret: PRIVATE_KEY } }),
    refreshAssets: async ({ force }) => {
      assert.equal(force, true);
      refreshes += 1;
    },
    showToast: () => {},
    confirmTransfer: async () => {
      confirmations += 1;
      return true;
    },
    fetchFn: createRpcFetch(calls),
  });

  const result = await service.send({
    network: hardhatNetwork(),
    asset: tokenAsset(),
    recipient: RECIPIENT,
    amount: '12.5',
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.transactionHash, TRANSACTION_HASH);
  assert.equal(refreshes, 1);
  assert.equal(confirmations, 1);
  const broadcast = calls.find(({ request }) => request.method === 'eth_sendRawTransaction');
  assert.match(broadcast.request.params[0], /^0x02[0-9a-f]+$/);
  assert.equal(broadcast.request.params[0].includes(PRIVATE_KEY), false);
});

test('rejects insufficient token balance before contacting RPC', () => {
  const calls = [];
  const service = new EvmTransactionService({
    getAccount: () => ({ keys: { address: SENDER, secret: PRIVATE_KEY } }),
    refreshAssets: async () => {},
    showToast: () => {},
    confirmTransfer: async () => true,
    fetchFn: createRpcFetch(calls),
  });

  const validation = service.validate({
    network: hardhatNetwork(),
    asset: tokenAsset({ tokenAmount: '1', rawAmount: '1000000' }),
    recipient: RECIPIENT,
    amount: '2',
  });

  assert.equal(validation.valid, false);
  assert.match(validation.message, /Insufficient USDC/);
  assert.equal(calls.length, 0);
});
