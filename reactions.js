/**
 * The reaction state machine, shared by 1:1 and group chat.
 *
 * Extracted from app.js unchanged. Every function here touches only the
 * container it is handed -- its `.messages` and `.reactions` arrays -- and
 * never myData, a modal or the network, which is what lets a group view use
 * the same code a contact does.
 *
 * What did NOT come with it is 1:1's optimistic pending-chain machinery
 * (getPendingReactionChainEntries and friends). That reads myData.pending and
 * is specific to how ChatModal shows a reaction before its transaction
 * settles, so it stays in app.js.
 *
 * Ordering rule throughout: reactions are held newest-first by timestamp, and a
 * later reaction from the same sender on the same target replaces an earlier
 * one rather than stacking. That is why changing a reaction costs one
 * transaction and not two.
 */

import { normalizeAddress, insertSorted } from './lib.js';

/**
 * @typedef {{ sender: string, reactId: string, action: 'remove', timestamp: number, reactionTxId?: string, targetReactionTxId?: string } | { sender: string, reactId: string, action: 'set', emoji: string, timestamp: number, reactionTxId?: string }} ReactionUpdate
 */

/**
 * Returns the newest effective reaction for a specific sender and target message.
 * @param {Object} contact
 * @param {string} targetTxid
 * @param {string} sender
 * @returns {Object|null}
 */
export function getEffectiveReactionForSenderTarget(contact, targetTxid, sender) {
  const reactions = Array.isArray(contact.reactions) ? contact.reactions : [];
  const normalizedSender = normalizeAddress(sender);

  for (const reaction of reactions) {
    if (!reaction.emoji) {
      continue;
    }
    if (reaction.targetTxid === targetTxid && normalizeAddress(reaction.sender) === normalizedSender) {
      return reaction;
    }
  }

  return null;
}

/**
 * Returns the newest reaction state, including empty-emoji removal markers.
 * @param {Object} contact
 * @param {string} targetTxid
 * @param {string} sender
 * @returns {Object|null}
 */
export function getLatestReactionStateForSenderTarget(contact, targetTxid, sender) {
  const reactions = Array.isArray(contact.reactions) ? contact.reactions : [];
  const normalizedSender = normalizeAddress(sender);

  for (const reaction of reactions) {
    if (reaction.targetTxid === targetTxid && normalizeAddress(reaction.sender) === normalizedSender) {
      return reaction;
    }
  }

  return null;
}

/**
 * Returns the effective reactions for a specific target message.
 * @param {Object} contact
 * @param {string} targetTxid
 * @returns {Array<Object>}
 */
export function getContactReactionsForTarget(contact, targetTxid) {
  const reactions = Array.isArray(contact.reactions) ? contact.reactions : [];
  const seen = new Set();
  const effectiveReactions = [];

  for (const reaction of reactions) {
    if (!reaction.emoji) {
      continue;
    }
    if (reaction.targetTxid !== targetTxid) {
      continue;
    }

    const senderKey = normalizeAddress(reaction.sender);
    if (seen.has(senderKey)) {
      continue;
    }

    seen.add(senderKey);
    effectiveReactions.push(reaction);
  }

  return effectiveReactions;
}

/**
 * Removes every raw reaction entry for a given sender and target.
 * @param {Object} contact
 * @param {string} targetTxid
 * @param {string} sender
 * @returns {boolean}
 */
export function purgeReactionStackForSenderTarget(contact, targetTxid, sender) {
  if (!Array.isArray(contact.reactions)) {
    return false;
  }

  const normalizedSender = normalizeAddress(sender);
  const initialLength = contact.reactions.length;
  contact.reactions = contact.reactions.filter((reaction) => {
    return !(reaction.targetTxid === targetTxid && normalizeAddress(reaction.sender) === normalizedSender);
  });
  return contact.reactions.length !== initialLength;
}

/**
 * Removes a raw reaction entry by the txid of the reaction-control transaction that created it.
 * @param {Object} contact
 * @param {string} reactionTxId
 * @returns {boolean}
 */
export function removeReactionByReactionTxId(contact, reactionTxId) {
  if (!Array.isArray(contact.reactions) || !reactionTxId) {
    return false;
  }

  const index = contact.reactions.findIndex((reaction) => reaction.reactionTxId === reactionTxId);
  if (index === -1) {
    return false;
  }

  contact.reactions.splice(index, 1);
  return true;
}

/**
 * Records a reaction removal as chat-list activity without creating a visible chip.
 * @param {Object} contact
 * @param {Extract<ReactionUpdate, { action: 'remove' }>} reaction
 * @returns {void}
 */
export function recordReactionRemovalActivity(contact, reaction) {
  insertSorted(contact.reactions, {
    sender: normalizeAddress(reaction.sender),
    targetTxid: reaction.reactId,
    emoji: '',
    timestamp: reaction.timestamp,
    reactionTxId: reaction.reactionTxId
  }, 'timestamp');
}

/**
 * Returns a normalized copy of a reaction snapshot or null.
 * @param {ReactionSnapshot | null} reaction
 * @returns {ReactionSnapshot | null}
 */
export function copyReactionSnapshot(reaction) {
  if (!reaction) {
    return null;
  }

  return {
    sender: normalizeAddress(reaction.sender),
    targetTxid: reaction.targetTxid,
    emoji: reaction.emoji,
    timestamp: Number(reaction.timestamp),
    reactionTxId: reaction.reactionTxId
  };
}

/**
 * Returns whether two reaction snapshots describe the same visible reaction.
 * @param {ReactionSnapshot | null} left
 * @param {ReactionSnapshot | null} right
 * @returns {boolean}
 */
export function areReactionSnapshotsEqual(left, right) {
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return normalizeAddress(left.sender) === normalizeAddress(right.sender) &&
    left.targetTxid === right.targetTxid &&
    left.emoji === right.emoji &&
    Number(left.timestamp) === Number(right.timestamp) &&
    left.reactionTxId === right.reactionTxId;
}

/**
 * Replaces the visible reaction for one sender+target pair with the provided snapshot.
 * @param {Object} contact
 * @param {string} targetTxid
 * @param {string} sender
 * @param {ReactionSnapshot | null} reaction
 * @returns {void}
 */
export function setVisibleReaction(contact, targetTxid, sender, reaction) {
  contact.reactions ??= [];
  purgeReactionStackForSenderTarget(contact, targetTxid, sender);

  if (!reaction) {
    return;
  }

  insertSorted(contact.reactions, {
    sender: normalizeAddress(reaction.sender),
    targetTxid: reaction.targetTxid,
    emoji: reaction.emoji,
    timestamp: Number(reaction.timestamp),
    reactionTxId: reaction.reactionTxId
  }, 'timestamp');
}

/**
 * Removes all active reactions that target a specific message.
 * @param {Object} contact
 * @param {string} targetTxid
 * @returns {boolean}
 */
export function purgeContactReactionsForTarget(contact, targetTxid) {
  if (!Array.isArray(contact.reactions)) {
    return false;
  }

  const initialLength = contact.reactions.length;
  contact.reactions = contact.reactions.filter((reaction) => reaction.targetTxid !== targetTxid);
  return contact.reactions.length !== initialLength;
}

/**
 * Applies a reaction control message to the contact-level active reaction state.
 * @param {Object} contact
 * @param {ReactionUpdate} reaction
 * @returns {boolean}
 */
export function applyIncomingReaction(contact, reaction, opts = {}) {
  /*
   * Injected rather than imported. 1:1 messages can be soft-deleted and a
   * reaction must not resurrect a chip on one; group messages have no delete
   * yet, so groups pass nothing and every target counts as live.
   */
  const isDeleted = opts.isDeleted || (() => false);
  const targetMessage = contact.messages.find((message) => message.txid === reaction.reactId);
  if (!targetMessage || isDeleted(targetMessage)) {
    console.warn('Reaction target not found locally', reaction);
    return false;
  }

  if (!Array.isArray(contact.reactions)) {
    if (reaction.action === 'remove') {
      return false;
    }
    contact.reactions = [];
  }

  const sender = normalizeAddress(reaction.sender);
  const latestReactionState = getLatestReactionStateForSenderTarget(contact, reaction.reactId, sender);
  const isIncomingOlderThanCurrent = !!latestReactionState && latestReactionState.timestamp > reaction.timestamp;

  switch (reaction.action) {
    case 'remove': {
      if (reaction.targetReactionTxId) {
        const targetReaction = contact.reactions.find((entry) => {
          return entry.targetTxid === reaction.reactId &&
            normalizeAddress(entry.sender) === sender &&
            entry.reactionTxId === reaction.targetReactionTxId;
        });
        if (!targetReaction) {
          return false;
        }
        removeReactionByReactionTxId(contact, targetReaction.reactionTxId);
        recordReactionRemovalActivity(contact, reaction);
        return true;
      }
      if (isIncomingOlderThanCurrent) {
        return false;
      }
      if (!purgeReactionStackForSenderTarget(contact, reaction.reactId, sender)) {
        return false;
      }
      recordReactionRemovalActivity(contact, reaction);
      return true;
    }

    case 'set': {
      const emoji = reaction.emoji.trim();
      const currentReaction = getEffectiveReactionForSenderTarget(contact, reaction.reactId, sender);
      // don't allow duplicate reactions
      if (reaction.reactionTxId && contact.reactions.some((entry) => entry.reactionTxId === reaction.reactionTxId)) {
        return false;
      }
      if (isIncomingOlderThanCurrent) {
        return false;
      }
      if (currentReaction && currentReaction.emoji === emoji) {
        return false;
      }
      purgeReactionStackForSenderTarget(contact, reaction.reactId, sender);

      insertSorted(contact.reactions, {
        sender,
        targetTxid: reaction.reactId,
        emoji,
        timestamp: reaction.timestamp,
        reactionTxId: reaction.reactionTxId
      }, 'timestamp');
      return true;
    }

    default:
      throw new Error(`Unknown reaction action: ${reaction.action}`);
  }
}
