/**
 * Threat model T1 and T17, the client's half: a member's client must refuse a
 * commit that does not do what the network recorded.
 *
 * The network refuses these commits before they land (liberdus-server
 * src/utils/mlsCommit.ts, test/groupCommitInspection.test.ts). This tests the
 * second line, in case the network's check ever fails: groupCommitCheck.js,
 * which mlsEngine.applyCommit runs on every commit before ts-mls processes it.
 *
 * Adversarial. B is an ordinary member. Each attack pairs a real commit with
 * the record the network would hold for it, and the client must refuse it
 * before its state changes. The honest commits must still apply -- a check that
 * refuses valid commits leaves the group stuck, which is its own failure.
 *
 * Commits are built as public messages, as clients now send them, so every
 * refusal below is for the mismatch and not merely for the wire format.
 *
 *   node test/commit-authority.mjs
 */
import {
  getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage,
  createGroup, createCommit, makePskIndex, defaultLifetime, joinGroup,
  encodeMlsMessage, decodeMlsMessage, processPublicMessage, acceptAll,
} from '../external/ts-mls.js'; // the bundle we actually ship, not node_modules
import { randomBytes } from '@noble/hashes/utils.js';
import { checkCommitAgainstRecord } from '../groupCommitCheck.js';

const SUITE = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(SUITE));
const te = new TextEncoder();
const td = new TextDecoder();
const caps = { versions: ['mls10'], ciphersuites: [SUITE], extensions: [], proposals: [], credentials: ['basic'] };

// Credential identity is the account address, as in mlsEngine.deriveIdentity.
const ADDR = { A: 'a'.repeat(64), B: 'b'.repeat(64), C: 'c'.repeat(64), D: 'd'.repeat(64), M: 'e'.repeat(64) };
const name = (address) => Object.keys(ADDR).find((k) => ADDR[k] === address) || address;
const mkKp = (identityOf) => generateKeyPackage({ credentialType: 'basic', identity: te.encode(ADDR[identityOf]) }, caps, defaultLifetime, [], cs);

const pskFor = (id, secret) => makePskIndex(undefined, { [Buffer.from(id).toString('base64')]: secret });
const pskProp = (id, nonce) => ({ proposalType: 'psk', psk: { preSharedKeyId: { psktype: 'external', pskId: id, pskNonce: nonce } } });
const roundTrip = (msg) => decodeMlsMessage(encodeMlsMessage(msg), 0)[0];

const commit = async (state, proposals, withPsk = true) => {
  let pskIndex = makePskIndex(undefined, {});
  const extra = [...proposals];
  if (withPsk) {
    const id = randomBytes(16);
    pskIndex = pskFor(id, randomBytes(cs.kdf.size));
    extra.push(pskProp(id, randomBytes(cs.kdf.size)));
  }
  const out = await createCommit({ state, cipherSuite: cs, pskIndex }, { wireAsPublicMessage: true, extraProposals: extra });
  return { ...out, pskIndex };
};
const add = (kp) => ({ proposalType: 'add', add: { keyPackage: kp.publicPackage } });
const leafIndexOf = (state, who) => state.ratchetTree.findIndex((n, i) =>
  i % 2 === 0 && n && n.leaf && td.decode(n.leaf.credential.identity) === ADDR[who]) / 2;
const remove = (state, who) => ({ proposalType: 'remove', remove: { removed: leafIndexOf(state, who) } });

/** What mlsEngine.applyCommit does: the check, then ts-mls. */
async function applyAsClient(state, built, record) {
  const message = roundTrip(built.commit);
  checkCommitAgainstRecord(message, state.ratchetTree, record);
  return (await processPublicMessage(state, message.publicMessage, built.pskIndex, cs, acceptAll)).newState;
}

// --- A founds the group and adds B and C ----------------------------------------
const kp = { A: await mkKp('A'), B: await mkKp('B'), C: await mkKp('C'), D: await mkKp('D') };
let aState = await createGroup(te.encode('g'), kp.A.publicPackage, kp.A.privatePackage, [], cs);
const setup = await commit(aState, [add(kp.B), add(kp.C)]);
aState = setup.newState;
const bState = await joinGroup(setup.welcome, kp.B.publicPackage, kp.B.privatePackage, setup.pskIndex, cs, aState.ratchetTree);
const cState = await joinGroup(setup.welcome, kp.C.publicPackage, kp.C.privatePackage, setup.pskIndex, cs, aState.ratchetTree);

console.log('\n\x1b[1mT1/T17 - does a client refuse a commit that differs from the network record?\x1b[0m\n');
const failures = [];

async function expectRefused(label, state, built, record) {
  try {
    await applyAsClient(state, built, record);
    console.log(`  \x1b[31mapplied\x1b[0m  ${label}`);
    failures.push(`${label}: applied`);
  } catch (e) {
    console.log(`  refused  ${label}\n           ${e.message}`);
  }
}
async function expectApplied(label, state, built, record) {
  try {
    const next = await applyAsClient(state, built, record);
    console.log(`  applied  ${label}`);
    return next;
  } catch (e) {
    console.log(`  \x1b[31mrefused\x1b[0m  ${label}\n           ${e.message}`);
    failures.push(`${label}: refused (${e.message})`);
    return null;
  }
}

// Attacks. Each record is what the network would hold if its check had failed.
await expectRefused('B secretly adds outsider D, recorded as no change',
  aState, await commit(bState, [add(kp.D)]), { from: ADDR.B, addedMembers: [], removedMembers: [] });
await expectRefused('B secretly removes C, recorded as no change',
  aState, await commit(bState, [remove(bState, 'C')]), { from: ADDR.B, addedMembers: [], removedMembers: [] });
await expectRefused("B's commit recorded as A's",
  aState, await commit(bState, [], false), { from: ADDR.A, addedMembers: [], removedMembers: [] });

// T17: B re-keys its own leaf under C's address. ts-mls carries the credential
// from the committer's current leaf into the new one, so B edits its copy.
const bLeaf = leafIndexOf(bState, 'B') * 2;
const forgedTree = bState.ratchetTree.slice();
forgedTree[bLeaf] = { ...forgedTree[bLeaf], leaf: { ...forgedTree[bLeaf].leaf, credential: { credentialType: 'basic', identity: te.encode(ADDR.C) } } };
await expectRefused("B's path update moves B's leaf to C's address",
  aState, await commit({ ...bState, ratchetTree: forgedTree }, [], false), { from: ADDR.B, addedMembers: [], removedMembers: [] });

// Mallory publishes a key package naming D, and A adds "Mallory" with it: the
// network records Mallory, but the group's roster would show D.
const impostor = await mkKp('D');
await expectRefused("A adds M with a key package that names D",
  aState, await commit(aState, [add(impostor)]), { from: ADDR.A, addedMembers: [ADDR.M], removedMembers: [] });

// Honest commits still apply.
console.log('');
const afterAdd = await expectApplied('A adds D, recorded', bState,
  await commit(aState, [add(kp.D)]), { from: ADDR.A, addedMembers: [ADDR.D], removedMembers: [] });
await expectApplied('A removes C, recorded', bState,
  await commit(aState, [remove(aState, 'C')]), { from: ADDR.A, addedMembers: [], removedMembers: [ADDR.C] });
await expectApplied("B's path update", cState,
  await commit(bState, [], false), { from: ADDR.B, addedMembers: [], removedMembers: [] });
if (afterAdd && !afterAdd.ratchetTree.some((n, i) => i % 2 === 0 && n && td.decode(n.leaf.credential.identity) === ADDR.D)) {
  failures.push('the recorded add did not put D in the tree');
}

console.log('');
if (failures.length) {
  console.log('  \x1b[31m\x1b[1mFAIL\x1b[0m');
  for (const f of failures) console.log(`        - ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`  \x1b[32m\x1b[1mPASS\x1b[0m  every mismatched commit was refused; every recorded one applied (${name(ADDR.A)}, ${name(ADDR.B)}, ${name(ADDR.C)}).\n`);
