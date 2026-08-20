/**
 * Browser self-test for the group-chat crypto layer.
 *
 * Runs mlsEngine.js against the real crypto.js primitives with three simulated
 * accounts, with no chain and no wallet, so the MLS layer can be verified
 * independently of the network. Nothing here touches app.js.
 */

import * as mls from '../mlsEngine.js';
import { mlsStore, locksSupported, withGroupLock } from '../mlsStore.js';
import { generateRandomBytes } from '../crypto.js';
import { bin2hex, bin2base64, longAddress } from '../lib.js';

const $ = (id) => document.getElementById(id);
let pass = 0;
let fail = 0;

function result(label, ok, detail = '') {
  ok ? pass++ : fail++;
  const li = document.createElement('li');
  li.className = ok ? 'ok' : 'bad';
  li.innerHTML =
    `<span class="mark">${ok ? '✓' : '✗'}</span><span class="label">${label}</span>` +
    (detail ? `<span class="detail">${detail}</span>` : '');
  $('results').appendChild(li);
}

function section(title) {
  const li = document.createElement('li');
  li.className = 'section';
  li.textContent = title;
  $('results').appendChild(li);
}

function summary() {
  const el = $('summary');
  el.textContent = fail === 0 ? `All ${pass} checks passed` : `${pass} passed, ${fail} failed`;
  el.className = `summary ${fail === 0 ? 'ok' : 'bad'}`;
  el.dataset.pass = pass;
  el.dataset.fail = fail;
  el.dataset.done = '1';
}

const kb = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

/**
 * Stand-in for a Liberdus account.
 *
 * keys.address is the 20-byte SHORT form, exactly as app.js stores it. That
 * matters: the MLS credential must end up as the padded 64-character form so it
 * matches tx.from and the on-chain roster, and using a pre-padded address here
 * would hide a mismatch rather than expose it.
 */
function fakeAccount(name) {
  const seed = new Uint8Array(64);
  for (let i = 0; i < 64; i++) seed[i] = (name.charCodeAt(i % name.length) * 7 + i * 13) & 0xff;
  const addr = new Uint8Array(20);
  for (let i = 0; i < 20; i++) addr[i] = (name.charCodeAt(i % name.length) + i * 11) & 0xff;
  return { keys: { address: bin2hex(addr), pqSeed: bin2hex(seed) } };
}

/** What the chain reports as tx.from — derived independently of the identity. */
const chainAddress = (account) => longAddress(account.keys.address).toLowerCase();

async function run() {
  $('results').innerHTML = '';
  pass = 0;
  fail = 0;
  await mlsStore.clearAll();
  mls.evictCache();

  // --- environment ---------------------------------------------------------
  section('Environment');
  const t0 = performance.now();
  const cs = await mls.cipherSuite();
  result('X-Wing ciphersuite loads from external/ts-mls.js', !!cs,
    `${mls.MLS_CIPHERSUITE_NAME} · ${(performance.now() - t0).toFixed(0)}ms`);
  result('Web Locks available (multi-tab safety)', locksSupported,
    locksSupported ? 'navigator.locks' : 'FALLBACK — tabs could fork state');
  result('IndexedDB available', typeof indexedDB !== 'undefined');

  // --- identity from the account's existing pqSeed --------------------------
  section('Identity from the existing Liberdus pqSeed');
  const A = fakeAccount('alice');
  const B = fakeAccount('bob');
  const C = fakeAccount('carol');

  const idA = mls.deriveIdentity(A.keys);
  const idA2 = mls.deriveIdentity(A.keys);
  result('MLS signature key is deterministic from pqSeed',
    bin2hex(idA.sigKeyPair.publicKey) === bin2hex(idA2.sigKeyPair.publicKey),
    bin2hex(idA.sigKeyPair.publicKey).slice(0, 16) + '…');
  result('ML-KEM-1024 identity comes from crypto.js generatePQKeys',
    idA.pq.publicKey.length === 1568, `pk ${kb(idA.pq.publicKey.length)}`);
  result('credential identity is the PADDED 64-char address (matches tx.from)',
    new TextDecoder().decode(idA.credential.identity) === chainAddress(A) && idA.address.length === 64,
    idA.address.slice(0, 12) + '…');

  const idB = mls.deriveIdentity(B.keys);
  const idC = mls.deriveIdentity(C.keys);

  // --- PQ PSK sealing using crypto.js primitives ----------------------------
  section('Post-quantum PSK (crypto.js pqSharedKey + encryptChacha)');
  const psk = generateRandomBytes(32);
  const sealed = mls.sealPsk(psk, bin2base64(idB.pq.publicKey));
  result('sealPsk produced a sealed blob', !!sealed && !!sealed.cipherText && !!sealed.ct,
    `${kb(sealed.cipherText.length + sealed.ct.length)} b64`);
  const opened = mls.openPsk(sealed, idB.pq.secretKey);
  result('openPsk recovers the PSK via ML-KEM decapsulate',
    bin2hex(opened) === bin2hex(psk));

  const ratcheted = mls.ratchetPsk(psk);
  result('PSK ratchet is deterministic and 32 bytes',
    ratcheted.length === 32 && bin2hex(mls.ratchetPsk(psk)) === bin2hex(ratcheted),
    bin2hex(ratcheted).slice(0, 16) + '…');

  // --- group lifecycle ------------------------------------------------------
  section('Group lifecycle');
  const GID = 'a'.repeat(64);
  await mls.createGroup(idA, GID, GID);
  let view = await mls.getGroupView(idA.address, GID);
  result('group created at epoch 0', view.epoch === 0, `roster ${view.roster.length}`);

  // Publishable packages persist their private half — required to open a Welcome.
  const kpBWire = await mls.createPublishableKeyPackage(idB);
  const kpCWire = await mls.createPublishableKeyPackage(idC);
  result('KeyPackages encode for publishing', kpBWire.length > 0, `${kb(kpBWire.length)} b64`);

  const commit = await mls.addMembers(idA, GID, [
    { address: idB.address, keyPackage: kpBWire, pqPublicKey: bin2base64(idB.pq.publicKey) },
    { address: idC.address, keyPackage: kpCWire, pqPublicKey: bin2base64(idC.pq.publicKey) },
  ]);
  result('commit adds two members in one epoch', commit.addedMembers.length === 2,
    `targets epoch ${commit.epoch} · commit ${kb(commit.commit.length)} b64`);
  result('welcomes are sealed per joiner (O(added), not O(members))',
    commit.welcomes.length === 2 && !!commit.welcomes[0].envelope.sealedPsk);


  /*
   * Stands in for the network.
   *
   * A welcome envelope leaves the client with an EMPTY ratchetTree: the tree is
   * ~1.8 kB per member and shipping it per joiner was the single largest cost in
   * a commit. The server fills it in from the tree it maintains via each
   * commit's treeDelta, snapshotting it at the joining epoch. Offline, we do
   * that here so the join path under test is the real one.
   */
  const asDelivered = (envelope, treeWire) => ({
    ...envelope,
    ratchetTree: treeWire,
  });

  const treeAfterAdd = await mls.exportRatchetTree(idA, GID);
  await mls.joinFromWelcome(idB, GID, asDelivered(commit.welcomes.find((w) => w.address === idB.address).envelope, treeAfterAdd));
  await mls.joinFromWelcome(idC, GID, asDelivered(commit.welcomes.find((w) => w.address === idC.address).envelope, treeAfterAdd));
  const viewB = await mls.getGroupView(idB.address, GID);
  result('members join from the Welcome and recover the PSK', viewB.epoch === 1,
    `epoch ${viewB.epoch} · roster ${viewB.roster.length}`);
  result('roster is read from the ratchet tree', viewB.roster.includes(idA.address) && viewB.roster.includes(idC.address));

  // --- messaging + sender binding -------------------------------------------
  section('Messaging and sender binding');
  const enc = await mls.encryptMessage(idA, GID, { message: 'hello group', sent_timestamp: Date.now() });
  result('message encrypts', !!enc.message, `${kb(enc.message.length)} b64 · epoch ${enc.epoch}`);

  // `from` is derived from the account, NOT from idA.address — this is what the
  // chain puts in tx.from. If the MLS credential used a different address form
  // the binding check would reject every honest message, so deriving both sides
  // independently is what makes this assertion meaningful.
  const record = { message: enc.message, from: chainAddress(A), timestamp: Date.now(), epoch: enc.epoch };
  const got = await mls.decryptMessage(idB, GID, record);
  result('honest message passes the tx.from binding check', got && got.message === 'hello group',
    `payload.from === tx.from (${chainAddress(A).slice(0, 12)}…)`);

  const enc2 = await mls.encryptMessage(idA, GID, { message: 'second', sent_timestamp: Date.now() });
  let bindingErr = '';
  try {
    await mls.decryptMessage(idC, GID, {
      message: enc2.message,
      from: 'deadbeef'.repeat(8), // replayed under a different tx.from
      timestamp: Date.now(),
      epoch: enc2.epoch,
    });
  } catch (e) {
    bindingErr = e.message;
  }
  result('replay under a different tx.from is rejected',
    bindingErr.startsWith('sender mismatch'), bindingErr.slice(0, 52) || 'NOT REJECTED');

  // --- existing member ratchets locally on a later commit -------------------
  section('PQ PSK ratchet on a later commit');
  const D = fakeAccount('dave');
  const idD = mls.deriveIdentity(D.keys);
  const kpD = await mls.createPublishableKeyPackage(idD);
  const commit2 = await mls.addMembers(idA, GID, [
    { address: idD.address, keyPackage: kpD, pqPublicKey: bin2base64(idD.pq.publicKey) },
  ]);
  result('second commit seals only to the new member', commit2.welcomes.length === 1);

  const bobEpoch = await mls.applyCommit(idB, GID, {
    commit: commit2.commit, pskId: commit2.pskId, pskNonce: commit2.pskNonce,
  });
  result('existing member applies it by ratcheting locally (no sealed blob)',
    bobEpoch === 2, `epoch ${bobEpoch}`);

  // --- group secret convergence ---------------------------------------------
  await mls.applyCommit(idC, GID, {
    commit: commit2.commit, pskId: commit2.pskId, pskNonce: commit2.pskNonce,
  });
  const sA = bin2hex(await mls.exportGroupSecret(idA, GID));
  const sB = bin2hex(await mls.exportGroupSecret(idB, GID));
  const sC = bin2hex(await mls.exportGroupSecret(idC, GID));
  result('all members derive an identical group secret', sA === sB && sB === sC, sA.slice(0, 16) + '…');

  // --- persistence -----------------------------------------------------------
  section('Persistence');
  const rec = await mlsStore.get(idB.address, GID);
  result('state persisted to IndexedDB', !!rec, `${kb(rec.state.length)} per group`);
  result('state and cursors are one atomic record',
    'state' in rec && 'lastMessageTimestamp' in rec && 'lastHandshakeEpoch' in rec);
  result('records are namespaced per account', rec.key.startsWith(idB.address));

  mls.evictCache();
  const enc3 = await mls.encryptMessage(idA, GID, { message: 'after eviction', sent_timestamp: Date.now() });
  const got3 = await mls.decryptMessage(idB, GID, {
    message: enc3.message, from: chainAddress(A), timestamp: Date.now(), epoch: enc3.epoch,
  });
  result('state round-trips storage and still decrypts',
    got3 && got3.message === 'after eviction', 'cache evicted, reloaded from IDB');

  // --- concurrency ------------------------------------------------------------
  section('Concurrency');
  let overlap = 0;
  let active = 0;
  await Promise.all(
    Array.from({ length: 8 }, () =>
      withGroupLock(idA.address, GID, async () => {
        if (active > 0) overlap++;
        active++;
        await new Promise((r) => setTimeout(r, 4));
        active--;
      }),
    ),
  );
  result('withGroupLock serializes concurrent writers', overlap === 0, `${overlap} overlaps in 8 racers`);

  const sends = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      mls.encryptMessage(idA, GID, { message: `concurrent ${i}`, sent_timestamp: Date.now() }),
    ),
  );
  let decrypted = 0;
  for (const s of sends) {
    const p = await mls.decryptMessage(idB, GID, {
      message: s.message, from: chainAddress(A), timestamp: Date.now(), epoch: s.epoch,
    });
    if (p) decrypted++;
  }
  result('4 concurrent sends all decrypt (no ratchet corruption)', decrypted === 4, `${decrypted}/4`);

  summary();
}

let running = false;
function guarded() {
  if (running) return;
  running = true;
  $('run').disabled = true;
  $('summary').textContent = 'running…';
  delete $('summary').dataset.done;
  run()
    .catch((e) => {
      result('FATAL', false, e.message);
      console.error(e);
      summary();
    })
    .finally(() => {
      running = false;
      $('run').disabled = false;
    });
}

$('run').addEventListener('click', guarded);
guarded();
