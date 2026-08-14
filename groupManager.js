/**
 * Group chat orchestration: transaction building, chain sync, and discovery.
 *
 * app.js keeps its helpers module-scoped, so this module receives them through
 * initGroupManager() rather than importing them. That keeps group chat in its
 * own file instead of growing app.js, and keeps the seam explicit.
 *
 * Division of labour:
 *   mlsEngine.js  — all cryptography and MLS state
 *   mlsStore.js   — durability and cross-tab locking
 *   groupManager  — transactions, polling, and the myData.groups view model
 */

import * as mls from './mlsEngine.js';
import { mlsStore, onGroupChanged, locksSupported } from './mlsStore.js';
import { hashBytes, encryptChacha, decryptChacha, generateRandomBytes } from './crypto.js';
import { longAddress, normalizeAddress, bin2hex, bin2base64 } from './lib.js';

/** How many single-use KeyPackages to keep published. X-Wing ones are ~2.6 kB. */
const KEY_PACKAGE_POOL = 5;
const KEY_PACKAGE_REFILL_AT = 2;

let deps = null;

/**
 * @param {Object} d
 * @param {Function} d.queryNetwork      GET against a gateway
 * @param {Function} d.signObj           signs a tx in place, returns txid
 * @param {Function} d.injectTx          submits a signed tx
 * @param {Function} d.getTransactionTimestamp
 * @param {Function} d.getTransactionFeeWei
 * @param {Function} d.getMyAccount      () => myAccount
 * @param {Function} d.getMyData         () => myData
 * @param {Function} d.getNetworkId      () => netid
 * @param {Function} [d.onGroupUpdated]  called after a group's view model changes
 */
export function initGroupManager(d) {
  deps = d;
  if (!locksSupported) {
    console.warn('[groups] Web Locks unavailable: multiple tabs could fork MLS state.');
  }
  onGroupChanged(({ groupId }) => {
    if (deps && deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  });
}

const myAddress = () => longAddress(deps.getMyAccount().keys.address).toLowerCase();
const identity = () => mls.deriveIdentity(deps.getMyAccount().keys);

/** Server-side id is hash(creator + nonce); this must match utils.calculateGroupId. */
export const calculateGroupId = (creator, groupNonce) =>
  hashBytes(`${String(creator).toLowerCase()}${String(groupNonce).toLowerCase()}`);

async function submit(tx) {
  const txid = await deps.signObj(tx, deps.getMyAccount().keys);
  const res = await deps.injectTx(tx, txid);
  const ok = res?.result?.success ?? res?.success;
  if (!ok) {
    throw new Error(res?.result?.reason || res?.reason || 'transaction was rejected');
  }
  return { txid, res };
}

const baseTx = (type) => ({
  type,
  from: myAddress(),
  timestamp: deps.getTransactionTimestamp(),
  fee: deps.getTransactionFeeWei(),
  networkId: deps.getNetworkId(),
});

// ------------------------------------------------------------ group metadata --

/*
 * Group name and avatar are encrypted with the MLS exporter secret so the
 * network only ever stores an opaque blob. The exporter changes every epoch, so
 * the blob is rewritten on every commit — a member always holds the secret for
 * the epoch they are currently on, including the one they joined at.
 */
async function metaKey(groupId) {
  return mls.exportGroupSecret(identity(), groupId, 'liberdus-group-meta');
}

async function encryptMeta(groupId, meta) {
  return encryptChacha(await metaKey(groupId), JSON.stringify(meta));
}

async function decryptMeta(groupId, blob) {
  if (!blob) return {};
  try {
    const plain = decryptChacha(await metaKey(groupId), blob);
    return plain ? JSON.parse(plain) : {};
  } catch {
    // Written at a different epoch, or we are not a member yet.
    return {};
  }
}

// -------------------------------------------------------------- key packages --

/** Publishes a fresh pool of single-use KeyPackages so others can add us. */
export async function publishKeyPackages(count = KEY_PACKAGE_POOL) {
  const id = identity();
  // Publishing replaces the on-chain pool, so the old private halves are dead
  // weight — any Welcome addressed to them can no longer be produced.
  await mls.clearStoredKeyPackages(id.address);
  const packages = [];
  for (let i = 0; i < count; i++) {
    // Persists the private half; a Welcome can only be opened with it.
    packages.push(await mls.createPublishableKeyPackage(id));
  }
  // The last entry doubles as the reusable fallback for when the pool empties.
  const tx = {
    ...baseTx('group_keypackage_publish'),
    keyPackages: packages,
    lastResortKeyPackage: packages[packages.length - 1],
    cipherSuite: mls.MLS_CIPHERSUITE_ID,
  };
  await submit(tx);
  return packages.length;
}

/** Tops the pool back up once adds have consumed most of it. */
export async function ensureKeyPackages() {
  const res = await deps.queryNetwork(`/account/${myAddress()}/keypackages`);
  const remaining = Array.isArray(res?.keyPackages) ? res.keyPackages.length : 0;
  const suiteMismatch = res?.cipherSuite && res.cipherSuite !== mls.MLS_CIPHERSUITE_ID;
  if (remaining <= KEY_PACKAGE_REFILL_AT || suiteMismatch) {
    await publishKeyPackages();
    return true;
  }
  return false;
}

// ------------------------------------------------------------------ lifecycle --

export async function createGroup(name, maxMembers = 50) {
  const id = identity();
  const groupNonce = bin2hex(generateRandomBytes(32));
  const groupId = calculateGroupId(id.address, groupNonce);

  await mls.createGroup(id, groupId, groupId);

  const tx = {
    ...baseTx('group_create'),
    groupId,
    groupNonce,
    mlsGroupId: groupId,
    cipherSuite: mls.MLS_CIPHERSUITE_ID,
    meta: await encryptMeta(groupId, { name }),
    maxMembers,
  };

  try {
    await submit(tx);
  } catch (e) {
    // The chain rejected it, so drop the local state rather than leaving an
    // orphan group that can never be synced.
    await mlsStore.delete(id.address, groupId);
    mls.evictCache(id.address, groupId);
    throw e;
  }

  // Seed the view locally rather than re-reading the chain: submit() returns on
  // acceptance, not application, so the group account does not exist yet.
  const view = ensureGroupView(groupId);
  view.name = name;
  view.members = [id.address];
  view.admins = [id.address];
  view.epoch = 0;
  view.memberSinceEpoch = 0;
  view.maxMembers = maxMembers;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);

  return groupId;
}

/**
 * Adds members. Each addee must have published a KeyPackage and a pqPublicKey —
 * the first is how MLS adds them, the second is how the post-quantum PSK is
 * sealed to their long-term identity.
 */
export async function addMembers(groupId, addresses) {
  const id = identity();
  const newMembers = [];

  for (const raw of addresses) {
    const address = longAddress(raw).toLowerCase();
    const res = await deps.queryNetwork(`/account/${address}/keypackages`);
    const pool = Array.isArray(res?.keyPackages) ? res.keyPackages : [];
    const keyPackage = pool[0] || res?.lastResortKeyPackage;
    if (!keyPackage) throw new Error(`${raw} has not published an MLS key package yet`);
    if (!res?.pqPublicKey) throw new Error(`${raw} has no post-quantum public key`);
    if (res?.cipherSuite && res.cipherSuite !== mls.MLS_CIPHERSUITE_ID) {
      throw new Error(`${raw} published key packages for a different ciphersuite`);
    }
    newMembers.push({ address, keyPackage, pqPublicKey: res.pqPublicKey });
  }

  const commit = await mls.addMembers(id, groupId, newMembers);
  const view = deps.getMyData().groups?.[groupId];
  const tx = {
    ...baseTx('group_commit'),
    groupId,
    ...commit,
    meta: await encryptMeta(groupId, { name: view?.name || '' }),
  };
  await submit(tx);
  applyMembershipLocally(groupId, { added: commit.addedMembers }, commit.epoch + 1);
  return commit.addedMembers;
}

export async function removeMembers(groupId, addresses) {
  const id = identity();
  const commit = await mls.removeMembers(
    id,
    groupId,
    addresses.map((a) => longAddress(a).toLowerCase()),
  );
  const view = deps.getMyData().groups?.[groupId];
  const tx = {
    ...baseTx('group_commit'),
    groupId,
    ...commit,
    meta: await encryptMeta(groupId, { name: view?.name || '' }),
  };
  await submit(tx);
  applyMembershipLocally(groupId, { removed: commit.removedMembers }, commit.epoch + 1);
  return commit.removedMembers;
}

/**
 * Leaves a group.
 *
 * NOTE: this stops the network accepting our messages, but we still hold the
 * current epoch secret until a remaining member commits a Remove. The UI should
 * not claim the departure is cryptographically complete.
 */
export async function leaveGroup(groupId) {
  const view = deps.getMyData().groups?.[groupId];
  /*
   * If we have already been removed there is nothing to leave: the chain roster
   * no longer contains us, so group_leave would be rejected with "sender is not
   * a member of this group". Just drop the local copy.
   */
  if (!view?.removed) {
    await submit({ ...baseTx('group_leave'), groupId });
  }
  await forgetGroup(groupId);
}

/** Purges every local trace of a group. Does not touch the network. */
export async function forgetGroup(groupId) {
  const id = identity();
  await mlsStore.delete(id.address, groupId);
  mls.evictCache(id.address, groupId);
  const myData = deps.getMyData();
  if (myData.groups) delete myData.groups[groupId];
  myData.chats = (myData.chats || []).filter((c) => !(c.kind === 'group' && c.groupId === groupId));
}

// -------------------------------------------------------------------- sending --

export async function sendGroupMessage(groupId, text) {
  const id = identity();
  const sentTimestamp = deps.getTransactionTimestamp();
  const { message, epoch } = await mls.encryptMessage(id, groupId, {
    message: text,
    sent_timestamp: sentTimestamp,
  });

  const tx = { ...baseTx('group_message'), groupId, epoch, message };
  const { txid } = await submit(tx);

  // Optimistic local echo: MLS cannot decrypt our own outbound message, so the
  // transcript replay will skip it and this is the only copy we render.
  appendLocalMessage(groupId, {
    txid,
    from: id.address,
    message: text,
    sent_timestamp: sentTimestamp,
    timestamp: tx.timestamp,
    mine: true,
  });
  return txid;
}

// ----------------------------------------------------------------- view model --

function ensureGroupView(groupId) {
  const myData = deps.getMyData();
  if (!myData.groups) myData.groups = {};
  if (!myData.groups[groupId]) {
    myData.groups[groupId] = {
      groupId,
      name: '',
      members: [],
      admins: [],
      epoch: 0,
      memberSinceEpoch: 0,
      messages: [],
      unread: 0,
      lastActivity: 0,
      // Set once the chain roster no longer contains us. History stays readable
      // up to the removing commit; nothing after it ever becomes decryptable.
      removed: false,
    };
  }
  if (!Array.isArray(myData.chats)) myData.chats = [];
  if (!myData.chats.some((c) => c.kind === 'group' && c.groupId === groupId)) {
    myData.chats.unshift({ kind: 'group', groupId, timestamp: 0 });
  }
  return myData.groups[groupId];
}

/**
 * Records that some history was skipped because it predates our membership.
 *
 * Stored as an ordinary item in the message list so it sorts into the right
 * position, including the second gap a member accumulates if they are removed
 * and later added back. Only emitted when something was genuinely skipped —
 * inferring it from memberSinceEpoch showed the separator to anyone who had not
 * created the group, even when they could read every message present.
 */
function noteHistoryGap(groupId, timestamp) {
  const view = ensureGroupView(groupId);
  const last = view.messages[view.messages.length - 1];
  // Extend the current gap rather than emitting one marker per hidden message.
  if (last && last.system === 'gap') {
    last.timestamp = Math.max(last.timestamp, timestamp);
    return;
  }
  view.messages.push({
    system: 'gap',
    txid: `gap-${timestamp}`,
    message: 'Messages sent before you joined are not available',
    timestamp,
  });
}

function appendLocalMessage(groupId, message) {
  const view = ensureGroupView(groupId);
  if (message.txid && view.messages.some((m) => m.txid === message.txid)) return;
  view.messages.push(message);
  view.lastActivity = Math.max(view.lastActivity || 0, message.timestamp || 0);
  const entry = deps.getMyData().chats.find((c) => c.kind === 'group' && c.groupId === groupId);
  if (entry) entry.timestamp = view.lastActivity;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
}

/**
 * Applies a membership change to the local view immediately after a commit.
 *
 * Deliberately NOT a chain re-read. `submit()` returns once the transaction is
 * accepted, not once it is applied, so querying the group right away returns
 * the pre-commit state: a stale roster, and a `meta` blob encrypted with the
 * previous epoch's exporter which our now-advanced state cannot decrypt. That
 * produced a spurious "Decryption failed" in the console and briefly showed the
 * old member list. We already know the outcome, so apply it directly and let
 * the next poll reconcile.
 */
function applyMembershipLocally(groupId, { added = [], removed = [] }, epoch) {
  const view = ensureGroupView(groupId);
  const gone = new Set(removed.map((a) => String(a).toLowerCase()));
  view.members = [...(view.members || []).filter((m) => !gone.has(m)), ...added];
  view.admins = (view.admins || []).filter((a) => !gone.has(a));
  if (typeof epoch === 'number') view.epoch = epoch;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return view;
}

/** Refreshes the view model from chain metadata plus local MLS state. */
async function upsertGroupView(groupId, extra = {}) {
  const view = ensureGroupView(groupId);
  const info = await deps.queryNetwork(`/group/${groupId}`);
  if (info?.group) {
    view.members = info.group.members || [];
    view.admins = info.group.admins || [];
    view.maxMembers = info.group.maxMembers;
    const meta = await decryptMeta(groupId, info.group.meta);
    if (meta.name) view.name = meta.name;
  }
  const local = await mls.getGroupView(myAddress(), groupId);
  if (local) {
    view.epoch = local.epoch;
    view.memberSinceEpoch = local.memberSinceEpoch;
  }
  if (extra.name) view.name = extra.name;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return view;
}

// -------------------------------------------------------------------- syncing --

/**
 * Brings one group up to date: apply commits first, then decrypt messages.
 *
 * Order matters. A message encrypted at epoch N+1 cannot be read until the
 * commit that produced N+1 has been applied.
 */
export async function syncGroup(groupId) {
  const id = identity();
  const me = id.address;

  /*
   * Removal check first.
   *
   * group_commit deletes the removee's chats pointer, so a removed member no
   * longer appears in /account/:id/groups and would otherwise sit forever on a
   * stale screen with no idea anything happened. The roster on the group
   * account is the authority.
   */
  const info = await deps.queryNetwork(`/group/${groupId}`);
  const roster = Array.isArray(info?.group?.members) ? info.group.members : null;

  if (roster && !roster.includes(me)) {
    const view = ensureGroupView(groupId);
    if (!view.removed) {
      view.removed = true;
      view.members = roster;
      /*
       * Discard the MLS state. The removing commit rotated the group keys, so
       * this state can never decrypt anything again — keeping it only creates
       * the illusion of membership. Dropping it also means that if we are added
       * back later, hasGroupState() is false and we take the normal join path
       * with the fresh Welcome, instead of silently continuing on dead state.
       *
       * The decrypted history in view.messages is deliberately kept: it was
       * legitimately readable while we were a member.
       */
      await mlsStore.delete(me, groupId);
      mls.evictCache(me, groupId);
      if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
      return true;
    }
    return false;
  }

  // Back in the roster after a removal: clear the flag so the UI recovers, and
  // fall through to the join path below.
  const current = ensureGroupView(groupId);
  if (current.removed && roster) {
    current.removed = false;
    current.members = roster;
    if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  }

  if (!(await mls.hasGroupState(me, groupId))) {
    const joined = await tryJoinFromWelcome(groupId);
    if (!joined) return false;
  }

  let local = await mls.getGroupView(me, groupId);
  let changed = false;

  // --- handshakes -----------------------------------------------------------
  const hs = await deps.queryNetwork(`/group/${groupId}/handshakes/${local.epoch}`);
  const records = Array.isArray(hs?.handshakes) ? [...hs.handshakes].sort((a, b) => a.epoch - b.epoch) : [];

  if (hs && typeof hs.oldestAvailableEpoch === 'number' && hs.oldestAvailableEpoch > local.epoch) {
    // The commits we need have been pruned. Replaying is impossible; recovery
    // requires an external re-join from the checkpoint.
    console.warn(`[groups] ${groupId}: commits from epoch ${local.epoch} were pruned; external re-join required`);
    const view = ensureGroupView(groupId);
    view.needsRecovery = true;
    if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
    return false;
  }

  for (const record of records) {
    // record.epoch is the epoch the commit was built against. Anything below our
    // current epoch is already merged — including our own commits, which we
    // merged locally before injecting.
    if (record.epoch < local.epoch) continue;
    try {
      await mls.applyCommit(id, groupId, record);
      changed = true;
      local = await mls.getGroupView(me, groupId);
    } catch (e) {
      console.error(`[groups] ${groupId}: failed to apply commit at epoch ${record.epoch}`, e);
      break;
    }
  }

  // --- application messages -------------------------------------------------
  const since = (local.lastMessageTimestamp || 0) + 1;
  const msgs = await deps.queryNetwork(`/group/${groupId}/messages/${since}`);
  const list = Array.isArray(msgs?.messages) ? msgs.messages : [];

  for (const record of list) {
    if (String(record.from).toLowerCase() === me) {
      // Our own outbound message; MLS cannot decrypt it and we already echoed it.
      await mls.skipMessage(id, groupId, record.timestamp);
      continue;
    }
    if (record.epoch < local.memberSinceEpoch) {
      // Sent before we joined — undecryptable by design (forward secrecy).
      // Record it so the UI can show a separator at the right place, rather
      // than inferring one from the epoch and showing it even when nothing was
      // actually hidden.
      noteHistoryGap(groupId, record.timestamp);
      await mls.skipMessage(id, groupId, record.timestamp);
      continue;
    }
    try {
      const payload = await mls.decryptMessage(id, groupId, record);
      if (!payload) continue;
      appendLocalMessage(groupId, {
        txid: record.txId,
        from: record.from,
        message: payload.message,
        sent_timestamp: payload.sent_timestamp || record.timestamp,
        timestamp: record.timestamp,
        mine: false,
      });
      const view = ensureGroupView(groupId);
      view.unread = (view.unread || 0) + 1;
      changed = true;
    } catch (e) {
      // A sender mismatch is an attack signal, not a transient error.
      console.error(`[groups] ${groupId}: dropped message ${record.txId}`, e.message);
      await mls.skipMessage(id, groupId, record.timestamp);
    }
  }

  if (changed) await upsertGroupView(groupId);
  return changed;
}

/** Joins a group we have been added to, using the Welcome parked on-chain. */
async function tryJoinFromWelcome(groupId) {
  const id = identity();
  const res = await deps.queryNetwork(`/group/${groupId}/welcome/${id.address}`);
  if (!res?.welcome) return false;
  if (res.cipherSuite && res.cipherSuite !== mls.MLS_CIPHERSUITE_ID) {
    console.error(`[groups] ${groupId}: ciphersuite ${res.cipherSuite} is not supported by this client`);
    return false;
  }
  await mls.joinFromWelcome(id, groupId, res.welcome);
  await upsertGroupView(groupId);
  // That Welcome consumed one of our published KeyPackages.
  ensureKeyPackages().catch((e) => console.warn('[groups] key package refill failed', e));
  return true;
}

/**
 * Discovers groups from the chain and syncs them all.
 *
 * Called from the existing chat poll loop. Discovery works through the same
 * chats map that 1:1 uses — group_create and group_commit write a pointer into
 * each member's account, so a new group surfaces without a separate index.
 */
export async function syncAllGroups() {
  if (!deps || !deps.getMyAccount()?.keys) return 0;

  /*
   * The chain listing alone is not enough. It is derived from the account's
   * chats pointers, and group_commit deletes the pointer when someone is
   * removed — so the one group a removed member most needs to hear about is
   * exactly the one that disappears from this list. Union it with the groups
   * this device already holds MLS state for.
   */
  const res = await deps.queryNetwork(`/account/${myAddress()}/groups`);
  const fromChain = Array.isArray(res?.groups) ? res.groups.map((g) => g.id) : [];
  const fromLocal = (await mlsStore.listForAccount(myAddress())).map((r) => r.groupId);
  const groupIds = [...new Set([...fromChain, ...fromLocal])];

  let updated = 0;
  for (const groupId of groupIds) {
    try {
      if (await syncGroup(groupId)) updated++;
    } catch (e) {
      console.error(`[groups] sync failed for ${groupId}`, e);
    }
  }
  return updated;
}

/** Restores the view model for every locally-known group after sign-in. */
export async function restoreGroups() {
  const records = await mlsStore.listForAccount(myAddress());
  for (const rec of records) {
    try {
      await upsertGroupView(rec.groupId);
    } catch (e) {
      console.warn(`[groups] could not restore ${rec.groupId}`, e);
    }
  }
  return records.length;
}

/** View-model only, so it stays usable before initGroupManager has run. */
export function markGroupRead(groupId) {
  const myData = deps && deps.getMyData();
  if (myData?.groups?.[groupId]) myData.groups[groupId].unread = 0;
}

export { normalizeAddress, bin2base64 };
