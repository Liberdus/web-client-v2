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
import { applyIncomingReaction, getContactReactionsForTarget } from './reactions.js';
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

/**
 * The one canonical form for an address in the view model: the padded 64-char
 * chain form, lower-cased.
 *
 * Comparing addresses by raw string is how the same person ends up listed
 * twice: the 40-char and 64-char forms of one account are different strings but
 * the same member, and lower-casing alone does not merge them. longAddress is
 * idempotent across both forms, so this is safe to apply repeatedly.
 *
 * Returns the input unchanged if it is not an address at all, so a malformed
 * roster entry stays visible rather than throwing the whole render away.
 */
function norm(address) {
  try {
    return longAddress(address).toLowerCase();
  } catch {
    return String(address).toLowerCase();
  }
}
const identity = () => mls.deriveIdentity(deps.getMyAccount().keys);

/** Server-side id is hash(creator + nonce); this must match utils.calculateGroupId. */
export const calculateGroupId = (creator, groupNonce) =>
  hashBytes(`${String(creator).toLowerCase()}${String(groupNonce).toLowerCase()}`);

/*
 * Receipt confirmation.
 *
 * Injecting a transaction only means "queued". Shardus runs validate_fields at
 * inject time, so those failures come back synchronously — but validate() and
 * apply() run later, during consensus. The epoch fence, the roster checks, the
 * balance checks and the payload size limit therefore all return success:true
 * at inject and only report failure in the receipt.
 *
 * So any local state we change on the strength of an inject response is a guess.
 * For group_commit that guess is expensive: this device advances an MLS epoch
 * nobody else advanced, and every commit it builds afterwards is unusable.
 */

/** A validator only answers for a short window; the collector is durable. */
const RECEIPT_VIA_VALIDATOR_MS = 20000;
/** Consensus needs a few seconds before any receipt exists. */
const RECEIPT_FIRST_POLL_MS = 4000;
const RECEIPT_POLL_MS = 2000;
const RECEIPT_TIMEOUT_MS = 30000;

/**
 * How long local state may read as ahead of the chain before we call it a fork
 * rather than propagation lag.
 *
 * Comfortably longer than RECEIPT_TIMEOUT_MS: by then a commit of ours has
 * either been confirmed (so the chain has it and the gap closes) or rolled back
 * (so we are no longer ahead).
 */
const AHEAD_GRACE_MS = 45000;

/*
 * Path updates are epoch-advancing commits, and the network allows exactly one
 * per epoch. Several members typically become eligible at the same instant —
 * a joiner rotates its key, and the same commit that admitted them opens the
 * creator's own deferred rotation — so without spacing they race, one loses,
 * and the loser has paid a transaction fee for a rejection.
 *
 * Staggering by leaf index gives members distinct slots from the same public
 * tree, with no coordination. One stagger step has to outlast a receipt
 * confirmation, or the next member starts before the previous one has landed.
 * Slots wrap (see PATH_UPDATE_SLOTS) so the wait stays bounded.
 */
const PATH_UPDATE_STAGGER_MS = 12000;
/**
 * How many distinct start slots the stagger uses.
 *
 * The delay was leafIndex * STAGGER, which grows without bound: leaf 20 waited
 * four minutes before its FIRST attempt, and a member with no path update is a
 * member with no post-compromise security. Slots are taken modulo this instead,
 * so the longest anyone waits is fixed however large the group gets.
 *
 * Ten because at most groupMaxMembersPerCommit (10) members can be admitted in
 * one commit, and it is precisely that batch which becomes eligible at the same
 * moment and needs distinct slots. Members further apart than this share a slot,
 * which costs a lost race and a backoff -- never correctness, since the epoch
 * fence rejects the loser cleanly.
 */
const PATH_UPDATE_SLOTS = 10;
/** After losing a race, wait rather than immediately re-racing the winner. */
const PATH_UPDATE_BACKOFF_MS = 15000;

/**
 * How long this member waits before its first path-update attempt.
 *
 * Derived from the leaf index alone, so every client computes the same slot for
 * the same member from public tree structure, with nothing to coordinate.
 *
 * @param {number} leafIndex
 * @returns {number} milliseconds, bounded by (PATH_UPDATE_SLOTS - 1) steps.
 */
function pathUpdateSlotDelay(leafIndex) {
  const leaf = Number.isInteger(leafIndex) && leafIndex > 0 ? leafIndex : 0;
  return (leaf % PATH_UPDATE_SLOTS) * PATH_UPDATE_STAGGER_MS;
}

/**
 * The server throttles group_message to one per member per group per second
 * (groupMessageMinIntervalMs), which is invisible until a reaction makes
 * sending two things in quick succession normal: react, then type, and the
 * message is rejected for "sending too fast".
 *
 * So outbound group messages queue behind each other. The extra 100ms is for
 * clock skew between us and the node validating tx.timestamp -- landing exactly
 * on the boundary is a rejection.
 *
 * Per group, because the limit is per group. Seeded empty on load: a send made
 * just before a reload can still be raced, and the server's rejection is the
 * backstop for that.
 */
const MIN_GROUP_SEND_GAP_MS = 1100;
const lastGroupSendAt = new Map();

async function spaceGroupSend(groupId) {
  const wait = (lastGroupSendAt.get(groupId) || 0) + MIN_GROUP_SEND_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastGroupSendAt.set(groupId, Date.now());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The receipt for a transaction, or null if it has not settled yet.
 *
 * Shared by the membership transactions and by reconcilePendingMessages so there
 * is one definition of "did this land".
 */
async function fetchReceipt(txid, submittedAt) {
  const age = Date.now() - submittedAt;
  const endpoint =
    age > RECEIPT_VIA_VALIDATOR_MS
      ? `/collector/api/transaction?appReceiptId=${txid}`
      : `/transaction/${txid}`;
  let res;
  try {
    res = await deps.queryNetwork(endpoint);
  } catch {
    return null; // transient; the caller polls again
  }
  const tx = res?.transaction;
  return tx && Object.keys(tx).length > 0 ? tx : null;
}

/**
 * Waits for a transaction to be applied on chain.
 *
 * @throws with the network's own reason if it was rejected, or after
 *         RECEIPT_TIMEOUT_MS with no receipt at all.
 */
async function awaitReceipt(txid, submittedAt) {
  let waited = 0;
  let delay = RECEIPT_FIRST_POLL_MS;
  while (waited < RECEIPT_TIMEOUT_MS) {
    await sleep(delay);
    waited += delay;
    delay = RECEIPT_POLL_MS;

    const receipt = await fetchReceipt(txid, submittedAt);
    if (!receipt) continue;
    if (receipt.success === false) {
      throw new Error(receipt.reason || 'the network rejected this transaction');
    }
    return receipt;
  }
  /*
   * Deliberately an error, not a shrug. The transaction may yet apply, but we
   * cannot claim it did — and for a commit, guessing wrong is what forks this
   * device off the group. Callers roll back; the next sync re-reads the chain
   * and picks the change up if it does land.
   */
  throw new Error('timed out waiting for the network to confirm this transaction');
}

/** Signs and injects. Acceptance only — see awaitReceipt for the real answer. */
async function submit(tx) {
  const txid = await deps.signObj(tx, deps.getMyAccount().keys);
  const submittedAt = Date.now();
  const res = await deps.injectTx(tx, txid);
  const ok = res?.result?.success ?? res?.success;
  if (!ok) {
    throw new Error(res?.result?.reason || res?.reason || 'transaction was rejected');
  }
  return { txid, res, submittedAt };
}

/** Injects and waits for the chain to actually apply it. */
async function submitAndConfirm(tx) {
  const { txid, submittedAt } = await submit(tx);
  const receipt = await awaitReceipt(txid, submittedAt);
  return { txid, receipt };
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

// ----------------------------------------------------- network capability --

/*
 * Whether this network understands group transactions.
 *
 * `null` until probed, then true/false, keyed by netid so switching networks
 * re-asks. Held in memory only: a wrong answer cached to disk would outlive the
 * upgrade that made it wrong.
 */
let groupSupport = { netid: null, supported: null };

/**
 * Has this network got group support?
 * @returns {boolean|null} null when not yet probed
 */
export function isGroupSupported() {
  if (groupSupport.netid !== deps.getNetworkId?.()) return null;
  return groupSupport.supported;
}

/**
 * Asks the network once whether it handles group transactions.
 *
 * There is no capability list in /network/parameters, so this infers it from a
 * route: a network with group support answers /account/<addr>/keypackages, and
 * one without returns 404 and an HTML error page.
 *
 * The account read has to succeed first. Without that check a gateway hiccup
 * would look identical to "this network has no groups" — and we would then stop
 * publishing key packages on a network that was merely briefly unreachable,
 * which is the failure this whole probe exists to avoid.
 *
 * @returns {Promise<boolean|null>} null when the network could not be reached
 */
export async function detectGroupSupport() {
  const netid = deps.getNetworkId?.();
  if (groupSupport.netid === netid && groupSupport.supported !== null) {
    return groupSupport.supported;
  }
  let address;
  try {
    address = myAddress();
  } catch {
    // Signed out mid-probe; nothing to conclude.
    return null;
  }
  if (!address) return null;

  const account = await deps.queryNetwork(`/account/${address}`);
  // Gateway unreachable or not answering: conclude nothing, ask again later.
  if (account === null || account === undefined) return null;

  const res = await deps.queryNetwork(`/account/${address}/keypackages`);
  const supported = res !== null && res !== undefined;
  groupSupport = { netid, supported };
  if (!supported) {
    console.warn('[groups] this network has no group support; group features are off');
  }
  return supported;
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
  // Confirmed, not fire-and-forget: if this silently fails, nobody can add us to
  // a group and the only symptom is an unexplained "has not published an MLS key
  // package yet" on someone else's screen.
  await submitAndConfirm(tx);
  return packages.length;
}

/** Tops the pool back up once adds have consumed most of it. */
export async function ensureKeyPackages() {
  /*
   * Nothing is being suppressed here: on a network without group support the
   * publish would be rejected, so we do not send it. On a network that DOES
   * support groups a genuine failure still surfaces, which it must — see the
   * note on publishKeyPackages.
   */
  if ((await detectGroupSupport()) === false) return false;

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

export async function createGroup(name, maxMembers = 50, joinFee = 0n) {
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
    /*
     * Price of admission. Zero is an open group; a positive value is escrowed by
     * each requester and paid to the admin who approves them, after a vesting
     * delay during which removing the member refunds them instead.
     */
    joinFee: BigInt(joinFee || 0),
  };

  try {
    await submitAndConfirm(tx);
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
  /*
   * The creator never arrives through a Welcome, so without this it is the one
   * member that never rotates its own leaf key and never gains post-compromise
   * security. Deferred until someone else joins — see flushPathUpdate.
   */
  view.owesPathUpdate = true;
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
 * Submits a group_commit and only touches the local view once the chain has
 * applied it.
 *
 * The window between inject and receipt is real (seconds), so the change is
 * published as `view.pendingChange` for the UI to show as in-flight rather than
 * done. Three outcomes:
 *
 *   applied  — advance the local view to the new epoch
 *   rejected — restore the MLS snapshot, so this device stays on the old epoch
 *              and can retry; surface the network's reason
 *   timeout  — same rollback. If the commit does land later, syncGroup reads it
 *              back off the chain like any other member's commit.
 *
 * @param {Object} snapshot  MLS state from before the local epoch advance
 * @param {{kind: string, addresses: string[], epoch: number}} change
 */
async function commitAndConfirm(groupId, tx, snapshot, change) {
  const view = ensureGroupView(groupId);
  view.pendingChange = {
    kind: change.kind,
    addresses: change.addresses,
    since: Date.now(),
  };
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);

  try {
    await submitAndConfirm(tx);
    applyMembershipLocally(
      groupId,
      change.kind === 'add' ? { added: change.addresses } : { removed: change.addresses },
      change.epoch,
    );
  } catch (e) {
    await mls.restoreGroup(snapshot);
    throw e;
  } finally {
    delete view.pendingChange;
    if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  }
}


/**
 * Publishes this member's own path update (decisions 1 and 2).
 *
 * An UpdatePath populates ONLY the committer's direct path, so a member has to
 * commit for its own branch of the tree to exist at all. While ancestors are
 * blank, RFC 9420 §4.1.1 expands each copath resolution down to individual
 * leaves and a removal costs O(N) ciphertexts instead of O(log N) — on an
 * 8-member group, 6 instead of 3.
 *
 * Structured exactly like a membership commit: the MLS state advances before
 * the transaction exists, so it is snapshotted and rolled back if the chain
 * rejects it, and only counted as applied once the receipt confirms it.
 */
export async function updatePath(groupId) {
  const id = identity();

  /*
   * Never build a commit from a stale epoch.
   *
   * The network fences on `tx.epoch === group.epoch`, and building a commit
   * ADVANCES our MLS state before the transaction exists — so a rejected one has
   * to be rolled back, and a run of them is how a device ends up forked. If we
   * are behind, the right move is to do nothing and let the next sync apply the
   * commits we are missing first.
   */
  const info = await deps.queryNetwork(`/group/${groupId}`);
  const chainEpoch = typeof info?.group?.epoch === 'number' ? info.group.epoch : null;
  const local = await mls.getGroupView(id.address, groupId);
  if (chainEpoch !== null && local && local.epoch !== chainEpoch) {
    throw new Error(
      `local epoch ${local.epoch} is behind the group's ${chainEpoch}; skipping the path update until sync catches up`,
    );
  }

  const snapshot = await mls.snapshotGroup(id.address, groupId);
  const commit = await mls.selfUpdate(id, groupId);
  const view = deps.getMyData().groups?.[groupId];
  const tx = {
    ...baseTx('group_commit'),
    groupId,
    ...commit,
    meta: await encryptMeta(groupId, { name: view?.name || '' }),
  };
  try {
    await submitAndConfirm(tx);
  } catch (e) {
    await mls.restoreGroup(snapshot);
    throw e;
  }
  applyMembershipLocally(groupId, {}, commit.epoch + 1);
  return commit.epoch + 1;
}

/**
 * Settles this member's own outstanding path update (decision 1).
 *
 * Distinct from maybeUpdatePath: that one repairs the SHARED tree after a
 * removal and deliberately lets a single member act for everyone. This one is
 * personal — rotating our own leaf key is the only way we get post-compromise
 * security, and nobody else can do it for us. So it retries until it lands,
 * rather than deferring to a lower-indexed member.
 *
 * Cleared once the commit is confirmed. If the member turns out not to need one
 * (someone else's update already merged us and our path is populated), the
 * obligation is dropped rather than forcing a pointless epoch.
 */
async function flushPathUpdate(groupId) {
  const view = deps.getMyData().groups?.[groupId];
  if (!view?.owesPathUpdate) return false;
  if (view.removed || view.needsReset || view.pendingChange) return false;

  /*
   * Nothing to rekey while we are the only member: there is no copath, so the
   * commit would carry no path and selfUpdate would (correctly) refuse it. The
   * obligation is kept, not dropped, so it fires as soon as someone joins.
   */
  if ((view.members?.length ?? 0) < 2) return false;

  /*
   * Claim a slot the first time we become eligible. Leaf 0 (the creator) goes
   * immediately, leaf 1 twelve seconds later, and so on — enough for each
   * commit to be confirmed before the next member starts building one.
   */
  if (typeof view.pathUpdateNotBefore !== 'number') {
    let myLeaf = 0;
    try {
      myLeaf = (await mls.pathUpdateState(identity(), groupId)).myLeaf ?? 0;
    } catch {
      /* no state yet; treat as leaf 0 */
    }
    view.pathUpdateNotBefore = Date.now() + pathUpdateSlotDelay(myLeaf);
  }
  if (Date.now() < view.pathUpdateNotBefore) return false;

  try {
    /*
     * Deliberately NOT gated on pathUpdateState().needed. That asks "would this
     * improve the shared tree", which someone else's update can already have
     * satisfied on our behalf. The obligation here is personal: our leaf key is
     * only rotated when WE commit, and that is the whole post-compromise
     * security story for this member. Cleared only once a commit is confirmed.
     */
    await updatePath(groupId);
    delete view.owesPathUpdate;
    delete view.pathUpdateNotBefore;
    return true;
  } catch (e) {
    /*
     * Usually a lost epoch race. Back off instead of retrying on the next poll:
     * the winner's commit has to be applied here first, and re-racing it
     * immediately just buys another rejected transaction at full fee.
     */
    view.pathUpdateNotBefore = Date.now() + PATH_UPDATE_BACKOFF_MS;
    console.warn(`[groups] ${groupId}: own path update deferred (${e.message})`);
    return false;
  }
}

/**
 * Publishes a path update if this member is the one that should.
 *
 * A removal blanks every ancestor of the removed leaf, so several members
 * qualify at once. They must not all commit — each is epoch-advancing and the
 * server fences on epoch, so all but one would be rejected. pathUpdateState
 * picks the lowest eligible leaf index from public tree structure, which every
 * client computes identically without coordinating.
 *
 * Best-effort by design: a failure here costs efficiency, never correctness, so
 * it is logged rather than surfaced. The next sync re-evaluates.
 */
async function maybeUpdatePath(groupId) {
  const view = deps.getMyData().groups?.[groupId];
  // Do not stack a second epoch-advancing commit on one already in flight, and
  // do not fight a group that is already known to be out of step.
  if (!view || view.removed || view.needsReset || view.pendingChange) return false;

  let state;
  try {
    state = await mls.pathUpdateState(identity(), groupId);
  } catch {
    return false;
  }
  if (!state.iAmFirst) return false;

  // Shares the backoff with flushPathUpdate: both produce epoch-advancing
  // commits, so a loss on either should quiet both for a while.
  if (typeof view.pathUpdateNotBefore === 'number' && Date.now() < view.pathUpdateNotBefore) return false;

  try {
    await updatePath(groupId);
    delete view.pathUpdateNotBefore;
    return true;
  } catch (e) {
    /*
     * Losing the epoch race is expected when several members qualify; whoever
     * won repaired the shared ancestors, and after applying their commit we
     * usually no longer qualify at all. Back off so the next poll does not pay
     * another fee to find that out.
     */
    view.pathUpdateNotBefore = Date.now() + PATH_UPDATE_BACKOFF_MS;
    console.warn(`[groups] ${groupId}: path update did not land (${e.message})`);
    return false;
  }
}


// ------------------------------------------------------------ join requests --

/**
 * Public metadata for a group we are not in, resolved from an invite link.
 *
 * `meta` (name, avatar) is encrypted under the MLS exporter secret, so a
 * non-member genuinely cannot read it — this returns the roster size, the fee
 * and whether we already have a request in flight, and nothing prettier.
 */
export async function previewGroup(groupId) {
  const info = await deps.queryNetwork(`/group/${groupId}`);
  if (!info?.group) throw new Error('no such group');
  const reqs = await deps.queryNetwork(`/group/${groupId}/requests`);
  const me = myAddress();
  return {
    groupId,
    memberCount: (info.group.members || []).length,
    maxMembers: info.group.maxMembers,
    joinFee: reqs?.joinFee || '0',
    alreadyMember: (info.group.members || []).map(norm).includes(me),
    requestPending: (reqs?.requests || []).some((r) => norm(r.address) === me),
  };
}

/**
 * Asks to join a group.
 *
 * Deliberately carries no KeyPackage: the approving commit takes one from our
 * published pool. Pinning one here would break if we rotated the pool while the
 * request sat pending, because publishing discards the private halves and the
 * Welcome would arrive undecryptable.
 *
 * Makes sure we HAVE a pool first — an approval that finds it empty falls back
 * to the reusable last-resort package, which has weaker post-compromise
 * security (RFC 9420 §10).
 */
export async function requestToJoin(groupId, message = '') {
  await ensureKeyPackages().catch((e) => console.warn('[groups] key package top-up failed', e));

  const preview = await previewGroup(groupId);
  if (preview.alreadyMember) throw new Error('you are already a member of this group');
  if (preview.requestPending) throw new Error('you already have a request pending for this group');

  const tx = {
    ...baseTx('group_join_request'),
    groupId,
    // Must equal the group's advertised fee exactly. Because the escrowed amount
    // IS our consent, an admin raising the fee afterwards can never charge more.
    escrow: BigInt(preview.joinFee),
    message: String(message).slice(0, 200),
  };
  await submitAndConfirm(tx);

  const view = ensureGroupView(groupId);
  view.joinRequested = { since: Date.now(), escrow: preview.joinFee };
  /*
   * Placeholder name. The real one lives in `meta`, encrypted under the MLS
   * exporter secret, so it cannot be read until we are actually a member — until
   * then the chat list would show an empty title. upsertGroupView overwrites
   * this the moment the group decrypts.
   */
  if (!view.name) view.name = 'Group (pending approval)';
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return true;
}

/**
 * Withdraws our join request and takes the escrow back.
 *
 * An admin ignoring a request is how a group says no — making the group pay a
 * fee to reject a spammer would be backwards — so this is the only way the
 * money comes home.
 */
export async function reclaimJoinRequest(groupId) {
  await submitAndConfirm({ ...baseTx('group_join_reclaim'), groupId });
  const view = deps.getMyData().groups?.[groupId];
  if (view) {
    delete view.joinRequested;
    if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  }
  return true;
}

/** Requests awaiting an admin's decision, for the approval queue. */
export async function listJoinRequests(groupId) {
  const res = await deps.queryNetwork(`/group/${groupId}/requests`);
  const requests = Array.isArray(res?.requests) ? res.requests : [];
  const normalised = requests.map((r) => ({ ...r, address: norm(r.address) }));

  /*
   * Resolve usernames the same way member names are resolved. A requester is by
   * definition not a member yet and usually not a contact either, so without
   * this an admin is asked to approve a raw 64-character address.
   */
  const view = ensureGroupView(groupId);
  await cacheMemberNames(view, normalised.map((r) => r.address));
  return normalised;
}

/**
 * Admits a requester. This is an ordinary add — the pending request is what
 * makes it permissible, and the approving commit consumes it.
 */
export async function approveJoinRequest(groupId, address) {
  return addMembers(groupId, [address]);
}


/**
 * Join fees earned in this group, and how much is collectable now.
 *
 * Vesting means an approved fee is not paid out immediately: until it matures
 * the money can still be returned to the member if they are removed, which is
 * what stops "take the fee, remove them" from being a cheap scam.
 */
export async function joinFeeStatus(groupId) {
  const res = await deps.queryNetwork(`/group/${groupId}/requests`);
  const me = myAddress();
  const mine = (res?.vestedFees || []).filter((v) => norm(v.admin) === me);
  const sum = (list) => list.reduce((total, v) => total + BigInt(v.amount), 0n);
  return {
    joinFee: BigInt(res?.joinFee || '0'),
    claimable: sum(mine.filter((v) => v.matured)),
    vesting: sum(mine.filter((v) => !v.matured)),
    nextVestingAt: mine.filter((v) => !v.matured).map((v) => v.vestingUntil).sort()[0] || null,
  };
}

/** Collects join fees that have finished vesting. */
export async function claimJoinFees(groupId) {
  await submitAndConfirm({ ...baseTx('group_fee_claim'), groupId });
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return true;
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

  /*
   * MLS state has to advance before the transaction exists — the commit bytes
   * are a product of that advance. So snapshot first and roll back if the chain
   * rejects it, otherwise this client ends up an epoch ahead of everyone and
   * every subsequent commit it builds is unusable.
   */
  const snapshot = await mls.snapshotGroup(id.address, groupId);
  const commit = await mls.addMembers(id, groupId, newMembers);
  const view = deps.getMyData().groups?.[groupId];
  /*
   * Resolve their names BEFORE the pending state goes up. Someone being added
   * is not a member yet and usually not a contact, so the "Adding …" hint had
   * nothing to show but a truncated address — for a person whose username the
   * admin had just typed.
   */
  await cacheMemberNames(ensureGroupView(groupId), commit.addedMembers);
  const tx = {
    ...baseTx('group_commit'),
    groupId,
    ...commit,
    meta: await encryptMeta(groupId, { name: view?.name || '' }),
  };
  await commitAndConfirm(groupId, tx, snapshot, {
    kind: 'add',
    addresses: commit.addedMembers,
    epoch: commit.epoch + 1,
  });
  return commit.addedMembers;
}

export async function removeMembers(groupId, addresses) {
  const id = identity();
  const snapshot = await mls.snapshotGroup(id.address, groupId);
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
  await commitAndConfirm(groupId, tx, snapshot, {
    kind: 'remove',
    addresses: commit.removedMembers,
    epoch: commit.epoch + 1,
  });
  return commit.removedMembers;
}

/**
 * Leaves a group.
 *
 * NOTE: this stops the network accepting our messages, but we still hold the
 * current epoch secret until a remaining member commits a Remove. The UI should
 * not claim the departure is cryptographically complete.
 */
/**
 * Whether a group can still pay to repair its own tree.
 *
 * The network charges a repair commit to the group's maintenance balance
 * instead of to whichever member happened to perform it. When that balance runs
 * out the fee falls back on that member, which is the situation this exists to
 * warn about before it happens rather than after.
 *
 * "Enough" is one fee per member, because any member leaving is one repair the
 * group will owe. Measured against the fee right now, never a figure captured
 * when the deposits were made -- the fee moves, and a balance that was ample
 * last month may not be today.
 *
 * A group with fewer than two members is never low, however empty it is. There
 * is no copath in a one-member group, so no repair can ever be needed -- the
 * same reason flushPathUpdate refuses to act below two. Warning about upkeep
 * there would be warning about work that cannot happen, and the deposits from
 * adding a second member arrive before it can.
 *
 * @param {object} view a group view
 * @returns {{ balance: bigint, needed: bigint, covers: number, low: boolean, empty: boolean }}
 */
export function maintenanceHealth(view) {
  let fee = 0n;
  try {
    fee = deps.getTransactionFeeWei() || 0n;
  } catch {
    /* no network parameters yet; treat the fee as unknown rather than zero */
  }
  let balance = 0n;
  try {
    balance = BigInt(view?.maintenanceBalance ?? 0);
  } catch {
    balance = 0n;
  }
  const memberCount = view?.members?.length ?? 0;
  const needed = fee * BigInt(memberCount);
  // How many repairs the balance can actually pay for, which is the number
  // worth telling someone -- a wei figure is not.
  const covers = fee > 0n ? Number(balance / fee) : 0;
  // With no fee figure there is nothing to compare against, and below two
  // members there is nothing to repair. Either way, say nothing.
  const applicable = fee > 0n && memberCount >= 2;
  return {
    balance,
    needed,
    covers,
    low: applicable && balance < needed,
    empty: applicable && balance < fee,
  };
}

/**
 * Adds LIB to a group's maintenance balance.
 *
 * Open to any account, member or not: the balance can only ever be spent
 * burning the fee on a repair commit, and there is no withdrawal transaction,
 * so a contribution cannot be redirected or taken back.
 *
 * @param {string} groupId
 * @param {bigint} amount wei to contribute, on top of this transaction's fee
 */
export async function fundGroupMaintenance(groupId, amount) {
  const value = BigInt(amount);
  if (value <= 0n) throw new Error('Contribution must be greater than zero');
  await submitAndConfirm({ ...baseTx('group_maintenance_fund'), groupId, amount: value });
  // Refresh so the banner reflects the new balance rather than waiting for the
  // next poll to notice.
  await upsertGroupView(groupId);
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
}

export async function leaveGroup(groupId) {
  const view = deps.getMyData().groups?.[groupId];
  /*
   * If we have already been removed there is nothing to leave: the chain roster
   * no longer contains us, so group_leave would be rejected with "sender is not
   * a member of this group". Just drop the local copy.
   */
  if (!view?.removed) {
    // Confirm before forgetting: forgetGroup destroys the MLS state, so leaving
    // on an unconfirmed transaction could drop our keys while the chain still
    // has us on the roster — unable to read the group and unable to leave it.
    await submitAndConfirm({ ...baseTx('group_leave'), groupId });
  }
  await forgetGroup(groupId);
}

/**
 * Discards this device's MLS state for a group, keeping the readable history.
 *
 * The escape hatch when local state has diverged from consensus. MLS state
 * cannot be rebuilt from the public transcript — the commits are public but the
 * secrets never were — so after a reset this device is outside the group until
 * a member adds it again, which delivers a fresh Welcome.
 *
 * Leaving first is usually the cleaner route: it takes this account off the
 * chain roster, so an existing member can add it straight back. Resetting alone
 * leaves the account on the roster with no usable keys.
 */
export async function resetGroupState(groupId) {
  const id = identity();
  await mlsStore.delete(id.address, groupId);
  mls.evictCache(id.address, groupId);

  const view = ensureGroupView(groupId);
  view.needsReset = false;
  view.epoch = 0;
  view.memberSinceEpoch = 0;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);

  // Publish a fresh pool so whoever re-adds us has a KeyPackage to consume.
  await ensureKeyPackages().catch((e) => console.warn('[groups] key package refill failed', e));
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

/**
 * @param {string} groupId
 * @param {string} text
 * @param {{ id: string, message: string, from: string }} [reply]
 *   The message being replied to: its txid, a short preview, and the ADDRESS of
 *   whoever wrote it. The address rather than 1:1's viewer-relative
 *   `replyOwnerIsMine` flag, because in a group "was it mine?" has a different
 *   answer for every member — an address has the same answer for all of them.
 */
export async function sendGroupMessage(groupId, text, reply = null) {
  const id = identity();
  const sentTimestamp = deps.getTransactionTimestamp();
  const payload = {
    message: text,
    sent_timestamp: sentTimestamp,
  };
  if (reply && reply.id) {
    payload.replyId = reply.id;
    payload.replyMessage = reply.message || '';
    payload.replyFrom = reply.from || '';
  }
  const { message, epoch } = await mls.encryptMessage(id, groupId, payload);

  await spaceGroupSend(groupId);
  const tx = { ...baseTx('group_message'), groupId, epoch, message };
  /*
   * Deliberately NOT submitAndConfirm. A chat message should appear the instant
   * it is sent, so this stays optimistic and the bubble carries status:'pending'
   * until reconcilePendingMessages reads the receipt and marks it sent/failed.
   * Nothing else depends on the outcome — unlike a commit, a failed message does
   * not leave this device on an epoch the rest of the group never reached.
   */
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
    replyId: payload.replyId,
    replyMessage: payload.replyMessage,
    replyFrom: payload.replyFrom,
    // Settled by reconcilePendingMessages once the receipt is available.
    status: 'pending',
  });
  return txid;
}

/**
 * Reacts to a group message, or clears our reaction on one.
 *
 * The chip is applied locally first and the transaction follows. That is not
 * just for responsiveness: outbound sends are spaced to clear the server's
 * one-per-second throttle, so waiting for the network would make a tap take up
 * to a second to show anything.
 *
 * Reverting on failure is the whole of the reconciliation. Unlike 1:1 -- which
 * keeps a pending chain per target because a reaction can be in flight while
 * another arrives -- a group sender never sees its own message come back:
 * syncGroup skips records from us, since MLS cannot decrypt our own outbound.
 * So the optimistic copy IS the only copy, exactly like the message echo, and
 * there is nothing later to reconcile it against.
 *
 * @param {string} groupId
 * @param {{reactId: string, reactAction: 'set'|'remove', reactMessage?: string, targetReactionTxId?: string}} reaction
 * @returns {Promise<boolean>} false when the reaction was a no-op and no
 *   transaction was spent.
 */
export async function sendGroupReaction(groupId, reaction) {
  const id = identity();
  const view = ensureGroupView(groupId);
  view.reactions ??= [];

  const sentTimestamp = deps.getTransactionTimestamp();
  /*
   * A local id, because the real txid only exists after submit and the chip
   * needs one now. It never has to be reconciled: nothing else will ever
   * reference this reaction, since we do not receive our own messages back.
   */
  const localReactionTxId = `local-${sentTimestamp}-${Math.random().toString(36).slice(2, 8)}`;
  const before = view.reactions.map((r) => ({ ...r }));

  const applied = applyIncomingReaction(view, {
    sender: norm(id.address),
    reactId: reaction.reactId,
    action: reaction.reactAction,
    emoji: reaction.reactMessage,
    targetReactionTxId: reaction.targetReactionTxId,
    timestamp: sentTimestamp,
    reactionTxId: localReactionTxId,
  });
  // Nothing changed -- the same emoji was already set, or there was nothing to
  // remove. Spending a transaction on that is pure cost.
  if (!applied) return false;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);

  const payload = {
    sent_timestamp: sentTimestamp,
    reactId: reaction.reactId,
    reactAction: reaction.reactAction,
  };
  if (reaction.reactAction === 'set') payload.reactMessage = reaction.reactMessage;
  if (reaction.reactAction === 'remove') payload.targetReactionTxId = reaction.targetReactionTxId;

  try {
    const { message, epoch } = await mls.encryptMessage(id, groupId, payload);
    await spaceGroupSend(groupId);
    const tx = { ...baseTx('group_message'), groupId, epoch, message };
    await submit(tx);
    return true;
  } catch (e) {
    view.reactions = before;
    if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
    throw e;
  }
}

/** Everyone's reactions on one message, for rendering. */
export function groupReactionsFor(groupId, targetTxid) {
  const view = deps.getMyData().groups?.[groupId];
  if (!view || !Array.isArray(view.reactions)) return [];
  return getContactReactionsForTarget(view, targetTxid);
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
      /**
       * Per-group notification sound, toggled from Group info. Local to this
       * device: nothing about who wants to be interrupted belongs on-chain.
       */
      muted: false,
      lastActivity: 0,
      // Set once the chain roster no longer contains us. History stays readable
      // up to the removing commit; nothing after it ever becomes decryptable.
      removed: false,
      /**
       * address -> username, resolved from each member's account alias.
       *
       * Group members are usually not in your contacts, so without this every
       * sender label falls back to a truncated address.
       */
      memberNames: {},
      /**
       * Chips, in the same shape 1:1 stores them, so the shared engine in
       * reactions.js operates on this view exactly as it does on a contact.
       */
      reactions: [],
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
  /*
   * Idempotent on purpose. This runs after the receipt confirms the commit,
   * which is seconds after injection — easily long enough for a background
   * syncGroup to have already written the new roster from the chain. Appending
   * blindly then lists the added member twice.
   *
   * Normalising both sides matters as much as the dedupe: comparing a raw
   * roster entry against a lower-cased set silently fails to remove anyone if
   * the two ever disagree on case.
   */
  const gone = new Set(removed.map(norm));
  const kept = (view.members || []).map(norm).filter((m) => !gone.has(m));
  view.members = [...new Set([...kept, ...added.map(norm)])];
  view.admins = [...new Set((view.admins || []).map(norm))].filter((a) => !gone.has(a));
  if (typeof epoch === 'number') view.epoch = epoch;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return view;
}

/**
 * Resolves member addresses to usernames via each account's `alias`.
 *
 * Only fetches addresses not already cached, so this costs one request per new
 * member and nothing thereafter. Failures are silent: the UI falls back to a
 * truncated address, which is worse-looking but never wrong.
 */
/**
 * Fills `view.memberNames` for any of `addresses` not already cached.
 *
 * Written out three times before this: for join requests, for the roster, and
 * not at all for a pending add — which is why "Adding 40997842…" showed an
 * address for someone whose username the user had just typed.
 *
 * Failures are silent; displayName falls back to a truncated address, which is
 * worse-looking but never wrong.
 *
 * @param {Object} view
 * @param {string[]} addresses
 * @returns {Promise<void>}
 */
async function cacheMemberNames(view, addresses) {
  view.memberNames ??= {};
  const unknown = [...new Set(addresses)].filter((a) => a && !view.memberNames[a]);
  if (unknown.length === 0) return;
  await Promise.all(
    unknown.map(async (address) => {
      try {
        const res = await deps.queryNetwork(`/account/${address}`);
        const alias = res?.account?.alias;
        if (alias) view.memberNames[address] = alias;
      } catch {
        /* leave it unresolved */
      }
    }),
  );
}

export async function refreshMemberNames(groupId) {
  const view = ensureGroupView(groupId);
  view.memberNames ??= {};

  /*
   * Resolve current members AND anyone who has spoken in the transcript. A
   * sender who has since been removed is no longer in the roster, but their
   * messages are still on screen and would otherwise keep showing an address.
   */
  const senders = (view.messages || []).map((m) => m.from).filter(Boolean);
  const candidates = [...new Set([...(view.members || []), ...senders])];
  const before = Object.keys(view.memberNames).length;
  await cacheMemberNames(view, candidates);
  if (Object.keys(view.memberNames).length === before) return;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
}

/**
 * Settles optimistic group messages against their transaction receipts.
 *
 * A group message renders immediately from a local echo, because MLS cannot
 * decrypt our own outbound ciphertext and the transcript replay skips it. That
 * echo previously stayed on screen forever even when the transaction failed —
 * insufficient balance, the per-member rate limit, a stale epoch — so the sender
 * believed a message had been delivered that never was.
 *
 * Uses the same endpoints and timings as checkPendingTransactions, but runs from
 * the group poll rather than threading group cases through that function.
 */
async function reconcilePendingMessages(groupId) {
  const view = ensureGroupView(groupId);
  const pending = (view.messages || []).filter((m) => m.status === 'pending' && m.txid);
  if (pending.length === 0) return false;

  const now = Date.now();
  let changed = false;

  for (const message of pending) {
    const age = now - (message.timestamp || now);
    if (age < 8000) continue; // not yet worth asking about

    const tx = await fetchReceipt(message.txid, message.timestamp || now);
    if (tx) {
      // The receipt records whether apply() succeeded, not just acceptance.
      message.status = tx.success === false ? 'failed' : 'sent';
      changed = true;
    } else if (age > 30000) {
      message.status = 'failed';
      changed = true;
    }
  }

  if (changed && deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return changed;
}

/** Refreshes the view model from chain metadata plus local MLS state. */
async function upsertGroupView(groupId, extra = {}) {
  const view = ensureGroupView(groupId);
  const info = await deps.queryNetwork(`/group/${groupId}`);
  if (info?.group) {
    view.members = (info.group.members || []).map(norm);
    view.admins = info.group.admins || [];
    view.maxMembers = info.group.maxMembers;
    /*
     * What the group has left to pay for repairing its own tree, as a decimal
     * string of wei. Kept as a string on the view because that is how it
     * arrives and how the balance helpers want it; only the health check below
     * needs it as a number.
     */
    view.maintenanceBalance = info.group.maintenanceBalance ?? '0';
    /*
     * When the group was made. The creator joined at epoch 0, so their
     * memberSince entry IS the creation time — both fields are already in this
     * response, so this costs no extra request and no protocol change. Group
     * info used to label view.lastActivity as "created", which was the time of
     * the last message.
     */
    const founded = info.group.memberSince?.[info.group.createdBy]?.timestamp;
    if (founded) view.createdAt = founded;
    const meta = await decryptMeta(groupId, info.group.meta);
    if (meta.name) view.name = meta.name;
    // Fire and forget: a slow directory lookup must not hold up the view.
    refreshMemberNames(groupId).catch(() => {});
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
  let changedByJoin = false;

  if (roster && !roster.includes(me)) {
    const view = ensureGroupView(groupId);
    if (!view.removed) {
      view.removed = true;
      view.members = roster.map(norm);
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
    if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  }

  /*
   * Keep the roster and member names current on every sync, not only when
   * something changed. upsertGroupView runs conditionally at the end of this
   * function, which is too late and too rare: a quiet group would never resolve
   * its members' usernames and every sender label would stay an address.
   */
  if (roster) {
    current.members = roster.map(norm);
    if (Array.isArray(info.group.admins)) current.admins = info.group.admins.map(norm);
    refreshMemberNames(groupId).catch(() => {});
  }

  if (!(await mls.hasGroupState(me, groupId))) {
    /*
     * Surfaces an invite for the user to accept or decline — accepting is the
     * only thing that joins, because joining burns one of our KeyPackages and
     * obliges us to pay for a path update. The exception is a group we asked to
     * join: the request was the consent, so notePendingInvite joins inline.
     */
    const noted = await notePendingInvite(groupId);
    if (!(await mls.hasGroupState(me, groupId))) return noted;
    /*
     * We just joined, so DO NOT return here — fall through to the handshake
     * catch-up below. Our Welcome is for the epoch we were admitted at, and the
     * group has usually moved on since (the approving commit is immediately
     * followed by someone's path update). Returning early left us behind, and
     * the very next thing that runs is our own path update, which would then
     * target a stale epoch and be rejected with "commit targets epoch N but the
     * group is at M".
     */
    changedByJoin = true;
  }

  let local = await mls.getGroupView(me, groupId);
  let changed = changedByJoin;

  /*
   * Local state ahead of consensus.
   *
   * Only possible if a commit was built — which advances and persists state —
   * and then rejected by the chain. MLS has no undo, so a client cannot roll
   * itself back after the fact: every commit it builds from here targets an
   * epoch that does not exist, and ts-mls rejects its own retries with errors
   * like "Commit cannot contain an Add proposal for someone already in the
   * group", because the local tree holds a member the chain never received.
   *
   * Commits are now snapshotted and rolled back on rejection so this should not
   * recur, but state already in this condition has to be reset and re-obtained
   * from a Welcome. Surface it instead of failing cryptically forever.
   */
  const chainEpoch = typeof info?.group?.epoch === 'number' ? info.group.epoch : null;
  // Recorded on every sync, not only when something is wrong: the UI needs it to
  // tell "behind and catching up" from "in step".
  if (chainEpoch !== null) current.chainEpoch = chainEpoch;
  if (chainEpoch !== null && local.epoch > chainEpoch) {
    const ahead = ensureGroupView(groupId);
    /*
     * Not necessarily a fork. Our own commit reads back as "ahead" for a moment:
     * the receipt confirms it applied, but the node this sync happens to query
     * may not have caught up yet, so we see the epoch we already advanced to and
     * a group account still one behind.
     *
     * The two cases are indistinguishable from a single read and only differ
     * over time — lag resolves within seconds, a fork never does. So start a
     * clock instead of accusing, and only surface the banner once the divergence
     * has actually persisted. Getting this wrong is expensive in both
     * directions: a false banner tells someone to reset a perfectly good group,
     * and a missed one leaves them stuck on cryptic ts-mls errors.
     */
    if (typeof ahead.aheadSince !== 'number') ahead.aheadSince = Date.now();
    if (Date.now() - ahead.aheadSince < AHEAD_GRACE_MS) return false;

    if (!ahead.needsReset) {
      ahead.needsReset = true;
      ahead.localEpoch = local.epoch;
      ahead.chainEpoch = chainEpoch;
      console.warn(`[groups] ${groupId}: local epoch ${local.epoch} is ahead of chain epoch ${chainEpoch}; reset required`);
      if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
    }
    return false;
  }
  // Back in step: drop the clock so a later blip starts its own grace period.
  if (typeof current.aheadSince === 'number') delete current.aheadSince;
  if (current.needsReset) current.needsReset = false;

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
      if (current.applyFailedAtEpoch !== undefined) delete current.applyFailedAtEpoch;
      local = await mls.getGroupView(me, groupId);
    } catch (e) {
      /*
       * Terminal for this device, not transient.
       *
       * MLS state advances strictly commit by commit; a commit that will not
       * apply cannot be skipped, and every later one depends on it. Retrying on
       * the next poll fails identically forever. Previously this only logged and
       * broke, so the client sat silently behind with the composer still
       * enabled — sending messages encrypted at a stale epoch that nobody else
       * could read, which is exactly how this looks from the outside.
       *
       * The secrets cannot be rebuilt from anything public, so the only route
       * back is a reset and a fresh Welcome.
       */
      console.error(`[groups] ${groupId}: failed to apply commit at epoch ${record.epoch}`, e);
      const stuck = ensureGroupView(groupId);
      stuck.applyFailedAtEpoch = record.epoch;
      stuck.localEpoch = local.epoch;
      stuck.chainEpoch = chainEpoch;
      if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
      break;
    }
  }

  // --- application messages -------------------------------------------------
  /*
   * Counted separately from `changed`, which is also set by commits and roster
   * updates. Only a message someone else sent should make a sound.
   */
  let received = 0;
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

      /*
       * A reaction is an ordinary group_message whose payload happens to be a
       * control object -- the same trick 1:1 uses. It updates the chips on an
       * existing message instead of becoming one, so it never reaches
       * appendLocalMessage and never counts toward unread.
       */
      if (payload.reactAction) {
        const view = ensureGroupView(groupId);
        view.reactions ??= [];
        const applied = applyIncomingReaction(view, {
          sender: norm(record.from),
          reactId: payload.reactId,
          action: payload.reactAction,
          emoji: payload.reactMessage,
          targetReactionTxId: payload.targetReactionTxId,
          timestamp: payload.sent_timestamp || record.timestamp,
          reactionTxId: record.txId,
        });
        if (applied) {
          changed = true;
          if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
        }
        continue;
      }

      appendLocalMessage(groupId, {
        txid: record.txId,
        from: record.from,
        message: payload.message,
        sent_timestamp: payload.sent_timestamp || record.timestamp,
        timestamp: record.timestamp,
        mine: false,
        // Undefined on an ordinary message; appendLocalMessage stores the
        // record as given, so absent fields simply never appear.
        replyId: payload.replyId,
        replyMessage: payload.replyMessage,
        replyFrom: payload.replyFrom,
      });
      const view = ensureGroupView(groupId);
      view.unread = (view.unread || 0) + 1;
      received += 1;
      changed = true;
    } catch (e) {
      // A sender mismatch is an attack signal, not a transient error.
      console.error(`[groups] ${groupId}: dropped message ${record.txId}`, e.message);
      await mls.skipMessage(id, groupId, record.timestamp);
    }
  }

  if (changed) await upsertGroupView(groupId);
  /*
   * After upsertGroupView, so whoever handles this sees the settled view --
   * including `muted`, which is what decides whether anything is heard.
   */
  if (received > 0 && deps.onGroupMessages) deps.onGroupMessages(groupId, received);
  return changed;
}

/** Joins a group we have been added to, using the Welcome parked on-chain. */
/**
 * Is there a Welcome waiting for us, and do we want it?
 *
 * Being added to a group is not free: joining consumes one of our single-use
 * KeyPackages, and the path update we owe on joining (decision 1) is a
 * transaction WE pay for. So a Welcome we never asked for must not be acted on
 * automatically — otherwise anyone can spend our money by adding us to a group.
 *
 * Returns true if an invite is now pending a decision, so the caller can tell
 * that something changed without anything having been joined.
 */
async function notePendingInvite(groupId) {
  const id = identity();
  const res = await deps.queryNetwork(`/group/${groupId}/welcome/${id.address}`);
  if (!res?.welcome) return false;

  /*
   * The declined list lives on myData, NOT on the group view: declining calls
   * forgetGroup, which deletes the view outright. Storing the flag there would
   * erase it in the same breath and re-prompt on the very next sync.
   */
  const myData = deps.getMyData();
  if (!Array.isArray(myData.declinedGroupInvites)) myData.declinedGroupInvites = [];
  if (myData.declinedGroupInvites.includes(groupId)) return false;

  const view = ensureGroupView(groupId);
  if (view.invitePending) return false;

  /*
   * We asked for this one. The join request IS the consent — it was signed,
   * paid for and recorded on chain — so asking again when the admin approves
   * would be nonsense ("X added you… Join / Decline" for a group we requested).
   * Join straight away.
   */
  if (view.joinRequested) {
    const joined = await tryJoinFromWelcome(groupId);
    if (joined) {
      delete view.joinRequested;
      if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
    }
    return joined;
  }

  view.invitePending = {
    // Recorded by the server when the welcome was parked; nothing else knows it.
    from: res.welcome.addedBy ? norm(res.welcome.addedBy) : '',
    epoch: res.welcome.epoch,
    since: Date.now(),
  };
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return true;
}

/**
 * Accepts a pending invite: joins the group and takes on the path-update
 * obligation. This is the ONLY path that spends anything, and it runs only from
 * an explicit user action.
 */
export async function acceptInvite(groupId) {
  const view = deps.getMyData().groups?.[groupId];
  if (!view?.invitePending) throw new Error('there is no pending invitation for this group');
  const joined = await tryJoinFromWelcome(groupId);
  if (!joined) throw new Error('the invitation is no longer available');
  delete view.invitePending;
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return true;
}

/**
 * Declines a pending invite.
 *
 * Purely local and free: no transaction, no MLS state. The Welcome is left
 * uncollected on chain and expires. Note this does NOT remove us from the group
 * roster or the ratchet tree — only an admin's commit can do that — so we stay a
 * "ghost" member until they act. Hiding it locally is the best a declining
 * client can do without paying for the privilege.
 */
export async function declineInvite(groupId) {
  const myData = deps.getMyData();
  if (!Array.isArray(myData.declinedGroupInvites)) myData.declinedGroupInvites = [];
  if (!myData.declinedGroupInvites.includes(groupId)) myData.declinedGroupInvites.push(groupId);
  // After forgetGroup the view is gone, so the record of the decision has to be
  // written first and kept somewhere forgetGroup does not touch.
  await forgetGroup(groupId);
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return true;
}

/** Undoes a decline, so a later invite to the same group is surfaced again. */
export async function unDeclineInvite(groupId) {
  const myData = deps.getMyData();
  if (Array.isArray(myData.declinedGroupInvites)) {
    myData.declinedGroupInvites = myData.declinedGroupInvites.filter((g) => g !== groupId);
  }
  return true;
}

async function tryJoinFromWelcome(groupId) {
  const id = identity();
  const res = await deps.queryNetwork(`/group/${groupId}/welcome/${id.address}`);
  if (!res?.welcome) return false;
  if (res.cipherSuite && res.cipherSuite !== mls.MLS_CIPHERSUITE_ID) {
    console.error(`[groups] ${groupId}: ciphersuite ${res.cipherSuite} is not supported by this client`);
    return false;
  }
  await mls.joinFromWelcome(id, groupId, res.welcome);
  // No longer waiting on anyone: we are in.
  const joinedView = ensureGroupView(groupId);
  if (joinedView.joinRequested) delete joinedView.joinRequested;
  await upsertGroupView(groupId);
  // That Welcome consumed one of our published KeyPackages.
  ensureKeyPackages().catch((e) => console.warn('[groups] key package refill failed', e));
  /*
   * Decision 1: a new member publishes its own path update.
   *
   * Recorded as a durable obligation rather than attempted once, because it must
   * happen even if the first attempt loses the epoch race. It is NOT routed
   * through maybeUpdatePath: that picks the single lowest-indexed eligible
   * member, which is almost always the admin — the tree still ends up healthy,
   * but this member's own leaf key is never rotated and it never gains
   * post-compromise security. Only the member itself can rotate its own key.
   */
  ensureGroupView(groupId).owesPathUpdate = true;
  // Not awaited: joining must not block on a second transaction.
  flushPathUpdate(groupId).catch(() => {});
  return true;
}

/**
 * Discovers groups from the chain and syncs them all.
 *
 * Called from the existing chat poll loop. Discovery works through the same
 * chats map that 1:1 uses — group_create and group_commit write a pointer into
 * each member's account, so a new group surfaces without a separate index.
 */

/**
 * Re-applies whatever the network still holds for this group, right now.
 *
 * Deliberately NOT a "rebuild": MLS state cannot be reconstructed from anything
 * public. The ratchet tree and the commits on chain are public keys only — the
 * private path secrets and key schedule are never published, which is exactly
 * what makes forward secrecy work. So this re-fetches and re-applies the
 * commits that are still stored, and nothing more.
 *
 * Worth having anyway, because the two things it does fix are real:
 *   - sync runs on a poll; this skips the wait
 *   - an apply that failed for a transient reason (a storage error, a lock held
 *     by another tab) is retried, rather than the group staying marked stuck
 *
 * If the commits we need have been pruned, or the commit itself is genuinely
 * unapplyable, no amount of retrying helps and the group has to be reset and
 * rejoined. The returned status says which case we are in.
 */
export async function forceCatchUp(groupId) {
  const me = myAddress();
  const view = ensureGroupView(groupId);
  const before = (await mls.getGroupView(me, groupId))?.epoch ?? null;

  // Clear the stuck marker so the failed commit is attempted again.
  delete view.applyFailedAtEpoch;

  await syncGroup(groupId);

  const after = (await mls.getGroupView(me, groupId))?.epoch ?? null;
  const chainEpoch = view.chainEpoch ?? null;

  if (view.applyFailedAtEpoch !== undefined) {
    return { status: 'stuck', before, after, chainEpoch, failedAt: view.applyFailedAtEpoch };
  }
  if (view.needsRecovery) return { status: 'pruned', before, after, chainEpoch };
  if (after !== before) return { status: 'advanced', before, after, chainEpoch };
  if (chainEpoch !== null && after !== null && after < chainEpoch) {
    return { status: 'behind', before, after, chainEpoch };
  }
  return { status: 'current', before, after, chainEpoch };
}

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
    /*
     * Settling optimistic sends is independent of MLS sync and must not depend
     * on it. syncGroup returns early in several legitimate cases — no local
     * state yet, a Welcome not yet available, a removal — and a message stuck
     * on "pending" forever is exactly the failure this was added to prevent.
     */
    try {
      if (await reconcilePendingMessages(groupId)) updated++;
    } catch (e) {
      console.error(`[groups] receipt check failed for ${groupId}`, e);
    }

    try {
      if (await syncGroup(groupId)) updated++;
    } catch (e) {
      console.error(`[groups] sync failed for ${groupId}`, e);
    }

    /*
     * Decision 2: repair the tree after a removal.
     *
     * Removing a member blanks every node on its direct path, and those nodes
     * can only be repopulated by someone underneath them — the admin who did the
     * removing cannot, because an UpdatePath only ever covers the committer's
     * own path. Run after syncGroup so the removal has actually been applied
     * locally and the tree we inspect is current.
     *
     * maybeUpdatePath is a no-op for everyone except the one member that should
     * act, so this costs a local tree walk on every sync and nothing else.
     */
    try {
      // Our own obligation first (decision 1), then the shared tree repair
      // (decision 2). flushPathUpdate is a no-op unless we personally owe one.
      if (await flushPathUpdate(groupId)) updated++;
      else if (await maybeUpdatePath(groupId)) updated++;
    } catch (e) {
      console.error(`[groups] path update failed for ${groupId}`, e);
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
      /*
       * myData is persisted to localStorage, so a pendingChange written just
       * before a reload would come back with no awaitReceipt still running to
       * clear it — leaving the group's admin controls disabled forever. A
       * confirmation cannot survive a reload, so any that we find here is
       * orphaned. The commit itself is safe either way: if it landed, syncGroup
       * reads it off the chain; if it did not, this device rolled back before
       * the state was ever written.
       */
      const view = deps.getMyData().groups?.[rec.groupId];
      if (view?.pendingChange) delete view.pendingChange;
    } catch (e) {
      console.warn(`[groups] could not restore ${rec.groupId}`, e);
    }
  }
  return records.length;
}

/** Is this group's notification sound off? View-model only, no network. */
export function isGroupMuted(groupId) {
  const myData = deps && deps.getMyData();
  return !!myData?.groups?.[groupId]?.muted;
}

/**
 * Turn this group's notification sound on or off.
 * @returns {boolean} the resulting muted state.
 */
export function setGroupMuted(groupId, muted) {
  const myData = deps && deps.getMyData();
  const view = myData?.groups?.[groupId];
  if (!view) return false;
  view.muted = !!muted;
  // Explicit: group views are otherwise only persisted by the sync path, and a
  // preference that does not survive a reload is not a preference.
  if (deps.saveState) deps.saveState();
  if (deps.onGroupUpdated) deps.onGroupUpdated(groupId);
  return view.muted;
}

/** View-model only, so it stays usable before initGroupManager has run. */
export function markGroupRead(groupId) {
  const myData = deps && deps.getMyData();
  if (myData?.groups?.[groupId]) myData.groups[groupId].unread = 0;
}

export { normalizeAddress, bin2base64 };
