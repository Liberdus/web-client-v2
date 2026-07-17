import { DEFAULT_EVM_NETWORKS, EvmRpcPool } from '../evm/index.js';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const address = readArgument('--address');
const requestedNetworks = readArgument('--networks');

if (!address) {
  console.error('Usage: npm run check:evm-balances -- --address 0x... [--networks ethereum,polygon]');
  process.exitCode = 1;
} else {
  const networkIds = requestedNetworks
    ? requestedNetworks.split(',').map((value) => value.trim()).filter(Boolean)
    : DEFAULT_EVM_NETWORKS.map((network) => network.id);
  const rpcPool = new EvmRpcPool();
  const result = await rpcPool.getNativeBalances(address, networkIds);

  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length > 0) {
    process.exitCode = 2;
  }
}
