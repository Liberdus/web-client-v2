import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachDaoPendingMetadata,
  buildDaoPendingMetadata,
  DAO_PROPOSAL_CREATE_TYPE,
  DAO_SETTLEMENT_OUTCOMES,
  getDaoPendingToastMessage,
  getDaoSettlementUiPlan,
  settleDaoPendingTransaction,
} from '../dao.settlement.js';

const PROPOSAL_STORE_ID = '12_abc123';
const TXID = 'tx-dao-create-1';

function createPendingCreate(overrides = {}) {
  return {
    txid: TXID,
    type: DAO_PROPOSAL_CREATE_TYPE,
    submittedts: Date.now() - 10_000,
    proposalStoreId: PROPOSAL_STORE_ID,
    proposalId: 'abc123',
    proposalNumber: 12,
    from: '0x' + 'a'.repeat(40),
    ...overrides,
  };
}

test('attachDaoPendingMetadata stores proposal create identity on the pending entry', () => {
  const pending = [{ txid: TXID, type: DAO_PROPOSAL_CREATE_TYPE, submittedts: 1 }];
  const metadata = buildDaoPendingMetadata({
    type: DAO_PROPOSAL_CREATE_TYPE,
    txid: TXID,
    proposalStoreId: PROPOSAL_STORE_ID,
    proposalId: 'abc123',
    proposalNumber: 12,
    from: 'sender',
  });

  assert.equal(attachDaoPendingMetadata(pending, metadata), true);
  assert.deepEqual(pending[0], {
    txid: TXID,
    type: DAO_PROPOSAL_CREATE_TYPE,
    submittedts: 1,
    proposalStoreId: PROPOSAL_STORE_ID,
    proposalId: 'abc123',
    proposalNumber: 12,
    from: 'sender',
    action: '',
  });
});

test('injection and settlement toasts are distinct for proposal create', () => {
  assert.equal(
    getDaoPendingToastMessage(DAO_PROPOSAL_CREATE_TYPE, 'pending'),
    'Proposal submitted—pending confirmation',
  );
  assert.equal(
    getDaoPendingToastMessage(DAO_PROPOSAL_CREATE_TYPE, DAO_SETTLEMENT_OUTCOMES.SUCCESS),
    'Proposal confirmed',
  );
  assert.equal(
    getDaoPendingToastMessage(DAO_PROPOSAL_CREATE_TYPE, DAO_SETTLEMENT_OUTCOMES.FAILURE, {
      failureReason: 'insufficient funds',
    }),
    'Proposal creation failed: insufficient funds',
  );
  assert.equal(
    getDaoPendingToastMessage(DAO_PROPOSAL_CREATE_TYPE, DAO_SETTLEMENT_OUTCOMES.TIMEOUT),
    'Proposal confirmation is taking longer than expected',
  );
});

test('settlement with DAO list open refreshes repo and rerenders list, without navigation', async () => {
  const pendingTxInfo = createPendingCreate();
  const calls = [];

  const result = await settleDaoPendingTransaction({
    pendingTxInfo,
    outcome: DAO_SETTLEMENT_OUTCOMES.SUCCESS,
    refreshDao: async () => { calls.push('refreshDao'); },
    isDaoListOpen: () => true,
    getOpenProposalId: () => null,
    renderDaoList: () => { calls.push('renderDaoList'); },
    refreshProposalDetail: async () => { calls.push('refreshProposalDetail'); },
    showToast: (message, _duration, type) => { calls.push(`toast:${type}:${message}`); },
  });

  assert.deepEqual(calls, [
    'refreshDao',
    'renderDaoList',
    'toast:success:Proposal confirmed',
  ]);
  assert.equal(result.uiPlan.renderDaoList, true);
  assert.equal(result.uiPlan.refreshProposalDetail, false);
  assert.equal(result.uiPlan.forceNavigation, false);
});

test('settlement with matching proposal detail open refreshes detail in place', async () => {
  const pendingTxInfo = createPendingCreate();
  const calls = [];

  const result = await settleDaoPendingTransaction({
    pendingTxInfo,
    outcome: DAO_SETTLEMENT_OUTCOMES.SUCCESS,
    refreshDao: async () => { calls.push('refreshDao'); },
    isDaoListOpen: () => false,
    getOpenProposalId: () => PROPOSAL_STORE_ID,
    renderDaoList: () => { calls.push('renderDaoList'); },
    refreshProposalDetail: async (proposalStoreId) => {
      calls.push(`refreshProposalDetail:${proposalStoreId}`);
    },
    showToast: (message, _duration, type) => { calls.push(`toast:${type}:${message}`); },
  });

  assert.deepEqual(calls, [
    'refreshDao',
    `refreshProposalDetail:${PROPOSAL_STORE_ID}`,
    'toast:success:Proposal confirmed',
  ]);
  assert.equal(result.uiPlan.renderDaoList, false);
  assert.equal(result.uiPlan.refreshProposalDetail, true);
  assert.equal(result.uiPlan.forceNavigation, false);
});

test('settlement with DAO UI closed refreshes repo only and preserves navigation', async () => {
  const pendingTxInfo = createPendingCreate();
  const calls = [];

  const result = await settleDaoPendingTransaction({
    pendingTxInfo,
    outcome: DAO_SETTLEMENT_OUTCOMES.SUCCESS,
    refreshDao: async () => { calls.push('refreshDao'); },
    isDaoListOpen: () => false,
    getOpenProposalId: () => null,
    renderDaoList: () => { calls.push('renderDaoList'); },
    refreshProposalDetail: async () => { calls.push('refreshProposalDetail'); },
    showToast: (message, _duration, type) => { calls.push(`toast:${type}:${message}`); },
  });

  assert.deepEqual(calls, [
    'refreshDao',
    'toast:success:Proposal confirmed',
  ]);
  assert.deepEqual(result.uiPlan, {
    refreshRepo: true,
    renderDaoList: false,
    refreshProposalDetail: false,
    proposalStoreId: PROPOSAL_STORE_ID,
    forceNavigation: false,
  });
});

test('failed and timeout settlements refresh DAO data without treating timeout as confirmed failure', async () => {
  const pendingTxInfo = createPendingCreate();

  const failureCalls = [];
  await settleDaoPendingTransaction({
    pendingTxInfo,
    outcome: DAO_SETTLEMENT_OUTCOMES.FAILURE,
    failureReason: 'rejected by network',
    refreshDao: async () => { failureCalls.push('refreshDao'); },
    isDaoListOpen: () => true,
    getOpenProposalId: () => PROPOSAL_STORE_ID,
    renderDaoList: () => { failureCalls.push('renderDaoList'); },
    refreshProposalDetail: async () => { failureCalls.push('refreshProposalDetail'); },
    showToast: (message, _duration, type) => { failureCalls.push(`toast:${type}:${message}`); },
  });

  assert.deepEqual(failureCalls, [
    'refreshDao',
    'renderDaoList',
    'refreshProposalDetail',
    'toast:error:Proposal creation failed: rejected by network',
  ]);

  const timeoutCalls = [];
  await settleDaoPendingTransaction({
    pendingTxInfo,
    outcome: DAO_SETTLEMENT_OUTCOMES.TIMEOUT,
    refreshDao: async () => { timeoutCalls.push('refreshDao'); },
    isDaoListOpen: () => false,
    getOpenProposalId: () => null,
    renderDaoList: () => { timeoutCalls.push('renderDaoList'); },
    refreshProposalDetail: async () => { timeoutCalls.push('refreshProposalDetail'); },
    showToast: (message, _duration, type) => { timeoutCalls.push(`toast:${type}:${message}`); },
  });

  assert.deepEqual(timeoutCalls, [
    'refreshDao',
    'toast:warning:Proposal confirmation is taking longer than expected',
  ]);
});

test('ui plan ignores non-matching open proposal detail', () => {
  const plan = getDaoSettlementUiPlan({
    pendingTxInfo: createPendingCreate(),
    daoListOpen: true,
    openProposalId: '99_other',
  });

  assert.equal(plan.renderDaoList, true);
  assert.equal(plan.refreshProposalDetail, false);
  assert.equal(plan.forceNavigation, false);
});
