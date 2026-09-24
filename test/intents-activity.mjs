/**
 * Asset activity: three sources merged into one history.
 *
 * The deposit fixture is a real record the bridge returned for a real SOL
 * deposit, so the field names are the bridge's, not a guess at them.
 *
 *   node test/intents-activity.mjs
 */
import {
  IntentsActivity, depositEntry, orderEntry, orderStatusFrom, paymentEntry,
} from '../intents-activity.js';
import { intentsDeposits } from '../intents-deposits.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);

const SOL = 'nep141:sol.omft.near';
const USDC = 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near';
const ACCOUNT = '0x8147165a17c70371a4d390c1799630c074ac6991';

// As returned by recent_deposits, 2026-09-23.
const REAL_DEPOSIT = {
  tx_hash: '5UhbfA3T1SsCdiVvhGPaMFvD2SUr5DrC4dy4MV1jMfkZeZhSfFZgVisWcJ6CAXYTvfaP8Ycoy7dY9S3pYChxgLVz',
  mint_tx_hash: '',
  chain: 'sol:mainnet',
  defuse_asset_identifier: 'sol:mainnet:native',
  near_token_id: 'sol.omft.near',
  decimals: 9,
  amount: 10000000,
  account_id: ACCOUNT,
  address: 'DJHiQj3uyQMKWHfuUKnYjWH1JhwDHsPQexqLu6Rn7Umi',
  status: 'COMPLETED',
  created_at: '2026-09-23T08:05:21.948Z',
  from: '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj',
};

section('a bridge deposit');
const deposit = depositEntry(REAL_DEPOSIT);
ck('matched to its asset by near_token_id', deposit.assetId, SOL);
ck('amount from base units and decimals', deposit.amount, '0.01');
ck('completed is done', deposit.status, 'done');
ck('money in', deposit.direction, 1);
ck('the sender, shortened', deposit.detail, 'From 9NVKzb…v2uj');
ck('time from created_at', deposit.time, Date.parse('2026-09-23T08:05:21.948Z'));
ck('pending stays pending', depositEntry({ ...REAL_DEPOSIT, status: 'PENDING' }).status, 'pending');
ck('an unknown status is not called done', depositEntry({ ...REAL_DEPOSIT, status: 'WEIRD' }).status, 'pending');
ck('a missing amount is zero, not a crash', depositEntry({ ...REAL_DEPOSIT, amount: undefined }).amount, '0');

section('a multi-token deposit (nep245)');
// As returned by recent_deposits, 2026-09-24: USDT on BNB Chain, which the
// first version of this list dropped by assuming every token was nep141.
const REAL_BSC_DEPOSIT = {
  tx_hash: '0xdc7b9e171c944b33e827a8af78b43e3901cf2b7d08c69065d3ea43d79bf29cf3',
  mint_tx_hash: 'NvtFnVCgr6PjbXEJ1sQMequJWvSXUcAimQEEwtdwko2',
  chain: 'eth:56',
  defuse_asset_identifier: 'eth:56:0x55d398326f99059ff775485246999027b3197955',
  near_token_id: 'v2_1.omni.hot.tg:56_2CMMyVTGZkeyNZTSvS5sarzfir6g',
  decimals: 18,
  amount: 3000000000000000000,
  account_id: ACCOUNT,
  address: '0xc61BBE188F88f120021C3490f7Aaf898B1ce149d',
  status: 'COMPLETED',
  created_at: '2026-09-24T07:37:18.250Z',
  from: '0xEc33aDc8A175DCc44f809909B9aae9F4F5760818',
};
const BSC_USDT = 'nep245:v2_1.omni.hot.tg:56_2CMMyVTGZkeyNZTSvS5sarzfir6g';
const BRIDGE = [
  // The bridge's own entry for it, as listed on the same day.
  { defuse_asset_identifier: 'eth:56:0x55d398326f99059ff775485246999027b3197955', near_token_id: 'v2_1.omni.hot.tg',
    standard: 'nep245', intents_token_id: BSC_USDT, multi_token_id: '56_2CMMyVTGZkeyNZTSvS5sarzfir6g' },
  // Two tokens on one origin asset, told apart only by the NEAR-side token.
  { defuse_asset_identifier: 'btc:mainnet:native', near_token_id: 'nbtc.bridge.near', intents_token_id: 'nep141:nbtc.bridge.near' },
  { defuse_asset_identifier: 'btc:mainnet:native', near_token_id: 'btc.omft.near', intents_token_id: 'nep141:btc.omft.near' },
];
ck('credited to the nep245 asset', depositEntry(REAL_BSC_DEPOSIT, BRIDGE).assetId, BSC_USDT);
ck('3 USDT at 18 decimals', depositEntry(REAL_BSC_DEPOSIT, BRIDGE).amount, '3');
ck('without the token list, inferred from the id', depositEntry(REAL_BSC_DEPOSIT).assetId, BSC_USDT);
ck('siblings on one origin asset stay apart',
  [depositEntry({ ...REAL_DEPOSIT, near_token_id: 'btc.omft.near' }, BRIDGE).assetId,
    depositEntry({ ...REAL_DEPOSIT, near_token_id: 'nbtc.bridge.near' }, BRIDGE).assetId],
  ['nep141:btc.omft.near', 'nep141:nbtc.bridge.near']);
ck('a nep141 deposit is unchanged by the lookup', depositEntry(REAL_DEPOSIT, BRIDGE).assetId, SOL);

section('a chat payment');
const sent = paymentEntry({ assetId: SOL, amount: '0.001', my: true, peer: 'firefox', time: 5, intentHash: 'h1', note: 'for coffee' });
ck('ours: to whom, money out, settled', [sent.title, sent.direction, sent.status, sent.detail], ['To firefox', -1, 'done', 'for coffee']);
const received = paymentEntry({ assetId: SOL, amount: '0.002', my: false, peer: 'Dana', time: 6, intentHash: 'h2' });
ck('theirs: a claim until checked', [received.title, received.direction, received.status], ['From Dana', 1, 'checking']);
ck('a claim that failed its check', paymentEntry({ ...received, my: false, verified: 'failed' }).status, 'unconfirmed');

section('an order, from each side');
const swap = { id: 's1', kind: 'swap', fromAssetId: SOL, toAssetId: USDC, fromSymbol: 'SOL', toSymbol: 'USDC', amount: '0.005', amountOut: '0.57', time: 7, status: 'pending' };
ck('paying side', [orderEntry(swap, SOL).title, orderEntry(swap, SOL).amount, orderEntry(swap, SOL).direction], ['Swapped to USDC', '0.005', -1]);
ck('receiving side, on the quote', [orderEntry(swap, USDC).title, orderEntry(swap, USDC).amount, orderEntry(swap, USDC).estimated], ['Swapped from SOL', '0.57', true]);
ck('receiving side, once 1Click says', orderEntry({ ...swap, amountReceived: '0.5711' }, USDC).amount, '0.5711');
const withdrawal = { id: 'w1', kind: 'withdraw', assetId: SOL, amount: '0.005', destinationChain: 'Solana', destinationAddress: '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj', time: 8 };
ck('withdrawal', [orderEntry(withdrawal, SOL).title, orderEntry(withdrawal, SOL).detail], ['Withdrawn to Solana', 'To 9NVKzb…v2uj']);
ck('1Click states', ['SUCCESS', 'REFUNDED', 'FAILED', 'PROCESSING', undefined].map(orderStatusFrom),
  ['done', 'refunded', 'failed', 'pending', 'pending']);

section('merged for one asset');
intentsDeposits.bridgeTokens = [
  { intents_token_id: SOL, defuse_asset_identifier: 'sol:mainnet:native', asset_name: 'SOL', decimals: 9 },
];
intentsDeposits.bridgeTokensFetchedAt = Date.now();

let orders = [];
const statusCalls = [];
const activity = new IntentsActivity();
activity.configure({
  getOrders: () => orders,
  saveOrders: (next) => { orders = next; },
  listPayments: () => [
    { assetId: SOL, amount: '0.001', my: true, peer: 'firefox', time: Date.parse('2026-09-23T09:00:00Z'), intentHash: 'h1' },
    { assetId: USDC, amount: '5', my: false, peer: 'Dana', time: Date.parse('2026-09-23T10:00:00Z'), intentHash: 'h3' },
  ],
  fetchDeposits: async (accountId, chain) => (accountId === ACCOUNT && chain === 'sol:mainnet' ? [REAL_DEPOSIT] : []),
  fetchOrderStatus: async (address) => {
    statusCalls.push(address);
    return { status: 'SUCCESS', swapDetails: { amountOutFormatted: '0.5711' } };
  },
});

const id = activity.recordOrder({ kind: 'swap', fromAssetId: SOL, toAssetId: USDC, fromSymbol: 'SOL', toSymbol: 'USDC', amount: '0.005', amountOut: '0.57', depositAddress: 'dep1' });
ck('recorded as pending, before sending', orders[0].status, 'pending');

const { entries, depositsUnavailable } = await activity.forAsset(ACCOUNT, { assetId: SOL });
ck('deposit, payment and swap, newest first', entries.map((entry) => entry.kind), ['swap', 'sent', 'deposit']);
ck('nothing from another asset', entries.every((entry) => entry.assetId === SOL), true);
ck('the unsettled order was asked about', statusCalls, ['dep1']);
ck('and its answer kept', [orders[0].status, orders[0].amountReceived], ['done', '0.5711']);
ck('deposits were read', depositsUnavailable, false);

statusCalls.length = 0;
await activity.forAsset(ACCOUNT, { assetId: SOL });
ck('a settled order is not asked again', statusCalls, []);

const usdc = await activity.forAsset(ACCOUNT, { assetId: USDC });
// The swap was recorded just now, so it is newer than the fixture payment.
ck('the other side of the swap shows what arrived', usdc.entries.map((entry) => [entry.kind, entry.amount]), [['swap', '0.5711'], ['received', '5']]);

section('a refunded swap');
orders = [];
activity.configure({ fetchOrderStatus: async () => ({ status: 'REFUNDED' }) });
activity.recordOrder({ kind: 'swap', fromAssetId: SOL, toAssetId: USDC, fromSymbol: 'SOL', toSymbol: 'USDC', amount: '0.005', amountOut: '0.57', depositAddress: 'dep2' });
const paid = await activity.forAsset(ACCOUNT, { assetId: SOL });
ck('shown as refunded on the asset that paid', paid.entries.find((entry) => entry.kind === 'swap').status, 'refunded');
const target = await activity.forAsset(ACCOUNT, { assetId: USDC });
ck('absent from the asset it never delivered', target.entries.some((entry) => entry.kind === 'swap'), false);

section('when a source fails');
activity.configure({ fetchDeposits: async () => { throw new Error('bridge down'); } });
const partial = await activity.forAsset(ACCOUNT, { assetId: SOL });
ck('reported, not thrown', partial.depositsUnavailable, true);
ck('and the rest still shown', partial.entries.some((entry) => entry.kind === 'sent'), true);

section('the order log');
orders = [];
const forgotten = activity.recordOrder({ kind: 'withdraw', assetId: SOL, amount: '1' });
activity.forgetOrder(forgotten);
ck('an order never sent can be removed', orders.length, 0);
for (let i = 0; i < 205; i += 1) activity.recordOrder({ kind: 'withdraw', assetId: SOL, amount: '1' });
ck('capped so saved state cannot grow without bound', orders.length, 200);

section('checking a received claim');
activity.configure({ verifyClaim: async () => ({ state: 'settled' }) });
ck('settled reads as done', await activity.verifyPayment('h9'), 'done');
activity.configure({ verifyClaim: async () => { throw new Error('offline'); } });
ck('remembered once settled', await activity.verifyPayment('h9'), 'done');
ck('offline is not a verdict', await activity.verifyPayment('h10'), 'checking');

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
