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
// The quote/fund/follow machinery is shared with swaps and lives in
// intents-oneclick.js, including the rule that we sign only payloads we built
// ourselves. What is specific here is that the asset does not change: only
// where it lives does.

import { getSwapStatus, requestSwapQuote } from './intents.js';
import { parseTokenAmount } from './intents-transfer.js';
import {
  buildFundingTransfer,
  buildQuoteRequest,
  followOrder,
  fundOrder,
  isQuoteExpired,
  simulateFunding,
  STATUS_TIMEOUT_MS,
} from './intents-oneclick.js';

export class IntentsWithdrawError extends Error {
  constructor(message, code = 'WITHDRAW_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsWithdrawError';
    this.code = code;
    this.details = details;
  }
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
   * The quote fields that make this a withdrawal rather than a swap.
   *
   * `destinationAsset` defaults to the asset being spent -- the same coin, on
   * its own chain. It differs when the same symbol exists on several chains:
   * ETH held on Base can leave to Ethereum or Arbitrum, and the person has to
   * say which, because an address is not enough to tell them apart.
   */
  quoteFor({ accountId, asset, destinationAsset = null, destinationAddress, rawAmount, dry }) {
    return buildQuoteRequest({
      accountId,
      originAssetId: asset.assetId,
      destinationAssetId: (destinationAsset || asset).assetId,
      rawAmount,
      recipient: destinationAddress,
      recipientType: 'DESTINATION_CHAIN',
      dry,
      slippageBps: this.slippageBps,
    });
  }

  /**
   * What this withdrawal would cost, without creating one.
   *
   * Also the validation step: a dry quote is where 1Click rejects a malformed
   * destination address or an amount below the bridge minimum, and its
   * explanations are better than anything we could compute locally -- the
   * minimums it quotes are live, where the cached ones are not always.
   */
  async preview({ accountId, asset, destinationAsset = null, destinationAddress, amount }) {
    const rawAmount = parseTokenAmount(amount, asset.tokenDecimals).toString();
    if (!destinationAddress) {
      throw new IntentsWithdrawError('Enter an address to withdraw to', 'NO_DESTINATION');
    }

    const response = await this.requestQuote(
      this.quoteFor({ accountId, asset, destinationAsset, destinationAddress, rawAmount, dry: true }),
    );

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
      destinationChain: (destinationAsset || asset).chainName,
    });
  }

  /**
   * Commit to the withdrawal: take a real quote, and build the transfer that
   * funds it. Nothing is signed or published here.
   */
  async prepare({ accountId, asset, destinationAsset = null, destinationAddress, amount }) {
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

    const response = await this.requestQuote(
      this.quoteFor({ accountId, asset, destinationAsset, destinationAddress, rawAmount, dry: false }),
    );

    const quote = response?.quote;
    const depositAddress = quote?.depositAddress;
    if (!depositAddress) {
      throw new IntentsWithdrawError(
        'The quote did not come with a deposit address',
        'NO_DEPOSIT_ADDRESS',
        { response },
      );
    }

    const payload = await buildFundingTransfer({
      accountId,
      assetId: asset.assetId,
      rawAmount,
      depositAddress,
      depositMemo: quote.depositMemo,
    });

    return Object.freeze({
      accountId,
      assetId: asset.assetId,
      symbol: asset.tokenSymbol,
      amount: String(amount).trim(),
      rawAmount,
      destinationAddress,
      destinationChain: (destinationAsset || asset).chainName,
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
  simulate(signed) {
    return simulateFunding(signed);
  }

  /**
   * Sign the funding transfer, publish it, and follow the withdrawal out.
   *
   * The deposit address expires; past that 1Click says funds sent to it may be
   * lost, so an expired quote is refused here rather than published hopefully.
   */
  async execute(prepared, secretKey, { onStatus = null, signed = null } = {}) {
    if (isQuoteExpired(prepared.depositDeadline)) {
      throw new IntentsWithdrawError(
        'This quote has expired. Get a new one before withdrawing.',
        'QUOTE_EXPIRED',
      );
    }

    const { intentHash, settlement, settled } = await fundOrder(prepared, secretKey, { signed });
    if (!settled) {
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
  followStatus(prepared, { onStatus = null, timeoutMs = STATUS_TIMEOUT_MS } = {}) {
    return followOrder({
      getStatus: (address, memo) => this.getStatus(address, memo),
      depositAddress: prepared.depositAddress,
      depositMemo: prepared.depositMemo,
      onStatus,
      timeoutMs,
    });
  }
}

export const intentsWithdrawals = new IntentsWithdrawService();
