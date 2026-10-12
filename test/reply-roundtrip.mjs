/**
 * A reply survives the trip from sender to another member.
 *
 * The reply fields ride inside the MLS application payload rather than in any
 * transaction field, so nothing on the wire declares them and nothing validates
 * them. That makes it easy for one narrowing step — a `{message, sent_timestamp}`
 * pick anywhere along the path — to drop them silently, with the sender's own
 * optimistic echo still looking correct. This asserts the receiving side really
 * sees them.
 *
 *   node test/reply-roundtrip.mjs
 */
import {
  getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage, createGroup,
  createCommit, joinGroup, encodeMlsMessage, decodeMlsMessage, defaultLifetime,
  makePskIndex, processPublicMessage, acceptAll, createApplicationMessage, processPrivateMessage,
} from '../external/ts-mls.js';

const S = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(S));
const te = new TextEncoder();
const td = new TextDecoder();
const caps = { versions: ['mls10'], ciphersuites: [S], extensions: [], proposals: [], credentials: ['basic'] };
const cred = (n) => ({ credentialType: 'basic', identity: te.encode(`m-${String(n).padStart(4, '0')}${'0'.repeat(40)}`) });
const empty = makePskIndex(undefined, {});
// The same envelope mlsEngine puts on the wire; encodeMlsMessage needs it.
const wrapPrivate = (pm) => ({ wireformat: 'mls_private_message', version: 'mls10', privateMessage: pm });
const wire = (pm) => decodeMlsMessage(encodeMlsMessage(wrapPrivate(pm)), 0)[0].privateMessage;

let pass = 0, fail = 0;
const chk = (n, ok, d = '') => {
  if (ok) { console.log(`  \x1b[32m✓\x1b[0m ${n}`); pass++; }
  else { console.log(`  \x1b[31m✗\x1b[0m ${n}${d ? '\n      ' + d : ''}`); fail++; }
};

console.log('\n\x1b[1mA reply survives sender -> receiver\x1b[0m\n');

// --- two members in one group ----------------------------------------------
const a = await generateKeyPackage(cred(0), caps, defaultLifetime, [], cs);
const b = await generateKeyPackage(cred(1), caps, defaultLifetime, [], cs);
let alice = await createGroup(te.encode('g'), a.publicPackage, a.privatePackage, [], cs);
const add = await createCommit(
  { state: alice, cipherSuite: cs, pskIndex: empty },
  { extraProposals: [{ proposalType: 'add', add: { keyPackage: b.publicPackage } }] },
);
alice = add.newState;
// joinGroup returns the state itself, not a {newState} wrapper.
let bob = await joinGroup(add.welcome, b.publicPackage, b.privatePackage, empty, cs, alice.ratchetTree);

// --- exactly what groupManager.sendGroupMessage builds ----------------------
const SENDER = '0xalice';
const payloadOut = {
  message: 'Hey man!',
  sent_timestamp: 1787600000000,
  replyId: 'tx-of-the-original',
  replyMessage: 'hello 2',
  replyFrom: '0xbob',
  from: SENDER, // encryptMessage adds this
};
const enc = await createApplicationMessage(alice, te.encode(JSON.stringify(payloadOut)), cs);
alice = enc.newState;

// --- and what the receiving side parses -------------------------------------
const dec = await processPrivateMessage(bob, wire(enc.privateMessage), empty, cs);
bob = dec.newState;
const payloadIn = JSON.parse(td.decode(dec.message));

chk('the message text arrives', payloadIn.message === 'Hey man!');
chk('replyId survives', payloadIn.replyId === 'tx-of-the-original', `got ${payloadIn.replyId}`);
chk('replyMessage survives', payloadIn.replyMessage === 'hello 2', `got ${payloadIn.replyMessage}`);
chk('replyFrom survives', payloadIn.replyFrom === '0xbob', `got ${payloadIn.replyFrom}`);

// --- the record groupManager then stores, field for field --------------------
const stored = {
  txid: 'tx-incoming',
  from: SENDER,
  message: payloadIn.message,
  sent_timestamp: payloadIn.sent_timestamp,
  timestamp: 1787600000001,
  mine: false,
  replyId: payloadIn.replyId,
  replyMessage: payloadIn.replyMessage,
  replyFrom: payloadIn.replyFrom,
};
chk('the stored record carries the quote', !!(stored.replyId && stored.replyMessage && stored.replyFrom));

// --- and what the renderer keys off -----------------------------------------
chk('the renderer would emit a quote for it', !!stored.replyId);

// --- an ordinary message must not grow empty reply fields --------------------
const plainOut = { message: 'hi', sent_timestamp: 1787600000002, from: SENDER };
const enc2 = await createApplicationMessage(alice, te.encode(JSON.stringify(plainOut)), cs);
alice = enc2.newState;
const dec2 = await processPrivateMessage(bob, wire(enc2.privateMessage), empty, cs);
const plainIn = JSON.parse(td.decode(dec2.message));
chk('a plain message carries no replyId', plainIn.replyId === undefined);
chk('  and so renders no quote', !plainIn.replyId);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
