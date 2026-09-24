// The machinery shared by withdrawals and swaps.
//
// Both are the same shape: ask 1Click what it would cost, take a live quote to
// get a deposit address inside the verifier, fund that address with an ordinary
// transfer intent, then follow the order out. Only three fields differ --
// what you end up holding, who receives it, and whether the payout lands on a
// foreign chain or stays in intents.
//
// It lives in one place because the parts that are easy to get wrong are the
// shared ones: refusing an expired deposit address, insisting the funding
// transfer actually settled before watching for a payout, and not mistaking a
// status-endpoint hiccup for a failed order. Two copies of that would drift.

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

export const QUOTE_LIFETIME_MS = 10 * 60_000;
export const DEPOSIT_DEADLINE_MARGIN_MS = 30_000;
export const STATUS_POLL_MS = 3_000;
export const STATUS_TIMEOUT_MS = 10 * 60_000;

/** Statuses 1Click will not move on from. */
export const SETTLED_STATUSES = new Set(['SUCCESS', 'REFUNDED', 'FAILED']);

/**
 * The quote request.
 *
 * `refundType` is always INTENTS: if the order cannot be filled, the asset
 * should come back to the account that paid, not be pushed onto a foreign
 * chain the person may not have meant to touch.
 */
export function buildQuoteRequest({
  accountId,
  originAssetId,
  destinationAssetId,
  rawAmount,
  recipient,
  recipientType,
  dry,
  slippageBps,
}) {
  return {
    dry,
    swapType: 'EXACT_INPUT',
    slippageTolerance: slippageBps,
    originAsset: originAssetId,
    depositType: 'INTENTS',
    destinationAsset: destinationAssetId,
    amount: rawAmount,
    refundTo: accountId,
    refundType: 'INTENTS',
    recipient,
    recipientType,
    deadline: new Date(Date.now() + QUOTE_LIFETIME_MS).toISOString(),
  };
}

/**
 * The transfer that funds an order.
 *
 * Built here from values the caller chose, never from a payload 1Click
 * composed: this client signs only what it built itself, so no remote service
 * can hand it something to sign whose recipient or amount differs from what
 * was agreed. 1Click supplies the destination account and nothing else.
 */
export async function buildFundingTransfer({ accountId, assetId, rawAmount, depositAddress, depositMemo = null }) {
  const deadline = intentDeadline();
  const salt = await getCurrentSalt();
  return buildIntentPayload({
    signerId: accountId,
    deadline,
    nonce: buildVersionedNonce(salt, deadline),
    intents: [buildTransferIntent({
      receiverId: depositAddress,
      tokens: { [assetId]: rawAmount },
      memo: depositMemo || null,
    })],
  });
}

/** Ask the verifier whether the funding transfer would go through. */
export async function simulateFunding(signed) {
  try {
    return { ok: true, simulation: await simulateIntents(signed), reason: null };
  } catch (error) {
    return { ok: false, simulation: null, reason: error.message || String(error) };
  }
}

/** True when the quote's deposit address is gone or about to be. */
export function isQuoteExpired(depositDeadline) {
  if (!depositDeadline) return false;
  const expiresAt = Date.parse(depositDeadline);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() > expiresAt - DEPOSIT_DEADLINE_MARGIN_MS;
}

/**
 * Fund an order and wait for the funding transfer to land.
 *
 * Returns only once the transfer has settled, because watching for a payout
 * that was never paid for would report a timeout instead of the real failure.
 */
export async function fundOrder(prepared, secretKey, { signed = null } = {}) {
  // A caller that simulated first passes the signature it checked, so the
  // payload published is the one the verifier approved.
  const payload = signed || await signIntentPayload(prepared.payload, secretKey);
  const intentHash = await publishIntent(payload);
  const settlement = await waitForIntentSettlement(intentHash);
  return { intentHash, settlement, settled: settlement.status === 'SETTLED' };
}

/** Poll 1Click until the order reaches a resting state. */
export async function followOrder({
  getStatus,
  depositAddress,
  depositMemo = null,
  onStatus = null,
  timeoutMs = STATUS_TIMEOUT_MS,
}) {
  const deadline = Date.now() + timeoutMs;
  let last = { status: 'PENDING', detail: null };

  while (Date.now() < deadline) {
    let response;
    try {
      response = await getStatus(depositAddress, depositMemo);
    } catch {
      // A status endpoint hiccup is not a failed order.
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
