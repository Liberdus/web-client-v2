/**
 * Sending an intents balance: amount parsing and the checks before signing.
 *
 * The amount parser gets the most attention here because it is where money
 * bugs live -- a float would turn 0.1 BTC into a different number of satoshis,
 * and nothing downstream would notice.
 *
 *   node test/intents-transfer.mjs
 */
import { IntentsTransferService, parseTokenAmount } from '../intents-transfer.js';
import { normalizeIntentsToken } from '../intents-assets.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);
const code = (fn) => {
  try { fn(); return 'no error'; } catch (error) { return error.code || 'unknown'; }
};

const BTC = { assetId: 'nep141:btc.omft.near', decimals: 8, blockchain: 'btc', symbol: 'BTC', price: 86693 };

section('amount parsing');
ck('whole number', parseTokenAmount('1', 8).toString(), '100000000');
ck('decimal', parseTokenAmount('1.5', 8).toString(), '150000000');
ck('one satoshi', parseTokenAmount('0.00000001', 8).toString(), '1');
ck('leading dot', parseTokenAmount('.5', 8).toString(), '50000000');
ck('trailing dot', parseTokenAmount('2.', 8).toString(), '200000000');
ck('padded zeros do not change it', parseTokenAmount('1.50000000', 8).toString(), '150000000');
ck('zero decimals asset', parseTokenAmount('7', 0).toString(), '7');
ck('24-decimal asset', parseTokenAmount('1.000000000000000000000001', 24).toString(),
  '1000000000000000000000001');

// The float trap: Number('0.1') * 1e8 is 10000000.000000002.
ck('0.1 at 8 decimals is exact', parseTokenAmount('0.1', 8).toString(), '10000000');
ck('0.29 at 8 decimals is exact', parseTokenAmount('0.29', 8).toString(), '29000000');
ck('a big amount keeps every digit',
  parseTokenAmount('123456789.123456789012345678', 18).toString(),
  '123456789123456789012345678');

section('amounts that must be refused');
ck('empty', code(() => parseTokenAmount('', 8)), 'INVALID_AMOUNT');
ck('just a dot', code(() => parseTokenAmount('.', 8)), 'INVALID_AMOUNT');
ck('letters', code(() => parseTokenAmount('1.0abc', 8)), 'INVALID_AMOUNT');
ck('negative', code(() => parseTokenAmount('-1', 8)), 'INVALID_AMOUNT');
ck('two dots', code(() => parseTokenAmount('1.2.3', 8)), 'INVALID_AMOUNT');
ck('exponent notation', code(() => parseTokenAmount('1e8', 8)), 'INVALID_AMOUNT');
ck('a space inside', code(() => parseTokenAmount('1 000', 8)), 'INVALID_AMOUNT');
ck('nothing at all', code(() => parseTokenAmount(null, 8)), 'INVALID_AMOUNT');
ck('zero', code(() => parseTokenAmount('0', 8)), 'AMOUNT_NOT_POSITIVE');
ck('zero with decimals', code(() => parseTokenAmount('0.000', 8)), 'AMOUNT_NOT_POSITIVE');
// Silently rounding this would spend a different amount than was typed.
ck('more precision than the asset has', code(() => parseTokenAmount('0.000000001', 8)), 'TOO_PRECISE');
ck('any fraction on a 0-decimal asset', code(() => parseTokenAmount('1.5', 0)), 'TOO_PRECISE');
ck('nonsense decimals', code(() => parseTokenAmount('1', 1.5)), 'INVALID_DECIMALS');

section('checks before signing');
{
  const SENDER = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
  const RECIPIENT = '0x0551f7c9a91ee579c9e40444ffc490001c323108';
  let account = { keys: { address: SENDER } };
  const service = new IntentsTransferService({ getAccount: () => account });
  const asset = normalizeIntentsToken(BTC, '150000000'); // 1.5 BTC

  const failsWith = async (overrides) => {
    try {
      await service.prepare({ asset, recipientAddress: RECIPIENT, amount: '1', ...overrides });
      return 'no error';
    } catch (error) {
      return error.code || 'unknown';
    }
  };

  ck('no account signed in', await (async () => {
    account = null;
    const result = await failsWith({});
    account = { keys: { address: SENDER } };
    return result;
  })(), 'NO_ACCOUNT');

  ck('no asset', await failsWith({ asset: null }), 'NO_ASSET');
  ck('recipient is not an address', await failsWith({ recipientAddress: 'bob' }), 'INVALID_RECIPIENT');
  ck('recipient is missing', await failsWith({ recipientAddress: '' }), 'INVALID_RECIPIENT');
  // The verifier refuses this one anyway, but with "invalid intent".
  ck('sending to yourself', await failsWith({ recipientAddress: SENDER }), 'SELF_TRANSFER');
  ck('  even spelled differently', await failsWith({ recipientAddress: SENDER.toUpperCase() }), 'SELF_TRANSFER');
  ck('more than the balance', await failsWith({ amount: '2' }), 'INSUFFICIENT_BALANCE');
  ck('  exactly one satoshi more', await failsWith({ amount: '1.50000001' }), 'INSUFFICIENT_BALANCE');
  ck('zero', await failsWith({ amount: '0' }), 'AMOUNT_NOT_POSITIVE');
}

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
