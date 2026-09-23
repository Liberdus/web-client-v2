/**
 * Chat payments: the announcement, and what a peer is allowed to say.
 *
 * Most of this is about incoming messages. A payment bubble is a persuasive
 * thing to be able to forge, and every field of one arrives from someone else,
 * so parseTransferMessage is the boundary that decides what may be rendered
 * at all.
 *
 *   node test/intents-chat.mjs
 */
import {
  INTENTS_CHAT_MESSAGE_TYPE,
  buildTransferMessage,
  parseTransferMessage,
  verifyTransferClaim,
} from '../intents-chat.js';

let pass = 0, fail = 0;
const ck = (n, g, w) => {
  const ok = JSON.stringify(g) === JSON.stringify(w);
  ok ? pass++ : fail++;
  console.log((ok ? 'ok  ' : 'FAIL') + '  ' + n + (ok ? '' : `\n        got  ${JSON.stringify(g)}\n        want ${JSON.stringify(w)}`));
};
const section = (s) => console.log(`\n-- ${s}`);

const GOOD = {
  type: INTENTS_CHAT_MESSAGE_TYPE,
  assetId: 'nep141:sol.omft.near',
  symbol: 'SOL',
  chainName: 'Solana',
  amount: '0.01',
  decimals: 9,
  intentHash: '8LKE47o44ybZQR9ozLyDnvMDTh4Ao5ipy2mJWsYByG5Q',
};
const withGood = (overrides) => parseTransferMessage({ ...GOOD, ...overrides });

section('the announcement we send');
{
  const message = buildTransferMessage({
    assetId: 'nep141:sol.omft.near', symbol: 'SOL', chainName: 'Solana',
    amount: '0.01', decimals: 9, intentHash: GOOD.intentHash,
  });
  ck('is typed so the renderer can find it', message.type, INTENTS_CHAT_MESSAGE_TYPE);
  ck('carries the intent hash that proves it', message.intentHash, GOOD.intentHash);
  ck('carries no note by default', message.note, undefined);
  ck('a note is kept', buildTransferMessage({ ...GOOD, note: 'lunch' }).note, 'lunch');
  ck('and truncated', buildTransferMessage({ ...GOOD, note: 'x'.repeat(300) }).note.length, 140);
}

section('a well-formed claim');
{
  const claim = parseTransferMessage(GOOD);
  ck('is accepted', claim.amount, '0.01');
  ck('  with its symbol', claim.symbol, 'SOL');
  ck('  and is frozen', Object.isFrozen(claim), true);
  ck('a whole-number amount', withGood({ amount: '5' }).amount, '5');
}

section('claims that must not render');
ck('nothing at all', parseTransferMessage(null), null);
ck('another message type', parseTransferMessage({ type: 'message', message: 'hi' }), null);
// A renderer showing "0 SOL" still looks like a payment happened.
ck('zero', withGood({ amount: '0' }), null);
ck('zero with decimals', withGood({ amount: '0.000' }), null);
ck('negative', withGood({ amount: '-1' }), null);
ck('exponent', withGood({ amount: '1e9' }), null);
ck('not a number', withGood({ amount: 'lots' }), null);
ck('a number, not a string', withGood({ amount: 0.01 }), null);
ck('missing amount', withGood({ amount: undefined }), null);
ck('missing symbol', withGood({ symbol: '' }), null);
ck('missing asset id', withGood({ assetId: '' }), null);
ck('missing intent hash', withGood({ intentHash: '' }), null);
// The hash reaches a URL and a lookup, so keep it to plain characters.
ck('an intent hash with punctuation', withGood({ intentHash: '../../etc/passwd' }), null);
ck('an intent hash with a space', withGood({ intentHash: 'abc def' }), null);
ck('an absurd asset id', withGood({ assetId: 'n'.repeat(400) }), null);
ck('an absurd symbol', withGood({ symbol: 'S'.repeat(40) }), null);

section('fields a peer may bend but not break');
ck('a silly chain name is truncated', withGood({ chainName: 'C'.repeat(90) }).chainName.length, 32);
ck('a missing chain name is empty, not undefined', withGood({ chainName: undefined }).chainName, '');
ck('nonsense decimals become null', withGood({ decimals: 999 }).decimals, null);
ck('  as do fractional ones', withGood({ decimals: 1.5 }).decimals, null);
ck('  and negative ones', withGood({ decimals: -1 }).decimals, null);
ck('a long note is truncated', withGood({ note: 'x'.repeat(300) }).note.length, 140);
ck('an empty note is null', withGood({ note: '   ' }).note, null);

section('verifying a claim');
{
  const settled = await verifyTransferClaim(GOOD, {
    getStatus: async () => ({ status: 'SETTLED', transactionHash: 'abc' }),
  });
  ck('a settled intent verifies', settled.state, 'settled');
  ck('  and names the transaction', settled.transactionHash, 'abc');

  ck('a pending intent is pending', (await verifyTransferClaim(GOOD, {
    getStatus: async () => ({ status: 'PENDING' }),
  })).state, 'pending');

  ck('anything else is a failure', (await verifyTransferClaim(GOOD, {
    getStatus: async () => ({ status: 'NOT_FOUND_OR_NOT_VALID' }),
  })).state, 'failed');

  // An unreachable relay is not evidence either way, and must not read as one.
  ck('an unreachable relay is unverifiable, not settled', (await verifyTransferClaim(GOOD, {
    getStatus: async () => { throw new Error('offline'); },
  })).state, 'unverifiable');

  ck('a claim with no hash is unverifiable', (await verifyTransferClaim({ amount: '1' })).state, 'unverifiable');
}

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
