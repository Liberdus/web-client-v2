/**
 * Deposit targets: chain mapping, minimums, memo chains, address caching.
 *
 * The numbers here are the ones that decide whether money arrives, so they are
 * tested against the shapes the bridge actually returns (captured from
 * supported_tokens) rather than invented ones. The live half is
 * dev/intents-deposit.html.
 *
 *   node test/intents-deposits.mjs
 */
import { IntentsDepositService, bridgeChainDisplayName, depositUri } from '../intents-deposits.js';
import { bridgeChainOf } from '../intents.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);

// Real entries from supported_tokens, trimmed to the fields that matter.
const BRIDGE_TOKENS = [
  {
    defuse_asset_identifier: 'btc:mainnet:native', near_token_id: 'nbtc.bridge.near',
    decimals: 8, asset_name: 'BTC', min_deposit_amount: '5000',
    min_withdrawal_amount: '700', withdrawal_fee: '1500',
    intents_token_id: 'nep141:nbtc.bridge.near',
  },
  {
    defuse_asset_identifier: 'btc:mainnet:native', near_token_id: 'btc.omft.near',
    decimals: 8, asset_name: 'BTC', min_deposit_amount: '5000',
    min_withdrawal_amount: '700', withdrawal_fee: '1500',
    intents_token_id: 'nep141:btc.omft.near',
  },
  {
    defuse_asset_identifier: 'sol:mainnet:native', near_token_id: 'sol.omft.near',
    decimals: 9, asset_name: 'SOL', min_deposit_amount: '10000000',
    min_withdrawal_amount: '5000000', withdrawal_fee: '5000000',
    intents_token_id: 'nep141:sol.omft.near',
  },
  {
    // Stellar rides the HOT bridge, so its ids are nep245 multi-tokens rather
    // than nep141 -- the token id shape is not uniform across chains.
    defuse_asset_identifier: 'stellar:mainnet:native', near_token_id: 'v2_1.omni.hot.tg',
    decimals: 7, asset_name: 'XLM', min_deposit_amount: '1',
    min_withdrawal_amount: '1', withdrawal_fee: '0', standard: 'nep245',
    intents_token_id: 'nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz',
  },
];

const service = new IntentsDepositService();
service.bridgeTokens = BRIDGE_TOKENS;
service.bridgeTokensFetchedAt = Date.now();

section('chain from a defuse asset identifier');
ck('native asset', bridgeChainOf('btc:mainnet:native'), 'btc:mainnet');
ck('evm chain id is part of the chain', bridgeChainOf('eth:8453:0xabc'), 'eth:8453');
ck('a contract address is not', bridgeChainOf('sol:mainnet:So111'), 'sol:mainnet');
ck('nonsense is null', bridgeChainOf('btc'), null);
ck('nothing is null', bridgeChainOf(undefined), null);

section('deposit target');
{
  const btc = service.describeDepositTarget('nep141:btc.omft.near');
  ck('chain', btc.chain, 'btc:mainnet');
  ck('chain name is human', btc.chainName, 'Bitcoin');
  // 5000 sats. Showing "5000" next to a BTC address would be a disaster.
  ck('minimum is scaled to the asset decimals', btc.minDeposit, '0.00005');
  ck('  and the raw value is kept', btc.minDepositRaw, '5000');
  ck('withdrawal minimum', btc.minWithdrawal, '0.000007');
  ck('withdrawal fee', btc.withdrawalFee, '0.000015');
  ck('the target is frozen', Object.isFrozen(btc), true);

  const sol = service.describeDepositTarget('nep141:sol.omft.near');
  ck('9-decimal minimum', sol.minDeposit, '0.01');
  ck('no sibling token on that chain shares the name', sol.siblings, 0);

  // Two BTC token ids live on btc:mainnet, so one address can credit either.
  ck('a chain carrying the same asset twice is flagged', btc.siblings, 1);

  ck('an asset the bridge does not carry', service.describeDepositTarget('nep141:nope.near'), null);
}

section('non-nep141 token ids');
{
  const xlm = service.describeDepositTarget('nep245:v2_1.omni.hot.tg:1100_111bzQBB5v7AhLyPMDwS8uJgQV24KaAPXtwyVWu2KXbbfQU6NXRCz');
  ck('a nep245 id resolves like any other', xlm.chain, 'stellar:mainnet');
  ck('  7-decimal minimum', xlm.minDeposit, '0.0000001');
  ck('  no withdrawal fee', xlm.withdrawalFee, '0');
}
// A four-part identifier still yields a two-part chain.
ck('an identifier with a contract and a code', bridgeChainOf('stellar:mainnet:USDC:GA5ZSEJY'), 'stellar:mainnet');

section('chains available for funding');
{
  const chains = service.listDepositChains().map((c) => c.chain);
  ck('one entry per chain, not per token', chains, ['btc:mainnet', 'sol:mainnet', 'stellar:mainnet']);
}

section('addresses are cached per account and chain');
{
  const cached = new IntentsDepositService();
  cached.bridgeTokens = BRIDGE_TOKENS;
  cached.bridgeTokensFetchedAt = Date.now();

  cached.addresses.set('0xabc|btc:mainnet', { address: 'bc1qtest', chain: 'btc:mainnet', memo: null });

  const target = cached.describeDepositTarget('nep141:btc.omft.near');
  ck('a cached address is reused', cached.addresses.get('0xabc|btc:mainnet').address, 'bc1qtest');
  ck('  and merges with the target', { ...target, ...cached.addresses.get('0xabc|btc:mainnet') }.minDeposit, '0.00005');
  cached.reset();
  ck('reset clears cached addresses', cached.addresses.size, 0);
}

section('chain names');
// Every EVM chain is an "eth:" chain. Naming them by that prefix alone labelled
// ten different chains "Ethereum", which is how someone sends Base funds to a
// mainnet address.
ck('mainnet', bridgeChainDisplayName('eth:1'), 'Ethereum');
ck('base is not ethereum', bridgeChainDisplayName('eth:8453'), 'Base');
ck('bnb chain is not ethereum', bridgeChainDisplayName('eth:56'), 'BNB Chain');
ck('arbitrum is not ethereum', bridgeChainDisplayName('eth:42161'), 'Arbitrum');
ck('bitcoin', bridgeChainDisplayName('btc:mainnet'), 'Bitcoin');
// An unmapped chain shows its raw id: unhelpful, but never the wrong chain.
ck('an unknown chain is not guessed at', bridgeChainDisplayName('eth:36900'), 'eth:36900');
ck('nothing at all', bridgeChainDisplayName(null), 'Unknown');

section('payment URIs');
ck('bitcoin', depositUri('btc:mainnet', 'bc1qtest'), 'bitcoin:bc1qtest');
ck('  with an amount', depositUri('btc:mainnet', 'bc1qtest', { amount: '0.001' }), 'bitcoin:bc1qtest?amount=0.001');
ck('dogecoin', depositUri('doge:mainnet', 'D8mk'), 'dogecoin:D8mk');
// Solana has no settled URI scheme a wallet would reliably parse, so the QR
// must carry the bare address instead of an invented one.
ck('solana has none', depositUri('sol:mainnet', '12gRNH'), null);
ck('nor does an evm chain', depositUri('eth:8453', '0xabc'), null);
ck('no address, no uri', depositUri('btc:mainnet', null), null);

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
