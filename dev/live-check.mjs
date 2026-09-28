// Read-only view of a real intents account, for checking the app against the
// network after a real-money step. Signs nothing, sends nothing, writes
// nothing: balances, bridge deposit records, and the status of an intent or a
// 1Click order.
//
//   node dev/live-check.mjs <account> [more accounts…]
//   node dev/live-check.mjs <account> --intent <hash>        one intent's status
//   node dev/live-check.mjs <account> --order <depositAddr>  one 1Click order
//   node dev/live-check.mjs <account> --chains btc:mainnet,eth:56
//
// With no --chains, deposits are read for every chain the account holds an
// asset on, plus Bitcoin and Solana.

import { intentsAssets, buildIntentsNetwork, intentsAccountIdForAddress } from '../intents-assets.js';
import { intentsDeposits } from '../intents-deposits.js';
import { fetchRecentDeposits, getIntentStatus, getIntentsBalances, getSwapStatus } from '../intents.js';
import { depositEntry } from '../intents-activity.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};
const accounts = args.filter((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--'))
  .map((arg) => intentsAccountIdForAddress(arg) || arg);
if (!accounts.length) {
  console.error('usage: node dev/live-check.mjs <account> [--intent <hash>] [--order <address>] [--chains a,b]');
  process.exit(2);
}

const tokens = await intentsAssets.loadTokens();
await intentsDeposits.loadBridgeTokens();
const usd = (value) => (value === null ? 'unpriced' : `$${Number(value).toFixed(2)}`);

for (const account of accounts) {
  console.log(`\n== ${account}  (${new Date().toISOString()})`);

  const balances = await getIntentsBalances(account, tokens.map((token) => token.assetId));
  const network = buildIntentsNetwork(tokens, balances);
  console.log(`balances  total ${usd(network.totalValueUsd)}`);
  for (const asset of network.assets) {
    console.log(`  ${asset.tokenSymbol.padEnd(6)} ${asset.chainName.padEnd(12)} ${asset.tokenAmount.padEnd(24)} ${usd(asset.tokenValueUsd).padStart(9)}  ${asset.assetId}`);
  }

  const chains = flag('--chains')?.split(',') || [...new Set([
    'btc:mainnet', 'sol:mainnet',
    ...network.assets.map((asset) => intentsDeposits.describeDepositTarget(asset.assetId)?.chain).filter(Boolean),
  ])];
  console.log('deposits');
  for (const chain of chains) {
    const records = await fetchRecentDeposits(account, chain, { limit: 10 });
    if (!records.length) continue;
    for (const record of records) {
      const entry = depositEntry(record, intentsDeposits.bridgeTokens);
      const asset = tokens.find((token) => token.assetId === entry.assetId);
      console.log(`  ${chain.padEnd(12)} ${record.status.padEnd(10)} ${entry.amount} ${asset?.symbol || '?'}  ${record.created_at}  credited ${entry.assetId}  tx ${record.tx_hash}`);
    }
  }
}

const intent = flag('--intent');
if (intent) {
  const status = await getIntentStatus(intent);
  console.log(`\nintent ${intent}: ${status.status}${status.transactionHash ? `  near tx ${status.transactionHash}` : ''}`);
}

const order = flag('--order');
if (order) {
  const status = await getSwapStatus(order, flag('--memo'));
  const details = status?.swapDetails || {};
  console.log(`\n1Click order ${order}: ${status?.status}`);
  console.log(`  in ${details.amountInFormatted ?? '?'}  out ${details.amountOutFormatted ?? '?'}  refunded ${details.refundedAmountFormatted ?? '0'}`);
  if (details.intentHashes?.length) console.log(`  intents ${details.intentHashes.join(', ')}`);
}
