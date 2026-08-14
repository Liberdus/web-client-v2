/**
 * MLS (RFC 9420) engine for Liberdus group chat.
 *
 * Pins the hybrid post-quantum ciphersuite
 * MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519 (X25519 + ML-KEM-768), and
 * layers the account's EXISTING long-term ML-KEM-1024 identity on top as an MLS
 * external pre-shared key, so a group secret can only be recovered by breaking
 * ML-KEM-1024 as well as the MLS key exchange.
 *
 * All post-quantum primitives come from crypto.js — the same generatePQKeys /
 * pqSharedKey used by 1:1 chat — so the PSK is sealed to precisely the key
 * derived from the account's pqSeed. No second ML-KEM implementation.
 *
 * THE PQ PSK RATCHET
 * ------------------
 * Every member must be able to resolve a PSK referenced by a commit. Sealing it
 * to all N members on each membership change would cost ~1.6 KB x N. Instead:
 *
 *     psk[0] = 32 random bytes                       (group creation)
 *     psk[n] = KDF(psk[n-1])                         (existing members derive)
 *     psk[n] -> ML-KEM sealed to NEW members only
 *
 * Existing members advance locally, so per-commit cost is O(added) rather than
 * O(members), while every epoch's key schedule still depends on the long-term
 * post-quantum identity.
 */

import {
  getCiphersuiteImpl,
  getCiphersuiteFromName,
  generateKeyPackageWithKey,
  createGroup as mlsCreateGroup,
  createCommit,
  joinGroup,
  joinGroupExternal,
  createApplicationMessage,
  processPrivateMessage,
  processPublicMessage,
  encodeMlsMessage,
  decodeMlsMessage,
  encodeGroupState,
  decodeGroupState,
  makePskIndex,
  mlsExporter,
  acceptAll,
  defaultLifetime,
  defaultKeyRetentionConfig,
  defaultLifetimeConfig,
  defaultKeyPackageEqualityConfig,
  defaultPaddingConfig,
  defaultAuthenticationService,
  ed25519,
} from './external/ts-mls.js';

import {
  generatePQKeys,
  pqSharedKey,
  deriveDhKey,
  encryptChacha,
  decryptChacha,
  generateRandomBytes,
} from './crypto.js';

import { utf82bin, bin2utf8, hex2bin, bin2base64, base642bin, longAddress } from './lib.js';

import { mlsStore, keyPackageStore, withGroupLock, announceGroupChanged } from './mlsStore.js';
import { hashBytes } from './crypto.js';

/** Pinned ciphersuite. Stored on the group account; members must agree. */
export const MLS_CIPHERSUITE_NAME = 'MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519';
export const MLS_CIPHERSUITE_ID = 84;

/**
 * ts-mls does NOT export defaultClientConfig (only the ClientConfig type), and
 * decodeGroupState rebuilds a GroupState WITHOUT it — restored state then throws
 * "Cannot read properties of undefined (reading 'paddingConfig')" on first use.
 * Rebuild it here and re-attach on every load.
 */
const CLIENT_CONFIG = {
  keyRetentionConfig: defaultKeyRetentionConfig,
  lifetimeConfig: defaultLifetimeConfig,
  keyPackageEqualityConfig: defaultKeyPackageEqualityConfig,
  paddingConfig: defaultPaddingConfig,
  authService: defaultAuthenticationService,
};

const CAPABILITIES = {
  versions: ['mls10'],
  ciphersuites: [MLS_CIPHERSUITE_NAME],
  extensions: [],
  proposals: [],
  credentials: ['basic'],
};

let cipherSuitePromise = null;
export function cipherSuite() {
  if (!cipherSuitePromise) cipherSuitePromise = getCiphersuiteImpl(getCiphersuiteFromName(MLS_CIPHERSUITE_NAME));
  return cipherSuitePromise;
}

const wrapPrivate = (pm) => ({ wireformat: 'mls_private_message', version: 'mls10', privateMessage: pm });
const decodeWire = (b64) => decodeMlsMessage(base642bin(b64), 0)[0];

const concatBytes = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

/**
 * Stand-in for ts-mls `processMessage`.
 *
 * UPSTREAM BUG (ts-mls 1.6.2, processMessages.js): processMessage forwards the
 * caller's pskIndex for public messages but hardcodes emptyPskIndex for private
 * ones. Since commits travel as private messages, every PSK-bearing commit —
 * i.e. the whole post-quantum design — fails with "Could not find pskId
 * referenced in proposal". The lower-level functions honour the index.
 */
async function processAny(message, clientState, pskIndex, cs) {
  if (message.wireformat === 'mls_public_message') {
    const r = await processPublicMessage(clientState, message.publicMessage, pskIndex, cs, acceptAll);
    return { ...r, kind: 'newState' };
  }
  return processPrivateMessage(clientState, message.privateMessage, pskIndex, cs, acceptAll);
}

// ----------------------------------------------------------------- identity --

/**
 * Derives the MLS identity from the account's existing 64-byte pqSeed, so it
 * survives account restore with no new backup material.
 *
 * PARTIAL by design: only the signature key is recoverable this way. ts-mls
 * generates the init and HPKE keys internally, so after a restore the client
 * keeps its MLS identity (it remains the same principal in existing groups) but
 * MUST publish fresh KeyPackages, and recovers per-group ratchet state from
 * IndexedDB or via an external re-join.
 */
export function deriveIdentity(keys) {
  /*
   * ALWAYS the padded 64-character form.
   *
   * keys.address is the 40-character short address, but everything this
   * identity is compared against uses the padded form: tx.from, the group
   * roster from the chain, and the groupId the server recomputes from tx.from.
   * Using the short form here silently breaks all three — group_create is
   * rejected for a bad groupId, and every inbound message fails the
   * sender-binding check because the credential says 40 chars and tx.from says
   * 64.
   */
  const address = longAddress(keys.address).toLowerCase();
  const pqSeed = hex2bin(keys.pqSeed);
  const signKey = deriveDhKey(concatBytes(utf82bin('liberdus-mls-sig-v1'), pqSeed));
  return {
    address,
    credential: { credentialType: 'basic', identity: utf82bin(address) },
    sigKeyPair: { signKey, publicKey: ed25519.getPublicKey(signKey) },
    pq: generatePQKeys(keys.pqSeed),
  };
}

/** Produces a KeyPackage. Transient — nothing is persisted. */
export async function generateKeyPackage(identity) {
  const cs = await cipherSuite();
  return generateKeyPackageWithKey(identity.credential, CAPABILITIES, defaultLifetime, [], identity.sigKeyPair, cs);
}

export async function encodeKeyPackageForPublish(keyPackage) {
  return bin2base64(encodeMlsMessage({ wireformat: 'mls_key_package', version: 'mls10', keyPackage }));
}

/**
 * Produces a KeyPackage for publishing AND persists its private half.
 *
 * A Welcome is encrypted to the exact KeyPackage that was consumed to add us,
 * so joining later needs those private keys. Generating a fresh KeyPackage at
 * join time fails with "No matching secret found".
 */
export async function createPublishableKeyPackage(identity) {
  const kp = await generateKeyPackage(identity);
  const wire = await encodeKeyPackageForPublish(kp.publicPackage);
  await keyPackageStore.put({
    id: `${identity.address}:${hashBytes(wire)}`,
    address: identity.address,
    wire,
    privatePackage: kp.privatePackage,
  });
  return wire;
}

/** How many published KeyPackages are still awaiting use. */
export async function countStoredKeyPackages(address) {
  return (await keyPackageStore.listForAccount(address)).length;
}

/** Drops stored KeyPackages, e.g. after re-publishing a fresh pool. */
export async function clearStoredKeyPackages(address) {
  return keyPackageStore.clearAccount(address);
}

export function decodeKeyPackageFromChain(b64) {
  const msg = decodeWire(b64);
  if (!msg || msg.wireformat !== 'mls_key_package') throw new Error('not a key package');
  return msg.keyPackage;
}

// ------------------------------------------------------------- PQ PSK ratchet --

const PSK_RATCHET_LABEL = utf82bin('liberdus-mls-psk-ratchet');
const PSK_WRAP_LABEL = utf82bin('liberdus-mls-psk-wrap');

/** psk[n] = KDF(label || psk[n-1]) — how existing members keep up for free. */
export const ratchetPsk = (psk) => deriveDhKey(concatBytes(PSK_RATCHET_LABEL, psk));

/**
 * Seals a PSK to a member's published ML-KEM-1024 public key, using the same
 * primitives 1:1 chat uses.
 * @param {Uint8Array} psk
 * @param {string} pqPublicKeyB64 the member's account pqPublicKey
 */
export function sealPsk(psk, pqPublicKeyB64) {
  const { cipherText, sharedSecret } = pqSharedKey(pqPublicKeyB64);
  const key = deriveDhKey(concatBytes(PSK_WRAP_LABEL, sharedSecret));
  return {
    cipherText: bin2base64(cipherText),
    nonce: '',
    ct: encryptChacha(key, bin2base64(psk)),
  };
}

/** Recovers a sealed PSK with the account's ML-KEM secret key. */
export function openPsk(sealed, pqSecretKey) {
  const sharedSecret = pqSharedKey(pqSecretKey, sealed.cipherText);
  const key = deriveDhKey(concatBytes(PSK_WRAP_LABEL, sharedSecret));
  const psk = decryptChacha(key, sealed.ct);
  if (!psk) throw new Error('failed to open the post-quantum PSK');
  return base642bin(psk);
}

const pskProposal = (pskId, pskNonce) => ({
  proposalType: 'psk',
  psk: { preSharedKeyId: { psktype: 'external', pskId, pskNonce } },
});

const pskIndexFor = (pskId, psk) => makePskIndex(undefined, { [bin2base64(pskId)]: psk });

// ---------------------------------------------------------------- state I/O --

/** In-memory cache of live ClientState, keyed by `${address}:${groupId}`. */
const live = new Map();
const cacheKey = (address, groupId) => `${String(address).toLowerCase()}:${String(groupId).toLowerCase()}`;

async function loadEntry(address, groupId) {
  const key = cacheKey(address, groupId);
  if (live.has(key)) return live.get(key);
  const rec = await mlsStore.get(address, groupId);
  if (!rec) return null;
  const entry = {
    address,
    groupId,
    // re-attach clientConfig: decodeGroupState does not restore it
    clientState: { ...decodeGroupState(rec.state, 0)[0], clientConfig: CLIENT_CONFIG },
    psk: rec.psk,
    pskId: rec.pskId,
    pskNonce: rec.pskNonce,
    lastMessageTimestamp: rec.lastMessageTimestamp || 0,
    lastHandshakeEpoch: rec.lastHandshakeEpoch || 0,
    memberSinceEpoch: rec.memberSinceEpoch || 0,
  };
  live.set(key, entry);
  return entry;
}

/** Persists state and cursors atomically, then notifies other tabs. */
async function persist(entry) {
  live.set(cacheKey(entry.address, entry.groupId), entry);
  await mlsStore.put({
    address: entry.address,
    groupId: entry.groupId,
    state: encodeGroupState(entry.clientState),
    epoch: Number(entry.clientState.groupContext.epoch),
    psk: entry.psk,
    pskId: entry.pskId,
    pskNonce: entry.pskNonce,
    lastMessageTimestamp: entry.lastMessageTimestamp || 0,
    lastHandshakeEpoch: entry.lastHandshakeEpoch || 0,
    memberSinceEpoch: entry.memberSinceEpoch || 0,
  });
  announceGroupChanged(entry.groupId, Number(entry.clientState.groupContext.epoch));
}

/** Drops cached state so the next read comes from IndexedDB. */
export function evictCache(address, groupId) {
  if (address && groupId) live.delete(cacheKey(address, groupId));
  else live.clear();
}

export const hasGroupState = async (address, groupId) => !!(await mlsStore.get(address, groupId));

export const epochOf = (entry) => Number(entry.clientState.groupContext.epoch);

/** Member addresses, read from the ratchet tree — cryptographic, not hearsay. */
export function rosterOf(entry) {
  return entry.clientState.ratchetTree
    .filter((n) => n && n.nodeType === 'leaf')
    .map((n) => bin2utf8(n.leaf.credential.identity));
}

export async function getGroupView(address, groupId) {
  const entry = await loadEntry(address, groupId);
  if (!entry) return null;
  return {
    epoch: epochOf(entry),
    roster: rosterOf(entry),
    memberSinceEpoch: entry.memberSinceEpoch,
    lastMessageTimestamp: entry.lastMessageTimestamp,
    lastHandshakeEpoch: entry.lastHandshakeEpoch,
  };
}

// -------------------------------------------------------------------- group --

/** Creates a new group locally. Returns what group_create needs. */
export async function createGroup(identity, groupId, mlsGroupId) {
  const cs = await cipherSuite();
  return withGroupLock(identity.address, groupId, async () => {
    const keyPackage = await generateKeyPackage(identity);
    const clientState = await mlsCreateGroup(
      utf82bin(mlsGroupId),
      keyPackage.publicPackage,
      keyPackage.privatePackage,
      [],
      cs,
      CLIENT_CONFIG,
    );
    const entry = {
      address: identity.address,
      groupId,
      clientState,
      psk: generateRandomBytes(32), // psk[0]
      pskId: generateRandomBytes(16),
      pskNonce: generateRandomBytes(cs.kdf.size),
      lastMessageTimestamp: 0,
      lastHandshakeEpoch: 0,
      memberSinceEpoch: 0,
    };
    await persist(entry);
    return { epoch: 0, mlsGroupId };
  });
}

/**
 * Adds members. Ratchets the post-quantum PSK and seals it to the NEW members
 * only; existing members derive the same value locally.
 *
 * Returns the payload for a group_commit transaction. State is persisted before
 * returning, so the caller must treat a failed injection as a burnt epoch and
 * re-read the chain rather than retrying with the same commit.
 */
export async function addMembers(identity, groupId, newMembers) {
  const cs = await cipherSuite();
  return withGroupLock(identity.address, groupId, async () => {
    const entry = await loadEntry(identity.address, groupId);
    if (!entry) throw new Error('no local MLS state for this group');

    const nextPsk = ratchetPsk(entry.psk);
    const nextPskId = generateRandomBytes(16);
    const nextPskNonce = generateRandomBytes(cs.kdf.size);

    const commit = await createCommit(
      { state: entry.clientState, cipherSuite: cs, pskIndex: pskIndexFor(nextPskId, nextPsk) },
      {
        extraProposals: [
          ...newMembers.map((m) => ({
            proposalType: 'add',
            add: { keyPackage: decodeKeyPackageFromChain(m.keyPackage) },
          })),
          pskProposal(nextPskId, nextPskNonce),
        ],
      },
    );

    const priorEpoch = epochOf(entry);
    entry.clientState = commit.newState;
    entry.psk = nextPsk;
    entry.pskId = nextPskId;
    entry.pskNonce = nextPskNonce;
    entry.lastHandshakeEpoch = epochOf(entry);
    await persist(entry);
    commit.consumed.forEach((b) => b.fill(0));

    const ratchetTree = bin2base64(encodeGroupState(entry.clientState));
    const welcomeB64 = bin2base64(
      encodeMlsMessage({ wireformat: 'mls_welcome', version: 'mls10', welcome: commit.welcome }),
    );

    return {
      epoch: priorEpoch, // the epoch this commit targets, for the server fence
      commit: bin2base64(encodeMlsMessage(commit.commit)),
      proposals: [],
      pskId: bin2base64(nextPskId),
      pskNonce: bin2base64(nextPskNonce),
      ratchetTree,
      groupInfo: ratchetTree,
      welcomes: newMembers.map((m) => ({
        address: m.address,
        envelope: {
          welcome: welcomeB64,
          ratchetTree,
          sealedPsk: sealPsk(nextPsk, m.pqPublicKey),
          pskId: bin2base64(nextPskId),
          pskNonce: bin2base64(nextPskNonce),
          epoch: priorEpoch + 1,
          timestamp: Date.now(),
        },
      })),
      addedMembers: newMembers.map((m) => m.address),
      removedMembers: [],
      consumedKeyPackages: newMembers.map((m) => ({ address: m.address, keyPackage: m.keyPackage })),
    };
  });
}

/** Removes members. Same ratchet, but nobody new needs a sealed copy. */
export async function removeMembers(identity, groupId, addresses) {
  const cs = await cipherSuite();
  return withGroupLock(identity.address, groupId, async () => {
    const entry = await loadEntry(identity.address, groupId);
    if (!entry) throw new Error('no local MLS state for this group');

    const roster = rosterOf(entry);
    const leafIndexes = addresses.map((address) => {
      const idx = roster.indexOf(String(address).toLowerCase());
      if (idx < 0) throw new Error(`${address} is not in the group roster`);
      return idx;
    });

    const nextPsk = ratchetPsk(entry.psk);
    const nextPskId = generateRandomBytes(16);
    const nextPskNonce = generateRandomBytes(cs.kdf.size);

    const commit = await createCommit(
      { state: entry.clientState, cipherSuite: cs, pskIndex: pskIndexFor(nextPskId, nextPsk) },
      {
        extraProposals: [
          ...leafIndexes.map((removed) => ({ proposalType: 'remove', remove: { removed } })),
          pskProposal(nextPskId, nextPskNonce),
        ],
      },
    );

    const priorEpoch = epochOf(entry);
    entry.clientState = commit.newState;
    entry.psk = nextPsk;
    entry.pskId = nextPskId;
    entry.pskNonce = nextPskNonce;
    entry.lastHandshakeEpoch = epochOf(entry);
    await persist(entry);
    commit.consumed.forEach((b) => b.fill(0));

    const ratchetTree = bin2base64(encodeGroupState(entry.clientState));
    return {
      epoch: priorEpoch,
      commit: bin2base64(encodeMlsMessage(commit.commit)),
      proposals: [],
      pskId: bin2base64(nextPskId),
      pskNonce: bin2base64(nextPskNonce),
      ratchetTree,
      groupInfo: ratchetTree,
      welcomes: [],
      addedMembers: [],
      removedMembers: addresses.map((a) => String(a).toLowerCase()),
      consumedKeyPackages: [],
    };
  });
}

/** Applies someone else's commit, ratcheting the local PSK to match. */
export async function applyCommit(identity, groupId, record) {
  const cs = await cipherSuite();
  return withGroupLock(identity.address, groupId, async () => {
    const entry = await loadEntry(identity.address, groupId);
    if (!entry) throw new Error('no local MLS state for this group');

    const nextPsk = ratchetPsk(entry.psk);
    const pskId = base642bin(record.pskId);
    const res = await processAny(decodeWire(record.commit), entry.clientState, pskIndexFor(pskId, nextPsk), cs);
    if (res.kind !== 'newState') throw new Error(`expected a commit, got ${res.kind}`);

    entry.clientState = res.newState;
    entry.psk = nextPsk;
    entry.pskId = pskId;
    entry.pskNonce = base642bin(record.pskNonce);
    entry.lastHandshakeEpoch = epochOf(entry);
    await persist(entry);
    res.consumed.forEach((b) => b.fill(0));
    return epochOf(entry);
  });
}

/** Joins from a Welcome, recovering the PSK with the account's ML-KEM key. */
export async function joinFromWelcome(identity, groupId, envelope) {
  const cs = await cipherSuite();
  return withGroupLock(identity.address, groupId, async () => {
    const psk = openPsk(envelope.sealedPsk, identity.pq.secretKey);
    const pskId = base642bin(envelope.pskId);

    const welcome = decodeWire(envelope.welcome);
    if (!welcome || welcome.wireformat !== 'mls_welcome') throw new Error('not a welcome message');

    const ratchetTree = decodeGroupState(base642bin(envelope.ratchetTree), 0)[0].ratchetTree;

    /*
     * The Welcome is addressed to whichever published KeyPackage the committer
     * consumed, and the transaction does not tell us which. Try each stored
     * candidate — the pool is small — and keep the one that works.
     */
    const candidates = await keyPackageStore.listForAccount(identity.address);
    if (candidates.length === 0) {
      throw new Error('no stored key packages: cannot open a Welcome addressed to a published one');
    }

    let clientState = null;
    let used = null;
    let lastError = null;
    for (const candidate of candidates) {
      try {
        clientState = await joinGroup(
          welcome.welcome,
          decodeKeyPackageFromChain(candidate.wire),
          candidate.privatePackage,
          pskIndexFor(pskId, psk),
          cs,
          ratchetTree,
          undefined,
          CLIENT_CONFIG,
        );
        used = candidate;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!clientState) {
      throw new Error(`could not open the Welcome with any stored key package: ${lastError && lastError.message}`);
    }
    // That KeyPackage is spent; MLS init keys are single-use.
    await keyPackageStore.delete(used.id);

    const entry = {
      address: identity.address,
      groupId,
      clientState,
      psk,
      pskId,
      pskNonce: base642bin(envelope.pskNonce),
      lastMessageTimestamp: 0,
      lastHandshakeEpoch: Number(clientState.groupContext.epoch),
      // Everything before this epoch is undecryptable by design (forward secrecy)
      memberSinceEpoch: Number(clientState.groupContext.epoch),
    };
    await persist(entry);
    return epochOf(entry);
  });
}

// ------------------------------------------------------------------ messages --

/**
 * Encrypts an application message.
 *
 * The sender address is embedded in the plaintext and must be checked against
 * tx.from on receipt. MLS proves *a group member* sent the message; the
 * transaction signature proves *which* member. Together they close the gap left
 * by ts-mls not exposing the sender for application messages.
 *
 * State is persisted BEFORE the caller injects: MLS ratchets forward on
 * encrypt, and reusing a ratchet step after a crash would be a genuine
 * confidentiality break. A failed injection merely burns a step.
 */
export async function encryptMessage(identity, groupId, payloadObject) {
  const cs = await cipherSuite();
  return withGroupLock(identity.address, groupId, async () => {
    const entry = await loadEntry(identity.address, groupId);
    if (!entry) throw new Error('no local MLS state for this group');

    const payload = { ...payloadObject, from: identity.address };
    const r = await createApplicationMessage(entry.clientState, utf82bin(JSON.stringify(payload)), cs);
    entry.clientState = r.newState;
    await persist(entry);
    r.consumed.forEach((b) => b.fill(0));

    return {
      message: bin2base64(encodeMlsMessage(wrapPrivate(r.privateMessage))),
      epoch: epochOf(entry),
    };
  });
}

/**
 * Decrypts one transcript record.
 *
 * Returns null for records that are not application messages (own echoes, for
 * instance). Throws on a sender mismatch, which is the anti-replay check.
 */
export async function decryptMessage(identity, groupId, record) {
  const cs = await cipherSuite();
  return withGroupLock(identity.address, groupId, async () => {
    const entry = await loadEntry(identity.address, groupId);
    if (!entry) throw new Error('no local MLS state for this group');

    const res = await processAny(decodeWire(record.message), entry.clientState, pskIndexFor(entry.pskId, entry.psk), cs);
    entry.clientState = res.newState;
    if (record.timestamp > entry.lastMessageTimestamp) entry.lastMessageTimestamp = record.timestamp;
    await persist(entry);

    if (res.kind !== 'applicationMessage') return null;
    res.consumed.forEach((b) => b.fill(0));

    const payload = JSON.parse(bin2utf8(res.message));
    const claimed = String(payload.from || '').toLowerCase();
    const actual = String(record.from || '').toLowerCase();
    if (claimed !== actual) {
      throw new Error(`sender mismatch: payload claims ${claimed} but tx.from is ${actual}`);
    }
    return payload;
  });
}

/** Advances the message cursor without decrypting (pre-join history). */
export async function skipMessage(identity, groupId, timestamp) {
  return withGroupLock(identity.address, groupId, async () => {
    const entry = await loadEntry(identity.address, groupId);
    if (!entry) return;
    if (timestamp > entry.lastMessageTimestamp) {
      entry.lastMessageTimestamp = timestamp;
      await persist(entry);
    }
  });
}

/**
 * Exports a group secret. Identical across members only when every client is at
 * the same epoch, which makes it a cheap way to prove convergence.
 */
export async function exportGroupSecret(identity, groupId, label = 'liberdus-verification') {
  const cs = await cipherSuite();
  const entry = await loadEntry(identity.address, groupId);
  if (!entry) throw new Error('no local MLS state for this group');
  // mlsExporter takes the exporter secret itself, not the client state.
  return mlsExporter(entry.clientState.keySchedule.exporterSecret, label, utf82bin(groupId), 32, cs);
}

export { joinGroupExternal };
