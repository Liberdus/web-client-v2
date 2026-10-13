/**
 * Threat model T3: leaving must actually end a member's access.
 *
 * group_leave takes an account off the roster but leaves its leaf in the MLS
 * tree, and the leaver keeps every key it held. Until a remaining member
 * commits the Remove, the leaver's retained state decrypts the group -- this
 * test shows that first, so it is clear what the fix is for.
 *
 * The fix: every member works out the same designated remover from its tree
 * and the roster (groupDeparture.js); that member commits the Remove; the
 * others check it against the network's record (groupCommitCheck.js) and apply
 * it. Afterwards the leaver's retained state can neither derive the new epoch
 * nor read the next message, even stepping the PSK ratchet as members do.
 *
 *   node test/leave-effective.mjs
 */
import {
  getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage,
  createGroup, createCommit, makePskIndex, defaultLifetime, joinGroup,
  encodeMlsMessage, decodeMlsMessage, processPublicMessage, processPrivateMessage,
  createApplicationMessage, mlsExporter, acceptAll,
} from '../external/ts-mls.js'; // the bundle we actually ship, not node_modules
import { randomBytes } from '@noble/hashes/utils.js';
import { checkCommitAgainstRecord } from '../groupCommitCheck.js';
import { departedMembers, designatedRemover, shouldRemoveDeparted } from '../groupDeparture.js';

const SUITE = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(SUITE));
const te = new TextEncoder();
const td = new TextDecoder();
const caps = { versions: ['mls10'], ciphersuites: [SUITE], extensions: [], proposals: [], credentials: ['basic'] };
const ADDR = { A: 'a'.repeat(64), B: 'b'.repeat(64), C: 'c'.repeat(64) };
const hex = (u) => Buffer.from(u).toString('hex');
const ratchet = async (p) => new Uint8Array(await cs.kdf.expand(p, te.encode('liberdus-pq-psk'), cs.kdf.size));
const pskFor = (id, secret) => makePskIndex(undefined, { [Buffer.from(id).toString('base64')]: secret });
const roundTrip = (msg) => decodeMlsMessage(encodeMlsMessage(msg), 0)[0];
const exporter = async (s) => hex(await mlsExporter(s.keySchedule.exporterSecret, te.encode('probe'), new Uint8Array(), 32, cs));
const rosterOf = (s) => s.ratchetTree.filter((n, i) => i % 2 === 0 && n && n.leaf).map((n) => td.decode(n.leaf.credential.identity));
const leafIndexOf = (s, who) => s.ratchetTree.findIndex((n, i) => i % 2 === 0 && n && n.leaf && td.decode(n.leaf.credential.identity) === ADDR[who]) / 2;
const asPrivate = (pm) => roundTrip({ wireformat: 'mls_private_message', version: 'mls10', privateMessage: pm }).privateMessage;

const failures = [];
const step = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : '\x1b[31mBAD\x1b[0m '} ${label}${detail ? `\n         ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

const kp = {};
for (const w of ['A', 'B', 'C']) kp[w] = await generateKeyPackage({ credentialType: 'basic', identity: te.encode(ADDR[w]) }, caps, defaultLifetime, [], cs);

// --- A founds the group with B and C ---------------------------------------------
let psk = randomBytes(cs.kdf.size);
psk = await ratchet(psk);
let id = randomBytes(16);
const setup = await createCommit(
  { state: await createGroup(te.encode('g'), kp.A.publicPackage, kp.A.privatePackage, [], cs), cipherSuite: cs, pskIndex: pskFor(id, psk) },
  { wireAsPublicMessage: true, extraProposals: [
    { proposalType: 'add', add: { keyPackage: kp.B.publicPackage } },
    { proposalType: 'add', add: { keyPackage: kp.C.publicPackage } },
    { proposalType: 'psk', psk: { preSharedKeyId: { psktype: 'external', pskId: id, pskNonce: randomBytes(cs.kdf.size) } } },
  ] },
);
let A = setup.newState;
let B = await joinGroup(setup.welcome, kp.B.publicPackage, kp.B.privatePackage, pskFor(id, psk), cs, A.ratchetTree);
const cRetained = await joinGroup(setup.welcome, kp.C.publicPackage, kp.C.privatePackage, pskFor(id, psk), cs, A.ratchetTree);
const pskAtLeave = psk;

console.log('\n\x1b[1mT3 - does leaving end a member\'s access?\x1b[0m\n');

// --- C leaves: off the roster, leaf still in the tree ----------------------------
const roster = [ADDR.A, ADDR.B];
const before = await createApplicationMessage(A, te.encode('said after C left'), cs);
A = before.newState;
const leaked = await processPrivateMessage(cRetained, asPrivate(before.privateMessage), makePskIndex(undefined, {}), cs, acceptAll);
step('the gap: before anyone removes C, C still reads the group', leaked.kind === 'applicationMessage' && td.decode(leaked.message) === 'said after C left');

// --- every member agrees on who removes C ---------------------------------------
const departedA = departedMembers(rosterOf(A), roster, ADDR.A);
const departedB = departedMembers(rosterOf(B), roster, ADDR.B);
step('A and B both see C as departed', departedA.join() === ADDR.C && departedB.join() === ADDR.C);
const designated = designatedRemover(rosterOf(B), roster);
step('both name A (the lowest leaf on the roster) as the remover', designated === ADDR.A && designatedRemover(rosterOf(A), roster) === ADDR.A);
const t0 = 1_000_000;
step('B waits while the grace period runs', !shouldRemoveDeparted({ departed: departedB, designated, me: ADDR.B, oldestSince: t0, now: t0 + 60_000, graceMs: 120_000 }));
step('B may act once it has passed', shouldRemoveDeparted({ departed: departedB, designated, me: ADDR.B, oldestSince: t0, now: t0 + 120_000, graceMs: 120_000 }));
step('A acts at once', shouldRemoveDeparted({ departed: departedA, designated, me: ADDR.A, oldestSince: t0, now: t0, graceMs: 120_000 }));

// --- A commits the Remove; B checks and applies it -------------------------------
psk = await ratchet(psk);
id = randomBytes(16);
const rm = await createCommit(
  { state: A, cipherSuite: cs, pskIndex: pskFor(id, psk) },
  { wireAsPublicMessage: true, extraProposals: [
    { proposalType: 'remove', remove: { removed: leafIndexOf(A, 'C') } },
    { proposalType: 'psk', psk: { preSharedKeyId: { psktype: 'external', pskId: id, pskNonce: randomBytes(cs.kdf.size) } } },
  ] },
);
A = rm.newState;
const record = { from: ADDR.A, addedMembers: [], removedMembers: departedA };
try {
  const message = roundTrip(rm.commit);
  checkCommitAgainstRecord(message, B.ratchetTree, record);
  B = (await processPublicMessage(B, message.publicMessage, pskFor(id, psk), cs, acceptAll)).newState;
  step("B checks A's removal of C against the record and applies it", (await exporter(A)) === (await exporter(B)));
} catch (e) {
  step("B checks A's removal of C against the record and applies it", false, e.message);
}

// --- C's retained state, even stepping the PSK as members do ----------------------
let cDerived = null;
try {
  const cPsk = await ratchet(pskAtLeave);
  const out = await processPublicMessage(cRetained, roundTrip(rm.commit).publicMessage, pskFor(id, cPsk), cs, acceptAll);
  cDerived = await exporter(out.newState);
} catch {
  // refusing the commit outright is the expected outcome
}
step('after the removal, C cannot derive the new epoch', cDerived === null || cDerived !== (await exporter(A)));

const after = await createApplicationMessage(A, te.encode('said after the removal'), cs);
let cRead = null;
try {
  const r = await processPrivateMessage(cRetained, asPrivate(after.privateMessage), makePskIndex(undefined, {}), cs, acceptAll);
  if (r.kind === 'applicationMessage') cRead = td.decode(r.message);
} catch {
  // expected
}
step('and cannot read the next message', cRead === null);

console.log('');
if (failures.length) {
  console.log(`  \x1b[31m\x1b[1mFAIL\x1b[0m  ${failures.length} step(s) failed.\n`);
  process.exit(1);
}
console.log('  \x1b[32m\x1b[1mPASS\x1b[0m  leaving ends access once the designated member removes the leaf.\n');
