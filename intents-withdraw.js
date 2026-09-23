// Taking an asset out of intents and back onto its own chain.
//
// The mechanics of leaving differ per asset -- PoA bridge for some, Omni for
// others, with a migration list between them that is maintained by hand, a
// storage account derived by a case-sensitive hash, and a fee charged in wNEAR.
// Reimplementing that split is the highest-risk code in this project, and there
// is no testnet on which to get it wrong safely.
//
// So we do not. 1Click prices the withdrawal and hands back a deposit address
// inside the verifier; funding it with an ordinary transfer intent is the whole
// of our side. The bridge choice, the fee maths and the storage derivation stay
// where they are maintained.
//
// One thing we deliberately do not delegate: 1Click can compose the intent
// payload for us, and we do not let it. This client signs only payloads it
// built itself, so a remote service can never hand it something to sign whose
// recipient or amount differs from what the person agreed to.

import {
  buildIntentPayload,
  buildTransferIntent,
  buildVersionedNonce,
  getCurrentSalt,
  getSwapStatus,
  intentDeadline,
  publishIntent,
  requestSwapQuote,
  signIntentPayload,
  simulateIntents,
  waitForIntentSettlement,
} from './intents.js';
import { parseTokenAmount } from './intents-transfer.js';

export class IntentsWithdrawError extends Error {
  constructor(message, code = 'WITHDRAW_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsWithdrawError';
    this.code = code;
    this.details = details;
  }
}

// How long the quote's deposit address stays fundable. Past it, 1Click warns
// that funds sent may be lost, so we refuse to publish rather than race it.
const DEPOSIT_DEADLINE_MARGIN_MS = 30_000;
const QUOTE_LIFETIME_MS = 10 * 60_000;
const STATUS_POLL_MS = 3_000;
const STATUS_TIMEOUT_MS = 10 * 60_000;

const SETTLED_STATUSES = new Set(['SUCCESS', 'REFUNDED', 'FAILED']);

function quoteRequestFor({ accountId, asset, destinationAddress, rawAmount, dry, slippageBps }) {
  return {
    dry,
    swapType: 'EXACT_INPUT',
    slippageTolerance: slippageBps,
    // Same asset in and out: a withdrawal is a swap that does not change what
    // you hold, only where it lives.
    originAsset: asset.assetId,
    depositType: 'INTENTS',
    destinationAsset: asset.assetId,
    amount: rawAmount,
    refundTo: accountId,
    refundType: 'INTENTS',
    recipient: destinationAddress,
    recipientType: 'DESTINATION_CHAIN',
    deadline: new Date(Date.now() + QUOTE_LIFETIME_MS).toISOString(),
  };
}

export class IntentsWithdrawService {
  /**
   * `requestQuote` and `getStatus` are injectable so the request this builds
   * can be asserted without a network: the difference between refundType
   * INTENTS and DESTINATION_CHAIN is the difference between a refund coming
   * back and a refund going somewhere else.
   */
  constructor({
    getAccount = () => null,
    slippageBps = 100,
    requestQuote = requestSwapQuote,
    getStatus = getSwapStatus,
  } = {}) {
    this.getAccount = getAccount;
    this.slippageBps = slippageBps;
    this.requestQuote = requestQuote;
    this.getStatus = getStatus;
  }

  configure({ getAccount } = {}) {
    if (typeof getAccount === 'function') this.getAccount = getAccount;
  }

  /**
   * What this withdrawal would cost, without creating one.
   *
   * Also the validation step: a dry quote is where 1Click rejects a malformed
   * destination address or an amount below the bridge minimum, and its
   * explanations are better than anything we could compute locally -- the
   * minimums it quotes are live, where the cached ones are not always.
   */
  async preview({ accountId, asset, destinationAddress, amount }) {
    const rawAmount = parseTokenAmount(amount, asset.tokenDecimals).toString();
    if (!destinationAddress) {
      throw new IntentsWithdrawError('Enter an address to withdraw to', 'NO_DESTINATION');
    }

    const response = await this.requestQuote(quoteRequestFor({
      accountId,
      asset,
      destinationAddress,
      rawAmount,
      dry: true,
      slippageBps: this.slippageBps,
    }));

    const quote = response?.quote;
    if (!quote) {
      throw new IntentsWithdrawError('No quote came back for that withdrawal', 'NO_QUOTE', { response });
    }

    return Object.freeze({
      rawAmount,
      amountIn: quote.amountInFormatted,
      amountOut: quote.amountOutFormatted,
      minAmountOut: quote.minAmountOut,
      amountOutUsd: quote.amountOutUsd,
      withdrawFee: quote.withdrawFee,
      timeEstimateSeconds: quote.timeEstimate,
      symbol: asset.tokenSymbol,
      destinationAddress,
    });
  }

  /**
   * Commit to the withdrawal: take a real quote, and build the transfer that
   * funds it. Nothing is signed or published here.
   */
  async prepare({ accountId, asset, destinationAddress, amount }) {
    if (!accountId) {
      throw new IntentsWithdrawError('No account is signed in', 'NO_ACCOUNT');
    }
    const rawAmount = parseTokenAmount(amount, asset.tokenDecimals).toString();
    const available = BigInt(asset.rawAmount || '0');
    if (BigInt(rawAmount) > available) {
      throw new IntentsWithdrawError(
        `You only have ${asset.tokenAmount} ${asset.tokenSymbol}`,
        'INSUFFICIENT_BALANCE',
      );
    }

    const response = await this.requestQuote(quoteRequestFor({
      accountId,
      asset,
      destinationAddress,
      rawAmount,
      dry: false,
      slippageBps: this.slippageBps,
    }));

    const quote = response?.quote;
    const depositAddress = quote?.depositAddress;
    if (!depositAddress) {
      throw new IntentsWithdrawError(
        'The quote did not come with a deposit address',
        'NO_DEPOSIT_ADDRESS',
        { response },
      );
    }

    const deadline = intentDeadline();
    const salt = await getCurrentSalt();

    // The transfer that funds the withdrawal. Built here, from values we chose,
    // so what gets signed is what was agreed -- 1Click supplies the destination
    // account and nothing else.
    const payload = buildIntentPayload({
      signerId: accountId,
      deadline,
      nonce: buildVersionedNonce(salt, deadline),
      intents: [buildTransferIntent({
        receiverId: depositAddress,
        tokens: { [asset.assetId]: rawAmount },
        memo: quote.depositMemo || null,
      })],
    });

    return Object.freeze({
      accountId,
      assetId: asset.assetId,
      symbol: asset.tokenSymbol,
      amount: String(amount).trim(),
      rawAmount,
      destinationAddress,
      depositAddress,
      depositMemo: quote.depositMemo || null,
      depositDeadline: quote.deadline || null,
      amountOut: quote.amountOutFormatted,
      withdrawFee: quote.withdrawFee,
      timeEstimateSeconds: quote.timeEstimate,
      payload,
    });
  }

  /** Ask the verifier whether the funding transfer would go through. */
  async simulate(signed) {
    try {
      return { ok: true, simulation: await simulateIntents(signed), reason: null };
    } catch (error) {
      return { ok: false, simulation: null, reason: error.message || String(error) };
    }
  }

  /**
   * Sign the funding transfer, publish it, and follow the withdrawal out.
   *
   * The deposit address expires; past that 1Click says funds sent to it may be
   * lost, so an expired quote is refused here rather than published hopefully.
   */
  async execute(prepared, secretKey, { onStatus = null, signed = null } = {}) {
    if (prepared.depositDeadline) {
      const expiresAt = Date.parse(prepared.depositDeadline);
      if (Number.isFinite(expiresAt) && Date.now() > expiresAt - DEPOSIT_DEADLINE_MARGIN_MS) {
        throw new IntentsWithdrawError(
          'This quote has expired. Get a new one before withdrawing.',
          'QUOTE_EXPIRED',
        );
      }
    }

    // A caller that simulated first passes the signature it checked, so the
    // payload published is the one the verifier approved.
    const payload = signed || await signIntentPayload(prepared.payload, secretKey);
    const intentHash = await publishIntent(payload);
    const settlement = await waitForIntentSettlement(intentHash);

    if (settlement.status !== 'SETTLED') {
      throw new IntentsWithdrawError(
        `The funding transfer did not settle (${settlement.status})`,
        'FUNDING_FAILED',
        { intentHash, settlement },
      );
    }

    const final = await this.followStatus(prepared, { onStatus });
    return {
      intentHash,
      transactionHash: settlement.transactionHash,
      status: final.status,
      detail: final.detail,
    };
  }

  /** Poll 1Click until the withdrawal reaches a resting state. */
  async followStatus(prepared, { onStatus = null, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
    const deadline = Date.now() + timeoutMs;
    let last = { status: 'PENDING', detail: null };

    while (Date.now() < deadline) {
      let response;
      try {
        response = await this.getStatus(prepared.depositAddress, prepared.depositMemo);
      } catch (error) {
        // A status endpoint hiccup is not a failed withdrawal.
        await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
        continue;
      }

      last = { status: String(response?.status || 'PENDING'), detail: response };
      onStatus?.(last);
      if (SETTLED_STATUSES.has(last.status)) return last;

      await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
    }
    return { ...last, status: last.status === 'PENDING' ? 'TIMED_OUT' : last.status };
  }
}

export const intentsWithdrawals = new IntentsWithdrawService();
