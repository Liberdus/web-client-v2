// Sending an intents balance to another Liberdus account.
//
// This is the part that makes multichain assets a messaging feature rather
// than a wallet tab. Both sides of a Liberdus chat already have an intents
// account -- it is their account address -- so a transfer inside the verifier
// settles between them directly: no chain fee, no bridge, no waiting on
// confirmations, and nothing to see on Bitcoin or Solana.
//
// What it is not: a withdrawal. This moves a claim from one account to another
// inside intents.near. Getting the asset onto its home chain is a separate
// intent and a separate phase.

import {
  buildIntentPayload,
  buildTransferIntent,
  buildVersionedNonce,
  getCurrentSalt,
  intentDeadline,
  publishIntent,
  signIntentPayload,
  simulateIntents,
  waitForIntentSettlement,
} from './intents.js';
import { intentsAccountIdForAddress } from './intents-assets.js';

export class IntentsTransferError extends Error {
  constructor(message, code = 'TRANSFER_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsTransferError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Decimal amount to the token's smallest unit, exactly.
 *
 * Never via Number: 0.1 BTC through a float is 0.1000000000000000055511151231,
 * and at eight decimals that is a different amount of money. Everything here
 * stays in strings and BigInt.
 */
export function parseTokenAmount(value, decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new IntentsTransferError('Token decimals are out of range', 'INVALID_DECIMALS');
  }

  const text = String(value ?? '').trim();
  if (!/^\d*(\.\d*)?$/.test(text) || text === '' || text === '.') {
    throw new IntentsTransferError('Enter an amount using digits only', 'INVALID_AMOUNT');
  }

  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) {
    throw new IntentsTransferError(
      decimals === 0
        ? 'This asset cannot be split into fractions'
        : `This asset supports at most ${decimals} decimal places`,
      'TOO_PRECISE',
    );
  }

  const raw = BigInt(`${whole || '0'}${fraction.padEnd(decimals, '0')}`);
  if (raw <= 0n) {
    throw new IntentsTransferError('Enter an amount greater than zero', 'AMOUNT_NOT_POSITIVE');
  }
  return raw;
}

export class IntentsTransferService {
  constructor({ getAccount = () => null } = {}) {
    this.getAccount = getAccount;
  }

  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
  }

  /**
   * Everything that can be checked before anyone signs anything.
   *
   * Returns a frozen description of the transfer. Nothing here talks to the
   * network except the salt, which the nonce needs.
   */
  async prepare({ asset, recipientAddress, amount, memo = null }) {
    const account = this.getAccount();
    const senderId = intentsAccountIdForAddress(account?.keys?.address);
    if (!senderId) {
      throw new IntentsTransferError('No account is signed in', 'NO_ACCOUNT');
    }
    if (!asset?.assetId) {
      throw new IntentsTransferError('Choose an asset to send', 'NO_ASSET');
    }

    const recipientId = intentsAccountIdForAddress(recipientAddress);
    if (!recipientId) {
      throw new IntentsTransferError('That recipient address is not valid', 'INVALID_RECIPIENT');
    }
    // The verifier refuses a self-transfer as an invalid intent, before it
    // looks at balances, so catch it here where the message can be useful.
    if (recipientId === senderId) {
      throw new IntentsTransferError('You cannot send this to yourself', 'SELF_TRANSFER');
    }

    const rawAmount = parseTokenAmount(amount, asset.tokenDecimals);
    const available = BigInt(asset.rawAmount || '0');
    if (rawAmount > available) {
      throw new IntentsTransferError(
        `You only have ${asset.tokenAmount} ${asset.tokenSymbol}`,
        'INSUFFICIENT_BALANCE',
        { available: available.toString(), requested: rawAmount.toString() },
      );
    }

    const deadline = intentDeadline();
    const salt = await getCurrentSalt();

    return Object.freeze({
      senderId,
      recipientId,
      assetId: asset.assetId,
      symbol: asset.tokenSymbol,
      chainName: asset.chainName,
      amount: String(amount).trim(),
      rawAmount: rawAmount.toString(),
      memo: memo ? String(memo) : null,
      payload: buildIntentPayload({
        signerId: senderId,
        deadline,
        nonce: buildVersionedNonce(salt, deadline),
        intents: [buildTransferIntent({
          receiverId: recipientId,
          tokens: { [asset.assetId]: rawAmount.toString() },
          memo: memo || null,
        })],
      }),
    });
  }

  /** Sign a prepared transfer. Signing alone publishes nothing. */
  sign(prepared, secretKey) {
    return signIntentPayload(prepared.payload, secretKey);
  }

  /**
   * Ask the verifier what this transfer would do, without doing it.
   *
   * Worth running before publishing: it catches a bad signature, a spent
   * nonce, a stale salt or an expired deadline for free, where publishing
   * would spend the relayer's gas to discover the same thing.
   */
  async simulate(signed) {
    try {
      const simulation = await simulateIntents(signed);
      return { ok: true, simulation, reason: null };
    } catch (error) {
      return { ok: false, simulation: null, reason: error.message || String(error) };
    }
  }

  /**
   * Publish, then wait for the relayer to land it.
   *
   * The only call in this file with consequences.
   */
  async send(prepared, secretKey, { waitMs = 60_000 } = {}) {
    const signed = await this.sign(prepared, secretKey);
    const intentHash = await publishIntent(signed);
    const settlement = await waitForIntentSettlement(intentHash, { timeoutMs: waitMs });
    return {
      intentHash,
      status: settlement.status,
      transactionHash: settlement.transactionHash,
      settled: settlement.status === 'SETTLED',
    };
  }
}

export const intentsTransfers = new IntentsTransferService();
