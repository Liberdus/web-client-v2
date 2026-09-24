// Exchanging one intents balance for another.
//
// Mechanically this is the withdrawal flow with the payout pointed back at
// yourself: quote, fund the deposit address with a transfer intent, follow the
// order. The difference is that the asset changes and nothing leaves intents,
// so there is no destination chain, no address to get wrong, and no bridge
// minimum -- only the price.
//
// Which makes the price the thing to be careful about. A swap is the one
// operation here where the amount you receive is not known in advance: solvers
// compete, the quote moves, and slippage is the gap the person is agreeing to.
// So the worst case is what gets shown, not the headline number.

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

export class IntentsSwapError extends Error {
  constructor(message, code = 'SWAP_ERROR', details = {}) {
    super(message, { cause: details.cause });
    this.name = 'IntentsSwapError';
    this.code = code;
    this.details = details;
  }
}

/** Scale a raw amount to a decimal string without going through a float. */
function formatRaw(raw, decimals) {
  const amount = BigInt(raw || '0');
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

export class IntentsSwapService {
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
   * The quote fields that make this a swap: a different asset out, and a
   * payout that stays inside intents rather than landing on a chain.
   */
  quoteFor({ accountId, fromAsset, toAsset, rawAmount, dry }) {
    return buildQuoteRequest({
      accountId,
      originAssetId: fromAsset.assetId,
      destinationAssetId: toAsset.assetId,
      rawAmount,
      recipient: accountId,
      recipientType: 'INTENTS',
      dry,
      slippageBps: this.slippageBps,
    });
  }

  /**
   * Price the swap without creating one.
   *
   * `minAmountOut` is the number that matters: solvers compete and the rate
   * moves between quoting and filling, so the guarantee is the floor, not the
   * estimate. Both are returned and the UI is expected to show the floor.
   */
  async preview({ accountId, fromAsset, toAsset, amount }) {
    if (!fromAsset?.assetId || !toAsset?.assetId) {
      throw new IntentsSwapError('Choose what to swap from and to', 'NO_ASSETS');
    }
    if (fromAsset.assetId === toAsset.assetId) {
      throw new IntentsSwapError('Choose two different assets', 'SAME_ASSET');
    }

    const rawAmount = parseTokenAmount(amount, fromAsset.tokenDecimals).toString();
    const response = await this.requestQuote(
      this.quoteFor({ accountId, fromAsset, toAsset, rawAmount, dry: true }),
    );

    const quote = response?.quote;
    if (!quote) {
      throw new IntentsSwapError('No quote came back for that swap', 'NO_QUOTE', { response });
    }

    const toDecimals = Number.isInteger(toAsset.tokenDecimals) ? toAsset.tokenDecimals : 18;
    return Object.freeze({
      rawAmount,
      amountIn: quote.amountInFormatted,
      amountOut: quote.amountOutFormatted,
      // The worst case the person is agreeing to.
      minAmountOut: quote.minAmountOut ? formatRaw(quote.minAmountOut, toDecimals) : null,
      amountInUsd: quote.amountInUsd,
      amountOutUsd: quote.amountOutUsd,
      timeEstimateSeconds: quote.timeEstimate,
      fromSymbol: fromAsset.tokenSymbol,
      toSymbol: toAsset.tokenSymbol,
      slippageBps: this.slippageBps,
    });
  }

  /** Take a live quote and build the transfer that funds it. */
  async prepare({ accountId, fromAsset, toAsset, amount }) {
    if (!accountId) {
      throw new IntentsSwapError('No account is signed in', 'NO_ACCOUNT');
    }
    if (!fromAsset?.assetId || !toAsset?.assetId) {
      throw new IntentsSwapError('Choose what to swap from and to', 'NO_ASSETS');
    }
    if (fromAsset.assetId === toAsset.assetId) {
      throw new IntentsSwapError('Choose two different assets', 'SAME_ASSET');
    }

    const rawAmount = parseTokenAmount(amount, fromAsset.tokenDecimals).toString();
    const available = BigInt(fromAsset.rawAmount || '0');
    if (BigInt(rawAmount) > available) {
      throw new IntentsSwapError(
        `You only have ${fromAsset.tokenAmount} ${fromAsset.tokenSymbol}`,
        'INSUFFICIENT_BALANCE',
      );
    }

    const response = await this.requestQuote(
      this.quoteFor({ accountId, fromAsset, toAsset, rawAmount, dry: false }),
    );

    const quote = response?.quote;
    const depositAddress = quote?.depositAddress;
    if (!depositAddress) {
      throw new IntentsSwapError(
        'The quote did not come with a deposit address',
        'NO_DEPOSIT_ADDRESS',
        { response },
      );
    }

    const payload = await buildFundingTransfer({
      accountId,
      assetId: fromAsset.assetId,
      rawAmount,
      depositAddress,
      depositMemo: quote.depositMemo,
    });

    const toDecimals = Number.isInteger(toAsset.tokenDecimals) ? toAsset.tokenDecimals : 18;
    return Object.freeze({
      accountId,
      fromAssetId: fromAsset.assetId,
      toAssetId: toAsset.assetId,
      fromSymbol: fromAsset.tokenSymbol,
      toSymbol: toAsset.tokenSymbol,
      amount: String(amount).trim(),
      rawAmount,
      depositAddress,
      depositMemo: quote.depositMemo || null,
      depositDeadline: quote.deadline || null,
      amountOut: quote.amountOutFormatted,
      minAmountOut: quote.minAmountOut ? formatRaw(quote.minAmountOut, toDecimals) : null,
      timeEstimateSeconds: quote.timeEstimate,
      payload,
    });
  }

  simulate(signed) {
    return simulateFunding(signed);
  }

  /** Fund the swap and follow it until it fills, refunds or fails. */
  async execute(prepared, secretKey, { onStatus = null, signed = null } = {}) {
    if (isQuoteExpired(prepared.depositDeadline)) {
      throw new IntentsSwapError(
        'This quote has expired. Get a new one before swapping.',
        'QUOTE_EXPIRED',
      );
    }

    const { intentHash, settlement, settled } = await fundOrder(prepared, secretKey, { signed });
    if (!settled) {
      throw new IntentsSwapError(
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
      // A refund is not a failure: the asset came back because the swap could
      // not be filled on the agreed terms, which is the protection working.
      refunded: final.status === 'REFUNDED',
      detail: final.detail,
    };
  }

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

export const intentsSwaps = new IntentsSwapService();
