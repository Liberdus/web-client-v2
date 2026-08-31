/**
 * Spec §6.1 — removal must be cryptographically effective.
 *
 * A member who is removed keeps whatever state they had. The question is whether
 * that retained state still lets them derive the group's secrets at the epoch
 * created by their own removal.
 *
 * The test is adversarial: it does NOT ask the removed member's client to behave
 * itself. It feeds the removal commit to their retained state and compares the
 * exporter secret they derive against the one the remaining members derive. If
 * those match, removal is cosmetic.
 *
 *   node test/removal-effective.mjs
 */
import {
  getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage,
  createGroup, createCommit, makePskIndex, defaultLifetime,
  joinGroup, mlsExporter, encodeMlsMessage, decodeMlsMessage,
  processPrivateMessage, processPublicMessage, acceptAll,
} from '../external/ts-mls.js'; // the bundle we actually ship, not node_modules

/**
 * Same shim the client uses (mlsEngine.processAny): ts-mls 1.6.2's
 * processMessage substitutes an empty pskIndex for private messages, so every
 * PSK commit fails. Going through the underlying functions keeps this test on
 * the exact path production takes.
 */
async function processAny(message, state, pskIndex, cs) {
  if (message.wireformat === 'mls_public_message') {
    const r = await processPublicMessage(state, message.publicMessage, pskIndex, cs, acceptAll);
    return { ...r, kind: 'newState' };
  }
  return processPrivateMessage(state, message.privateMessage, pskIndex, cs, acceptAll);
}
import { randomBytes } from '@noble/hashes/utils.js';

const SUITE = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(SUITE));
const te = new TextEncoder();
const caps = { versions: ['mls10'], ciphersuites: [SUITE], extensions: [], proposals: [], credentials: ['basic'] };
const cred = (n) => ({ credentialType: 'basic', identity: te.encode(`m-${String(n).padStart(4, '0')}${'0'.repeat(40)}`) });
const mkKp = (n) => generateKeyPackage(cred(n), caps, defaultLifetime, [], cs);
const hex = (u8) => Buffer.from(u8).toString('hex');

/**
 * Our PQ PSK is a deterministic ratchet: psk[n] = KDF(psk[n-1]). Existing members
 * advance it locally, so a removed member can advance it too. Modelled faithfully
 * here — using a fresh random PSK would hide the weakness this test looks for.
 */
const ratchet = async (p) => new Uint8Array(await cs.kdf.expand(p, te.encode("liberdus-pq-psk"), cs.kdf.size));

const pskFor = (id, secret) => makePskIndex(undefined, { [Buffer.from(id).toString('base64')]: secret });
const pskProp = (id, nonce) => ({ proposalType: 'psk', psk: { preSharedKeyId: { psktype: 'external', pskId: id, pskNonce: nonce } } });

let psk = randomBytes(cs.kdf.size);

// --- build a 3-member group: A (admin), B (victim), C (bystander) -------------
const A = await mkKp(0), B = await mkKp(1), C = await mkKp(2);
let aState = await createGroup(te.encode('g'), A.publicPackage, A.privatePackage, [], cs);

let pskId = randomBytes(16), pskNonce = randomBytes(cs.kdf.size);
psk = await ratchet(psk);
const addCommit = await createCommit(
  { state: aState, cipherSuite: cs, pskIndex: pskFor(pskId, psk) },
  { extraProposals: [
      { proposalType: 'add', add: { keyPackage: B.publicPackage } },
      { proposalType: 'add', add: { keyPackage: C.publicPackage } },
      pskProp(pskId, pskNonce),
  ] },
);
aState = addCommit.newState;

const joinAs = (kp) => joinGroup(addCommit.welcome, kp.publicPackage, kp.privatePackage,
  pskFor(pskId, psk), cs, aState.ratchetTree);
let bState = await joinAs(B);
let cState = await joinAs(C);

const exporter = async (s) => hex(await mlsExporter(s.keySchedule.exporterSecret, te.encode('probe'), new Uint8Array(), 32, cs));

console.log('\n\x1b[1mSpec 6.1 - is removal cryptographically effective?\x1b[0m\n');
const agree = (await exporter(aState)) === (await exporter(bState)) && (await exporter(bState)) === (await exporter(cState));
console.log(`  epoch ${aState.groupContext.epoch}: A, B and C agree on the exporter: ${agree}`);

// --- B's retained state, exactly as it stood the moment before removal --------
const bRetained = bState;
const pskBeforeRemoval = psk;

// --- A removes B -------------------------------------------------------------
// NOTE: ratchetTree is indexed by NODE (leaves at even indices), but a Remove
// proposal takes a LEAF index. Mixing them up silently removes a different
// member, so convert explicitly.
const bNode = aState.ratchetTree.findIndex((n, i) =>
  i % 2 === 0 && n !== undefined &&
  Buffer.from(n.leaf.credential.identity).equals(Buffer.from(cred(1).identity)));
const bLeaf = bNode / 2;
console.log(`  B sits at node index ${bNode} = leaf index ${bLeaf}`);

pskId = randomBytes(16); pskNonce = randomBytes(cs.kdf.size);
psk = await ratchet(psk);
const rmCommit = await createCommit(
  { state: aState, cipherSuite: cs, pskIndex: pskFor(pskId, psk) },
  { extraProposals: [{ proposalType: 'remove', remove: { removed: bLeaf } }, pskProp(pskId, pskNonce)] },
);
aState = rmCommit.newState;

const wire = encodeMlsMessage(rmCommit.commit);
cState = (await processAny(decodeMlsMessage(wire, 0)[0], cState, pskFor(pskId, psk), cs)).newState;

const aEx = await exporter(aState);
const cEx = await exporter(cState);
console.log(`  epoch ${aState.groupContext.epoch}: A and C (remaining members) still agree:   ${aEx === cEx}`);

// --- the attack: B advances the PSK ratchet and applies the commit anyway -----
const bPsk = await ratchet(pskBeforeRemoval);
console.log(`  B recomputes the next PSK from the one it already held: ${hex(bPsk) === hex(psk)}`);

let bEx = null, bErr = null;
try {
  const out = await processAny(decodeMlsMessage(wire, 0)[0], bRetained, pskFor(pskId, bPsk), cs);
  bEx = await exporter(out.newState);
  console.log(`  B processed its own removal; groupActiveState = ${JSON.stringify(out.newState.groupActiveState?.kind)}`);
} catch (e) {
  bErr = e.message;
  console.log(`  B could not process the commit: ${e.message}`);
}

console.log('');
if (bEx !== null && bEx === aEx) {
  console.log('  \x1b[31m\x1b[1mFAIL\x1b[0m  the removed member derives the SAME exporter secret as the group.');
  console.log(`        group: ${aEx.slice(0, 32)}...`);
  console.log(`        B:     ${bEx.slice(0, 32)}...`);
  console.log('        Removal does not rotate the group keys.\n');
  process.exit(1);
}
console.log('  \x1b[32m\x1b[1mPASS\x1b[0m  the removed member cannot derive the new epoch secret.');
console.log(`        group: ${aEx.slice(0, 32)}...`);
console.log(`        B:     ${bErr ? '(rejected: ' + bErr + ')' : bEx.slice(0, 32) + '...'}\n`);
