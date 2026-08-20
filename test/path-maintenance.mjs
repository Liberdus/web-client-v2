/**
 * Decisions 1 and 2 as a policy loop.
 *
 * Verifies that the triggers groupManager runs (update-on-join, and repair by
 * the lowest eligible leaf after a removal) actually keep the ratchet tree
 * populated — and therefore keep removals O(log N) instead of O(N).
 *
 * Mirrors mlsEngine.pathUpdateState / groupManager.maybeUpdatePath.
 *
 *   node test/path-maintenance.mjs
 */
import { getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage, createGroup,
  createCommit, joinGroup, encodeMlsMessage, decodeMlsMessage, defaultLifetime,
  makePskIndex, processPublicMessage, acceptAll, filteredDirectPath, encodeNode } from '../external/ts-mls.js';

const S = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(S));
const te = new TextEncoder();
const caps = { versions: ['mls10'], ciphersuites: [S], extensions: [], proposals: [], credentials: ['basic'] };
const cred = (n) => ({ credentialType: 'basic', identity: te.encode(`m-${String(n).padStart(4,'0')}${'0'.repeat(40)}`) });
const mkKp = (n) => generateKeyPackage(cred(n), caps, defaultLifetime, [], cs);
const empty = makePskIndex(undefined, {});
const pub = (st, ex = []) => createCommit({ state: st, cipherSuite: cs, pskIndex: empty }, { wireAsPublicMessage: true, extraProposals: ex });

// ---- lifted from mlsEngine -------------------------------------------------
function leafNeedsUpdate(tree, leafIndex) {
  for (const nodeIndex of filteredDirectPath(leafIndex, tree)) {
    const node = tree[nodeIndex];
    if (node === undefined) return true;
    const unmerged = node.parent?.unmergedLeaves ?? [];
    if (unmerged.some((l) => Number(l) === Number(leafIndex))) return true;
  }
  return false;
}
function pathUpdateState(state) {
  const tree = state.ratchetTree;
  const myLeaf = state.privatePath.leafIndex;
  let firstLeaf = null;
  for (let leaf = 0; leaf * 2 < tree.length; leaf++) {
    if (tree[leaf * 2] === undefined) continue;
    if (leafNeedsUpdate(tree, leaf)) { firstLeaf = leaf; break; }
  }
  const needed = leafNeedsUpdate(tree, myLeaf);
  return { needed, myLeaf, firstLeaf, iAmFirst: needed && firstLeaf === myLeaf };
}

let pass = 0, fail = 0;
const chk = (n, ok, d = '') => { if (ok) { console.log(`  \x1b[32m✓\x1b[0m ${n}`); pass++; } else { console.log(`  \x1b[31m✗\x1b[0m ${n}${d ? '\n      ' + d : ''}`); fail++; } };

const N = 16;
const kps = []; for (let i = 0; i < N + 4; i++) kps.push(await mkKp(i));
let st = [await createGroup(te.encode('g'), kps[0].publicPackage, kps[0].privatePackage, [], cs)];

const bcast = async (from, w) => { for (let j = 0; j < st.length; j++) { if (j === from || st[j] === null) continue;
  try { st[j] = (await processPublicMessage(st[j], decodeMlsMessage(w, 0)[0].publicMessage, empty, cs, acceptAll)).newState; } catch { st[j] = null; } } };
const go = async (who, ex = []) => { const r = await pub(st[who], ex); const w = encodeMlsMessage(r.commit); st[who] = r.newState; await bcast(who, w); return r; };

/** groupManager's loop: whoever is first acts, repeat until nobody qualifies. */
async function settle(maxRounds = 20) {
  let rounds = 0;
  while (rounds < maxRounds) {
    const actor = st.findIndex((s) => s && pathUpdateState(s).iAmFirst);
    if (actor === -1) break;
    await go(actor);
    rounds++;
  }
  return rounds;
}

const removeCost = async () => {
  const first = st.findIndex((s, i) => s && i > 0);
  const r = await pub(st[0], [{ proposalType: 'remove', remove: { removed: st[0].ratchetTree.findIndex((n, i) => i % 2 === 0 && n !== undefined && i > 0) / 2 } }]);
  const p = decodeMlsMessage(encodeMlsMessage(r.commit), 0)[0].publicMessage.content.commit.path;
  return p.nodes.reduce((a, n) => a + n.encryptedPathSecret.length, 0);
};

const nodeToWire = (n) => (n === undefined ? null : Buffer.from(encodeNode(n)).toString('base64'));
const deltaOf = (a, b) => { const d = []; for (let i = 0; i < Math.max(a.length, b.length); i++) if (nodeToWire(a[i]) !== nodeToWire(b[i])) d.push(i); return d; };
const pskProp = (id, nonce) => ({ proposalType: 'psk', psk: { preSharedKeyId: { psktype: 'external', pskId: id, pskNonce: nonce } } });

console.log('\n\x1b[1mPath maintenance policy (decisions 1 + 2)\x1b[0m\n');

/*
 * The shape of the self-update commit is load-bearing, and got this wrong once:
 * mlsEngine.selfUpdate originally attached a PSK proposal, which makes the commit
 * "partial" rather than "empty" under RFC 9420 §12.4 — and a partial commit
 * legally omits the UpdatePath. It changed zero tree nodes, published an empty
 * delta, and the network rejected it. The policy tests passed anyway because they
 * hand-rolled a proposal-free commit instead of using the real one.
 */
{
  const kpA = await mkKp(90), kpB = await mkKp(91);
  let a = await createGroup(te.encode('shape'), kpA.publicPackage, kpA.privatePackage, [], cs);
  a = (await pub(a, [{ proposalType: 'add', add: { keyPackage: kpB.publicPackage } }])).newState;

  const id = new Uint8Array(16).fill(7), nonce = new Uint8Array(cs.kdf.size).fill(9);
  const withPsk = await createCommit(
    { state: a, cipherSuite: cs, pskIndex: makePskIndex(undefined, { [Buffer.from(id).toString('base64')]: new Uint8Array(32).fill(3) }) },
    { wireAsPublicMessage: true, extraProposals: [pskProp(id, nonce)] });
  chk('a PSK-bearing "self-update" changes NO tree node (the bug)',
      deltaOf(a.ratchetTree, withPsk.newState.ratchetTree).length === 0);

  const empty = await createCommit({ state: a, cipherSuite: cs, pskIndex: makePskIndex(undefined, {}) }, { wireAsPublicMessage: true });
  chk('a proposal-free self-update DOES rekey the path (the fix)',
      deltaOf(a.ratchetTree, empty.newState.ratchetTree).length > 0,
      `changed nodes: ${deltaOf(a.ratchetTree, empty.newState.ratchetTree).join(', ')}`);
}

// --- grow with update-on-join ----------------------------------------------
let joinUpdates = 0;
for (let n = 1; n < N; n++) {
  const r = await go(0, [{ proposalType: 'add', add: { keyPackage: kps[n].publicPackage } }]);
  st.push(await joinGroup(r.welcome, kps[n].publicPackage, kps[n].privatePackage, empty, cs, st[0].ratchetTree));
  joinUpdates += await settle();
}
const parents = (t) => t.filter((n, i) => i % 2 === 1 && n !== undefined).length;
const total = (t) => t.filter((_, i) => i % 2 === 1).length;
chk(`${N} members: every parent node populated (${parents(st[0].ratchetTree)}/${total(st[0].ratchetTree)})`,
    parents(st[0].ratchetTree) === total(st[0].ratchetTree));
chk(`growth settled in ${joinUpdates} updates, i.e. about one per joiner`, joinUpdates <= N + 2);

const healthy = await removeCost();
chk(`remove costs ${healthy} ciphertexts, i.e. log2(${N})=${Math.log2(N)} not O(N)`, healthy <= Math.log2(N) + 1);

// --- remove someone, then let the policy repair -----------------------------
await go(0, [{ proposalType: 'remove', remove: { removed: 8 } }]);
const eligible = st.map((s, i) => (s && pathUpdateState(s).needed ? i : null)).filter((i) => i !== null);
chk(`after a removal ${eligible.length} members qualify (a removal blanks a whole path)`, eligible.length > 1);
const firsts = st.filter((s) => s).map((s) => pathUpdateState(s).firstLeaf);
chk('every member independently picks the SAME one to go first', new Set(firsts).size === 1);

const rounds = await settle();
chk(`policy settled in ${rounds} update${rounds === 1 ? '' : 's'}, not one per eligible member`, rounds < eligible.length);
chk('nobody is left needing an update (loop terminates)', !st.some((s) => s && pathUpdateState(s).needed));

const afterRepair = await removeCost();
chk(`removals stay logarithmic after repair (${afterRepair} ciphertexts)`, afterRepair <= healthy + 1,
    `was ${healthy}, now ${afterRepair}`);

/*
 * PSK ratchet stays in step across mixed commit types.
 *
 * A membership commit carries a PSK and every member advances psk[n]=KDF(psk[n-1]).
 * A path update carries none, so NOBODY may advance — the committer does not, and
 * if appliers did, every member's PSK would diverge from that point and the next
 * membership commit would fail to resolve its PSK.
 *
 * Mirrors mlsEngine.applyCommit's `hasPsk` branch.
 */
{
  const ratchet = async (p) => new Uint8Array(await cs.kdf.expand(p, te.encode('liberdus-pq-psk'), cs.kdf.size));
  const hex = (u) => Buffer.from(u).toString('hex');

  // committer and two appliers, all starting from the same PSK
  let committer = new Uint8Array(cs.kdf.size).fill(1);
  let applierA = committer, applierB = committer;

  /** what selfUpdate/applyCommit do for a given commit record */
  const step = async (hasPsk) => {
    committer = hasPsk ? await ratchet(committer) : committer;
    applierA = hasPsk ? await ratchet(applierA) : applierA;
    applierB = hasPsk ? await ratchet(applierB) : applierB;
  };

  await step(true);   // membership commit (add)
  const afterAdd = hex(committer);
  await step(false);  // path update — must be a no-op for everyone
  chk('a path update does not advance the PSK ratchet', hex(committer) === afterAdd);
  chk('  and leaves every member in step',
      hex(committer) === hex(applierA) && hex(applierA) === hex(applierB));
  await step(true);   // next membership commit
  chk('the next membership commit resumes the ratchet from the same value',
      hex(committer) === hex(applierA) && hex(applierA) === hex(applierB) && hex(committer) !== afterAdd);
}

console.log(`\n${fail === 0 ? '\x1b[32m' : '\x1b[31m'}${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail === 0 ? 0 : 1);
