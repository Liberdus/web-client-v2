import { hashBytes } from './crypto.js';
import { utf82bin } from './lib.js';

// Shared DAO constants and light helper functions.
// Kept here so UI + repo can share one import surface.

export const DAO_ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const DAO_ARCHIVABLE_STATE_KEYS = ['withheld', 'rejected', 'accepted', 'applied'];

export const DAO_TYPE_OPTIONS = [
  { key: 'governance', label: 'Governance', group: 'Server proposal types' },
  { key: 'economic', label: 'Economic', group: 'Server proposal types' },
  { key: 'protocol', label: 'Protocol', group: 'Server proposal types' },
];

export const DAO_CONFIG_CHANGE_OPTIONS = {
  governance: [
    { key: 'claimDuration', path: 'current.dao.claimDuration', label: 'Claim Duration', valueType: 'integer' },
    { key: 'graceDuration', path: 'current.dao.graceDuration', label: 'Grace Duration', valueType: 'integer' },
    { key: 'minimumSpendUsdStr', path: 'current.dao.minimumSpendUsdStr', label: 'Minimum Vote Spend', valueType: 'float' },
    { key: 'pctBurned', path: 'current.dao.pctBurned', label: 'Percent Burned', valueType: 'integer' },
    { key: 'proposalFeeUsdStr', path: 'current.dao.proposalFeeUsdStr', label: 'Proposal Fee', valueType: 'float' },
    { key: 'reviewDuration', path: 'current.dao.reviewDuration', label: 'Review Duration', valueType: 'integer' },
    { key: 'voteExponent', path: 'current.dao.voteExponent', label: 'Vote Exponent', valueType: 'float' },
    { key: 'voteThresholdUsdStr', path: 'current.dao.voteThresholdUsdStr', label: 'Vote Threshold', valueType: 'float' },
    { key: 'votingDuration', path: 'current.dao.votingDuration', label: 'Voting Duration', valueType: 'integer' },
  ],
  economic: [
    { key: 'certCycleDuration', path: 'current.certCycleDuration', label: 'Certificate Cycle Duration', valueType: 'integer' },
    { key: 'enableNodeSlashing', path: 'current.enableNodeSlashing', label: 'Enable Node Slashing', valueType: 'boolean' },
    { key: 'maintenanceInterval', path: 'current.maintenanceInterval', label: 'Maintenance Interval', valueType: 'integer' },
    { key: 'messageMaxLength', path: 'current.messageMaxLength', label: 'Message Max Length', valueType: 'integer' },
    { key: 'messageRetentionDays', path: 'current.messageRetentionDays', label: 'Message Retention Days', valueType: 'integer' },
    { key: 'nodeRewardInterval', path: 'current.nodeRewardInterval', label: 'Node Reward Interval', valueType: 'integer' },
    { key: 'restakeCooldown', path: 'current.restakeCooldown', label: 'Restake Cooldown', valueType: 'integer' },
    { key: 'enableLeftNetworkEarlySlashing', path: 'current.slashing.enableLeftNetworkEarlySlashing', label: 'Enable Left Network Early Slashing', valueType: 'boolean' },
    { key: 'enableNodeRefutedSlashing', path: 'current.slashing.enableNodeRefutedSlashing', label: 'Enable Node Refuted Slashing', valueType: 'boolean' },
    { key: 'enableSyncTimeoutSlashing', path: 'current.slashing.enableSyncTimeoutSlashing', label: 'Enable Sync Timeout Slashing', valueType: 'boolean' },
    { key: 'leftNetworkEarlyPenaltyPercent', path: 'current.slashing.leftNetworkEarlyPenaltyPercent', label: 'Left Network Early Penalty Percent', valueType: 'float' },
    { key: 'nodeRefutedPenaltyPercent', path: 'current.slashing.nodeRefutedPenaltyPercent', label: 'Node Refuted Penalty Percent', valueType: 'float' },
    { key: 'syncTimeoutPenaltyPercent', path: 'current.slashing.syncTimeoutPenaltyPercent', label: 'Sync Timeout Penalty Percent', valueType: 'float' },
    { key: 'stabilityScaleDiv', path: 'current.stabilityScaleDiv', label: 'Stability Scale Divisor', valueType: 'integer' },
    { key: 'stabilityScaleMul', path: 'current.stabilityScaleMul', label: 'Stability Scale Multiplier', valueType: 'integer' },
    { key: 'stakeLockTime', path: 'current.stakeLockTime', label: 'Stake Lock Time', valueType: 'integer' },
    { key: 'tollNetworkTaxPercent', path: 'current.tollNetworkTaxPercent', label: 'Toll Network Tax Percent', valueType: 'integer' },
    { key: 'tollTimeout', path: 'current.tollTimeout', label: 'Toll Timeout', valueType: 'integer' },
    { key: 'txPause', path: 'current.txPause', label: 'Pause Transactions', valueType: 'boolean' },
  ],
  protocol: [
    { key: 'minNodes', path: 'config.p2p.minNodes', label: 'Min Nodes', valueType: 'integer' },
    { key: 'maxNodes', path: 'config.p2p.maxNodes', label: 'Max Nodes', valueType: 'integer' },
    { key: 'baselineNodes', path: 'config.p2p.baselineNodes', label: 'Baseline Nodes', valueType: 'integer' },
    { key: 'cycleDuration', path: 'config.p2p.cycleDuration', label: 'Cycle Duration', valueType: 'integer' },
    { key: 'allowEndUserTxnInjections', path: 'config.p2p.allowEndUserTxnInjections', label: 'Allow End User Transactions', valueType: 'boolean' },
    { key: 'amountToGrow', path: 'config.p2p.amountToGrow', label: 'Amount To Grow', valueType: 'integer' },
    { key: 'amountToShrink', path: 'config.p2p.amountToShrink', label: 'Amount To Shrink', valueType: 'integer' },
    { key: 'maxJoinedPerCycle', path: 'config.p2p.maxJoinedPerCycle', label: 'Max Joined Per Cycle', valueType: 'integer' },
    { key: 'maxDesiredMultiplier', path: 'config.p2p.maxDesiredMultiplier', label: 'Max Desired Multiplier', valueType: 'float' },
    { key: 'maxShrinkMultiplier', path: 'config.p2p.maxShrinkMultiplier', label: 'Max Shrink Multiplier', valueType: 'float' },
    { key: 'syncBoostEnabled', path: 'config.p2p.syncBoostEnabled', label: 'Sync Boost Enabled', valueType: 'boolean' },
    { key: 'limitRate', path: 'config.rateLimiting.limitRate', label: 'Limit Rate', valueType: 'boolean' },
    { key: 'nodesPerConsensusGroup', path: 'config.sharding.nodesPerConsensusGroup', label: 'Nodes Per Consensus Group', valueType: 'integer' },
    { key: 'voterPercentage', path: 'config.stateManager.voterPercentage', label: 'Voter Percentage', valueType: 'float' },
  ],
};

export const DAO_STATES = [
  { key: 'review', label: 'Review' },
  { key: 'withheld', label: 'Withheld' },
  { key: 'voting', label: 'Voting' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'applied', label: 'Applied' },
];

const DAO_PROPOSAL_DAY_MS = 24 * 60 * 60 * 1000;
const DAO_AFFIRMATIVE_OPTION_STRINGS = ['yes', 'accept', 'approve'];
const DAO_PROPOSALS_META_ID_STRING = 'dao proposals meta';
export const DAO_PROPOSAL_TITLE_MAX_LENGTH = 100;

export function getDaoTypeLabel(typeKey) {
  return DAO_TYPE_OPTIONS.find((t) => t.key === typeKey)?.label || typeKey || '';
}

export function getDaoStateLabel(key) {
  return DAO_STATES.find((s) => s.key === key)?.label || key;
}

export function getEffectiveDaoState(proposal) {
  return proposal?.status || proposal?.state || 'review';
}

const DAO_PROPOSAL_QUERY_BATCH_SIZE = 10;

function requireDaoDraftString(value, label, maxLength) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  if (Number.isSafeInteger(maxLength) && text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or less`);
  }
  return text;
}

function requireDaoNonNegativeNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return n;
}

function normalizeDaoDraftDayCount(value, label) {
  const n = Number(value || 0);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative whole number`);
  }
  return n;
}

function normalizeDaoDraftDurationMs(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${label} is required`);
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative whole number of milliseconds`);
  }
  return n;
}

function normalizeDaoDraftChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0) {
    throw new Error('At least one DAO parameter change is required');
  }

  return changes.map((change) => ({
    key: requireDaoDraftString(change?.key, 'DAO parameter key'),
    value: String(change?.value ?? '').trim(),
    current: String(change?.current ?? ''),
  }));
}

function normalizeDaoDraftOptions(options) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
    throw new Error('DAO proposal options must contain 2 to 10 entries');
  }

  const safeOptions = options.map((option) => requireDaoDraftString(option, 'DAO proposal option'));
  if (!DAO_AFFIRMATIVE_OPTION_STRINGS.includes(safeOptions[0].toLowerCase())) {
    throw new Error('The first DAO proposal option must be yes, accept, or approve');
  }
  return safeOptions;
}

function hashDaoString(value) {
  return hashBytes(utf82bin(value));
}

export function getDaoProposalsMetaId() {
  return hashDaoString(DAO_PROPOSALS_META_ID_STRING);
}

export function getDaoProposalAccountId(proposalNumber) {
  const n = normalizeDaoPositiveInteger(proposalNumber);
  if (!n) throw new Error('DAO proposal number must be a positive integer');
  return hashDaoString(`dao proposal #${n}`);
}

export function buildDaoProposalCreateDraft({
  from,
  displayTitle,
  emergency,
  proposalType,
  description,
  options,
  changes,
  proposalFeeUsdStr,
  startDelayDays,
  gracePeriodMs,
} = {}) {
  const safeProposalType = requireDaoDraftString(proposalType, 'DAO proposal type');
  if (!DAO_CONFIG_CHANGE_OPTIONS[safeProposalType]) {
    throw new Error('DAO proposal type is not supported');
  }

  const isEmergency = emergency === true;
  const feeUsdStr = isEmergency ? '0' : requireDaoDraftString(proposalFeeUsdStr, 'DAO proposal fee');
  const startDelayMs = normalizeDaoDraftDayCount(startDelayDays, 'Review start delay') * DAO_PROPOSAL_DAY_MS;
  const safeGracePeriodMs = normalizeDaoDraftDurationMs(gracePeriodMs, 'Grace period');
  const safeOptions = normalizeDaoDraftOptions(options);
  const safeChanges = normalizeDaoDraftChanges(changes);

  const transaction = {
    from: requireDaoDraftString(from, 'DAO proposal sender'),
    emergency: isEmergency,
    proposalType: safeProposalType,
    title: requireDaoDraftString(displayTitle, 'DAO proposal title', DAO_PROPOSAL_TITLE_MAX_LENGTH),
    description: requireDaoDraftString(description, 'DAO proposal description'),
    options: safeOptions,
    [safeProposalType]: { changes: safeChanges },
  };

  transaction.gracePeriod = safeGracePeriodMs;

  return {
    displayTitle: transaction.title,
    proposalFeeUsdStr: feeUsdStr,
    startDelayMs,
    transaction,
  };
}

export function buildDaoProposalCreateTransaction({
  draft,
  timestamp,
  networkId,
  proposalNumber,
} = {}) {
  const draftTx = draft?.transaction;
  if (!draftTx || typeof draftTx !== 'object') {
    throw new Error('DAO proposal draft is required');
  }

  const proposalType = requireDaoDraftString(draftTx.proposalType, 'DAO proposal type');
  if (!DAO_CONFIG_CHANGE_OPTIONS[proposalType]) {
    throw new Error('DAO proposal type is not supported');
  }

  const proposalId = getDaoProposalAccountId(proposalNumber);
  const txTimestamp = requireDaoNonNegativeNumber(timestamp, 'DAO proposal timestamp');
  if (txTimestamp <= 0) throw new Error('DAO proposal timestamp is required');
  const startDelayMs = requireDaoNonNegativeNumber(draft.startDelayMs ?? 0, 'Review start delay');
  const gracePeriod = requireDaoNonNegativeNumber(draftTx.gracePeriod, 'Grace period');

  const transaction = {
    ...draftTx,
    type: 'dao_proposal_create',
    timestamp: txTimestamp,
    networkId: requireDaoDraftString(networkId, 'Network ID'),
    proposalId,
    metaId: getDaoProposalsMetaId(),
    gracePeriod,
  };

  if (startDelayMs > 0) {
    transaction.startTime = txTimestamp + startDelayMs;
  }

  return transaction;
}

function getDaoProposalTransactionId(proposal) {
  return requireDaoDraftString(proposal?.accountId, 'DAO proposal account ID');
}

function buildDaoProposalActionTransaction({
  type,
  from,
  proposal,
  timestamp,
  networkId,
  timestampLabel,
  fromLabel,
} = {}) {
  const txTimestamp = requireDaoNonNegativeNumber(timestamp, timestampLabel);
  if (txTimestamp <= 0) throw new Error(`${timestampLabel} is required`);

  return {
    type: requireDaoDraftString(type, 'DAO transaction type'),
    timestamp: txTimestamp,
    networkId: requireDaoDraftString(networkId, 'Network ID'),
    from: requireDaoDraftString(from, fromLabel),
    proposalId: getDaoProposalTransactionId(proposal),
  };
}

export function buildDaoCommitteeVoteTransaction({
  from,
  proposal,
  vote,
  withheldReason,
  timestamp,
  networkId,
} = {}) {
  const safeVote = requireDaoDraftString(vote, 'Committee review vote');
  if (safeVote !== 'accept' && safeVote !== 'withhold') {
    throw new Error('Committee review vote must be accept or withhold');
  }
  const txTimestamp = requireDaoNonNegativeNumber(timestamp, 'Committee review timestamp');
  if (txTimestamp <= 0) throw new Error('Committee review timestamp is required');

  const transaction = {
    type: 'dao_committee_vote',
    timestamp: txTimestamp,
    networkId: requireDaoDraftString(networkId, 'Network ID'),
    from: requireDaoDraftString(from, 'Committee review sender'),
    proposalId: getDaoProposalTransactionId(proposal),
    vote: safeVote,
  };

  if (safeVote === 'withhold') {
    const reason = requireDaoDraftString(withheldReason, 'Withhold reason');
    if (reason.length > 1000) throw new Error('Withhold reason must be 1000 characters or less');
    transaction.withheldReason = reason;
  }

  return transaction;
}

export function buildDaoCommitteeResultTransaction({
  from,
  proposal,
  timestamp,
  networkId,
} = {}) {
  return buildDaoProposalActionTransaction({
    type: 'dao_committee_result',
    from,
    proposal,
    timestamp,
    networkId,
    timestampLabel: 'Review result timestamp',
    fromLabel: 'Review result sender',
  });
}

export function buildDaoVoteTransaction({
  from,
  proposal,
  weights,
  spend,
  timestamp,
  networkId,
} = {}) {
  const txTimestamp = requireDaoNonNegativeNumber(timestamp, 'Vote timestamp');
  if (txTimestamp <= 0) throw new Error('Vote timestamp is required');

  const options = Array.isArray(proposal?.options) ? proposal.options : [];
  if (options.length < 2 || options.length > 10) {
    throw new Error('DAO vote proposal options are required');
  }
  if (!Array.isArray(weights) || weights.length !== options.length) {
    throw new Error('Vote weights must match proposal options');
  }

  let totalWeight = 0;
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new Error('Vote weights must be non-negative whole numbers');
    }
    totalWeight += weight;
  }
  if (!Number.isSafeInteger(totalWeight) || totalWeight <= 0) {
    throw new Error('Vote weights must include at least one positive weight');
  }
  if (typeof spend !== 'bigint' || spend <= 0n) {
    throw new Error('Vote spend must be a positive LIB amount');
  }

  return {
    type: 'dao_vote',
    timestamp: txTimestamp,
    networkId: requireDaoDraftString(networkId, 'Network ID'),
    from: requireDaoDraftString(from, 'Vote sender'),
    proposalId: getDaoProposalTransactionId(proposal),
    weights: weights.slice(),
    spend,
  };
}

export function buildDaoVoteResultTransaction({
  from,
  proposal,
  timestamp,
  networkId,
} = {}) {
  return buildDaoProposalActionTransaction({
    type: 'dao_vote_result',
    from,
    proposal,
    timestamp,
    networkId,
    timestampLabel: 'Vote result timestamp',
    fromLabel: 'Vote result sender',
  });
}

export function buildDaoClaimRewardTransaction({
  from,
  proposal,
  timestamp,
  networkId,
} = {}) {
  return buildDaoProposalActionTransaction({
    type: 'dao_claim_reward',
    from,
    proposal,
    timestamp,
    networkId,
    timestampLabel: 'Reward claim timestamp',
    fromLabel: 'Reward claim sender',
  });
}

export function buildDaoBurnRewardTransaction({
  from,
  proposal,
  timestamp,
  networkId,
} = {}) {
  return buildDaoProposalActionTransaction({
    type: 'dao_burn_reward',
    from,
    proposal,
    timestamp,
    networkId,
    timestampLabel: 'Reward burn timestamp',
    fromLabel: 'Reward burn sender',
  });
}

export function buildDaoApplyParametersTransaction({
  from,
  proposal,
  timestamp,
  networkId,
} = {}) {
  return buildDaoProposalActionTransaction({
    type: 'dao_apply_parameters',
    from,
    proposal,
    timestamp,
    networkId,
    timestampLabel: 'Apply parameters timestamp',
    fromLabel: 'Apply parameters sender',
  });
}

async function submitDaoTransaction({ transaction, submitTransaction, errorMessage }) {
  try {
    if (typeof submitTransaction !== 'function') {
      throw new Error('DAO submit handler is required');
    }

    const response = await submitTransaction(transaction);
    if (!response?.result?.success) {
      return {
        ok: false,
        error: response?.result?.reason || errorMessage,
        response,
        transaction,
      };
    }

    return { ok: true, response, transaction };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || errorMessage,
      transaction,
    };
  }
}

async function submitDaoProposalAction({
  buildTransaction,
  from,
  proposal,
  timestamp,
  networkId,
  submitTransaction,
  errorMessage,
} = {}) {
  try {
    const transaction = buildTransaction({
      from,
      proposal,
      timestamp,
      networkId,
    });
    return submitDaoTransaction({
      transaction,
      submitTransaction,
      errorMessage,
    });
  } catch (error) {
    return { ok: false, error: error?.message || errorMessage, transaction: null };
  }
}

// In-memory DAO repository.
// Goal: UI uses this API while backend data loading stays behind this boundary.

function createEmptyDaoStore() {
  return {
    meta: { count: 0, active: 0, archived: 0 },
    activeProposals: [],
    archivedProposals: [],
    proposals: {},
  };
}

function daoProposalId(number, nonce) {
  return `${number}_${nonce}`;
}

function normalizeDaoPositiveInteger(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

function normalizeDaoTimestamp(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function getDaoProposalDescription(proposal) {
  return String(proposal?.description || '').trim();
}

function mapBackendProposalToStoreProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') return null;

  const number = normalizeDaoPositiveInteger(proposal.number);
  if (!number) return null;

  const accountId = String(proposal.id || '').trim();
  if (!accountId) return null;

  const nonce = accountId;
  const proposalType = String(proposal.proposalType || '').trim();
  if (!proposalType) return null;

  const state = getEffectiveDaoState(proposal);
  const created = normalizeDaoTimestamp(proposal.creationTime || proposal.created || proposal.timestamp);
  const stateChanged = normalizeDaoTimestamp(proposal.timestamp || proposal.state_changed || created);
  const description = getDaoProposalDescription(proposal);

  return {
    ...proposal,
    accountId,
    number,
    nonce,
    title: String(proposal.title || '').trim(),
    description,
    proposalType,
    state,
    status: state,
    state_changed: stateChanged,
    created,
  };
}

function getDaoStoreMeta(proposal) {
  return {
    number: proposal.number,
    title: proposal.title,
    state: proposal.state,
    status: proposal.status,
    state_changed: proposal.state_changed,
    proposalType: proposal.proposalType,
    nonce: proposal.nonce,
  };
}

function buildStoreFromBackendProposals(meta, proposals) {
  const store = createEmptyDaoStore();
  const safeMeta = meta && typeof meta === 'object' ? meta : {};

  store.meta = {
    ...safeMeta,
    count: Math.max(normalizeDaoPositiveInteger(safeMeta.count), proposals.length),
    active: 0,
    archived: 0,
  };

  for (const rawProposal of proposals) {
    const proposal = mapBackendProposalToStoreProposal(rawProposal);
    if (!proposal) continue;

    const id = daoProposalId(proposal.number, proposal.nonce);
    store.proposals[id] = proposal;
    store.activeProposals.push(getDaoStoreMeta(proposal));
  }

  return store;
}

async function fetchBackendProposal(queryDaoApi, proposalNumber) {
  const body = await queryDaoApi(`/dao/proposals/${proposalNumber}`);
  if (!body) {
    console.warn(`Skipping DAO proposal #${proposalNumber}: no response`);
    // TODO: Retry skipped proposal accounts after the initial list render.
    return null;
  }
  if (body.error || !body.proposal) {
    console.warn(`Skipping DAO proposal #${proposalNumber}: proposal unavailable`, body.error || body);
    // TODO: Retry skipped proposal accounts after the initial list render.
    return null;
  }
  return body.proposal;
}

export function createDaoBackendFetcher(queryDaoApi) {
  if (typeof queryDaoApi !== 'function') {
    return async () => createEmptyDaoStore();
  }

  return async () => {
    const body = await queryDaoApi('/dao/proposals/meta');
    if (!body) {
      throw new Error('Failed to load DAO proposal metadata');
    }
    if (body.error) {
      throw new Error(String(body.error));
    }

    const meta = body.meta && typeof body.meta === 'object' ? body.meta : null;
    const count = normalizeDaoPositiveInteger(meta?.count);
    if (!count) return buildStoreFromBackendProposals(meta, []);

    const proposals = [];
    for (let start = 1; start <= count; start += DAO_PROPOSAL_QUERY_BATCH_SIZE) {
      const end = Math.min(start + DAO_PROPOSAL_QUERY_BATCH_SIZE - 1, count);
      const batch = await Promise.all(
        Array.from({ length: end - start + 1 }, (_, index) => fetchBackendProposal(queryDaoApi, start + index))
      );
      proposals.push(...batch.filter(Boolean));
    }

    return buildStoreFromBackendProposals(meta, proposals);
  };
}

function normalizeDaoStore(store) {
  const safe = store && typeof store === 'object' ? store : createEmptyDaoStore();
  safe.meta = safe.meta && typeof safe.meta === 'object' ? safe.meta : { count: 0, active: 0, archived: 0 };
  safe.activeProposals = Array.isArray(safe.activeProposals) ? safe.activeProposals : [];
  safe.archivedProposals = Array.isArray(safe.archivedProposals) ? safe.archivedProposals : [];
  safe.proposals = safe.proposals && typeof safe.proposals === 'object' ? safe.proposals : {};

  // If store is missing count, reconstruct from proposals.
  if (!Number.isFinite(Number(safe.meta.count))) {
    const nums = Object.values(safe.proposals)
      .map((p) => Number(p?.number || 0))
      .filter((n) => n > 0);
    safe.meta.count = nums.length ? Math.max(...nums) : 0;
  }

  // Auto-archive proposals that have been in certain states for > 30 days.
  // Archived is a *category* (group), not a proposal state.
  const now = Date.now();
  const activeNext = [];
  const archivedIds = new Set(safe.archivedProposals.map((m) => daoProposalId(m.number, m.nonce)));

  for (const meta of safe.activeProposals) {
    const id = daoProposalId(meta.number, meta.nonce);
    const full = safe.proposals[id];
    if (!full) continue;

    const state = getEffectiveDaoState({ status: full.status || meta.status, state: full.state || meta.state });
    const enteredAt = Number(full.state_changed || meta.state_changed || full.created || 0);
    const isArchivable = DAO_ARCHIVABLE_STATE_KEYS.includes(state);

    if (isArchivable && enteredAt && now - enteredAt >= DAO_ARCHIVE_AFTER_MS) {
      const archivedAt = Number(full.archivedAt || (enteredAt + DAO_ARCHIVE_AFTER_MS));
      full.archivedAt = archivedAt;

      if (!archivedIds.has(id)) {
        safe.archivedProposals.push({
          number: meta.number,
          title: meta.title,
          state,
          state_changed: enteredAt,
          proposalType: meta.proposalType,
          nonce: meta.nonce,
        });
        archivedIds.add(id);
      }
      continue;
    }

    activeNext.push(meta);
  }

  safe.activeProposals = activeNext;

  // Remove archived metas whose full proposal no longer exists.
  safe.archivedProposals = safe.archivedProposals.filter((m) => {
    const id = daoProposalId(m.number, m.nonce);
    return Boolean(safe.proposals[id]);
  });

  safe.meta.active = safe.activeProposals.length;
  safe.meta.archived = safe.archivedProposals.length;
  safe.meta.count = Math.max(
    Number(safe.meta.count || 0),
    ...safe.activeProposals.map((m) => Number(m.number || 0)),
    ...safe.archivedProposals.map((m) => Number(m.number || 0))
  );

  return safe;
}

function storeToUiList(store, groupKey) {
  const safe = store || createEmptyDaoStore();
  const metas = groupKey === 'archived' ? safe.archivedProposals : safe.activeProposals;
  return metas
    .map((m) => {
      const id = daoProposalId(m.number, m.nonce);
      const p = safe.proposals?.[id];
      if (!p) return null;
      const description = p.description;
      const state = getEffectiveDaoState({ status: p.status || m.status, state: p.state || m.state });
      return {
        id,
        number: p.number,
        accountId: p.accountId,
        nonce: p.nonce,
        title: p.title,
        description,
        proposalType: p.proposalType,
        emergency: Boolean(p.emergency),
        createdAt: p.created,
        state,
        status: state,
        stateEnteredAt: p.state_changed,
        options: Array.isArray(p.options) ? p.options : ['yes', 'no'],
        totalVote: Array.isArray(p.totalVote) ? p.totalVote : undefined,
        committeeVotes: Array.isArray(p.committeeVotes) ? p.committeeVotes : [],
        committeeAddresses: Array.isArray(p.committeeAddresses) ? p.committeeAddresses : [],
        voterRewardPool: p.voterRewardPool,
        claimedReward: p.claimedReward,
        initialBurnedReward: p.initialBurnedReward,
        finalBurnedReward: p.finalBurnedReward,
        voterList: Array.isArray(p.voterList) ? p.voterList : [],
        claimList: Array.isArray(p.claimList) ? p.claimList : [],
        startTime: p.startTime,
        reviewDuration: p.reviewDuration,
        votingDuration: p.votingDuration,
        claimDuration: p.claimDuration,
        gracePeriod: p.gracePeriod,
        applyEligibleAt: p.applyEligibleAt,
        archivedAt: p.archivedAt || 0,
      };
    })
    .filter(Boolean);
}

let _store = null;
let _loadingPromise = null;

// Backend integration hook. The fetcher should return the DAO store shape
// consumed by this repository: meta, activeProposals, archivedProposals, proposals.
let _backendFetcher = null;

export function setDaoBackendFetcher(fetcher) {
  _backendFetcher = typeof fetcher === 'function' ? fetcher : null;
}

async function refreshInternal({ force } = {}) {
  if (_loadingPromise && !force) return _loadingPromise;
  if (_store && !force) return _store;

  const previousStore = _store;

  _loadingPromise = (async () => {
    try {
      const next = _backendFetcher ? await _backendFetcher() : createEmptyDaoStore();
      _store = normalizeDaoStore(next);
      return _store;
    } catch (error) {
      _store = previousStore || normalizeDaoStore(createEmptyDaoStore());
      throw error;
    }
  })();

  try {
    return await _loadingPromise;
  } finally {
    _loadingPromise = null;
  }
}

export const daoRepo = {
  isReady() {
    return Boolean(_store);
  },

  async refresh({ force } = {}) {
    return refreshInternal({ force: Boolean(force) });
  },

  async ensureLoaded() {
    return refreshInternal({ force: false });
  },

  getProposalById(proposalId) {
    return _store?.proposals?.[proposalId] || null;
  },

  getProposalsForUi(groupKey) {
    return storeToUiList(_store, groupKey || 'active');
  },

  async createProposal({ draft, timestamp, networkId, submitTransaction } = {}) {
    let transaction = null;
    let proposalNumber = 0;
    let proposalStoreId = '';

    try {
      if (typeof submitTransaction !== 'function') {
        throw new Error('DAO proposal submit handler is required');
      }

      const store = await refreshInternal({ force: true });
      proposalNumber = normalizeDaoPositiveInteger(store?.meta?.count) + 1;
      transaction = buildDaoProposalCreateTransaction({
        draft,
        timestamp,
        networkId,
        proposalNumber,
      });
      proposalStoreId = daoProposalId(proposalNumber, transaction.proposalId);

      const response = await submitTransaction(transaction);
      if (!response?.result?.success) {
        return {
          ok: false,
          error: response?.result?.reason || 'Proposal submission failed',
          response,
          proposalNumber,
          proposalStoreId,
          transaction,
        };
      }

      return {
        ok: true,
        response,
        proposalNumber,
        proposalStoreId,
        transaction,
      };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || 'Proposal submission failed',
        proposalNumber,
        proposalStoreId,
        transaction,
      };
    }
  },

  async castVote({ from, proposal, weights, spend, timestamp, networkId, submitTransaction } = {}) {
    try {
      const transaction = buildDaoVoteTransaction({
        from,
        proposal,
        weights,
        spend,
        timestamp,
        networkId,
      });
      return submitDaoTransaction({
        transaction,
        submitTransaction,
        errorMessage: 'Vote submission failed',
      });
    } catch (error) {
      return { ok: false, error: error?.message || 'Vote submission failed', transaction: null };
    }
  },

  async submitCommitteeVote({ from, proposal, vote, withheldReason, timestamp, networkId, submitTransaction } = {}) {
    try {
      const transaction = buildDaoCommitteeVoteTransaction({
        from,
        proposal,
        vote,
        withheldReason,
        timestamp,
        networkId,
      });
      return submitDaoTransaction({
        transaction,
        submitTransaction,
        errorMessage: 'Committee review submission failed',
      });
    } catch (error) {
      return { ok: false, error: error?.message || 'Committee review submission failed', transaction: null };
    }
  },

  async finalizeCommitteeResult({ from, proposal, timestamp, networkId, submitTransaction } = {}) {
    return submitDaoProposalAction({
      buildTransaction: buildDaoCommitteeResultTransaction,
      from,
      proposal,
      timestamp,
      networkId,
      submitTransaction,
      errorMessage: 'Review result finalization failed',
    });
  },

  async finalizeVoteResult({ from, proposal, timestamp, networkId, submitTransaction } = {}) {
    return submitDaoProposalAction({
      buildTransaction: buildDaoVoteResultTransaction,
      from,
      proposal,
      timestamp,
      networkId,
      submitTransaction,
      errorMessage: 'Vote result finalization failed',
    });
  },

  async claimReward({ from, proposal, timestamp, networkId, submitTransaction } = {}) {
    return submitDaoProposalAction({
      buildTransaction: buildDaoClaimRewardTransaction,
      from,
      proposal,
      timestamp,
      networkId,
      submitTransaction,
      errorMessage: 'Reward claim failed',
    });
  },

  async burnReward({ from, proposal, timestamp, networkId, submitTransaction } = {}) {
    return submitDaoProposalAction({
      buildTransaction: buildDaoBurnRewardTransaction,
      from,
      proposal,
      timestamp,
      networkId,
      submitTransaction,
      errorMessage: 'Reward burn failed',
    });
  },

  async applyParameters({ from, proposal, timestamp, networkId, submitTransaction } = {}) {
    return submitDaoProposalAction({
      buildTransaction: buildDaoApplyParametersTransaction,
      from,
      proposal,
      timestamp,
      networkId,
      submitTransaction,
      errorMessage: 'Apply parameters failed',
    });
  },
};
