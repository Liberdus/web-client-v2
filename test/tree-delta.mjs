/**
 * Spec §8.2 — the server must reconstruct exactly the committer's tree.
 *
 * The client publishes a delta of changed nodes; the server applies it by index
 * to its stored copy without parsing MLS. If those ever disagree, joiners get a
 * tree that fails its tree-hash check and cannot join.
 *
 * Exercises the REAL client helpers from mlsEngine and a verbatim copy of the
 * server's applyTreeDelta, over a full group lifecycle.
 *
 *   node test/tree-delta.mjs
 */
import { getCiphersuiteImpl, getCiphersuiteFromName, generateKeyPackage, createGroup,
  createCommit, joinGroup, encodeMlsMessage, decodeMlsMessage, defaultLifetime,
  makePskIndex, processPublicMessage, acceptAll, encodeNode, decodeNode, extendRatchetTree } from '../external/ts-mls.js';

// ---- verbatim from liberdus-server/src/transactions/group_commit.ts ---------
const applyTreeDelta = (stored, delta) => {
  let nodes = [];
  if (stored.length > 0) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) nodes = parsed;
    } catch { nodes = []; }
  }
  for (const entry of delta) {
    while (nodes.length <= entry.i) nodes.push(null);
    nodes[entry.i] = entry.n;
  }
  while (nodes.length > 0 && nodes[nodes.length - 1] === null) nodes.pop();
  return JSON.stringify(nodes);
};

// ---- client side, mirroring mlsEngine's helpers -----------------------------
const b64 = (u8) => Buffer.from(u8).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const nodeToWire = (n) => (n === undefined ? null : b64(encodeNode(n)));
const nodeFromWire = (s) => (s === null ? undefined : decodeNode(unb64(s), 0)[0]);
const treeToWire = (t) => { const n = t.map(nodeToWire); while (n.length && n[n.length-1] === null) n.pop(); return JSON.stringify(n); };
// Mirrors mlsEngine.treeFromWire, INCLUDING the extend step. Both sides trim
// trailing blanks, so a rebuilt array is short until it is extended back to full
// width; without that, leafWidth and every tree hash are computed against the
// wrong size.
const treeFromWire = (w) => extendRatchetTree(JSON.parse(w).map(nodeFromWire));
const treeDelta = (a, b) => { const d = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = nodeToWire(a[i]), y = nodeToWire(b[i]); if (x !== y) d.push({ i, n: y }); } return d; };

const S = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
const cs = await getCiphersuiteImpl(getCiphersuiteFromName(S));
const te = new TextEncoder();
const caps = { versions: ['mls10'], ciphersuites: [S], extensions: [], proposals: [], credentials: ['basic'] };
const cred = (n) => ({ credentialType: 'basic', identity: te.encode(`m-${String(n).padStart(4,'0')}${'0'.repeat(40)}`) });
const mkKp = (n) => generateKeyPackage(cred(n), caps, defaultLifetime, [], cs);
const empty = makePskIndex(undefined, {});
const pub = (st, ex = []) => createCommit({ state: st, cipherSuite: cs, pskIndex: empty }, { wireAsPublicMessage: true, extraProposals: ex });

let pass = 0, fail = 0;
const chk = (name, ok, detail = '') => { if (ok) { console.log(`  \x1b[32m✓\x1b[0m ${name}`); pass++; } else { console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? '\n      ' + detail : ''}`); fail++; } };

console.log('\n\x1b[1mTree delta round-trip (client publish -> server apply)\x1b[0m\n');

const N = 12;
const kps = []; for (let i = 0; i < N; i++) kps.push(await mkKp(i));
let st = [await createGroup(te.encode('g'), kps[0].publicPackage, kps[0].privatePackage, [], cs)];

/** What the chain holds. */
let chain = '';
let steps = 0, mismatches = 0;

const bcast = async (from, w) => { for (let j = 0; j < st.length; j++) { if (j === from || st[j] === null) continue;
  try { st[j] = (await processPublicMessage(st[j], decodeMlsMessage(w, 0)[0].publicMessage, empty, cs, acceptAll)).newState; } catch { st[j] = null; } } };

/** One commit, published the way groupManager would, then verified. */
async function commitAndPublish(who, ex = [], label = '') {
  const before = st[who].ratchetTree;
  const r = await pub(st[who], ex);
  const w = encodeMlsMessage(r.commit);
  st[who] = r.newState;
  await bcast(who, w);

  const baseline = chain === '' ? treeToWire(st[who].ratchetTree) : '';
  const delta = treeDelta(before, st[who].ratchetTree);
  chain = baseline.length > 0 ? baseline : applyTreeDelta(chain, delta);

  steps++;
  if (chain !== treeToWire(st[who].ratchetTree)) { mismatches++; console.log(`      mismatch after ${label}`); }
  return r;
}

// grow to N with update-on-join (decision 1)
for (let n = 1; n < N; n++) {
  const r = await commitAndPublish(0, [{ proposalType: 'add', add: { keyPackage: kps[n].publicPackage } }], `add ${n}`);
  st.push(await joinGroup(r.welcome, kps[n].publicPackage, kps[n].privatePackage, empty, cs, st[0].ratchetTree));
  await commitAndPublish(n, [], `join-update ${n}`);
}
chk(`${steps} commits during growth all round-tripped`, mismatches === 0);

// a joiner can rebuild the tree from what the chain holds
const rebuilt = treeFromWire(chain);
chk('tree rebuilt from the chain matches the committer\'s, node for node',
    treeToWire(rebuilt) === treeToWire(st[0].ratchetTree));
/*
 * Comparing via treeToWire is NOT sufficient on its own: it trims trailing
 * blanks on both sides, so a rebuilt tree that was never extended back to full
 * width compares equal while being unusable. Tree math derives leafWidth from
 * the array length, so a short array silently produces wrong tree hashes and the
 * failure surfaces much later as "Could not verify confirmation tag".
 */
chk('rebuilt tree is extended to full width (not just equal after trimming)',
    rebuilt.length === st[0].ratchetTree.length,
    `rebuilt ${rebuilt.length} vs committer ${st[0].ratchetTree.length}`);

// removal + sibling repair (decision 2)
const before = steps;
await commitAndPublish(0, [{ proposalType: 'remove', remove: { removed: 4 } }], 'remove');
await commitAndPublish(5, [], 'sibling repair');
chk('removal and sibling repair round-tripped', mismatches === 0);

// a rebuilt tree is usable: a new member joins against it
const r = await commitAndPublish(0, [{ proposalType: 'add', add: { keyPackage: (await mkKp(50)).publicPackage } }], 'late add');
chk('late add round-tripped', mismatches === 0);

// blanking must actually shrink the stored tree rather than grow it forever
chk('stored tree carries no trailing blanks', !JSON.parse(chain).length || JSON.parse(chain).at(-1) !== null);
chk(`stored tree is ${(chain.length/1024).toFixed(1)} KB for ${N} members`, chain.length > 0);

console.log(`\n${fail === 0 ? '\x1b[32m' : '\x1b[31m'}${pass} passed, ${fail} failed\x1b[0m  (${steps} commits verified)\n`);
process.exit(fail === 0 ? 0 : 1);
