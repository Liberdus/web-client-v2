/**
 * Pure helpers for withdraw_stake pending settlement and staking UI refresh.
 * Kept free of DOM so settlement outcomes are unit-testable.
 */

export const UNSTAKE_SUBMITTED_TOAST = 'Unstake submitted—pending confirmation';
export const UNSTAKE_CONFIRMED_TOAST = 'Unstake transaction confirmed';
export const UNSTAKE_TIMEOUT_TOAST = 'Unstake confirmation is taking longer than expected';
export const UNSTAKE_PENDING_BAR_TEXT = 'Pending Unstake Transaction';
export const UNSTAKE_DELAYED_BAR_TEXT = 'Unstake confirmation taking longer than expected';

/**
 * @param {Array|null|undefined} pending
 * @returns {object|null}
 */
export function findPendingStakeOrUnstake(pending) {
  if (!Array.isArray(pending)) return null;
  return pending.find((tx) => tx?.type === 'deposit_stake' || tx?.type === 'withdraw_stake') || null;
}

/**
 * @param {Array|null|undefined} pending
 * @returns {object|null}
 */
export function findPendingWithdrawStake(pending) {
  if (!Array.isArray(pending)) return null;
  return pending.find((tx) => tx?.type === 'withdraw_stake') || null;
}

/**
 * @param {object|null|undefined} pendingTx
 * @returns {string|null}
 */
export function getUnstakePendingBarText(pendingTx) {
  if (!pendingTx || pendingTx.type !== 'withdraw_stake') return null;
  if (pendingTx.confirmationDelayed) return UNSTAKE_DELAYED_BAR_TEXT;
  return UNSTAKE_PENDING_BAR_TEXT;
}

/**
 * @param {object} params
 * @param {string} params.nominee
 * @param {string} params.txid
 * @param {number} params.timestamp
 * @param {bigint|number|string} [params.amount]
 * @returns {object}
 */
export function createProvisionalUnstakeHistoryEntry({ nominee, txid, timestamp, amount = 0n }) {
  return {
    nominee,
    amount,
    type: 'withdraw_stake',
    sign: 1,
    status: 'sent',
    timestamp,
    txid,
  };
}

/**
 * Settle a withdraw_stake receipt outcome against pending + wallet history.
 * Never opens UI; callers decide whether to refresh an already-open modal.
 *
 * @param {object} params
 * @param {'success'|'failure'|'timeout'} params.outcome
 * @param {Array} params.pending
 * @param {Array} params.history
 * @param {string} params.txid
 * @param {boolean} params.modalOpen
 * @param {*} [params.totalUnstakeAmount] receipt amount for success
 * @param {string} [params.failureReason]
 * @returns {{
 *   pending: Array,
 *   history: Array,
 *   toast: { message: string, type: string, duration: number } | null,
 *   refreshModal: boolean,
 *   openModal: boolean,
 *   clearPending: boolean,
 *   didMutate: boolean,
 * }}
 */
export function settleWithdrawStake({
  outcome,
  pending,
  history,
  txid,
  modalOpen,
  totalUnstakeAmount,
  failureReason,
}) {
  const nextPending = Array.isArray(pending) ? [...pending] : [];
  const nextHistory = Array.isArray(history) ? [...history] : [];
  const pendingIndex = nextPending.findIndex((tx) => tx?.txid === txid && tx?.type === 'withdraw_stake');

  const base = {
    pending: nextPending,
    history: nextHistory,
    toast: null,
    refreshModal: Boolean(modalOpen),
    openModal: false,
    clearPending: false,
    didMutate: false,
  };

  if (outcome === 'success') {
    if (pendingIndex !== -1) {
      nextPending.splice(pendingIndex, 1);
      base.clearPending = true;
      base.didMutate = true;
    }

    const historyIndex = nextHistory.findIndex((tx) => tx?.txid === txid);
    if (historyIndex !== -1 && totalUnstakeAmount !== undefined) {
      nextHistory[historyIndex] = {
        ...nextHistory[historyIndex],
        amount: totalUnstakeAmount,
      };
      base.didMutate = true;
    }

    return {
      ...base,
      toast: { message: UNSTAKE_CONFIRMED_TOAST, type: 'success', duration: 5000 },
    };
  }

  if (outcome === 'failure') {
    if (pendingIndex !== -1) {
      nextPending.splice(pendingIndex, 1);
      base.clearPending = true;
      base.didMutate = true;
    }

    const filteredHistory = nextHistory.filter((tx) => tx?.txid !== txid);
    if (filteredHistory.length !== nextHistory.length) {
      base.history = filteredHistory;
      base.didMutate = true;
    }

    const reason = failureReason || 'Transaction failed';
    return {
      ...base,
      history: base.history,
      toast: { message: `Unstake failed: ${reason}`, type: 'error', duration: 0 },
    };
  }

  if (outcome === 'timeout') {
    if (pendingIndex === -1) {
      return base;
    }

    const pendingTx = { ...nextPending[pendingIndex] };
    if (pendingTx.confirmationDelayed) {
      // Already marked unresolved; keep polling without new toast/UI churn.
      nextPending[pendingIndex] = pendingTx;
      return {
        ...base,
        toast: null,
        refreshModal: false,
        clearPending: false,
        didMutate: false,
      };
    }

    pendingTx.confirmationDelayed = true;
    nextPending[pendingIndex] = pendingTx;
    return {
      ...base,
      toast: { message: UNSTAKE_TIMEOUT_TOAST, type: 'warning', duration: 0 },
      refreshModal: Boolean(modalOpen),
      clearPending: false,
      didMutate: true,
    };
  }

  return base;
}
