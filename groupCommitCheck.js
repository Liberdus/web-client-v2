/**
 * Does a commit do what the network recorded it as doing?
 *
 * The network reads every commit before accepting it (liberdus-server
 * src/utils/mlsCommit.ts) and records who sent it and whom it adds and
 * removes. This is the client's own copy of the parts of that check that
 * protect the group, run on the exact bytes it is about to apply, so a fault
 * on the network cannot quietly hand it a commit that changes membership behind
 * the roster (threat model T1) or moves a leaf to someone else's address (T17).
 *
 * The admin rule is deliberately NOT re-checked here. The network applies it
 * to the recorded change, and this confirms the commit makes exactly the
 * recorded change, so together they enforce it. A client cannot check it on
 * its own: it only knows today's admins, and a member catching up on a commit
 * made by an admin who has since left would refuse a valid commit and be stuck
 * on it for good.
 *
 * Pure: no storage, no network, no crypto. A refusal is thrown, and the caller
 * treats it as a commit that will not apply.
 */

const textDecoder = new TextDecoder();

/** The proposal types a commit may carry; the network refuses any other. */
const ALLOWED_PROPOSALS = new Set(['add', 'remove', 'psk']);

const addressOf = (leafNode) => textDecoder.decode(leafNode.credential.identity).toLowerCase();

/** The address in leaf `leafIndex` of our tree, or null if the leaf is blank. */
const leafAddress = (ratchetTree, leafIndex) => {
  const node = ratchetTree[leafIndex * 2];
  return node && node.nodeType === 'leaf' ? addressOf(node.leaf) : null;
};

const sameMembers = (a, b) => {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((value, i) => value === y[i]);
};

/**
 * @param {object} message  the decoded MLSMessage of `record.commit`
 * @param {Array} ratchetTree  our tree at the commit's epoch, before applying it
 * @param {{from: string, addedMembers?: string[], removedMembers?: string[]}} record
 *   the network's record of the commit, from /group/:id/handshakes
 * @throws {Error} naming the first mismatch
 */
export function checkCommitAgainstRecord(message, ratchetTree, record) {
  const refuse = (why) => {
    throw new Error(`commit does not match the network's record: ${why}`);
  };
  const from = String(record.from || '').toLowerCase();
  const declaredAdds = (record.addedMembers || []).map((a) => String(a).toLowerCase());
  const declaredRemoves = (record.removedMembers || []).map((a) => String(a).toLowerCase());

  if (!message || message.wireformat !== 'mls_public_message') refuse('it is not a public commit');
  const content = message.publicMessage.content;
  if (content.contentType !== 'commit') refuse(`it carries ${content.contentType}, not a commit`);
  if (content.sender.senderType === 'new_member_commit') {
    checkRejoin(content.commit, ratchetTree, from, declaredAdds, declaredRemoves, refuse);
    return;
  }
  if (content.sender.senderType !== 'member') refuse(`sender type ${content.sender.senderType}`);
  if (leafAddress(ratchetTree, content.sender.leafIndex) !== from) refuse('it is sent from a leaf that is not the sender');

  const added = [];
  const removed = [];
  for (const entry of content.commit.proposals) {
    if (entry.proposalOrRefType !== 'proposal') refuse('it carries a proposal by reference');
    const proposal = entry.proposal;
    if (!ALLOWED_PROPOSALS.has(proposal.proposalType)) refuse(`it carries a ${proposal.proposalType} proposal`);
    if (proposal.proposalType === 'add') added.push(addressOf(proposal.add.keyPackage.leafNode));
    if (proposal.proposalType === 'remove') {
      const address = leafAddress(ratchetTree, proposal.remove.removed);
      if (!address) refuse(`it removes blank leaf ${proposal.remove.removed}`);
      removed.push(address);
    }
  }
  // Matched by the address inside each key package, which is also what every
  // member's roster will show for the new leaf.
  if (!sameMembers(added, declaredAdds)) refuse(`it adds [${added}] but the record says [${declaredAdds}]`);
  if (!sameMembers(removed, declaredRemoves)) refuse(`it removes [${removed}] but the record says [${declaredRemoves}]`);

  const pathLeaf = content.commit.path?.leafNode;
  if (pathLeaf && addressOf(pathLeaf) !== from) refuse("its new leaf does not carry the sender's address");
}

/**
 * A member rejoining by external commit after their device fell out of step.
 *
 * It may swap the sender's own leaf and nothing else: one external_init, the
 * removal of the sender's former leaf (required while they still have one, or
 * the tree would hold two leaves for one account), and a new leaf in the
 * sender's name. The network only accepts these from accounts on the roster.
 */
function checkRejoin(commit, ratchetTree, from, declaredAdds, declaredRemoves, refuse) {
  if (declaredAdds.length > 0 || declaredRemoves.length > 0) refuse('a rejoin cannot add or remove members');
  const leafNode = commit.path?.leafNode;
  if (!leafNode) refuse('a rejoin must carry an UpdatePath');
  if (addressOf(leafNode) !== from) refuse("its new leaf does not carry the sender's address");

  let externalInits = 0;
  const removed = [];
  for (const entry of commit.proposals) {
    if (entry.proposalOrRefType !== 'proposal') refuse('it carries a proposal by reference');
    const type = entry.proposal.proposalType;
    if (type === 'external_init') externalInits += 1;
    else if (type === 'remove') removed.push(entry.proposal.remove.removed);
    else refuse(`a rejoin carries a ${type} proposal`);
  }
  if (externalInits !== 1 || removed.length > 1) refuse('a rejoin carries one external_init and at most one removal');

  const formerLeaf = ratchetTree.findIndex((n, i) => i % 2 === 0 && n && n.nodeType === 'leaf' && addressOf(n.leaf) === from);
  if (formerLeaf >= 0 && removed[0] !== formerLeaf / 2) refuse("a rejoin must remove the sender's former leaf");
  if (formerLeaf < 0 && removed.length > 0) refuse("a rejoin may only remove the sender's own former leaf");
}
