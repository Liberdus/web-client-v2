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
//      chat message saying they paid you. So the message carries the intent
//      hash, the recipient checks it against the relay, and the UI never
//      states a payment as received until that check passes.

import { getIntentStatus, publishIntent } from './intents.js';
import { IntentsTransferService } from './intents-transfer.js';

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
export function buildTransferMessage({ assetId, symbol, chainName, amount, decimals, intentHash, note = null }) {
  const message = {
    type: INTENTS_CHAT_MESSAGE_TYPE,
    assetId,
    symbol,
    chainName,
    amount,
    decimals,
    intentHash,
  };
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

  return Object.freeze({
    type: INTENTS_CHAT_MESSAGE_TYPE,
    assetId,
    symbol,
    chainName,
    amount,
    decimals,
    intentHash,
    note: note || null,
  });
}

/**
 * Has the claimed transfer actually settled?
 *
 * This checks that the intent the sender named reached the chain, which is what
 * separates a payment from a message claiming one. It does not yet check that
 * the settled intent carried this exact amount to this exact account -- that
 * needs the NEAR transaction itself -- so a verified claim means "this intent
 * settled", and the balance remains the final word.
 */
export async function verifyTransferClaim(claim, { getStatus = getIntentStatus } = {}) {
  if (!claim?.intentHash) return { state: 'unverifiable', reason: 'No intent hash' };
  try {
    const status = await getStatus(claim.intentHash);
    if (status.status === 'SETTLED') {
      return { state: 'settled', transactionHash: status.transactionHash };
    }
    if (status.status === 'PENDING') {
      return { state: 'pending', transactionHash: null };
    }
    return { state: 'failed', reason: status.status };
  } catch (error) {
    return { state: 'unverifiable', reason: error.message || String(error) };
  }
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
    return {
      intentHash,
      message: buildTransferMessage({
        assetId: prepared.assetId,
        symbol: prepared.symbol,
        chainName: asset?.chainName || '',
        amount: prepared.amount,
        decimals: asset?.tokenDecimals ?? null,
        intentHash,
        note,
      }),
    };
  }
}

export const intentsChatPayments = new IntentsChatPayments();
