// Paying someone inside a conversation.
//
// Both sides of a Liberdus chat already have an intents account -- it is their
// account address -- so the value moves between them inside the verifier: no
// chain fee, no bridge, no confirmations, nothing visible on Bitcoin or Solana.
//
// The value and the message travel separately, because they settle on different
// networks. The transfer settles on NEAR; the chat message is a Liberdus
// transaction that announces it. Two consequences shape everything here:
//
//   1. The money moves first. If the announcement then fails to send, the
//      sender is told the funds moved but the receipt did not -- a missing
//      receipt is recoverable, a receipt for a payment that never happened is
//      not.
//
//   2. An incoming payment message is a claim, not proof. Anyone can send a
//      chat message saying they paid you. So the message names the intent and
//      the NEAR transaction that settled it, and the recipient reads that
//      transaction for themselves: the verifier logs who paid whom, which
//      token and how much. The UI never states a payment as received until
//      what was logged matches what was claimed.

import {
  INTENT_IN_FLIGHT, fetchIntentTransfers, getIntentStatus, publishIntent, waitForIntentSettlement,
} from './intents.js';
import { IntentsTransferService, parseTokenAmount } from './intents-transfer.js';

export const INTENTS_CHAT_MESSAGE_TYPE = 'intents_transfer';

export class IntentsChatError extends Error {
  constructor(message, code = 'INTENTS_CHAT_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsChatError';
    this.code = code;
    this.details = details;
  }
}

/**
 * The announcement that travels through chat.
 *
 * Deliberately small: what was sent, and the hash that proves it. Anything the
 * recipient could derive for themselves is not worth trusting a peer for.
 */
export function buildTransferMessage({
  assetId, symbol, chainName, amount, decimals, intentHash, transactionHash = null, note = null,
}) {
  const message = {
    type: INTENTS_CHAT_MESSAGE_TYPE,
    assetId,
    symbol,
    chainName,
    amount,
    decimals,
    intentHash,
  };
  // The NEAR transaction that settled it: what the recipient checks, for as
  // long as the chat keeps the message. Absent when settlement was not seen.
  if (transactionHash) message.transactionHash = transactionHash;
  if (note) message.note = String(note).slice(0, 140);
  return message;
}

/**
 * Read a payment message that arrived from someone else.
 *
 * Every field is treated as hostile: a peer controls all of it, and a payment
 * bubble is a persuasive thing to be able to forge. Anything malformed is
 * rejected outright rather than rendered with defaults, because a bubble
 * reading "0 SOL" from a broken claim still looks like a payment happened.
 */
export function parseTransferMessage(raw) {
  if (!raw || raw.type !== INTENTS_CHAT_MESSAGE_TYPE) return null;

  const assetId = typeof raw.assetId === 'string' ? raw.assetId.trim() : '';
  const symbol = typeof raw.symbol === 'string' ? raw.symbol.trim() : '';
  const amount = typeof raw.amount === 'string' ? raw.amount.trim() : '';
  const intentHash = typeof raw.intentHash === 'string' ? raw.intentHash.trim() : '';

  // An amount must be a plain positive decimal. No exponents, no signs, no
  // stray text that a renderer might pass through.
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) return null;
  if (!assetId || assetId.length > 200) return null;
  if (!symbol || symbol.length > 16) return null;
  if (!intentHash || intentHash.length > 120 || !/^[A-Za-z0-9]+$/.test(intentHash)) return null;

  const chainName = typeof raw.chainName === 'string' ? raw.chainName.trim().slice(0, 32) : '';
  const decimals = Number.isInteger(raw.decimals) && raw.decimals >= 0 && raw.decimals <= 36
    ? raw.decimals
    : null;
  const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, 140) : null;
  // Base58, like every NEAR transaction hash. Anything else is dropped rather
  // than rejecting the claim: without it the claim is simply checked the
  // older way, through the relay.
  const transactionHash = typeof raw.transactionHash === 'string'
    && /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(raw.transactionHash.trim())
    ? raw.transactionHash.trim()
    : null;

  return Object.freeze({
    type: INTENTS_CHAT_MESSAGE_TYPE,
    assetId,
    symbol,
    chainName,
    amount,
    decimals,
    intentHash,
    transactionHash,
    note: note || null,
  });
}

/**
 * Does a transfer the verifier logged say what the claim says?
 *
 * Returns null when it does, or the reason it does not. Addresses compare
 * case-insensitively; the amount compares exactly, in base units, so a
 * claim of 0.25 is not satisfied by a transfer of 0.250059.
 */
export function transferMismatch(transfer, claim, { expectedFrom = null, expectedTo = null } = {}) {
  const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  if (transfer.intentHash !== claim.intentHash) return 'a different intent';
  if (expectedFrom && !same(transfer.from, expectedFrom)) return 'a different sender';
  if (expectedTo && !same(transfer.to, expectedTo)) return 'a different recipient';
  const moved = transfer.tokens?.[claim.assetId];
  if (moved === undefined) return 'a different token';
  if (!Number.isInteger(claim.decimals)) return 'an amount that cannot be checked';
  let claimed;
  try {
    claimed = parseTokenAmount(claim.amount, claim.decimals);
  } catch {
    return 'an amount that cannot be checked';
  }
  if (BigInt(moved) !== claimed) return 'a different amount';
  return null;
}

// How long the relay can be relied on to remember an intent. It knew a
// payment made hours earlier and had forgotten ones from three days before
// (seen 2026-09-28), so past this "not found" stops meaning "never happened".
// Kept short: a genuine payment wrongly marked "Not confirmed" is the worse
// mistake, and a forged hash is unknown from its first moment anyway.
export const RELAY_MEMORY_MS = 6 * 60 * 60 * 1000;

/**
 * Did the claimed payment happen, as claimed?
 *
 * Reads the NEAR transaction that settled the intent -- named in the claim,
 * or, for claims from before it was, the one the relay names while it still
 * remembers -- and checks the verifier's own record of the transfer against
 * the claim: this intent, from this sender, to this recipient, this token,
 * this exact amount. A settled hash alone proves only that *some* transfer
 * happened; anyone could quote someone else's.
 *
 * `expectedFrom` / `expectedTo` are the intents accounts of the chat's two
 * sides. States: settled (checked and matching), failed (checked and not),
 * pending, expired (too old for the relay and never checked while it knew),
 * unverifiable (nothing could be asked -- not evidence either way).
 */
export async function verifyTransferClaim(claim, {
  getStatus = getIntentStatus,
  getTransfers = fetchIntentTransfers,
  expectedFrom = null,
  expectedTo = null,
  sentAt = null,
  now = Date.now(),
} = {}) {
  if (!claim?.intentHash) return { state: 'unverifiable', reason: 'No intent hash' };

  let transactionHash = claim.transactionHash || null;
  if (!transactionHash) {
    let status;
    try {
      status = await getStatus(claim.intentHash);
    } catch (error) {
      return { state: 'unverifiable', reason: error.message || String(error) };
    }
    if (INTENT_IN_FLIGHT.includes(status.status)) return { state: 'pending', transactionHash: null };
    if (status.status !== 'SETTLED') {
      // Unknown to the relay: damning for a fresh claim, which a genuine
      // payment never is, but only forgetfulness for an old one.
      if (status.status === 'NOT_FOUND_OR_NOT_VALID' && Number(sentAt) > 0 && now - Number(sentAt) > RELAY_MEMORY_MS) {
        return { state: 'expired', reason: status.status };
      }
      return { state: 'failed', reason: status.status };
    }
    transactionHash = status.transactionHash;
    if (!transactionHash) return { state: 'unverifiable', reason: 'Settled, but no transaction to check' };
  }

  let transfers;
  try {
    transfers = await getTransfers(transactionHash);
  } catch (error) {
    return { state: 'unverifiable', reason: error.message || String(error) };
  }
  const logged = transfers.find((transfer) => transfer.intentHash === claim.intentHash);
  if (!logged) return { state: 'failed', reason: 'The transaction carries no such transfer', transactionHash };
  const mismatch = transferMismatch(logged, claim, { expectedFrom, expectedTo });
  if (mismatch) return { state: 'failed', reason: `The transfer went to ${mismatch}`, transactionHash };
  return { state: 'settled', transactionHash };
}

/**
 * What a payment bubble says about the transfer behind it. One table, read by
 * the renderer and by the verifier that updates bubbles in place, so the two
 * cannot drift.
 *
 * Outcomes, not mechanism: "Confirmed", never "confirmed on chain".
 */
export function paymentStatusLabel(state) {
  return {
    settled: 'Confirmed',
    pending: 'Confirming…',
    failed: 'Not confirmed',
    // Too old for the relay to remember, and never checked while it did.
    // Neither a verdict nor a problem to fix.
    expired: 'Too old to check',
    unverifiable: 'Could not check yet',
    unchecked: 'Checking…',
  }[state] || 'Could not check yet';
}

export class IntentsChatPayments {
  constructor({ getAccount = () => null, transfers = null } = {}) {
    this.getAccount = getAccount;
    this.transfers = transfers || new IntentsTransferService({ getAccount });
  }

  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') {
      this.getAccount = getAccount;
      this.transfers.configure({ getAccount });
    }
  }

  /** Everything checkable before anything moves. */
  prepare({ asset, recipientAddress, amount, note = null }) {
    return this.transfers.prepare({
      asset,
      recipientAddress,
      amount,
      memo: note ? `liberdus:${String(note).slice(0, 100)}` : 'liberdus chat payment',
    });
  }

  /**
   * Move the value, then hand back the announcement to send.
   *
   * Publishing and announcing are separate on purpose: the caller sends the
   * chat message, and if that fails it still knows the funds moved.
   */
  async send(prepared, secretKey, { asset, note = null } = {}) {
    const signed = await this.transfers.sign(prepared, secretKey);

    // Rehearse first. A refusal here costs nothing; discovering the same
    // problem after publishing costs the relay's gas and confuses the sender.
    const check = await this.transfers.simulate(signed);
    if (!check.ok) {
      throw new IntentsChatError(
        `This payment would fail: ${check.reason}`,
        'WOULD_FAIL',
        { reason: check.reason },
      );
    }

    const intentHash = await publishIntent(signed);

    // Wait for it to land before announcing it: the receipt then names the
    // transaction the recipient will check, and no receipt is ever sent for
    // a transfer that visibly failed. Seconds, usually. Still unsettled after
    // the wait, the receipt goes without it and is checked through the relay.
    let settlement = null;
    try {
      settlement = await waitForIntentSettlement(intentHash, { timeoutMs: 30_000 });
    } catch {
      settlement = null;
    }
    if (settlement && !['SETTLED', 'TIMED_OUT'].includes(settlement.status)) {
      throw new IntentsChatError(
        `The transfer did not go through (${settlement.status}).`,
        'NOT_SETTLED',
        { intentHash, settlement },
      );
    }
    const transactionHash = settlement?.status === 'SETTLED' ? settlement.transactionHash : null;

    return {
      intentHash,
      transactionHash,
      message: buildTransferMessage({
        assetId: prepared.assetId,
        symbol: prepared.symbol,
        chainName: asset?.chainName || '',
        amount: prepared.amount,
        decimals: asset?.tokenDecimals ?? null,
        intentHash,
        transactionHash,
        note,
      }),
    };
  }
}

export const intentsChatPayments = new IntentsChatPayments();
