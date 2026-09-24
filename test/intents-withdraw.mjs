/**
 * Withdrawals: the quote request we send, and the guards around publishing.
 *
 * The network calls are stubbed so the shape of the request can be pinned --
 * a withdrawal is a swap whose origin and destination assets are the same, and
 * getting refundType or recipientType wrong sends funds somewhere else.
 *
 *   node test/intents-withdraw.mjs
 */
import { IntentsWithdrawService } from '../intents-withdraw.js';
import { normalizeIntentsToken } from '../intents-assets.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);

const ACCOUNT = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
const SOL_ADDRESS = '9NVKzbnbTJ2wx8C26DoRvZMssqpgtd4EExMGEAGuv2uj';
const SOL = { assetId: 'nep141:sol.omft.near', decimals: 9, blockchain: 'sol', symbol: 'SOL', price: 118 };
const asset = normalizeIntentsToken(SOL, '50000000'); // 0.05 SOL

// Stand in for 1Click. Records what it was asked for.
let lastQuoteRequest = null;
let quoteReply = null;

const service = new IntentsWithdrawService({
  getAccount: () => ({ keys: { address: ACCOUNT } }),
  requestQuote: async (params) => { lastQuoteRequest = params; return quoteReply; },
});

const failsWith = async (fn) => {
  try { await fn(); return 'no error'; } catch (error) { return error.code || 'unknown'; }
};

section('the quote we ask for');
{
  quoteReply = {
    quote: {
      amountInFormatted: '0.01', amountOutFormatted: '0.009911741',
      minAmountOut: '9862623', amountOutUsd: '1.17', withdrawFee: '88259', timeEstimate: 7,
    },
  };
  const preview = await service.preview({
    accountId: ACCOUNT, asset, destinationAddress: SOL_ADDRESS, amount: '0.01',
  });

  ck('it is a dry run', lastQuoteRequest.dry, true);
  // Same asset both sides: a withdrawal moves where it lives, not what it is.
  ck('origin and destination are the same asset',
    [lastQuoteRequest.originAsset, lastQuoteRequest.destinationAsset],
    ['nep141:sol.omft.near', 'nep141:sol.omft.near']);
  ck('funded from the intents balance', lastQuoteRequest.depositType, 'INTENTS');
  ck('paid out on the destination chain', lastQuoteRequest.recipientType, 'DESTINATION_CHAIN');
  // A refund must come back to the intents account, not to the foreign chain.
  ck('refunds return to intents', lastQuoteRequest.refundType, 'INTENTS');
  ck('  and to this account', lastQuoteRequest.refundTo, ACCOUNT);
  ck('recipient is the foreign address', lastQuoteRequest.recipient, SOL_ADDRESS);
  ck('amount is in raw units', lastQuoteRequest.amount, '10000000');

  ck('preview reports what arrives', preview.amountOut, '0.009911741');
  ck('  and the fee', preview.withdrawFee, '88259');
  ck('  and how long it should take', preview.timeEstimateSeconds, 7);
  ck('  frozen', Object.isFrozen(preview), true);
}

section('amounts the preview refuses');
ck('no destination', await failsWith(() => service.preview({
  accountId: ACCOUNT, asset, destinationAddress: '', amount: '0.01',
})), 'NO_DESTINATION');
ck('zero', await failsWith(() => service.preview({
  accountId: ACCOUNT, asset, destinationAddress: SOL_ADDRESS, amount: '0',
})), 'AMOUNT_NOT_POSITIVE');
ck('too precise for the asset', await failsWith(() => service.preview({
  accountId: ACCOUNT, asset, destinationAddress: SOL_ADDRESS, amount: '0.0000000001',
})), 'TOO_PRECISE');

section('a symbol that exists on several chains');
{
  // ETH held on Base can leave to Ethereum; the destination asset says which,
  // and getting it wrong sends the funds to the right address on the wrong chain.
  const ethOnBase = normalizeIntentsToken(
    { assetId: 'nep141:base-eth.omft.near', decimals: 18, blockchain: 'base', symbol: 'ETH', price: 2773 },
    '900000000000000',
  );
  const ethOnMainnet = normalizeIntentsToken(
    { assetId: 'nep141:eth.omft.near', decimals: 18, blockchain: 'eth', symbol: 'ETH', price: 2773 },
    '0',
  );
  quoteReply = { quote: { amountInFormatted: '0.0001', amountOutFormatted: '0.00009', minAmountOut: '90', withdrawFee: '1', timeEstimate: 30 } };
  const preview = await service.preview({
    accountId: ACCOUNT, asset: ethOnBase, destinationAsset: ethOnMainnet,
    destinationAddress: '0x0551f7c9a91ee579c9e40444ffc490001c323108', amount: '0.0001',
  });
  ck('origin is what is held', lastQuoteRequest.originAsset, 'nep141:base-eth.omft.near');
  ck('destination is the chosen chain', lastQuoteRequest.destinationAsset, 'nep141:eth.omft.near');
  ck('the preview names it', preview.destinationChain, 'Ethereum');

  await service.preview({
    accountId: ACCOUNT, asset: ethOnBase,
    destinationAddress: '0x0551f7c9a91ee579c9e40444ffc490001c323108', amount: '0.0001',
  });
  ck('with no choice it stays on its own chain',
    [lastQuoteRequest.originAsset, lastQuoteRequest.destinationAsset],
    ['nep141:base-eth.omft.near', 'nep141:base-eth.omft.near']);
}

section('preparing the funding transfer');
{
  quoteReply = {
    quote: {
      depositAddress: '1click-deposit.near', depositMemo: null,
      deadline: new Date(Date.now() + 300_000).toISOString(),
      amountOutFormatted: '0.009911741', withdrawFee: '88259', timeEstimate: 7,
    },
  };
  const prepared = await service.prepare({
    accountId: ACCOUNT, asset, destinationAddress: SOL_ADDRESS, amount: '0.01',
  });

  ck('the real quote is not dry', lastQuoteRequest.dry, false);
  ck('funds go to the quote deposit address', prepared.depositAddress, '1click-deposit.near');

  const intent = prepared.payload.intents[0];
  ck('the funding is an ordinary transfer', intent.intent, 'transfer');
  ck('  to the deposit address', intent.receiver_id, '1click-deposit.near');
  ck('  of the exact amount', intent.tokens, { 'nep141:sol.omft.near': '10000000' });
  ck('signed by this account', prepared.payload.signer_id, ACCOUNT);
  ck('against the real verifier', prepared.payload.verifying_contract, 'intents.near');
}

ck('more than the balance is refused', await failsWith(() => service.prepare({
  accountId: ACCOUNT, asset, destinationAddress: SOL_ADDRESS, amount: '1',
})), 'INSUFFICIENT_BALANCE');
ck('no account is refused', await failsWith(() => service.prepare({
  accountId: null, asset, destinationAddress: SOL_ADDRESS, amount: '0.01',
})), 'NO_ACCOUNT');

section('a quote with no deposit address');
{
  quoteReply = { quote: { amountOutFormatted: '0.009', withdrawFee: '1', timeEstimate: 7 } };
  ck('is refused rather than published into the void', await failsWith(() => service.prepare({
    accountId: ACCOUNT, asset, destinationAddress: SOL_ADDRESS, amount: '0.01',
  })), 'NO_DEPOSIT_ADDRESS');
}

section('an expired deposit address');
{
  // Past the deadline 1Click warns funds sent may be lost, so publishing is
  // refused instead of raced.
  const stale = Object.freeze({
    depositAddress: '1click-deposit.near',
    depositDeadline: new Date(Date.now() - 1000).toISOString(),
    payload: {}, symbol: 'SOL', amount: '0.01',
  });
  ck('is never funded', await failsWith(() => service.execute(stale, 'ab'.repeat(32))), 'QUOTE_EXPIRED');

  const closing = Object.freeze({
    ...stale,
    depositDeadline: new Date(Date.now() + 5_000).toISOString(),
  });
  ck('nor is one about to expire', await failsWith(() => service.execute(closing, 'ab'.repeat(32))), 'QUOTE_EXPIRED');
}

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
