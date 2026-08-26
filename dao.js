import { hashBytes } from './crypto.js';
import { normalizeAddress, utf82bin } from './lib.js';

// Shared DAO constants and light helper functions.
// Kept here so UI + repo can share one import surface.

const DAO_REWARD_STATE_KEYS = ['accepted', 'rejected', 'applied'];

export const DAO_PROJECT_TYPE = 'project';
export const DAO_PROJECT_PREVIEW_KIND = 'project-preview';
export const DAO_PROJECT_MAX_MILESTONES = 10;
export const DAO_PROJECT_MILESTONE_TITLE_MAX_LENGTH = 100;
export const DAO_PROJECT_MILESTONE_TEXT_MAX_LENGTH = 1000;
export const DAO_PROJECT_DURATION_MAX_DAYS = 3650;

export const DAO_TYPE_OPTIONS = [
  { key: 'governance', label: 'Governance', group: 'Server proposal types' },
  { key: 'economic', label: 'Economic', group: 'Server proposal types' },
  { key: 'protocol', label: 'Protocol', group: 'Server proposal types' },
  { key: DAO_PROJECT_TYPE, label: 'Project', group: 'Preview proposal types' },
];

export const DAO_PARAMETER_MAX_WHOLE_DIGITS = 15;

const DAO_DECIMAL_STRING_PATTERN = /^(?:0|[1-9]\d{0,14})(?:\.\d{1,18})?$/;

export function normalizeDaoParameterInput(value) {
  let text = String(value ?? '');
  if (/^\.\d*$/.test(text)) text = `0${text}`;

  const [wholePart, ...decimalParts] = text.split('.');
  if (!/^\d+$/.test(wholePart)) return text;
  return [wholePart.slice(0, DAO_PARAMETER_MAX_WHOLE_DIGITS), ...decimalParts].join('.');
}

export function isValidDaoDecimalString(value) {
  return DAO_DECIMAL_STRING_PATTERN.test(String(value ?? '').trim());
}

export const DAO_CONFIG_CHANGE_OPTIONS = {
  governance: [
    { key: 'claimDuration', path: 'current.dao.claimDuration', label: 'Claim Duration', valueType: 'number', validation: 'integer' },
    { key: 'graceDuration', path: 'current.dao.graceDuration', label: 'Grace Duration', valueType: 'number', validation: 'integer' },
    { key: 'minimumSpendUsdStr', path: 'current.dao.minimumSpendUsdStr', label: 'Minimum Vote Spend', valueType: 'string', validation: 'decimalString' },
    { key: 'pctBurned', path: 'current.dao.pctBurned', label: 'Percent Burned', valueType: 'number', validation: 'integer' },
    { key: 'proposalFeeUsdStr', path: 'current.dao.proposalFeeUsdStr', label: 'Proposal Fee', valueType: 'string', validation: 'decimalString' },
    { key: 'reviewDuration', path: 'current.dao.reviewDuration', label: 'Review Duration', valueType: 'number', validation: 'integer' },
    { key: 'voteExponent', path: 'current.dao.voteExponent', label: 'Vote Exponent', valueType: 'number', validation: 'decimal' },
    { key: 'voteThresholdUsdStr', path: 'current.dao.voteThresholdUsdStr', label: 'Vote Threshold', valueType: 'string', validation: 'decimalString' },
    { key: 'votingDuration', path: 'current.dao.votingDuration', label: 'Voting Duration', valueType: 'number', validation: 'integer' },
  ],
  economic: [
    { key: 'certCycleDuration', path: 'current.certCycleDuration', label: 'Certificate Cycle Duration', valueType: 'number', validation: 'integer' },
    { key: 'enableNodeSlashing', path: 'current.enableNodeSlashing', label: 'Enable Node Slashing', valueType: 'boolean', validation: 'boolean' },
    { key: 'maintenanceInterval', path: 'current.maintenanceInterval', label: 'Maintenance Interval', valueType: 'number', validation: 'integer' },
    { key: 'messageMaxLength', path: 'current.messageMaxLength', label: 'Message Max Length', valueType: 'number', validation: 'integer' },
    { key: 'messageRetentionDays', path: 'current.messageRetentionDays', label: 'Message Retention Days', valueType: 'number', validation: 'integer' },
    { key: 'nodeRewardInterval', path: 'current.nodeRewardInterval', label: 'Node Reward Interval', valueType: 'number', validation: 'integer' },
    { key: 'restakeCooldown', path: 'current.restakeCooldown', label: 'Restake Cooldown', valueType: 'number', validation: 'integer' },
    { key: 'enableLeftNetworkEarlySlashing', path: 'current.slashing.enableLeftNetworkEarlySlashing', label: 'Enable Left Network Early Slashing', valueType: 'boolean', validation: 'boolean' },
    { key: 'enableNodeRefutedSlashing', path: 'current.slashing.enableNodeRefutedSlashing', label: 'Enable Node Refuted Slashing', valueType: 'boolean', validation: 'boolean' },
    { key: 'enableSyncTimeoutSlashing', path: 'current.slashing.enableSyncTimeoutSlashing', label: 'Enable Sync Timeout Slashing', valueType: 'boolean', validation: 'boolean' },
    { key: 'leftNetworkEarlyPenaltyPercent', path: 'current.slashing.leftNetworkEarlyPenaltyPercent', label: 'Left Network Early Penalty Percent', valueType: 'number', validation: 'decimal' },
    { key: 'nodeRefutedPenaltyPercent', path: 'current.slashing.nodeRefutedPenaltyPercent', label: 'Node Refuted Penalty Percent', valueType: 'number', validation: 'decimal' },
    { key: 'syncTimeoutPenaltyPercent', path: 'current.slashing.syncTimeoutPenaltyPercent', label: 'Sync Timeout Penalty Percent', valueType: 'number', validation: 'decimal' },
    { key: 'stabilityScaleDiv', path: 'current.stabilityScaleDiv', label: 'Stability Scale Divisor', valueType: 'number', validation: 'integer' },
    { key: 'stabilityScaleMul', path: 'current.stabilityScaleMul', label: 'Stability Scale Multiplier', valueType: 'number', validation: 'integer' },
    { key: 'stakeLockTime', path: 'current.stakeLockTime', label: 'Stake Lock Time', valueType: 'number', validation: 'integer' },
    { key: 'tollNetworkTaxPercent', path: 'current.tollNetworkTaxPercent', label: 'Toll Network Tax Percent', valueType: 'number', validation: 'integer' },
    { key: 'tollTimeout', path: 'current.tollTimeout', label: 'Toll Timeout', valueType: 'number', validation: 'integer' },
    { key: 'txPause', path: 'current.txPause', label: 'Pause Transactions', valueType: 'boolean', validation: 'boolean' },
  ],
  protocol: [
    { key: 'minNodes', path: 'config.p2p.minNodes', label: 'Min Nodes', valueType: 'number', validation: 'integer' },
    { key: 'maxNodes', path: 'config.p2p.maxNodes', label: 'Max Nodes', valueType: 'number', validation: 'integer' },
    { key: 'baselineNodes', path: 'config.p2p.baselineNodes', label: 'Baseline Nodes', valueType: 'number', validation: 'integer' },
    { key: 'cycleDuration', path: 'config.p2p.cycleDuration', label: 'Cycle Duration', valueType: 'number', validation: 'integer' },
    { key: 'allowEndUserTxnInjections', path: 'config.p2p.allowEndUserTxnInjections', label: 'Allow End User Transactions', valueType: 'boolean', validation: 'boolean' },
    { key: 'amountToGrow', path: 'config.p2p.amountToGrow', label: 'Amount To Grow', valueType: 'number', validation: 'integer' },
    { key: 'amountToShrink', path: 'config.p2p.amountToShrink', label: 'Amount To Shrink', valueType: 'number', validation: 'integer' },
    { key: 'maxJoinedPerCycle', path: 'config.p2p.maxJoinedPerCycle', label: 'Max Joined Per Cycle', valueType: 'number', validation: 'integer' },
    { key: 'maxDesiredMultiplier', path: 'config.p2p.maxDesiredMultiplier', label: 'Max Desired Multiplier', valueType: 'number', validation: 'decimal' },
    { key: 'maxShrinkMultiplier', path: 'config.p2p.maxShrinkMultiplier', label: 'Max Shrink Multiplier', valueType: 'number', validation: 'decimal' },
    { key: 'syncBoostEnabled', path: 'config.p2p.syncBoostEnabled', label: 'Sync Boost Enabled', valueType: 'boolean', validation: 'boolean' },
    { key: 'limitRate', path: 'config.rateLimiting.limitRate', label: 'Limit Rate', valueType: 'boolean', validation: 'boolean' },
    { key: 'nodesPerConsensusGroup', path: 'config.sharding.nodesPerConsensusGroup', label: 'Nodes Per Consensus Group', valueType: 'number', validation: 'integer' },
    { key: 'voterPercentage', path: 'config.stateManager.voterPercentage', label: 'Voter Percentage', valueType: 'number', validation: 'decimal' },
  ],
};

export function isDaoParameterProposalTypeKey(proposalType) {
  return Object.prototype.hasOwnProperty.call(
    DAO_CONFIG_CHANGE_OPTIONS,
    String(proposalType || ''),
  );
}

function parseDaoDecimalString(value, label) {
  const text = value.trim();
  if (!isValidDaoDecimalString(text)) throw new Error(`${label} must be a non-negative number`);
  const [whole, fraction = ''] = text.split('.');
  return { whole, fraction };
}

export function addDaoDecimalStrings(values) {
  if (!Array.isArray(values)) throw new Error('DAO decimal values must be an array');
  if (values.length === 0) return '0';

  const parsed = values.map((value) => parseDaoDecimalString(value, 'DAO decimal value'));
  const scale = Math.max(...parsed.map(({ fraction }) => fraction.length));
  const total = parsed.reduce((sum, { whole, fraction }) => (
    sum + BigInt(`${whole}${fraction.padEnd(scale, '0')}`)
  ), 0n);
  const digits = total.toString().padStart(scale + 1, '0');
  if (scale === 0) return digits;

  const fraction = digits.slice(-scale).replace(/0+$/, '');
  const whole = digits.slice(0, -scale);
  return fraction ? `${whole}.${fraction}` : whole;
}

function getDaoProjectBudgetValue(value) {
  const text = String(value ?? '').trim();
  return isValidDaoDecimalString(text) ? text : '0';
}

export function getDaoProjectBudgetSummary(milestones) {
  const entries = Array.isArray(milestones) ? milestones : [];
  const baseCostUsdStr = addDaoDecimalStrings(
    entries.map((milestone) => getDaoProjectBudgetValue(milestone?.costUsdStr)),
  );
  const maximumBonusUsdStr = addDaoDecimalStrings(
    entries.map((milestone) => getDaoProjectBudgetValue(milestone?.bonusUsdStr)),
  );

  return {
    baseCostUsdStr,
    maximumBonusUsdStr,
    maximumAuthorizedUsdStr: addDaoDecimalStrings([baseCostUsdStr, maximumBonusUsdStr]),
  };
}

export const DAO_STATES = [
  { key: 'review', label: 'Review' },
  { key: 'withheld', label: 'Withheld' },
  { key: 'voting', label: 'Voting' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'applied', label: 'Applied' },
];

export const DAO_PROJECT_FILTERS = [
  { key: 'executing', label: 'Executing' },
  { key: 'terminated', label: 'Terminated' },
  { key: 'completed', label: 'Completed' },
];

const DAO_PROJECT_STATUS_FILTER_KEYS = new Map([
  ['started', 'executing'],
  ['terminated', 'terminated'],
  ['completed', 'completed'],
]);

const DAO_NON_FILTER_STATE_LABELS = new Map([
  ['canceled', 'Canceled'],
]);

export const DAO_PROPOSAL_DAY_MS = 24 * 60 * 60 * 1000;
export const DAO_PROPOSAL_GRACE_PERIOD_MAX_MS = 999_999_999_999;
const DAO_PROPOSAL_MAX_DATE_MS = 100_000_000 * DAO_PROPOSAL_DAY_MS; // ECMAScript Date limit.
const DAO_PROPOSALS_META_ID_STRING = 'dao proposals meta';
export const DAO_PROPOSAL_TITLE_MAX_LENGTH = 100;
export const DAO_PROPOSAL_CREATE_TYPE = 'dao_proposal_create';

export const DAO_ACTION_TYPES = Object.freeze({
  COMMITTEE_VOTE: 'dao_committee_vote',
  COMMITTEE_RESULT: 'dao_committee_result',
  VOTE: 'dao_vote',
  VOTE_RESULT: 'dao_vote_result',
  CLAIM_REWARD: 'dao_claim_reward',
  BURN_REWARD: 'dao_burn_reward',
  APPLY_PARAMETERS: 'dao_apply_parameters',
});

const DAO_LIFECYCLE_KIND_TO_TYPE = Object.freeze({
  vote_result: DAO_ACTION_TYPES.VOTE_RESULT,
  claim_reward: DAO_ACTION_TYPES.CLAIM_REWARD,
  burn_reward: DAO_ACTION_TYPES.BURN_REWARD,
  apply_parameters: DAO_ACTION_TYPES.APPLY_PARAMETERS,
});

const DAO_TRANSACTION_MESSAGES = Object.freeze({
  [DAO_PROPOSAL_CREATE_TYPE]: {
    pending: 'Proposal submitted—pending confirmation',
    success: 'Proposal confirmed',
    failure: 'Proposal creation failed',
    timeout: 'Proposal confirmation is taking longer than expected',
  },
  [DAO_ACTION_TYPES.COMMITTEE_VOTE]: {
    pending: 'Committee review submitted—pending confirmation',
    success: 'Committee review confirmed',
    failure: 'Committee review failed',
    timeout: 'Committee review confirmation is taking longer than expected',
  },
  [DAO_ACTION_TYPES.COMMITTEE_RESULT]: {
    pending: 'Review result submitted—pending confirmation',
    success: 'Review result confirmed',
    failure: 'Review result failed',
    timeout: 'Review result confirmation is taking longer than expected',
  },
  [DAO_ACTION_TYPES.VOTE]: {
    pending: 'Vote submitted—pending confirmation',
    success: 'Vote confirmed',
    failure: 'Vote failed',
    timeout: 'Vote confirmation is taking longer than expected',
  },
  [DAO_ACTION_TYPES.VOTE_RESULT]: {
    pending: 'Vote result submitted—pending confirmation',
    success: 'Vote result confirmed',
    failure: 'Vote result failed',
    timeout: 'Vote result confirmation is taking longer than expected',
  },
  [DAO_ACTION_TYPES.CLAIM_REWARD]: {
    pending: 'Reward claim submitted—pending confirmation',
    success: 'Reward claim confirmed',
    failure: 'Reward claim failed',
    timeout: 'Reward claim confirmation is taking longer than expected',
  },
  [DAO_ACTION_TYPES.BURN_REWARD]: {
    pending: 'Reward burn submitted—pending confirmation',
    success: 'Reward burn confirmed',
    failure: 'Reward burn failed',
    timeout: 'Reward burn confirmation is taking longer than expected',
  },
  [DAO_ACTION_TYPES.APPLY_PARAMETERS]: {
    pending: 'Parameter apply submitted—pending confirmation',
    success: 'Parameters applied',
    failure: 'Parameter apply failed',
    timeout: 'Parameter apply confirmation is taking longer than expected',
  },
});

const DAO_TRANSACTION_TYPE_SET = new Set(Object.keys(DAO_TRANSACTION_MESSAGES));

export function isDaoTransactionType(type) {
  return DAO_TRANSACTION_TYPE_SET.has(type);
}

export function getDaoTypeForLifecycleKind(kind) {
  return DAO_LIFECYCLE_KIND_TO_TYPE[kind] || '';
}

export function hasPendingDaoAction(pendingList, type, proposalStoreId, from) {
  if (!Array.isArray(pendingList) || !type || !proposalStoreId || !from) return false;

  return pendingList.some((entry) => {
    if (!entry || entry.type !== type) return false;
    if (entry.proposalStoreId !== proposalStoreId) return false;
    return entry.from === from;
  });
}

export function getDaoTransactionMessage(type, outcome) {
  const messages = DAO_TRANSACTION_MESSAGES[type];
  if (!messages) throw new Error(`Unknown DAO transaction type: ${type}`);

  const message = messages[outcome];
  if (!message) throw new Error(`Unknown DAO transaction outcome: ${outcome}`);

  return message;
}
export function getDaoTypeLabel(typeKey) {
  return DAO_TYPE_OPTIONS.find((t) => t.key === typeKey)?.label || typeKey || '';
}

function getDaoDefaultProposalOptionLabel(proposalType) {
  return proposalType === DAO_PROJECT_TYPE ? 'Reject' : 'No change';
}

export function getDaoProposalOptionLabels(proposal) {
  const options = Array.isArray(proposal?.options) ? proposal.options : [];
  const firstOptionLabel = getDaoDefaultProposalOptionLabel(proposal?.proposalType);
  return options.map((option, index) => (
    index === 0 && String(option).toLowerCase() === 'no' ? firstOptionLabel : String(option)
  ));
}

export function getDaoStateLabel(key) {
  return DAO_STATES.find((state) => state.key === key)?.label
    || DAO_NON_FILTER_STATE_LABELS.get(key)
    || key;
}

export function getEffectiveDaoState(proposal) {
  return proposal?.status || proposal?.state || 'review';
}

export function getDaoProposalListFilterKey(proposal) {
  const proposalState = getEffectiveDaoState(proposal);
  if (proposal?.proposalType !== DAO_PROJECT_TYPE) return proposalState;

  const projectStatus = String(proposal?.project?.status || '').trim().toLowerCase();
  const projectFilterKey = DAO_PROJECT_STATUS_FILTER_KEYS.get(projectStatus);
  if (projectFilterKey) return projectFilterKey;

  // Applied is reserved for parameter changes. A malformed or not-yet-started
  // Project remains available through All instead of appearing as Applied.
  return proposalState === 'applied' ? '' : proposalState;
}

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

function normalizeDaoDraftInteger(value, label, unit = '') {
  const text = String(value ?? '').trim();
  const unitSuffix = unit ? ` of ${unit}` : '';
  if (!/^\d+$/.test(text)) throw new Error(`${label} must be a non-negative whole number${unitSuffix}`);

  const n = Number(text);
  if (!Number.isSafeInteger(n)) throw new Error(`${label} is too large`);
  return n;
}

function normalizeDaoDraftGracePeriodMs(value, maxGracePeriodMs) {
  const gracePeriodMs = normalizeDaoDraftInteger(value, 'Grace period', 'milliseconds');
  const configuredMaximumMs = normalizeDaoDraftInteger(maxGracePeriodMs, 'Maximum grace period', 'milliseconds');
  const maximumMs = Math.min(configuredMaximumMs, DAO_PROPOSAL_GRACE_PERIOD_MAX_MS);
  if (gracePeriodMs > maximumMs) {
    throw new Error(`Grace period must not exceed ${maximumMs} milliseconds`);
  }
  return gracePeriodMs;
}

function normalizeDaoDraftReviewStartTime(value) {
  const startTime = normalizeDaoDraftInteger(value, 'Review start time', 'milliseconds');
  if (startTime > 0 && Number.isNaN(new Date(startTime).getTime())) {
    throw new Error('Review start time must be a valid date');
  }
  return startTime;
}

function getDaoProposalLifecycleDurationMs({
  emergency = false,
  reviewDuration,
  votingDuration,
  claimDuration,
  gracePeriod,
} = {}) {
  const reviewDurationMs = normalizeDaoDraftInteger(reviewDuration, 'Review duration', 'milliseconds');
  const votingDurationMs = normalizeDaoDraftInteger(votingDuration, 'Voting duration', 'milliseconds');
  const claimDurationMs = normalizeDaoDraftInteger(claimDuration, 'Claim duration', 'milliseconds');
  const gracePeriodMs = normalizeDaoDraftInteger(gracePeriod, 'Grace period', 'milliseconds');
  // claimEnd and applyEligibleAt both start at claimStart, so reserve whichever finishes later.
  const durationMs = reviewDurationMs
    + (emergency === true ? 0 : votingDurationMs)
    + Math.max(claimDurationMs, gracePeriodMs);
  if (!Number.isSafeInteger(durationMs)) throw new Error('DAO proposal lifecycle duration is too large');
  return durationMs;
}

function normalizeDaoDraftChanges(changes, actionOptionCount) {
  if (!Array.isArray(changes) || changes.length !== actionOptionCount) {
    throw new Error('DAO proposal changes must match its action options');
  }

  let templateKeys = null;
  return changes.map((changeSet, optionIndex) => {
    if (!Array.isArray(changeSet) || changeSet.length === 0) {
      throw new Error(`DAO proposal option ${optionIndex + 1} needs parameter changes`);
    }

    const seenKeys = new Set();
    const normalizedChangeSet = changeSet.map((change) => {
      const key = requireDaoDraftString(change?.key, 'DAO parameter key');
      if (seenKeys.has(key)) throw new Error(`DAO proposal option ${optionIndex + 1} has duplicate ${key} changes`);
      seenKeys.add(key);
      return {
        key,
        value: requireDaoDraftString(change?.value, 'DAO parameter value'),
        current: String(change?.current ?? ''),
      };
    });

    const keys = normalizedChangeSet.map((change) => change.key);
    if (templateKeys && (keys.length !== templateKeys.length || keys.some((key, index) => key !== templateKeys[index]))) {
      throw new Error('DAO proposal action options must use the same parameters');
    }
    templateKeys = keys;
    return normalizedChangeSet;
  });
}

function normalizeDaoDraftOptions(options, emergency) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
    throw new Error('DAO proposal options must contain 2 to 10 entries');
  }

  const safeOptions = options.map((option) => requireDaoDraftString(option, 'DAO proposal option'));
  if (safeOptions[0].toLowerCase() !== 'no') {
    throw new Error('The first DAO proposal option must be no change');
  }
  if (emergency === true && safeOptions.length !== 2) {
    throw new Error('Emergency DAO proposals need exactly one action option');
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
  reviewStartTimeMs,
  gracePeriodMs,
  maxGracePeriodMs,
} = {}) {
  const safeProposalType = requireDaoDraftString(proposalType, 'DAO proposal type');
  if (!isDaoParameterProposalTypeKey(safeProposalType)) {
    throw new Error('DAO proposal type is not supported');
  }

  const isEmergency = emergency === true;
  const safeOptions = normalizeDaoDraftOptions(options, isEmergency);
  const safeChanges = normalizeDaoDraftChanges(changes, safeOptions.length - 1);
  const feeUsdStr = isEmergency ? '0' : requireDaoDraftString(proposalFeeUsdStr, 'DAO proposal fee');
  const transaction = {
    from: requireDaoDraftString(from, 'DAO proposal sender'),
    emergency: isEmergency,
    proposalType: safeProposalType,
    title: requireDaoDraftString(displayTitle, 'DAO proposal title', DAO_PROPOSAL_TITLE_MAX_LENGTH),
    description: requireDaoDraftString(description, 'DAO proposal description'),
    options: safeOptions,
    gracePeriod: normalizeDaoDraftGracePeriodMs(gracePeriodMs, maxGracePeriodMs),
    [safeProposalType]: { changes: safeChanges },
  };

  return {
    displayTitle: transaction.title,
    proposalFeeUsdStr: feeUsdStr,
    reviewStartTimeMs: normalizeDaoDraftReviewStartTime(reviewStartTimeMs),
    transaction,
  };
}

export function buildDaoProjectProposalPreviewDraft({
  displayTitle,
  description,
  project,
  proposalFeeUsdStr,
  reviewStartTimeMs,
  gracePeriodMs,
  maxGracePeriodMs,
} = {}) {
  const proposal = {
    proposalType: DAO_PROJECT_TYPE,
    emergency: false,
    title: requireDaoDraftString(displayTitle, 'DAO proposal title', DAO_PROPOSAL_TITLE_MAX_LENGTH),
    description: requireDaoDraftString(description, 'DAO proposal description'),
    options: ['no', 'Fund project'],
    gracePeriod: normalizeDaoDraftGracePeriodMs(gracePeriodMs, maxGracePeriodMs),
    project: normalizeDaoProjectDraft(project),
  };

  return {
    kind: DAO_PROJECT_PREVIEW_KIND,
    canSubmit: false,
    displayTitle: proposal.title,
    proposalFeeUsdStr: requireDaoProjectUsdString(proposalFeeUsdStr, 'DAO proposal fee'),
    reviewStartTimeMs: normalizeDaoDraftReviewStartTime(reviewStartTimeMs),
    proposal,
  };
}

export function buildDaoProposalCreateTransaction({
  draft,
  timestamp,
  networkId,
  proposalNumber,
  maxGracePeriodMs,
  proposalDurations,
} = {}) {
  const draftTx = draft?.transaction;
  if (!draftTx || typeof draftTx !== 'object') {
    throw new Error('DAO proposal draft is required');
  }

  const proposalType = requireDaoDraftString(draftTx.proposalType, 'DAO proposal type');
  if (!isDaoParameterProposalTypeKey(proposalType)) {
    throw new Error('DAO proposal type is not supported');
  }

  const emergency = draftTx.emergency === true;
  const options = normalizeDaoDraftOptions(draftTx.options, emergency);
  const changes = normalizeDaoDraftChanges(draftTx[proposalType]?.changes, options.length - 1);
  const proposalId = getDaoProposalAccountId(proposalNumber);
  const txTimestamp = normalizeDaoDraftInteger(timestamp, 'DAO proposal timestamp', 'milliseconds');
  if (txTimestamp <= 0) throw new Error('DAO proposal timestamp is required');
  const reviewStartTimeMs = normalizeDaoDraftReviewStartTime(draft.reviewStartTimeMs ?? 0);
  const gracePeriod = normalizeDaoDraftGracePeriodMs(draftTx.gracePeriod, maxGracePeriodMs);
  const transaction = {
    type: DAO_PROPOSAL_CREATE_TYPE,
    timestamp: txTimestamp,
    networkId: requireDaoDraftString(networkId, 'Network ID'),
    from: requireDaoDraftString(draftTx.from, 'DAO proposal sender'),
    emergency,
    proposalType,
    title: requireDaoDraftString(draftTx.title, 'DAO proposal title', DAO_PROPOSAL_TITLE_MAX_LENGTH),
    description: requireDaoDraftString(draftTx.description, 'DAO proposal description'),
    options,
    gracePeriod,
    [proposalType]: { changes },
    proposalId,
    metaId: getDaoProposalsMetaId(),
  };

  // The server expects an absolute Unix timestamp, not a duration from txTimestamp.
  // Derive it from the validated draft field and never include arbitrary draft fields.
  const reviewStart = reviewStartTimeMs || txTimestamp;
  const lifecycleDurationMs = getDaoProposalLifecycleDurationMs({
    ...proposalDurations,
    emergency: transaction.emergency,
    gracePeriod,
  });
  if (reviewStart > DAO_PROPOSAL_MAX_DATE_MS - lifecycleDurationMs) {
    throw new Error('DAO proposal lifecycle must end on a valid date');
  }
  if (reviewStartTimeMs > 0) {
    if (reviewStartTimeMs < txTimestamp) {
      throw new Error('Review start time must not be earlier than the proposal timestamp');
    }
    transaction.startTime = reviewStartTimeMs;
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
    type: DAO_ACTION_TYPES.COMMITTEE_VOTE,
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
    type: DAO_ACTION_TYPES.COMMITTEE_RESULT,
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
    type: DAO_ACTION_TYPES.VOTE,
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
    type: DAO_ACTION_TYPES.VOTE_RESULT,
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
    type: DAO_ACTION_TYPES.CLAIM_REWARD,
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
    type: DAO_ACTION_TYPES.BURN_REWARD,
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
    type: DAO_ACTION_TYPES.APPLY_PARAMETERS,
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
    meta: { count: 0, proposals: [] },
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

// Mirrors the authoritative helpers in Liberdus/server src/accounts/daoProposalAccount.ts.
export function getDaoProposalTimeline(proposal) {
  const reviewStart = Number(proposal?.startTime);
  const reviewDuration = Number(proposal?.reviewDuration);
  const votingDuration = Number(proposal?.votingDuration);
  const claimDuration = Number(proposal?.claimDuration);
  const gracePeriod = Number(proposal?.gracePeriod);
  const durations = [reviewDuration, votingDuration, claimDuration, gracePeriod];
  if (reviewStart <= 0 || !Number.isFinite(reviewStart)
    || durations.some((duration) => duration < 0 || !Number.isFinite(duration))) {
    return null;
  }

  const reviewEnd = reviewStart + reviewDuration;
  const votingStart = Number(proposal?.votingStartedAt ?? reviewEnd);
  const votingEnd = proposal?.emergency
    ? votingStart
    : votingStart + votingDuration;
  const claimStart = Number(proposal?.votingEndedAt ?? votingEnd);
  if (votingStart <= 0 || !Number.isFinite(votingStart)
    || claimStart <= 0 || !Number.isFinite(claimStart)) return null;

  return {
    reviewStart,
    reviewEnd,
    votingStart,
    votingEnd,
    claimStart,
    claimEnd: claimStart + claimDuration,
    applyEligibleAt: claimStart + gracePeriod,
    votingDuration,
  };
}

export function getDaoVoteReminderSchedule(proposal) {
  const timeline = getDaoProposalTimeline(proposal);
  if (!timeline) return null;

  const estimatedClaimEndsAt = timeline.votingEnd + Number(proposal.claimDuration);
  const reminderExpiresAt = estimatedClaimEndsAt + DAO_PROPOSAL_DAY_MS;
  if (!Number.isSafeInteger(timeline.votingEnd)
    || !Number.isSafeInteger(estimatedClaimEndsAt)
    || !Number.isSafeInteger(reminderExpiresAt)) return null;

  return {
    votingEndsAt: timeline.votingEnd,
    estimatedClaimEndsAt,
    reminderExpiresAt,
  };
}

export function normalizeDaoAddress(value) {
  const address = String(value || '').trim();
  if (!/^(?:0x)?[0-9a-fA-F]{40}(?:0{24})?$/.test(address)) return '';
  return normalizeAddress(address);
}

function createDaoProjectValidationError(message, field, milestoneIndex) {
  const error = new Error(message);
  error.daoProjectField = field;
  if (Number.isSafeInteger(milestoneIndex)) error.daoProjectMilestoneIndex = milestoneIndex;
  return error;
}

function requireDaoProjectText(value, label, maxLength, field, milestoneIndex) {
  try {
    return requireDaoDraftString(value, label, maxLength);
  } catch (error) {
    throw createDaoProjectValidationError(error.message, field, milestoneIndex);
  }
}

function requireDaoProjectUsdString(value, label, {
  field,
  milestoneIndex,
  positive = false,
} = {}) {
  const text = String(value ?? '').trim();
  if (!isValidDaoDecimalString(text)) {
    throw createDaoProjectValidationError(
      `${label} must be a non-negative USD amount`,
      field,
      milestoneIndex,
    );
  }
  if (positive && /^0(?:\.0+)?$/.test(text)) {
    throw createDaoProjectValidationError(`${label} must be greater than zero`, field, milestoneIndex);
  }
  return text;
}

export function normalizeDaoProjectDraft(value) {
  const normalizedAddress = normalizeDaoAddress(value?.address);
  if (!normalizedAddress) {
    throw createDaoProjectValidationError(
      'Project recipient must be a valid Liberdus address',
      'address',
    );
  }

  const milestones = value?.milestones;
  if (!Array.isArray(milestones) || milestones.length === 0) {
    throw createDaoProjectValidationError('Project needs at least one milestone', 'milestones');
  }
  if (milestones.length > DAO_PROJECT_MAX_MILESTONES) {
    throw createDaoProjectValidationError(
      `Project can have at most ${DAO_PROJECT_MAX_MILESTONES} milestones`,
      'milestones',
    );
  }

  return {
    address: `${normalizedAddress}${'0'.repeat(24)}`,
    milestones: milestones.map((milestone, index) => {
      const label = `Milestone ${index + 1}`;
      const durationText = String(milestone?.durationDays ?? '').trim();
      if (!/^[1-9]\d*$/.test(durationText)) {
        throw createDaoProjectValidationError(
          `${label} duration must be a positive whole number of days`,
          'durationDays',
          index,
        );
      }
      const durationDays = Number(durationText);
      if (!Number.isSafeInteger(durationDays) || durationDays > DAO_PROJECT_DURATION_MAX_DAYS) {
        throw createDaoProjectValidationError(
          `${label} duration must not exceed ${DAO_PROJECT_DURATION_MAX_DAYS} days`,
          'durationDays',
          index,
        );
      }

      return {
        title: requireDaoProjectText(
          milestone?.title,
          `${label} title`,
          DAO_PROJECT_MILESTONE_TITLE_MAX_LENGTH,
          'title',
          index,
        ),
        description: requireDaoProjectText(
          milestone?.description,
          `${label} description`,
          DAO_PROJECT_MILESTONE_TEXT_MAX_LENGTH,
          'description',
          index,
        ),
        deliverable: requireDaoProjectText(
          milestone?.deliverable,
          `${label} deliverable`,
          DAO_PROJECT_MILESTONE_TEXT_MAX_LENGTH,
          'deliverable',
          index,
        ),
        durationDays,
        costUsdStr: requireDaoProjectUsdString(milestone?.costUsdStr, `${label} cost`, {
          field: 'costUsdStr',
          milestoneIndex: index,
          positive: true,
        }),
        penaltyUsdStr: requireDaoProjectUsdString(milestone?.penaltyUsdStr, `${label} late penalty`, {
          field: 'penaltyUsdStr',
          milestoneIndex: index,
        }),
        bonusUsdStr: requireDaoProjectUsdString(milestone?.bonusUsdStr, `${label} early bonus`, {
          field: 'bonusUsdStr',
          milestoneIndex: index,
        }),
      };
    }),
  };
}

const DAO_PROJECT_STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  started: 'Started',
  completed: 'Completed',
  terminated: 'Terminated',
});

export function getDaoProposalInfoStateLabel(proposal) {
  const proposalState = getEffectiveDaoState(proposal);
  const proposalStateLabel = getDaoStateLabel(proposalState) || proposalState || 'Proposal';
  if (proposal?.proposalType !== DAO_PROJECT_TYPE || proposalState !== 'applied') {
    return proposalStateLabel;
  }

  const projectStatus = String(proposal?.project?.status || '').trim().toLowerCase();
  return DAO_PROJECT_STATUS_LABELS[projectStatus] || proposalStateLabel;
}

const DAO_PROJECT_RUNTIME_STATUS_KEYS = new Set(['started', 'terminated', 'completed']);

const DAO_PROJECT_MILESTONE_STATUS_LABELS = Object.freeze({
  pending: 'Pending',
  started: 'Started',
  completed: 'Completed',
});

function normalizeDaoProjectPresentationText(value, maxLength, issues, label) {
  if (typeof value !== 'string') {
    issues.push(`${label} is unavailable`);
    return null;
  }
  const text = String(value ?? '').trim();
  if (!text) {
    issues.push(`${label} is unavailable`);
    return null;
  }
  if (text.length > maxLength) {
    issues.push(`${label} exceeds the supported length`);
    return text.slice(0, maxLength);
  }
  return text;
}

function normalizeDaoProjectPresentationUsd(value, issues, label) {
  const text = String(value ?? '').trim();
  if (!isValidDaoDecimalString(text)) {
    issues.push(`${label} is unavailable`);
    return null;
  }
  return text;
}

function normalizeDaoProjectPresentationStatus(value, labels, issues, label) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) {
    issues.push(`${label} is unavailable`);
    return null;
  }
  if (!labels[key]) {
    issues.push(`${label} is unknown`);
    return null;
  }
  return { key, label: labels[key] };
}

function normalizeDaoProjectPresentationTimestamp(value, issues, label) {
  if (value === undefined || value === null || value === '') return null;
  const timestamp = normalizeDaoTimestamp(value);
  if (!timestamp) issues.push(`${label} is unavailable`);
  return timestamp || null;
}

function normalizeDaoProjectPresentationWei(value, issues, label, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) issues.push(`${label} is unavailable`);
    return null;
  }
  const amount = parseDaoUnsignedBigInt(value);
  if (amount === null) issues.push(`${label} is unavailable`);
  return amount;
}

function normalizeDaoProjectPresentationMilestone(value, index, issues) {
  const milestone = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const label = `Milestone ${index + 1}`;
  if (milestone !== value) issues.push(`${label} is malformed`);

  const durationDays = Number(milestone.durationDays);
  const normalizedDurationDays = Number.isSafeInteger(durationDays)
    && durationDays > 0
    && durationDays <= DAO_PROJECT_DURATION_MAX_DAYS
    ? durationDays
    : null;
  if (normalizedDurationDays === null) issues.push(`${label} duration is unavailable`);

  let paid = null;
  if (typeof milestone.paid === 'boolean') {
    paid = milestone.paid;
  } else {
    issues.push(`${label} paid state is unavailable`);
  }

  return {
    title: normalizeDaoProjectPresentationText(
      milestone.title,
      DAO_PROJECT_MILESTONE_TITLE_MAX_LENGTH,
      issues,
      `${label} title`,
    ),
    description: normalizeDaoProjectPresentationText(
      milestone.description,
      DAO_PROJECT_MILESTONE_TEXT_MAX_LENGTH,
      issues,
      `${label} description`,
    ),
    deliverable: normalizeDaoProjectPresentationText(
      milestone.deliverable,
      DAO_PROJECT_MILESTONE_TEXT_MAX_LENGTH,
      issues,
      `${label} deliverable`,
    ),
    durationDays: normalizedDurationDays,
    costUsdStr: normalizeDaoProjectPresentationUsd(milestone.costUsdStr, issues, `${label} cost`),
    penaltyUsdStr: normalizeDaoProjectPresentationUsd(milestone.penaltyUsdStr, issues, `${label} penalty`),
    bonusUsdStr: normalizeDaoProjectPresentationUsd(milestone.bonusUsdStr, issues, `${label} bonus`),
    status: normalizeDaoProjectPresentationStatus(
      milestone.status,
      DAO_PROJECT_MILESTONE_STATUS_LABELS,
      issues,
      `${label} status`,
    ),
    startedAt: normalizeDaoProjectPresentationTimestamp(milestone.startedAt, issues, `${label} start time`),
    completedAt: normalizeDaoProjectPresentationTimestamp(milestone.completedAt, issues, `${label} completion time`),
    paid,
    paidAt: normalizeDaoProjectPresentationTimestamp(milestone.paidAt, issues, `${label} paid time`),
    payoutWei: normalizeDaoProjectPresentationWei(milestone.payoutWei, issues, `${label} payout`),
  };
}

export function getDaoProjectPresentation(proposal) {
  const project = proposal?.project;
  if (proposal?.proposalType !== DAO_PROJECT_TYPE
    || !project
    || typeof project !== 'object'
    || Array.isArray(project)) {
    return Object.freeze({
      kind: 'unavailable',
      message: 'Project details are unavailable for this proposal.',
    });
  }

  const issues = [];
  const address = normalizeDaoAddress(project.address);
  if (!address) issues.push('Project recipient is unavailable');

  const rawMilestones = Array.isArray(project.milestones) ? project.milestones : [];
  if (!Array.isArray(project.milestones)) issues.push('Project milestones are unavailable');
  if (rawMilestones.length === 0) issues.push('Project has no milestones');
  if (rawMilestones.length > DAO_PROJECT_MAX_MILESTONES) {
    issues.push(`Project exceeds ${DAO_PROJECT_MAX_MILESTONES} milestones`);
  }

  const milestones = rawMilestones
    .slice(0, DAO_PROJECT_MAX_MILESTONES)
    .map((milestone, index) => normalizeDaoProjectPresentationMilestone(milestone, index, issues));
  const canCalculateBudget = milestones.length > 0
    && milestones.every((milestone) => (
      milestone.costUsdStr !== null && milestone.bonusUsdStr !== null
    ));
  const status = normalizeDaoProjectPresentationStatus(
    project.status,
    DAO_PROJECT_STATUS_LABELS,
    issues,
    'Project status',
  );
  const balanceWei = normalizeDaoProjectPresentationWei(project.balance, issues, 'Project balance', true);
  const claimableBalanceWei = normalizeDaoProjectPresentationWei(
    project.claimableBalance,
    issues,
    'Project claimable balance',
    true,
  );

  return Object.freeze({
    kind: 'available',
    completeness: issues.length === 0 ? 'complete' : 'partial',
    issueCount: issues.length,
    address: address || null,
    status,
    balanceWei,
    claimableBalanceWei,
    budget: canCalculateBudget ? getDaoProjectBudgetSummary(milestones) : null,
    milestones,
  });
}

export function shouldOpenDaoProjectMilestoneByDefault(project, proposalState, milestoneIndex) {
  if (proposalState === 'review' || proposalState === 'voting') return true;
  if (project?.status?.key !== 'started' || !Array.isArray(project.milestones)) return false;
  return project.milestones.findIndex((milestone) => milestone?.status?.key === 'started') === milestoneIndex;
}

export function shouldShowDaoProjectMilestoneRuntime(project) {
  return DAO_PROJECT_RUNTIME_STATUS_KEYS.has(project?.status?.key);
}

function normalizeDaoVoteReminderSchedule(value) {
  const votingEndsAt = normalizeDaoTimestamp(value?.votingEndsAt);
  const estimatedClaimEndsAt = normalizeDaoTimestamp(value?.estimatedClaimEndsAt);
  const reminderExpiresAt = normalizeDaoTimestamp(value?.reminderExpiresAt);
  if (!votingEndsAt || estimatedClaimEndsAt < votingEndsAt
    || reminderExpiresAt < estimatedClaimEndsAt) return null;

  return { votingEndsAt, estimatedClaimEndsAt, reminderExpiresAt };
}

function normalizeDaoUserVotes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const normalized = {};
  for (const [proposalKey, entry] of Object.entries(value)) {
    const proposalNumber = normalizeDaoPositiveInteger(proposalKey);
    if (!proposalNumber || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;

    const normalizedEntry = {};
    const reminderSchedule = normalizeDaoVoteReminderSchedule(entry);
    if (reminderSchedule) Object.assign(normalizedEntry, reminderSchedule);

    const claimStart = normalizeDaoTimestamp(entry.claimStart);
    const claimEnd = normalizeDaoTimestamp(entry.claimEnd);
    if (claimStart && claimEnd >= claimStart) {
      Object.assign(normalizedEntry, { claimStart, claimEnd });
    }
    normalized[proposalNumber] = normalizedEntry;
  }
  return normalized;
}

function hasDaoUserVoteClaimWindow(entry) {
  return Boolean(entry?.claimStart && entry.claimEnd >= entry.claimStart);
}

export function createDaoProposalVoteTracker({
  getDaoUserVotes,
  setDaoUserVotes,
}) {
  if (typeof getDaoUserVotes !== 'function' || typeof setDaoUserVotes !== 'function') {
    throw new TypeError('DAO vote tracker requires account vote state accessors');
  }

  function readVotes() {
    try {
      return normalizeDaoUserVotes(getDaoUserVotes());
    } catch {
      return {};
    }
  }

  function writeVotes(votes) {
    try {
      setDaoUserVotes(votes);
    } catch {
      // Vote history is optional; account-state failures must not block DAO actions.
    }
  }

  function getPendingClaimProposalNumbers() {
    return Object.entries(readVotes())
      .filter(([, entry]) => !hasDaoUserVoteClaimWindow(entry))
      .map(([proposalNumber]) => Number(proposalNumber));
  }

  function getOpenClaimProposalNumbers(now = Date.now()) {
    const timestamp = normalizeDaoTimestamp(now);
    if (!timestamp) return [];

    const votes = readVotes();
    const unexpiredVotes = Object.fromEntries(
      Object.entries(votes).filter(([, entry]) => (
        !hasDaoUserVoteClaimWindow(entry) || timestamp <= entry.claimEnd
      )),
    );
    if (Object.keys(unexpiredVotes).length !== Object.keys(votes).length) {
      writeVotes(unexpiredVotes);
    }

    return Object.entries(unexpiredVotes)
      .filter(([, entry]) => (
        hasDaoUserVoteClaimWindow(entry)
        && timestamp >= entry.claimStart
      ))
      .map(([proposalNumber]) => Number(proposalNumber));
  }

  function setAuthoritativeClaimWindow(proposalNumber, claimStart, claimEnd) {
    const number = normalizeDaoPositiveInteger(proposalNumber);
    const normalizedClaimStart = normalizeDaoTimestamp(claimStart);
    const normalizedClaimEnd = normalizeDaoTimestamp(claimEnd);
    if (!number || !normalizedClaimStart || normalizedClaimEnd < normalizedClaimStart) return;

    const current = readVotes();
    if (!Object.prototype.hasOwnProperty.call(current, number)) return;

    const currentWindow = current[number];
    if (currentWindow.claimStart === normalizedClaimStart
      && currentWindow.claimEnd === normalizedClaimEnd) return;

    writeVotes({
      ...current,
      [number]: {
        ...currentWindow,
        claimStart: normalizedClaimStart,
        claimEnd: normalizedClaimEnd,
      },
    });
  }

  function handleSettlement({
    type,
    outcome,
    proposalNumber,
    votingEndsAt,
    estimatedClaimEndsAt,
    reminderExpiresAt,
  }) {
    if (outcome !== 'success') return;
    if (type !== DAO_ACTION_TYPES.VOTE && type !== DAO_ACTION_TYPES.CLAIM_REWARD) return;

    const number = normalizeDaoPositiveInteger(proposalNumber);
    if (!number) return;

    const current = readVotes();
    const isTracked = Object.prototype.hasOwnProperty.call(current, number);

    if (type === DAO_ACTION_TYPES.VOTE) {
      const reminderSchedule = normalizeDaoVoteReminderSchedule({
        votingEndsAt,
        estimatedClaimEndsAt,
        reminderExpiresAt,
      });
      if (isTracked && normalizeDaoVoteReminderSchedule(current[number])) return;
      writeVotes({
        ...current,
        [number]: {
          ...current[number],
          ...reminderSchedule,
        },
      });
      return;
    }

    if (isTracked) {
      const next = { ...current };
      delete next[number];
      writeVotes(next);
    }
  }

  return Object.freeze({
    getPendingClaimProposalNumbers,
    getOpenClaimProposalNumbers,
    handleSettlement,
    setAuthoritativeClaimWindow,
  });
}

export function parseDaoUnsignedBigInt(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'bigint') return value >= 0n ? value : null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'object') {
    if (value.dataType !== 'bi') return null;
    const hexText = String(value.value ?? '').trim();
    if (!/^[0-9a-f]+$/i.test(hexText)) return null;
    return BigInt(`0x${hexText}`);
  }

  const text = String(value).trim();
  if (!text) return null;
  try {
    const parsed = BigInt(text);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function getDaoFinalVoteResult(proposal) {
  const state = getEffectiveDaoState(proposal);
  if (!DAO_REWARD_STATE_KEYS.includes(state)) return null;

  const totalVote = Array.isArray(proposal?.totalVote)
    ? proposal.totalVote.map((value) => parseDaoUnsignedBigInt(value) ?? 0n)
    : [];
  if (totalVote.length === 0) return null;

  const storedWinnerIndex = proposal?.winningOptionIndex;
  const winnerIndex = Number.isInteger(storedWinnerIndex)
    && storedWinnerIndex >= 0
    && storedWinnerIndex < totalVote.length
    ? storedWinnerIndex
    : totalVote.reduce(
      (winner, total, index) => (total > totalVote[winner] ? index : winner),
      0
    );
  const totalWeight = totalVote.reduce((sum, total) => sum + total, 0n);
  const isRejected = state === 'rejected';

  return {
    outcome: isRejected ? 'Rejected' : 'Accepted',
    tone: isRejected ? 'rejected' : 'accepted',
    totalWeight,
    winnerIndex,
  };
}

function hasZeroDaoVoteTotals(proposal) {
  const totalVote = proposal?.totalVote;
  return Array.isArray(totalVote)
    && totalVote.length > 0
    && totalVote.every((weight) => parseDaoUnsignedBigInt(weight) === 0n);
}

// Mirrors the server's default finalization behavior when no one participates.
export function getDaoPendingFinalizationOutcome(proposal, now = Date.now()) {
  const timeline = getDaoProposalTimeline(proposal);
  if (!timeline) return null;

  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) return null;

  const state = getEffectiveDaoState(proposal);
  if (state === 'review' && timestamp > timeline.reviewEnd) {
    const committeeVotes = Array.isArray(proposal?.committeeVotes) ? proposal.committeeVotes : [];
    if (committeeVotes.length === 0) {
      if (proposal?.emergency) {
        return {
          nextState: 'withheld',
          message: 'No committee votes were cast. Finalizing the review withholds this proposal.',
        };
      }
      return {
        nextState: 'voting',
        message: 'No committee votes were cast. Finalizing the review moves this proposal to Voting.',
      };
    }
  }

  if (state === 'voting' && timestamp > timeline.votingEnd && hasZeroDaoVoteTotals(proposal)) {
    const defaultOptionLabel = getDaoDefaultProposalOptionLabel(proposal?.proposalType);
    return {
      nextState: 'rejected',
      message: `No votes were cast. Finalizing the vote result rejects this proposal because the default ${defaultOptionLabel} option wins.`,
    };
  }

  return null;
}

export function getDaoProposalClaimWindow(proposal) {
  const timeline = getDaoProposalTimeline(proposal);
  if (!timeline) {
    return { start: null, end: null, votingStart: null, votingDuration: null };
  }

  return {
    start: timeline.claimStart,
    end: timeline.claimEnd,
    votingStart: timeline.votingStart,
    votingDuration: timeline.votingDuration,
  };
}

export function getDaoRewardClaimStatus(proposal, currentAddress, now = Date.now()) {
  const normalizedAddress = normalizeDaoAddress(currentAddress);
  if (!normalizedAddress) return 'Account unavailable';

  const state = getEffectiveDaoState(proposal);
  if (state === 'withheld') return 'Reward pool burned';
  if (!DAO_REWARD_STATE_KEYS.includes(state)) return 'Voting not finalized';

  const voterList = Array.isArray(proposal?.voterList) ? proposal.voterList : [];
  const voted = voterList.some((voter) => normalizeDaoAddress(voter?.address) === normalizedAddress);
  if (!voted) return 'Not eligible';

  const claimList = Array.isArray(proposal?.claimList) ? proposal.claimList : [];
  const alreadyClaimed = claimList.some((address) => normalizeDaoAddress(address) === normalizedAddress);
  if (alreadyClaimed) return 'Already claimed';

  const pool = parseDaoUnsignedBigInt(proposal?.voterRewardPool) ?? 0n;
  const claimed = parseDaoUnsignedBigInt(proposal?.claimedReward) ?? 0n;
  if (pool <= 0n) return 'Reward pool empty';
  if (claimed >= pool) return 'Reward pool fully claimed';

  const claimWindow = getDaoProposalClaimWindow(proposal);
  if (!claimWindow.end) return 'Claim timing unavailable';
  if (now > claimWindow.end) return 'Claim window ended';
  if (now < claimWindow.start) return 'Claim window not open';
  return 'Claimable';
}

function normalizeDaoProposalMetadataEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const proposal = normalizeDaoPositiveInteger(entry.proposal);
  const status = String(entry.status || '').trim();
  const timestamp = normalizeDaoTimestamp(entry.timestamp);
  if (!proposal || !status || !timestamp) return null;

  return {
    proposal,
    status,
    emergencyFlag: entry.emergencyFlag === true,
    timestamp,
  };
}

function normalizeDaoProposalIndexEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(normalizeDaoProposalMetadataEntry)
    .filter(Boolean);
}

export function getDaoNotificationSummary({
  metadataEntries,
  daoUserVotes,
  lastDaoOpenedAt,
  now,
}) {
  const entries = normalizeDaoProposalIndexEntries(metadataEntries);
  const trackedVotes = normalizeDaoUserVotes(daoUserVotes);
  const lastOpenedAt = normalizeDaoTimestamp(lastDaoOpenedAt);
  const currentTimestamp = normalizeDaoTimestamp(now);
  const summary = {
    newVoting: [],
    endedVoting: [],
    finalizedTrackedVote: [],
  };

  for (const entry of entries) {
    const trackedVote = trackedVotes[entry.proposal];
    if (entry.status === 'voting') {
      if (entry.timestamp > lastOpenedAt) summary.newVoting.push(entry.proposal);

      const reminderSchedule = normalizeDaoVoteReminderSchedule(trackedVote);
      if (reminderSchedule
        && currentTimestamp >= reminderSchedule.votingEndsAt
        && lastOpenedAt < reminderSchedule.votingEndsAt) {
        summary.endedVoting.push(entry.proposal);
      }
      continue;
    }

    if (!DAO_REWARD_STATE_KEYS.includes(entry.status) || !trackedVote) continue;
    const reminderSchedule = normalizeDaoVoteReminderSchedule(trackedVote);
    if (reminderSchedule
      && entry.timestamp > lastOpenedAt
      && currentTimestamp <= reminderSchedule.reminderExpiresAt) {
      summary.finalizedTrackedVote.push(entry.proposal);
    }
  }

  return summary;
}

export function getDaoTrackedProposalMetadataEntries(entries, proposalNumbers) {
  const tracked = new Set(
    (Array.isArray(proposalNumbers) ? proposalNumbers : [])
      .map(normalizeDaoPositiveInteger)
      .filter(Boolean),
  );
  return normalizeDaoProposalIndexEntries(entries)
    .filter((entry) => tracked.has(entry.proposal));
}

async function fetchDaoProposalMeta(queryDaoApi) {
  const body = await queryDaoApi('/dao/proposals/meta');
  if (!body) {
    throw new Error('Failed to load DAO proposal metadata');
  }
  if (body.error) {
    throw new Error(String(body.error));
  }

  const index = body.meta && typeof body.meta === 'object' ? body.meta : body;
  const proposals = normalizeDaoProposalIndexEntries(index.proposals);
  return {
    count: Math.max(normalizeDaoPositiveInteger(index.count), proposals.length),
    proposals,
  };
}

function mapBackendProposalToStoreProposal(proposal, metadataEntry) {
  if (!proposal || typeof proposal !== 'object') return null;

  const number = normalizeDaoPositiveInteger(proposal.number);
  if (!number) return null;

  const accountId = String(proposal.id || '').trim();
  if (!accountId) return null;

  const nonce = accountId;
  const proposalType = String(proposal.proposalType || '').trim();
  if (!proposalType) return null;

  const state = metadataEntry.status;
  const created = normalizeDaoTimestamp(proposal.creationTime);
  const stateChanged = metadataEntry.timestamp;
  const title = String(proposal.title || proposal.description || '').trim();

  return {
    ...proposal,
    accountId,
    number,
    nonce,
    title,
    description: String(proposal.description || '').trim(),
    proposalType,
    emergency: metadataEntry.emergencyFlag,
    state,
    status: state,
    state_changed: stateChanged,
    created,
  };
}

function mapBackendProposals(indexedProposals) {
  const proposals = {};
  for (const { proposal: rawProposal, metadataEntry } of indexedProposals) {
    const proposal = mapBackendProposalToStoreProposal(rawProposal, metadataEntry);
    if (!proposal) continue;

    const id = daoProposalId(proposal.number, proposal.nonce);
    proposals[id] = proposal;
  }
  return proposals;
}

async function fetchBackendProposal(queryDaoApi, metadataEntry) {
  const body = await queryDaoApi(`/dao/proposals/${metadataEntry.proposal}`);
  if (!body) {
    console.warn(`Skipping DAO proposal #${metadataEntry.proposal}: no response`);
    return null;
  }
  if (body.error || !body.proposal) {
    console.warn(`Skipping DAO proposal #${metadataEntry.proposal}: proposal unavailable`, body.error || body);
    return null;
  }
  return { proposal: body.proposal, metadataEntry };
}

export function createDaoBackendFetcher(queryDaoApi) {
  if (typeof queryDaoApi !== 'function') {
    return {
      fetchMeta: async () => createEmptyDaoStore().meta,
      fetchProposals: async () => ({}),
    };
  }

  return {
    async fetchMeta() {
      return fetchDaoProposalMeta(queryDaoApi);
    },

    async fetchProposals(entries) {
      const normalizedEntries = normalizeDaoProposalIndexEntries(entries);
      const proposals = await Promise.all(
        normalizedEntries.map((entry) => fetchBackendProposal(queryDaoApi, entry))
      );
      return mapBackendProposals(proposals.filter(Boolean));
    },
  };
}

function normalizeDaoStore(store) {
  const safe = store && typeof store === 'object' ? store : createEmptyDaoStore();
  safe.proposals = safe.proposals && typeof safe.proposals === 'object' ? safe.proposals : {};

  const proposalNumbers = Object.values(safe.proposals)
    .map((proposal) => normalizeDaoPositiveInteger(proposal?.number));
  safe.meta = {
    count: Math.max(normalizeDaoPositiveInteger(safe.meta?.count), ...proposalNumbers),
    proposals: normalizeDaoProposalIndexEntries(safe.meta?.proposals),
  };

  return safe;
}

function storeToUiList(store) {
  return Object.values(store?.proposals || {})
    .map((proposal) => {
      if (!proposal || typeof proposal !== 'object') return null;
      const state = getEffectiveDaoState(proposal);
      return {
        id: daoProposalId(proposal.number, proposal.nonce),
        number: proposal.number,
        accountId: proposal.accountId,
        nonce: proposal.nonce,
        title: proposal.title,
        description: proposal.description,
        proposalType: proposal.proposalType,
        project: proposal.project,
        emergency: Boolean(proposal.emergency),
        createdAt: proposal.created,
        state,
        status: state,
        stateEnteredAt: proposal.state_changed,
        options: proposal.options,
        totalVote: proposal.totalVote,
        winningOptionIndex: proposal.winningOptionIndex,
        committeeVotes: proposal.committeeVotes,
        committeeAddresses: proposal.committeeAddresses,
        voterRewardPool: proposal.voterRewardPool,
        claimedReward: proposal.claimedReward,
        initialBurnedReward: proposal.initialBurnedReward,
        finalBurnedReward: proposal.finalBurnedReward,
        voterList: proposal.voterList,
        claimList: proposal.claimList,
        startTime: proposal.startTime,
        reviewDuration: proposal.reviewDuration,
        votingStartedAt: proposal.votingStartedAt,
        votingEndedAt: proposal.votingEndedAt,
        votingDuration: proposal.votingDuration,
        claimDuration: proposal.claimDuration,
        gracePeriod: proposal.gracePeriod,
      };
    })
    .filter(Boolean);
}

let _store = null;
let _loadingPromise = null;
let _refreshVersion = 0;

// Backend integration hook. Metadata and full proposal details are fetched separately.
let _backendFetcher = null;

export function setDaoBackendFetcher(fetcher) {
  _backendFetcher = fetcher
    && typeof fetcher.fetchMeta === 'function'
    && typeof fetcher.fetchProposals === 'function'
    ? fetcher
    : null;
}

async function fetchNormalizedDaoMeta() {
  const meta = _backendFetcher ? await _backendFetcher.fetchMeta() : createEmptyDaoStore().meta;
  return normalizeDaoStore({ meta, proposals: {} }).meta;
}

async function refreshInternal({ force }) {
  if (_loadingPromise && !force) return _loadingPromise;
  if (_store && !force) return _store;

  const refreshVersion = ++_refreshVersion;
  const previousStore = _store;
  const loadingPromise = (async () => {
    try {
      const meta = await fetchNormalizedDaoMeta();
      const next = { meta, proposals: {} };
      const normalizedStore = normalizeDaoStore(next);
      if (refreshVersion === _refreshVersion) {
        _store = normalizedStore;
      }
      return _store;
    } catch (error) {
      if (!_store && refreshVersion === _refreshVersion) {
        _store = previousStore || normalizeDaoStore(createEmptyDaoStore());
      }
      throw error;
    }
  })();
  _loadingPromise = loadingPromise;

  try {
    return await loadingPromise;
  } finally {
    if (_loadingPromise === loadingPromise) {
      _loadingPromise = null;
    }
  }
}

export const daoRepo = {
  reset() {
    _store = null;
    _loadingPromise = null;
    _refreshVersion += 1;
  },

  async refresh({ force } = {}) {
    return refreshInternal({ force: Boolean(force) });
  },

  async ensureLoaded() {
    return refreshInternal({ force: false });
  },

  async loadProposalEntries(entries, { append = false } = {}) {
    if (!_store) await refreshInternal({ force: false });

    const currentStore = _store;
    const proposals = _backendFetcher ? await _backendFetcher.fetchProposals(entries) : {};
    if (_store !== currentStore) return _store;

    _store.proposals = append ? { ..._store.proposals, ...proposals } : proposals;
    return _store;
  },

  async refreshProposal(proposalNumber) {
    if (!_store) await refreshInternal({ force: false });

    const number = normalizeDaoPositiveInteger(proposalNumber);
    const entry = _store.meta.proposals.find((proposal) => proposal.proposal === number);
    if (!entry || !_backendFetcher) return null;

    const currentStore = _store;
    const proposals = await _backendFetcher.fetchProposals([entry]);
    if (_store !== currentStore) return null;

    const proposal = Object.values(proposals)[0] || null;
    if (proposal) _store.proposals[daoProposalId(proposal.number, proposal.nonce)] = proposal;
    return proposal;
  },

  getProposalById(proposalId) {
    return _store?.proposals?.[proposalId] || null;
  },

  getProposalsForUi() {
    return storeToUiList(_store);
  },

  getProposalMetaForUi() {
    return (_store?.meta?.proposals || []).map((entry) => ({ ...entry }));
  },

  async createProposal({
    draft,
    timestamp,
    networkId,
    maxGracePeriodMs,
    proposalDurations,
    submitTransaction,
  } = {}) {
    let transaction = null;
    let proposalNumber = 0;
    let proposalStoreId = '';

    try {
      if (typeof submitTransaction !== 'function') {
        throw new Error('DAO proposal submit handler is required');
      }

      const meta = await fetchNormalizedDaoMeta();
      proposalNumber = normalizeDaoPositiveInteger(meta.count) + 1;
      transaction = buildDaoProposalCreateTransaction({
        draft,
        timestamp,
        networkId,
        proposalNumber,
        maxGracePeriodMs,
        proposalDurations,
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
