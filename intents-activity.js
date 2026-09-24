// What happened to an intents balance: deposits, payments, swaps, withdrawals.
//
// There is no single public history for an intents account -- the verifier
// keeps balances, not events, and 1Click's account history is invite-only --
// so the list is assembled from three sources, each authoritative for its
// own kind:
//
//   deposits    the bridge's recent_deposits, per account and chain. Public,
//               and complete: it includes deposits sent from anywhere.
//   payments    chat payment messages, sent and received, which the app
//               already keeps and which travel with the conversation.
//   swaps,      a record this device writes when it places the order, whose
//   withdrawals state is then read back from 1Click by deposit address.
//               Orders placed on another device do not appear -- a known,
//               accepted gap.
//
// Everything here is data; the screen that draws it is in intents-ui.js.

import { fetchRecentDeposits, getSwapStatus } from './intents.js';
import { intentsDeposits } from './intents-deposits.js';
import { formatUnits } from './intents-assets.js';
import { verifyTransferClaim } from './intents-chat.js';

// A record per order is small, but a long-lived account would otherwise grow
// its saved state without bound.
const MAX_ORDERS = 200;

// Enough history for an asset screen; the bridge pages beyond this.
const DEPOSIT_LIMIT = 20;

const shortAddress = (address) => {
  const text = String(address || '');
  return text.length <= 14 ? text : `${text.slice(0, 6)}…${text.slice(-4)}`;
};

/** 1Click's order states, reduced to what a row needs to say. */
export function orderStatusFrom(status) {
  switch (status) {
    case 'SUCCESS': return 'done';
    case 'REFUNDED': return 'refunded';
    case 'FAILED': return 'failed';
    default: return 'pending';
  }
}

const FINAL = new Set(['done', 'refunded', 'failed']);

/**
 * Which intents asset a bridge deposit credited.
 *
 * Taken from the bridge's own token list, never built by hand: a record's
 * `near_token_id` is a NEP-141 contract for some tokens ("sol.omft.near")
 * and "<contract>:<token>" for multi-tokens ("v2_1.omni.hot.tg:56_2CM…",
 * USDT on BNB Chain), whose asset id is nep245. Prefixing nep141 to every
 * one silently dropped the multi-token deposits from the list.
 *
 * Matched on the NEAR-side token, not `defuse_asset_identifier`: two tokens
 * can share one origin asset -- Bitcoin has two on btc:mainnet:native -- and
 * the NEAR-side token is what tells them apart.
 */
export function depositAssetId(record, bridgeTokens = []) {
  const nearToken = String(record?.near_token_id || '');
  if (!nearToken) return null;
  const known = bridgeTokens.find((token) => (
    token.multi_token_id ? `${token.near_token_id}:${token.multi_token_id}` : token.near_token_id
  ) === nearToken);
  if (known?.intents_token_id) return known.intents_token_id;
  // Not in the list we hold: infer the standard from the id's shape.
  return nearToken.includes(':') ? `nep245:${nearToken}` : `nep141:${nearToken}`;
}

/**
 * One bridge deposit record, as a row.
 *
 * `amount` arrives as a JSON number of base units, so above 2^53 it is
 * already rounded by the time it is parsed. It is displayed to a few
 * significant digits, so the loss never shows -- but it is not exact, and
 * nothing here may treat it as a balance.
 */
export function depositEntry(record, bridgeTokens = []) {
  const decimals = Number.isInteger(record?.decimals) ? record.decimals : 18;
  let amount = '0';
  try {
    amount = formatUnits(BigInt(Math.trunc(Number(record?.amount) || 0)), decimals);
  } catch {
    amount = '0';
  }
  const status = { COMPLETED: 'done', PENDING: 'pending', FAILED: 'failed' }[record?.status] || 'pending';
  return {
    id: `deposit:${record?.tx_hash}`,
    kind: 'deposit',
    assetId: depositAssetId(record, bridgeTokens),
    title: 'Deposit',
    detail: record?.from ? `From ${shortAddress(record.from)}` : null,
    amount,
    direction: 1,
    time: Date.parse(record?.created_at) || 0,
    status,
  };
}

/**
 * A chat payment, as a row. Our own sends are settled by definition -- we
 * published them. A received one is a claim until the intent is checked.
 */
export function paymentEntry(payment) {
  const mine = Boolean(payment.my);
  return {
    id: `payment:${payment.intentHash}`,
    kind: mine ? 'sent' : 'received',
    assetId: payment.assetId,
    title: `${mine ? 'To' : 'From'} ${payment.peer || 'a contact'}`,
    detail: payment.note || null,
    amount: String(payment.amount),
    direction: mine ? -1 : 1,
    time: Number(payment.time) || 0,
    status: mine || payment.verified === 'settled' ? 'done'
      : payment.verified === 'failed' ? 'unconfirmed' : 'checking',
    intentHash: payment.intentHash,
  };
}

/**
 * A swap or withdrawal, as seen from one asset. A swap belongs to two assets
 * and reads differently from each: money out of one, into the other.
 */
export function orderEntry(order, assetId) {
  const base = { id: `order:${order.id}:${assetId}`, time: order.time, status: order.status || 'pending' };
  if (order.kind === 'withdraw') {
    return {
      ...base,
      kind: 'withdraw',
      assetId: order.assetId,
      title: `Withdrawn to ${order.destinationChain || 'another network'}`,
      detail: order.destinationAddress ? `To ${shortAddress(order.destinationAddress)}` : null,
      amount: order.amount,
      direction: -1,
    };
  }
  if (assetId === order.toAssetId) {
    return {
      ...base,
      kind: 'swap',
      assetId,
      title: `Swapped from ${order.fromSymbol}`,
      detail: null,
      // What actually arrived once 1Click reports it; the quote until then.
      amount: order.amountReceived || order.amountOut,
      estimated: !order.amountReceived,
      direction: 1,
    };
  }
  return {
    ...base,
    kind: 'swap',
    assetId: order.fromAssetId,
    title: `Swapped to ${order.toSymbol}`,
    detail: null,
    amount: order.amount,
    direction: -1,
  };
}

export class IntentsActivity {
  constructor({
    fetchDeposits = fetchRecentDeposits,
    fetchOrderStatus = getSwapStatus,
    verifyClaim = verifyTransferClaim,
  } = {}) {
    this.fetchDeposits = fetchDeposits;
    this.fetchOrderStatus = fetchOrderStatus;
    this.verifyClaim = verifyClaim;
    this.getOrders = () => [];
    this.saveOrders = () => {};
    this.listPayments = () => [];
    this.claims = new Map();
  }

  configure({ getOrders, saveOrders, listPayments, fetchDeposits, fetchOrderStatus, verifyClaim } = {}) {
    if (typeof getOrders === 'function') this.getOrders = getOrders;
    if (typeof saveOrders === 'function') this.saveOrders = saveOrders;
    if (typeof listPayments === 'function') this.listPayments = listPayments;
    if (typeof fetchDeposits === 'function') this.fetchDeposits = fetchDeposits;
    if (typeof fetchOrderStatus === 'function') this.fetchOrderStatus = fetchOrderStatus;
    if (typeof verifyClaim === 'function') this.verifyClaim = verifyClaim;
  }

  /**
   * Note an order this device is about to send. Written before sending, not
   * after: a send whose outcome is unknown is exactly the one that most needs
   * a record, and 1Click can settle it later by its deposit address.
   */
  recordOrder(order) {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const orders = [{ ...order, id, time: Date.now(), status: 'pending' }, ...this.getOrders()]
      .slice(0, MAX_ORDERS);
    this.saveOrders(orders);
    return id;
  }

  updateOrder(id, patch) {
    const orders = this.getOrders();
    const index = orders.findIndex((order) => order.id === id);
    if (index === -1) return;
    const next = orders.slice();
    next[index] = { ...orders[index], ...patch };
    this.saveOrders(next);
  }

  /** For an order that was never sent after all -- a quote that expired first. */
  forgetOrder(id) {
    this.saveOrders(this.getOrders().filter((order) => order.id !== id));
  }

  /** Ask 1Click where each unsettled order stands, and keep the answer. */
  async settleOrders(orders) {
    await Promise.all(orders.filter((order) => !FINAL.has(order.status) && order.depositAddress)
      .map(async (order) => {
        try {
          const response = await this.fetchOrderStatus(order.depositAddress, order.depositMemo || null);
          const status = orderStatusFrom(response?.status);
          const received = response?.swapDetails?.amountOutFormatted || null;
          if (status !== order.status || (received && status === 'done')) {
            this.updateOrder(order.id, {
              status,
              ...(received && status === 'done' ? { amountReceived: received } : {}),
            });
          }
        } catch {
          // Unreachable now is not a verdict; the next look may answer.
        }
      }));
  }

  /**
   * Everything known about one asset, newest first.
   *
   * Never throws: each source that fails is reported and the rest are still
   * shown, because a list that blanks when one service is down reads as the
   * money having gone.
   */
  async forAsset(accountId, asset) {
    const assetId = asset?.assetId;
    if (!assetId) return { entries: [], depositsUnavailable: false };

    let depositsUnavailable = false;
    const deposits = [];
    try {
      await intentsDeposits.loadBridgeTokens();
      const chain = intentsDeposits.describeDepositTarget(assetId)?.chain;
      if (chain && accountId) {
        const records = await this.fetchDeposits(accountId, chain, { limit: DEPOSIT_LIMIT });
        for (const record of records) {
          const entry = depositEntry(record, intentsDeposits.bridgeTokens);
          if (entry.assetId === assetId) deposits.push(entry);
        }
      }
    } catch (error) {
      console.warn('Deposit history unavailable:', error);
      depositsUnavailable = true;
    }

    let payments = [];
    try {
      payments = this.listPayments()
        .filter((payment) => payment?.assetId === assetId && payment.intentHash)
        .map(paymentEntry)
        .map((entry) => {
          const known = this.claims.get(entry.intentHash);
          return known ? { ...entry, status: known } : entry;
        });
    } catch (error) {
      console.warn('Payment history unavailable:', error);
    }

    const mine = this.getOrders().filter((order) => (
      order.assetId === assetId || order.fromAssetId === assetId || order.toAssetId === assetId
    ));
    await this.settleOrders(mine);
    const orders = this.getOrders()
      .filter((order) => mine.some((before) => before.id === order.id))
      // A swap that never filled delivered nothing to the asset it targeted.
      .filter((order) => !(order.toAssetId === assetId && order.status !== 'done' && order.status !== 'pending'))
      .map((order) => orderEntry(order, assetId));

    const entries = [...deposits, ...payments, ...orders].sort((a, b) => b.time - a.time);
    return { entries, depositsUnavailable };
  }

  /**
   * Check a received payment's claim. Only resting answers are remembered;
   * "pending" and "unverifiable" are asked again next time.
   */
  async verifyPayment(intentHash) {
    const known = this.claims.get(intentHash);
    if (known) return known;
    try {
      const result = await this.verifyClaim({ intentHash });
      const status = result?.state === 'settled' ? 'done'
        : result?.state === 'failed' ? 'unconfirmed' : 'checking';
      if (status !== 'checking') this.claims.set(intentHash, status);
      return status;
    } catch {
      return 'checking';
    }
  }
}

export const intentsActivity = new IntentsActivity();
