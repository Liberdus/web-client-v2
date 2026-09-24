/**
 * Swaps: the quote we ask for, and the guards around it.
 *
 * A swap is the one operation here whose output is not known in advance --
 * solvers compete and the rate moves between quoting and filling -- so most of
 * this is about the floor rather than the estimate.
 *
 *   node test/intents-swap.mjs
 */
import { IntentsSwapService } from '../intents-swap.js';
import { normalizeIntentsToken } from '../intents-assets.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);

const ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
const BTC = { assetId: 'nep141:btc.omft.near', decimals: 8, blockchain: 'btc', symbol: 'BTC', price: 86693 };
const from = normalizeIntentsToken(SOL, '50000000');  // 0.05 SOL
const to = normalizeIntentsToken(BTC, '0');

let lastQuote = null;
let reply = null;
const service = new IntentsSwapService({
  getAccount: () => ({ keys: { address: ACCOUNT } }),
  requestQuote: async (params) => { lastQuote = params; return reply; },
});

const failsWith = async (fn) => {
  try { await fn(); return 'no error'; } catch (error) { return error.code || 'unknown'; }
};

section('the quote we ask for');
{
  reply = { quote: {
    amountInFormatted: '0.01', amountOutFormatted: '0.00001361',
    minAmountOut: '1347', amountInUsd: '1.18', amountOutUsd: '1.18', timeEstimate: 9,
  } };
  const preview = await service.preview({ accountId: ACCOUNT, fromAsset: from, toAsset: to, amount: '0.01' });

  ck('is a dry run', lastQuote.dry, true);
  ck('origin and destination differ', [lastQuote.originAsset, lastQuote.destinationAsset],
    ['nep141:sol.omft.near', 'nep141:btc.omft.near']);
  ck('funded from the intents balance', lastQuote.depositType, 'INTENTS');
  // The payout stays inside intents: a swap does not leave for a chain.
  ck('paid back into intents', lastQuote.recipientType, 'INTENTS');
  ck('  to this same account', lastQuote.recipient, ACCOUNT);
  ck('refunds return to intents too', lastQuote.refundType, 'INTENTS');
  ck('amount is raw, in the origin asset', lastQuote.amount, '10000000');

  ck('estimate is reported', preview.amountOut, '0.00001361');
  // 1347 raw at 8 decimals. Showing "1347" beside a BTC figure would be absurd.
  ck('the floor is scaled to the destination asset', preview.minAmountOut, '0.00001347');
  ck('  and is lower than the estimate',
    Number(preview.minAmountOut) < Number(preview.amountOut), true);
  ck('slippage is stated', preview.slippageBps, 100);
  ck('frozen', Object.isFrozen(preview), true);
}

section('swaps that must be refused');
ck('no assets', await failsWith(() => service.preview({
  accountId: ACCOUNT, fromAsset: null, toAsset: to, amount: '0.01',
})), 'NO_ASSETS');
// Same asset in and out is a withdrawal, not a swap, and would burn the fee.
ck('the same asset both sides', await failsWith(() => service.preview({
  accountId: ACCOUNT, fromAsset: from, toAsset: from, amount: '0.01',
})), 'SAME_ASSET');
ck('zero', await failsWith(() => service.preview({
  accountId: ACCOUNT, fromAsset: from, toAsset: to, amount: '0',
})), 'AMOUNT_NOT_POSITIVE');
ck('more precision than the asset has', await failsWith(() => service.preview({
  accountId: ACCOUNT, fromAsset: from, toAsset: to, amount: '0.0000000001',
})), 'TOO_PRECISE');

section('preparing the funding transfer');
{
  reply = { quote: {
    depositAddress: '1click-swap.near', depositMemo: null,
    deadline: new Date(Date.now() + 300_000).toISOString(),
    amountOutFormatted: '0.00001361', minAmountOut: '1347', timeEstimate: 9,
  } };
  const prepared = await service.prepare({ accountId: ACCOUNT, fromAsset: from, toAsset: to, amount: '0.01' });

  ck('the real quote is not dry', lastQuote.dry, false);
  const intent = prepared.payload.intents[0];
  ck('funding is an ordinary transfer', intent.intent, 'transfer');
  ck('  to the deposit address', intent.receiver_id, '1click-swap.near');
  // The origin asset is what leaves; the destination arrives from the solver.
  ck('  of the origin asset only', intent.tokens, { 'nep141:sol.omft.near': '10000000' });
  ck('signed by this account', prepared.payload.signer_id, ACCOUNT);
  ck('the floor travels with the order', prepared.minAmountOut, '0.00001347');
}

ck('more than the balance', await failsWith(() => service.prepare({
  accountId: ACCOUNT, fromAsset: from, toAsset: to, amount: '1',
})), 'INSUFFICIENT_BALANCE');
ck('no account', await failsWith(() => service.prepare({
  accountId: null, fromAsset: from, toAsset: to, amount: '0.01',
})), 'NO_ACCOUNT');

section('a quote with no deposit address');
{
  reply = { quote: { amountOutFormatted: '0.00001', timeEstimate: 9 } };
  ck('is refused', await failsWith(() => service.prepare({
    accountId: ACCOUNT, fromAsset: from, toAsset: to, amount: '0.01',
  })), 'NO_DEPOSIT_ADDRESS');
}

section('an expired quote');
{
  const stale = Object.freeze({
    depositAddress: '1click-swap.near',
    depositDeadline: new Date(Date.now() - 1000).toISOString(),
    payload: {}, fromSymbol: 'SOL', amount: '0.01',
  });
  ck('is never funded', await failsWith(() => service.execute(stale, 'ab'.repeat(32))), 'QUOTE_EXPIRED');
  ck('nor is one about to expire', await failsWith(() => service.execute(
    { ...stale, depositDeadline: new Date(Date.now() + 5_000).toISOString() }, 'ab'.repeat(32),
  )), 'QUOTE_EXPIRED');
}

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
