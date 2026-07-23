/**
 * Receipt-driven DAO pending settlement helpers.
 *
 * #1464 wires proposal creation. #1465 can extend the same helpers for
 * committee/vote/claim/apply actions without inventing a second pattern.
 */

export const DAO_PROPOSAL_CREATE_TYPE = 'dao_proposal_create';

export const DAO_SETTLEMENT_OUTCOMES = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  TIMEOUT: 'timeout',
});

const DAO_PROPOSAL_CREATE_TOASTS = Object.freeze({
  pending: 'Proposal submitted—pending confirmation',
  success: 'Proposal confirmed',
  timeout: 'Proposal confirmation is taking longer than expected',
});

export function isDaoPendingType(type) {
  return typeof type === 'string' && type.startsWith('dao_');
}

export function isDaoProposalCreatePending(pendingTxInfo) {
  return pendingTxInfo?.type === DAO_PROPOSAL_CREATE_TYPE;
}

/**
 * Build pending metadata recorded after injection is accepted.
 * Keep this shape stable so #1465 can reuse the same fields (plus action).
 */
export function buildDaoPendingMetadata({
  type,
  txid,
  proposalStoreId = '',
  proposalId = '',
  proposalNumber = 0,
  from = '',
  action = '',
} = {}) {
  if (!type || !txid) {
    throw new Error('DAO pending metadata requires type and txid');
  }

  return {
    type,
    txid,
    proposalStoreId: proposalStoreId || '',
    proposalId: proposalId || '',
    proposalNumber: Number(proposalNumber) || 0,
    from: from || '',
    action: action || '',
  };
}

/**
 * Attach DAO-specific fields onto an existing myData.pending entry.
 * Returns true when an entry was updated.
 */
export function attachDaoPendingMetadata(pendingList, metadata) {
  if (!Array.isArray(pendingList) || !metadata?.txid) return false;

  const index = pendingList.findIndex((entry) => entry?.txid === metadata.txid);
  if (index === -1) return false;

  const current = pendingList[index] || {};
  pendingList[index] = {
    ...current,
    type: metadata.type || current.type,
    proposalStoreId: metadata.proposalStoreId || current.proposalStoreId || '',
    proposalId: metadata.proposalId || current.proposalId || '',
    proposalNumber: metadata.proposalNumber || current.proposalNumber || 0,
    from: metadata.from || current.from || '',
    action: metadata.action || current.action || '',
  };
  return true;
}

export function getDaoPendingToastMessage(type, outcome, { failureReason = '' } = {}) {
  if (type === DAO_PROPOSAL_CREATE_TYPE) {
    if (outcome === DAO_SETTLEMENT_OUTCOMES.SUCCESS) return DAO_PROPOSAL_CREATE_TOASTS.success;
    if (outcome === DAO_SETTLEMENT_OUTCOMES.TIMEOUT) return DAO_PROPOSAL_CREATE_TOASTS.timeout;
    if (outcome === DAO_SETTLEMENT_OUTCOMES.FAILURE) {
      return failureReason
        ? `Proposal creation failed: ${failureReason}`
        : 'Proposal creation failed';
    }
    return DAO_PROPOSAL_CREATE_TOASTS.pending;
  }

  return '';
}

/**
 * Pure plan for which DAO surfaces to update after settlement.
 * Never forces navigation or modal opens.
 */
export function getDaoSettlementUiPlan({
  pendingTxInfo,
  daoListOpen = false,
  openProposalId = null,
} = {}) {
  const proposalStoreId = pendingTxInfo?.proposalStoreId || '';
  const matchingDetailOpen = Boolean(
    openProposalId && proposalStoreId && openProposalId === proposalStoreId
  );

  return {
    refreshRepo: true,
    renderDaoList: Boolean(daoListOpen),
    refreshProposalDetail: matchingDetailOpen,
    proposalStoreId,
    forceNavigation: false,
  };
}

/**
 * Apply a settlement outcome: refresh DAO data, update open surfaces, toast.
 * Caller is responsible for removing the pending entry.
 */
export async function settleDaoPendingTransaction({
  pendingTxInfo,
  outcome,
  failureReason = '',
  refreshDao,
  isDaoListOpen,
  getOpenProposalId,
  renderDaoList,
  refreshProposalDetail,
  showToast,
} = {}) {
  if (!pendingTxInfo?.type) {
    throw new Error('DAO settlement requires pending transaction info');
  }
  if (!Object.values(DAO_SETTLEMENT_OUTCOMES).includes(outcome)) {
    throw new Error(`Unknown DAO settlement outcome: ${outcome}`);
  }
  if (typeof refreshDao !== 'function') {
    throw new Error('DAO settlement requires refreshDao');
  }

  const uiPlan = getDaoSettlementUiPlan({
    pendingTxInfo,
    daoListOpen: typeof isDaoListOpen === 'function' ? Boolean(isDaoListOpen()) : false,
    openProposalId: typeof getOpenProposalId === 'function' ? getOpenProposalId() : null,
  });

  let refreshError = null;
  try {
    await refreshDao();
  } catch (error) {
    refreshError = error;
    console.warn('DAO settlement refresh failed:', error);
  }

  if (uiPlan.renderDaoList && typeof renderDaoList === 'function') {
    renderDaoList();
  }

  if (uiPlan.refreshProposalDetail && typeof refreshProposalDetail === 'function') {
    await refreshProposalDetail(uiPlan.proposalStoreId);
  }

  if (typeof showToast === 'function') {
    const message = getDaoPendingToastMessage(pendingTxInfo.type, outcome, { failureReason });
    if (message) {
      if (outcome === DAO_SETTLEMENT_OUTCOMES.SUCCESS) {
        showToast(message, 3000, 'success');
      } else if (outcome === DAO_SETTLEMENT_OUTCOMES.FAILURE) {
        showToast(message, 0, 'error');
      } else if (outcome === DAO_SETTLEMENT_OUTCOMES.TIMEOUT) {
        showToast(message, 0, 'warning');
      }
    }
  }

  return {
    outcome,
    uiPlan,
    refreshError,
  };
}
