/**
 * Threat model T2 (the part no network check can catch): a member signs a
 * well-formed commit that nobody else can apply, and every honest member is
 * stuck. Recovery is rejoining by external commit from the checkpoint each
 * commit publishes (RFC 9420 s12.4.3.2) -- mlsEngine.resync on the client.
 *
 * The attack is the one a member can actually mount. B, an ordinary member,
 * commits with a PSK proposal whose secret is not the group's ratchet value.
 * The network accepts it (the signature verifies; the pskId matches the
 * proposal), but members step their own PSK and derive different secrets, so
 * the commit will not apply for anyone but B.
 *
 * Then: C rejoins from B's checkpoint, A rejoins from C's, every client checks
 * each rejoin with groupCommitCheck before applying it, and A -- the admin --
 * removes B. The test passes if A and C end up sharing a key schedule without
 * B, having stepped their PSK by the network's count rather than by guesswork.
 *
 *   node test/resync.mjs
 */
import {
  getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage, generateKeyPackageWithKey,
  createGroup, createCommit, makePskIndex, defaultLifetime, joinGroup, joinGroupExternal,
  createGroupInfoWithExternalPub, encodeMlsMessage, decodeMlsMessage, processPublicMessage,
  createApplicationMessage, processPrivateMessage, mlsExporter, acceptAll,
} from '../external/ts-mls.js'; // the bundle we actually ship, not node_modules
import { randomBytes } from '@noble/hashes/utils.js';
import { checkCommitAgainstRecord } from '../groupCommitCheck.js';

const SUITE = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(SUITE));
const te = new TextEncoder();
const td = new TextDecoder();
const caps = { versions: ['mls10'], ciphersuites: [SUITE], extensions: [], proposals: [], credentials: ['basic'] };
const ADDR = { A: 'a'.repeat(64), B: 'b'.repeat(64), C: 'c'.repeat(64) };
const hex = (u) => Buffer.from(u).toString('hex');

// The PSK ratchet, as mlsEngine runs it: members step it once per PSK commit.
const ratchet = async (p) => new Uint8Array(await cs.kdf.expand(p, te.encode('liberdus-pq-psk'), cs.kdf.size));
const pskFor = (id, secret) => makePskIndex(undefined, { [Buffer.from(id).toString('base64')]: secret });
const pskProp = (id, nonce) => ({ proposalType: 'psk', psk: { preSharedKeyId: { psktype: 'external', pskId: id, pskNonce: nonce } } });
const roundTrip = (msg) => decodeMlsMessage(encodeMlsMessage(msg), 0)[0];
const exporter = async (s) => hex(await mlsExporter(s.keySchedule.exporterSecret, te.encode('probe'), new Uint8Array(), 32, cs));
const leafIndexOf = (state, who) => state.ratchetTree.findIndex((n, i) =>
  i % 2 === 0 && n && n.leaf && td.decode(n.leaf.credential.identity) === ADDR[who]) / 2;
const roster = (state) => state.ratchetTree.filter((n, i) => i % 2 === 0 && n && n.leaf)
  .map((n) => Object.keys(ADDR).find((k) => ADDR[k] === td.decode(n.leaf.credential.identity))).sort().join('');

// Each member: MLS state, PSK and how many PSK steps it has taken.
const kp = {};
for (const w of ['A', 'B', 'C']) kp[w] = await generateKeyPackage({ credentialType: 'basic', identity: te.encode(ADDR[w]) }, caps, defaultLifetime, [], cs);
const sigKeys = (w) => ({ signKey: kp[w].privatePackage.signaturePrivateKey, publicKey: kp[w].publicPackage.leafNode.signaturePublicKey });

let networkPskCount = 0; // what the network counts: commits that carried a PSK
const failures = [];
const step = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : '\x1b[31mBAD\x1b[0m '} ${label}${detail ? `\n         ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

/** A member's commit, with its record and the checkpoint it publishes. */
async function memberCommit(member, who, proposals, { psk = null } = {}) {
  let pskIndex = makePskIndex(undefined, {});
  const extra = [...proposals];
  let pskId = '';
  if (psk) {
    const id = randomBytes(16);
    pskIndex = pskFor(id, psk);
    extra.push(pskProp(id, randomBytes(cs.kdf.size)));
    pskId = Buffer.from(id).toString('base64');
  }
  const out = await createCommit({ state: member.state, cipherSuite: cs, pskIndex }, { wireAsPublicMessage: true, extraProposals: extra });
  if (pskId) networkPskCount += 1;
  return { commit: out.commit, newState: out.newState, welcome: out.welcome, pskIndex, record: { from: ADDR[who], addedMembers: [], removedMembers: [], pskId }, checkpoint: await createGroupInfoWithExternalPub(out.newState, [], cs) };
}

/** What mlsEngine.applyCommit does, including the PSK step and the client check. */
async function apply(member, built) {
  const message = roundTrip(built.commit);
  checkCommitAgainstRecord(message, member.state.ratchetTree, built.record);
  const nextPsk = built.record.pskId ? await ratchet(member.psk) : member.psk;
  const index = built.record.pskId ? pskFor(Buffer.from(built.record.pskId, 'base64'), nextPsk) : makePskIndex(undefined, {});
  const r = await processPublicMessage(member.state, message.publicMessage, index, cs, acceptAll);
  return { state: r.newState, psk: nextPsk, pskCount: member.pskCount + (built.record.pskId ? 1 : 0) };
}

/** What mlsEngine.resync does: step the PSK to the network's count, rejoin from the checkpoint. */
async function rejoin(member, who, checkpoint, tree) {
  let psk = member.psk;
  for (let i = member.pskCount; i < networkPskCount; i++) psk = await ratchet(psk);
  const fresh = await generateKeyPackageWithKey({ credentialType: 'basic', identity: te.encode(ADDR[who]) }, caps, defaultLifetime, [], sigKeys(who), cs);
  const out = await joinGroupExternal(checkpoint, fresh.publicPackage, fresh.privatePackage, true, cs, tree);
  const commit = { wireformat: 'mls_public_message', version: 'mls10', publicMessage: out.publicMessage };
  return {
    member: { state: out.newState, psk, pskCount: networkPskCount },
    built: { commit, pskIndex: makePskIndex(undefined, {}), record: { from: ADDR[who], addedMembers: [], removedMembers: [], pskId: '' }, checkpoint: await createGroupInfoWithExternalPub(out.newState, [], cs) },
  };
}

console.log('\n\x1b[1mT2 - can members recover from a commit nobody can apply?\x1b[0m\n');

// --- A founds the group and adds B and C (PSK commit #1) -------------------------
const psk0 = randomBytes(cs.kdf.size);
let A = { state: await createGroup(te.encode('g'), kp.A.publicPackage, kp.A.privatePackage, [], cs), psk: psk0, pskCount: 0 };
const psk1 = await ratchet(psk0);
const setup = await memberCommit(A, 'A', [
  { proposalType: 'add', add: { keyPackage: kp.B.publicPackage } },
  { proposalType: 'add', add: { keyPackage: kp.C.publicPackage } },
], { psk: psk1 });
A = { state: setup.newState, psk: psk1, pskCount: 1 };
let B = { state: await joinGroup(setup.welcome, kp.B.publicPackage, kp.B.privatePackage, setup.pskIndex, cs, A.state.ratchetTree), psk: psk1, pskCount: 1 };
let C = { state: await joinGroup(setup.welcome, kp.C.publicPackage, kp.C.privatePackage, setup.pskIndex, cs, A.state.ratchetTree), psk: psk1, pskCount: 1 };
step('A, B and C share epoch 1', (await exporter(A.state)) === (await exporter(C.state)) && (await exporter(B.state)) === (await exporter(C.state)));

// --- B commits with a PSK that is not the group's (PSK commit #2) ----------------
const bad = await memberCommit(B, 'B', [], { psk: randomBytes(cs.kdf.size) });
B = { state: bad.newState, psk: B.psk, pskCount: 2 };
let aStuck = false;
let cStuck = false;
try { await apply(A, bad); } catch { aStuck = true; }
try { await apply(C, bad); } catch { cStuck = true; }
step("B's commit verifies but neither A nor C can apply it", aStuck && cStuck);

// --- C rejoins from B's checkpoint; B applies it ---------------------------------
const c = await rejoin(C, 'C', bad.checkpoint, B.state.ratchetTree);
C = c.member;
step('C stepped its PSK to the network count', C.pskCount === 2);
try {
  B = await apply(B, c.built);
  step("B checks and applies C's rejoin", true);
} catch (e) {
  step("B checks and applies C's rejoin", false, e.message);
}

// --- A rejoins from C's checkpoint; B and C apply it -----------------------------
const a = await rejoin(A, 'A', c.built.checkpoint, C.state.ratchetTree);
A = a.member;
try {
  C = await apply(C, a.built);
  B = await apply(B, a.built);
  step("B and C check and apply A's rejoin", true);
} catch (e) {
  step("B and C check and apply A's rejoin", false, e.message);
}
step('everyone is back on one epoch, three leaves', roster(A.state) === 'ABC' && (await exporter(A.state)) === (await exporter(C.state)));

// A message from A reaches C.
const sent = await createApplicationMessage(A.state, te.encode('back in step'), cs);
A = { ...A, state: sent.newState };
const got = await processPrivateMessage(C.state, roundTrip({ wireformat: 'mls_private_message', version: 'mls10', privateMessage: sent.privateMessage }).privateMessage, makePskIndex(undefined, {}), cs, acceptAll);
step('a message from A decrypts at C', got.kind === 'applicationMessage' && td.decode(got.message) === 'back in step');

// --- A removes B with the next PSK (PSK commit #3); C applies it -----------------
const psk3 = await ratchet(A.psk);
const rm = await memberCommit(A, 'A', [{ proposalType: 'remove', remove: { removed: leafIndexOf(A.state, 'B') } }], { psk: psk3 });
rm.record.removedMembers = [ADDR.B];
A = { state: rm.newState, psk: psk3, pskCount: 3 };
try {
  C = await apply(C, rm);
  step("C applies A's removal of B: their stepped PSKs agree", (await exporter(A.state)) === (await exporter(C.state)) && roster(C.state) === 'AC');
} catch (e) {
  step("C applies A's removal of B: their stepped PSKs agree", false, e.message);
}

// --- what the client check refuses -----------------------------------------------
const refused = (label, fn) => { try { fn(); step(label, false, 'accepted'); } catch (e) { step(label, true, e.message); } };
refused("a rejoin recorded as from someone else",
  () => checkCommitAgainstRecord(roundTrip(a.built.commit), c.member.state.ratchetTree, { ...a.built.record, from: ADDR.B }));
refused('a rejoin recorded as adding a member',
  () => checkCommitAgainstRecord(roundTrip(a.built.commit), c.member.state.ratchetTree, { ...a.built.record, addedMembers: [ADDR.B] }));

console.log('');
if (failures.length) {
  console.log(`  \x1b[31m\x1b[1mFAIL\x1b[0m  ${failures.length} step(s) failed.\n`);
  process.exit(1);
}
console.log('  \x1b[32m\x1b[1mPASS\x1b[0m  every honest member recovered without help, and the attacker was removed.\n');
