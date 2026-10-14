/**
 * Threat model T7: a group message the client lets you send must be one the
 * network accepts.
 *
 * The network refuses group messages over 4 kB, because every message travels
 * with the group's whole account. The client caps a draft at 1,000 bytes, like
 * 1:1, measured as the text is sent (JSON-encoded), so that even the worst
 * characters, with a reply, encrypt to well under 4 kB.
 *
 *   node test/group-message-size.mjs
 */
import {
  getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage, createGroup,
  defaultLifetime, createApplicationMessage, encodeMlsMessage,
} from '../external/ts-mls.js';
import { groupMessageSize, sendGroupMessage, GROUP_MESSAGE_MAX_BYTES } from '../groupManager.js';

const NETWORK_LIMIT = 4 * 1024; // groupAppMessageSizeLimit on the server

let pass = 0, fail = 0;
const chk = (n, ok, d = '') => {
  if (ok) { console.log(`  \x1b[32m✓\x1b[0m ${n}`); pass++; }
  else { console.log(`  \x1b[31m✗\x1b[0m ${n}${d ? '\n      ' + d : ''}`); fail++; }
};

console.log('\n\x1b[1mGroup message size (T7)\x1b[0m\n');

chk('the limit is 1,000 bytes, as in 1:1', GROUP_MESSAGE_MAX_BYTES === 1000);
chk('1,000 ASCII bytes can be sent', groupMessageSize('x'.repeat(1000)).ok);
chk('1,001 cannot', !groupMessageSize('x'.repeat(1001)).ok);
chk('bytes, not characters: 250 emoji fit, 251 do not',
  groupMessageSize('😀'.repeat(250)).ok && !groupMessageSize('😀'.repeat(251)).ok);
chk('a control character counts as the six bytes JSON writes',
  groupMessageSize('\u0001'.repeat(166)).bytes === 996 && !groupMessageSize('\u0001'.repeat(167)).ok);

// The send path refuses before touching MLS state or the network.
let refused = '';
try { await sendGroupMessage('9'.repeat(64), 'x'.repeat(1001)); } catch (e) { refused = e.message; }
chk('sendGroupMessage refuses an over-limit draft', /too long/.test(refused), refused);

// --- the largest drafts the client allows, encrypted as mlsEngine does -----
const S = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(S));
const te = new TextEncoder();
const caps = { versions: ['mls10'], ciphersuites: [S], extensions: [], proposals: [], credentials: ['basic'] };
const kp = await generateKeyPackage({ credentialType: 'basic', identity: te.encode('a'.repeat(64)) }, caps, defaultLifetime, [], cs);
let state = await createGroup(te.encode('g'), kp.publicPackage, kp.privatePackage, [], cs);

/** The longest run of `ch` the client lets through. */
const longest = (ch) => { let t = ''; while (groupMessageSize(t + ch).ok) t += ch; return t; };
// What groupUI's truncateReplyText produces at most: 40 characters and '...'.
const reply = (ch) => ({ replyId: 'f'.repeat(64), replyMessage: ch.repeat(40) + '...', replyFrom: 'e'.repeat(64) });

let largest = 0;
for (const [name, ch] of [['ASCII', 'x'], ['emoji', '😀'], ['quotes', '"'], ['control characters', '\u0001'], ['lone surrogates', '\ud800']]) {
  const payload = { message: longest(ch), sent_timestamp: Date.now(), ...reply(ch), from: 'a'.repeat(64) };
  const r = await createApplicationMessage(state, te.encode(JSON.stringify(payload)), cs);
  state = r.newState;
  const onChain = Buffer.from(encodeMlsMessage({ wireformat: 'mls_private_message', version: 'mls10', privateMessage: r.privateMessage })).toString('base64').length;
  largest = Math.max(largest, onChain);
  chk(`the largest ${name} draft, with a reply, fits the network's 4 kB (${onChain} B)`, onChain <= NETWORK_LIMIT);
}
chk('with room to spare: under 3 kB', largest < 3 * 1024, `${largest} B`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
