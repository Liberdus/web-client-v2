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
  paymentStatusLabel,
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

section('verifying a claim against the logged transfer');
{
  // A real payment: 0.250059 USDT (BNB Chain), nearintent -> firefox,
  // 2026-09-28. The transfer is the verifier's own log of it, as
  // fetchIntentTransfers returned it from the settlement transaction.
  const SENDER = '0x8147165a17c70371a4d390c1799630c074ac6991';
  const RECIPIENT = '0x3c576fc4b2b97a1bccfa10c2cae6333ae17d70b3';
  const USDT = 'nep245:v2_1.omni.hot.tg:56_2CMMyVTGZkeyNZTSvS5sarzfir6g';
  const TX = '9B1FBNKGRFZQicHABTivUvG6Mf9jJaAcDyddNouNHKp8';
  const LOGGED = {
    intentHash: 'HDEyCMyfubvoVeuZueoSHYzgPc2i4SfksMksakVLV6h7',
    from: SENDER, to: RECIPIENT, tokens: { [USDT]: '250059000000000000' }, memo: 'liberdus chat payment',
  };
  const CLAIM = parseTransferMessage({
    type: INTENTS_CHAT_MESSAGE_TYPE, assetId: USDT, symbol: 'USDT', chainName: 'BNB Chain',
    amount: '0.250059', decimals: 18, intentHash: LOGGED.intentHash, transactionHash: TX,
  });
  const parties = { expectedFrom: SENDER, expectedTo: RECIPIENT };
  const logged = (transfers) => async () => transfers;
  const asked = [];
  const noRelay = async (hash) => { asked.push(hash); throw new Error('the relay should not be needed'); };

  const good = await verifyTransferClaim(CLAIM, { ...parties, getStatus: noRelay, getTransfers: logged([LOGGED]) });
  ck('the real payment verifies against its transaction', good.state, 'settled');
  ck('  without asking the relay, which forgets', asked, []);
  ck('addresses compare without regard to case', (await verifyTransferClaim(CLAIM, {
    expectedFrom: SENDER.toUpperCase().replace('0X', '0x'), expectedTo: RECIPIENT, getTransfers: logged([LOGGED]),
  })).state, 'settled');

  // Each way of forging a receipt from someone else's real transfer.
  const forged = [
    ['another sender', { expectedFrom: '0x0551f7c9a91ee579c9e40444ffc490001c323108', expectedTo: RECIPIENT }, CLAIM],
    ['another recipient', { expectedFrom: SENDER, expectedTo: '0x0551f7c9a91ee579c9e40444ffc490001c323108' }, CLAIM],
    ['a bigger amount', parties, { ...CLAIM, amount: '25' }],
    ['a rounded amount', parties, { ...CLAIM, amount: '0.25' }],
    ['another token', parties, { ...CLAIM, assetId: 'nep141:sol.omft.near', decimals: 9 }],
    ['another intent in the same transaction', parties, { ...CLAIM, intentHash: 'FARxyZwEeCbymAngPdM8BgU8Bck9jZADawuGMyBfjxc5' }],
  ];
  for (const [label, who, claim] of forged) {
    const result = await verifyTransferClaim(claim, { ...who, getTransfers: logged([LOGGED]) });
    ck(`claiming ${label} is not confirmed`, result.state, 'failed');
  }
  ck('  and says why', (await verifyTransferClaim({ ...CLAIM, amount: '25' }, { ...parties, getTransfers: logged([LOGGED]) })).reason,
    'The transfer went to a different amount');
  ck('a claim with no decimals cannot be checked, so is not confirmed',
    (await verifyTransferClaim({ ...CLAIM, decimals: null }, { ...parties, getTransfers: logged([LOGGED]) })).state, 'failed');

  // Older receipts name no transaction: the relay names it while it remembers.
  const oldStyle = { ...CLAIM, transactionHash: null };
  const viaRelay = await verifyTransferClaim(oldStyle, {
    ...parties,
    getStatus: async () => ({ status: 'SETTLED', transactionHash: TX }),
    getTransfers: async (tx) => (tx === TX ? [LOGGED] : []),
  });
  ck('an older receipt is checked through the transaction the relay names', viaRelay.state, 'settled');
  ck('  and the transaction is kept', viaRelay.transactionHash, TX);
  ck('settled on the relay is not enough without a matching transfer', (await verifyTransferClaim(oldStyle, {
    ...parties, getStatus: async () => ({ status: 'SETTLED', transactionHash: TX }), getTransfers: logged([]),
  })).state, 'failed');

  ck('in flight is pending', (await verifyTransferClaim(oldStyle, {
    getStatus: async () => ({ status: 'TX_BROADCASTED' }),
  })).state, 'pending');
  ck('an unreadable transaction is not evidence either way', (await verifyTransferClaim(CLAIM, {
    ...parties, getTransfers: async () => { throw new Error('archival node down'); },
  })).state, 'unverifiable');
  ck('an unreachable relay is unverifiable, not settled', (await verifyTransferClaim(oldStyle, {
    getStatus: async () => { throw new Error('offline'); },
  })).state, 'unverifiable');
  ck('a claim with no hash is unverifiable', (await verifyTransferClaim({ amount: '1' })).state, 'unverifiable');

  // The relay forgets: a real payment from days ago comes back "not found".
  const now = Date.parse('2026-09-28T12:00:00Z');
  const notFound = async () => ({ status: 'NOT_FOUND_OR_NOT_VALID' });
  ck('unknown and fresh is a failure -- a real payment is known at once',
    (await verifyTransferClaim(oldStyle, { getStatus: notFound, sentAt: now - 60_000, now })).state, 'failed');
  ck('unknown and old is too old to check, not an accusation',
    (await verifyTransferClaim(oldStyle, { getStatus: notFound, sentAt: now - 3 * 86_400_000, now })).state, 'expired');
  ck('age never excuses an explicit failure', (await verifyTransferClaim(oldStyle, {
    getStatus: async () => ({ status: 'FAILED' }), sentAt: now - 3 * 86_400_000, now,
  })).state, 'failed');
  ck('with no time to go on, unknown stays a failure',
    (await verifyTransferClaim(oldStyle, { getStatus: notFound, now })).state, 'failed');
  ck('the label says why, and accuses no one', paymentStatusLabel('expired'), 'Too old to check');
}

section('the transaction a receipt names');
{
  ck('a base58 transaction hash is kept', withGood({ transactionHash: '9B1FBNKGRFZQicHABTivUvG6Mf9jJaAcDyddNouNHKp8' }).transactionHash,
    '9B1FBNKGRFZQicHABTivUvG6Mf9jJaAcDyddNouNHKp8');
  ck('anything else is dropped, not trusted', withGood({ transactionHash: '0x<img src=x>' }).transactionHash, null);
  ck('  without rejecting the claim', withGood({ transactionHash: 'nope' })?.intentHash, GOOD.intentHash);
  ck('the receipt we send names it when settled',
    buildTransferMessage({ ...GOOD, transactionHash: '9B1FBNKGRFZQicHABTivUvG6Mf9jJaAcDyddNouNHKp8' }).transactionHash,
    '9B1FBNKGRFZQicHABTivUvG6Mf9jJaAcDyddNouNHKp8');
  ck('  and leaves it out when not', 'transactionHash' in buildTransferMessage(GOOD), false);
}

console.log(`\n${fail ? 'FAIL' : 'PASS'}  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
