import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProvisionalUnstakeHistoryEntry,
  findPendingStakeOrUnstake,
  findPendingWithdrawStake,
  getUnstakePendingBarText,
  settleWithdrawStake,
  UNSTAKE_CONFIRMED_TOAST,
  UNSTAKE_DELAYED_BAR_TEXT,
  UNSTAKE_PENDING_BAR_TEXT,
  UNSTAKE_SUBMITTED_TOAST,
  UNSTAKE_TIMEOUT_TOAST,
} from '../unstake.settlement.js';

const TXID = 'unstake-txid-1';
const NOMINEE = '0x' + 'ab'.repeat(20);
const TOTAL_UNSTAKE = 1234500000000000000n;

function pendingUnstake(overrides = {}) {
  return {
    txid: TXID,
    type: 'withdraw_stake',
    submittedts: Date.now() - 40_000,
    checkedts: 0,
    to: NOMINEE,
    ...overrides,
  };
}

function provisionalHistory() {
  return [
    createProvisionalUnstakeHistoryEntry({
      nominee: NOMINEE,
      txid: TXID,
      timestamp: Date.now(),
      amount: 0n,
    }),
  ];
}

function settle(outcome, { modalOpen, failureReason, totalUnstakeAmount = TOTAL_UNSTAKE, pendingOverrides } = {}) {
  return settleWithdrawStake({
    outcome,
    pending: [pendingUnstake(pendingOverrides)],
    history: provisionalHistory(),
    txid: TXID,
    modalOpen,
    totalUnstakeAmount,
    failureReason,
  });
}

test('injection accepted copy uses pending confirmation toast, not confirmed success', () => {
  assert.equal(UNSTAKE_SUBMITTED_TOAST, 'Unstake submitted—pending confirmation');
  assert.notEqual(UNSTAKE_SUBMITTED_TOAST, UNSTAKE_CONFIRMED_TOAST);
});

test('pending helpers find withdraw_stake and block duplicates while pending', () => {
  const pending = [pendingUnstake()];
  assert.equal(findPendingWithdrawStake(pending)?.txid, TXID);
  assert.equal(findPendingStakeOrUnstake(pending)?.type, 'withdraw_stake');
  assert.equal(getUnstakePendingBarText(pending[0]), UNSTAKE_PENDING_BAR_TEXT);
});

test('success with modal open clears pending, updates history, refreshes modal, never reopens', () => {
  const result = settle('success', { modalOpen: true });

  assert.equal(result.pending.length, 0);
  assert.equal(result.clearPending, true);
  assert.equal(result.history[0].amount, TOTAL_UNSTAKE);
  assert.deepEqual(result.toast, {
    message: UNSTAKE_CONFIRMED_TOAST,
    type: 'success',
    duration: 5000,
  });
  assert.equal(result.refreshModal, true);
  assert.equal(result.openModal, false);
});

test('success with modal closed clears pending and updates history without opening UI', () => {
  const result = settle('success', { modalOpen: false });

  assert.equal(result.pending.length, 0);
  assert.equal(result.history[0].amount, TOTAL_UNSTAKE);
  assert.equal(result.toast.message, UNSTAKE_CONFIRMED_TOAST);
  assert.equal(result.refreshModal, false);
  assert.equal(result.openModal, false);
});

test('failure with modal open clears pending + provisional history and refreshes modal', () => {
  const result = settle('failure', {
    modalOpen: true,
    failureReason: 'insufficient stake',
  });

  assert.equal(result.pending.length, 0);
  assert.equal(result.history.length, 0);
  assert.equal(result.clearPending, true);
  assert.deepEqual(result.toast, {
    message: 'Unstake failed: insufficient stake',
    type: 'error',
    duration: 0,
  });
  assert.equal(result.refreshModal, true);
  assert.equal(result.openModal, false);
});

test('failure with modal closed clears pending + provisional history without opening UI', () => {
  const result = settle('failure', {
    modalOpen: false,
    failureReason: 'rejected by network',
  });

  assert.equal(result.pending.length, 0);
  assert.equal(result.history.length, 0);
  assert.equal(result.toast.message, 'Unstake failed: rejected by network');
  assert.equal(result.refreshModal, false);
  assert.equal(result.openModal, false);
});

test('timeout with modal open keeps pending unresolved and shows delayed state', () => {
  const result = settle('timeout', { modalOpen: true });

  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].confirmationDelayed, true);
  assert.equal(result.clearPending, false);
  assert.equal(result.history.length, 1);
  assert.deepEqual(result.toast, {
    message: UNSTAKE_TIMEOUT_TOAST,
    type: 'warning',
    duration: 0,
  });
  assert.equal(result.refreshModal, true);
  assert.equal(result.openModal, false);
  assert.equal(getUnstakePendingBarText(result.pending[0]), UNSTAKE_DELAYED_BAR_TEXT);
});

test('timeout with modal closed keeps pending unresolved without opening UI', () => {
  const result = settle('timeout', { modalOpen: false });

  assert.equal(result.pending.length, 1);
  assert.equal(result.pending[0].confirmationDelayed, true);
  assert.equal(result.clearPending, false);
  assert.equal(result.toast.message, UNSTAKE_TIMEOUT_TOAST);
  assert.equal(result.refreshModal, false);
  assert.equal(result.openModal, false);
});

test('repeated timeout after delayed mark does not re-toast or clear pending', () => {
  const first = settle('timeout', { modalOpen: true });
  const second = settleWithdrawStake({
    outcome: 'timeout',
    pending: first.pending,
    history: first.history,
    txid: TXID,
    modalOpen: true,
  });

  assert.equal(second.pending.length, 1);
  assert.equal(second.pending[0].confirmationDelayed, true);
  assert.equal(second.toast, null);
  assert.equal(second.refreshModal, false);
  assert.equal(second.didMutate, false);
  assert.equal(second.openModal, false);
});
