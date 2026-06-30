import { buildMockDaoStore } from './dao.mock-data.js';

// Shared DAO constants and light helper functions.
// Kept here so UI + repo can share one import surface.

export const DAO_ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const DAO_ARCHIVABLE_STATE_KEYS = ['withheld', 'rejected', 'accepted', 'applied'];

export const DAO_TYPE_OPTIONS = [
  // Server proposal types are the long-term shape; legacy options remain for the current add form.
  { key: 'governance', label: 'Governance', group: 'Server proposal types' },
  { key: 'economic', label: 'Economic', group: 'Server proposal types' },
  { key: 'protocol', label: 'Protocol', group: 'Server proposal types' },
  { key: 'treasury_project', label: 'Project', group: 'Treasury' },
  { key: 'treasury_mint', label: 'Mint coins (fund projects)', group: 'Treasury' },
  { key: 'params_governance', label: 'Governance', group: 'Parameters' },
  { key: 'params_economic', label: 'Economic', group: 'Parameters' },
  { key: 'params_protocol', label: 'Protocol', group: 'Parameters' },
];

export const DAO_STATES = [
  { key: 'review', label: 'Review' },
  { key: 'withheld', label: 'Withheld' },
  { key: 'voting', label: 'Voting' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'applied', label: 'Applied' },
];

export function getDaoTypeLabel(typeKey) {
  return DAO_TYPE_OPTIONS.find((t) => t.key === typeKey)?.label || typeKey || '';
}

export function getDaoStateLabel(key) {
  return DAO_STATES.find((s) => s.key === key)?.label || key;
}

export function getEffectiveDaoState(proposal) {
  const state = proposal?.status || proposal?.state || 'review';
  return state === 'discussion' ? 'review' : state;
}

// In-memory DAO repository.
// Goal: UI uses this API; swapping mock<->backend is a drop-in replacement.

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

    // Migration: older versions wrote a synthetic `state: 'archived'`.
    // We cannot reliably recover the original state; map to a server-supported final state.
    if ((full.status || full.state || meta.status || meta.state) === 'archived') {
      full.state = full.archivedFromState || 'applied';
      meta.state = meta.archivedFromState || full.state;
    }

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
          type: meta.type,
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

  // Migration: older versions stored `state: 'archived'` for archived items.
  for (const meta of safe.archivedProposals) {
    const id = daoProposalId(meta.number, meta.nonce);
    const full = safe.proposals[id];
    if (!full) continue;
    if ((full.status || full.state || meta.status || meta.state) === 'archived') {
      full.state = full.archivedFromState || 'applied';
      meta.state = meta.archivedFromState || full.state;
    }
  }

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
      const description = p.description || p.summary;
      const state = getEffectiveDaoState({ status: p.status || m.status, state: p.state || m.state });
      const type = p.proposalType || p.type;
      return {
        id,
        number: p.number,
        nonce: p.nonce,
        title: p.title,
        summary: description,
        description,
        type,
        proposalType: type,
        createdAt: p.created,
        state,
        status: state,
        stateEnteredAt: p.state_changed,
        createdBy: p.createdBy,
        fields: p.fields || {},
        options: Array.isArray(p.options) ? p.options : ['yes', 'no'],
        totalVote: Array.isArray(p.totalVote) ? p.totalVote : undefined,
        committeeVotes: Array.isArray(p.committeeVotes) ? p.committeeVotes : [],
        committeeAddresses: Array.isArray(p.committeeAddresses) ? p.committeeAddresses : [],
        voterRewardPool: p.voterRewardPool,
        claimedReward: p.claimedReward,
        initialBurnedReward: p.initialBurnedReward,
        finalBurnedReward: p.finalBurnedReward,
        startTime: p.startTime,
        reviewDuration: p.reviewDuration,
        votingDuration: p.votingDuration,
        claimDuration: p.claimDuration,
        votes: p.votes || { yes: 0, no: 0, by: {} },
        archivedAt: p.archivedAt || 0,
      };
    })
    .filter(Boolean);
}

function addProposalRecord(store, proposal) {
  const number = Number(store.meta?.count || 0) + 1;
  const nonce = proposal.nonce || Math.random().toString(16).slice(2);
  const id = daoProposalId(number, nonce);
  const now = Date.now();
  const state = proposal.status || proposal.state || 'review';
  const type = proposal.proposalType || proposal.type;
  const description = proposal.description || proposal.summary || '';

  store.meta.count = number;
  store.activeProposals.push({
    number,
    title: proposal.title,
    state,
    state_changed: proposal.stateChanged || now,
    type,
    nonce,
  });

  store.proposals[id] = {
    number,
    title: proposal.title,
    summary: description,
    description,
    type,
    proposalType: type,
    state,
    status: state,
    state_changed: proposal.stateChanged || now,
    nonce,
    created: proposal.created || now,
    createdBy: proposal.createdBy || 'fixture',
    fields: proposal.fields || {},
    options: Array.isArray(proposal.options) ? proposal.options : ['yes', 'no'],
    totalVote: Array.isArray(proposal.totalVote) ? proposal.totalVote : undefined,
    committeeVotes: Array.isArray(proposal.committeeVotes) ? proposal.committeeVotes : [],
    committeeAddresses: Array.isArray(proposal.committeeAddresses) ? proposal.committeeAddresses : [],
    voterRewardPool: proposal.voterRewardPool,
    claimedReward: proposal.claimedReward,
    initialBurnedReward: proposal.initialBurnedReward,
    finalBurnedReward: proposal.finalBurnedReward,
    startTime: proposal.startTime,
    reviewDuration: proposal.reviewDuration,
    votingDuration: proposal.votingDuration,
    claimDuration: proposal.claimDuration,
    votes: proposal.votes || { yes: 0, no: 0, by: {} },
  };

  return id;
}

let _mode = 'mock'; // 'mock' | 'backend'
let _store = null;
let _loadingPromise = null;
let _uiStressFixturesAdded = false;

// Optional hooks for future backend integration.
let _backendFetcher = null;

export function setDaoRepoMode(mode) {
  _mode = mode === 'backend' ? 'backend' : 'mock';
}

export function setDaoBackendFetcher(fetcher) {
  _backendFetcher = typeof fetcher === 'function' ? fetcher : null;
}

export function addDaoUiStressFixtures() {
  if (_uiStressFixturesAdded || !_store) return 0;

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const fixtures = [
    {
      state: 'voting',
      type: 'governance',
      title: 'Fixture: long governance vote title that should wrap cleanly',
      summary: 'Used to confirm long DAO row titles, metadata, summaries, and preview cards stay readable in a narrow modal.',
      votes: { yes: 48, no: 19, by: {} },
      stateChanged: now - 2 * hour,
    },
    {
      state: 'voting',
      type: 'economic',
      title: 'Fixture: economic spend change',
      summary: 'Shows a voting row for economic parameters with enough text to test two-line summary clamping.',
      votes: { yes: 14, no: 7, by: {} },
      stateChanged: now - 5 * hour,
    },
    {
      state: 'voting',
      type: 'protocol',
      title: 'Fixture: protocol limit update',
      summary: 'Exercises another voting row so the default Voting filter overflows and scrolls.',
      votes: { yes: 6, no: 11, by: {} },
      stateChanged: now - 7 * hour,
    },
    {
      state: 'voting',
      type: 'economic',
      title: 'Fixture: treasury project vote',
      summary: 'Confirms treasury project labels and route chips fit inside the proposal list row.',
      votes: { yes: 33, no: 4, by: {} },
      stateChanged: now - 10 * hour,
    },
    {
      state: 'voting',
      type: 'economic',
      title: 'Fixture: treasury mint vote',
      summary: 'Adds the remaining proposal type to the voting filter for visual coverage.',
      votes: { yes: 3, no: 12, by: {} },
      stateChanged: now - 12 * hour,
    },
    {
      state: 'review',
      type: 'governance',
      title: 'Fixture: committee review draft',
      summary: 'Review-state row used to verify the review preview and review route chip.',
      committeeVotes: [{ memberAddress: 'committee-1', vote: 'accept' }],
      committeeAddresses: ['committee-1', 'committee-2', 'committee-3'],
      stateChanged: now - day,
    },
    {
      state: 'withheld',
      type: 'protocol',
      title: 'Fixture: withheld committee item',
      summary: 'Withheld row used to test review-result transition copy.',
      committeeVotes: [
        { memberAddress: 'committee-1', vote: 'withhold' },
        { memberAddress: 'committee-2', vote: 'withhold' },
      ],
      committeeAddresses: ['committee-1', 'committee-2', 'committee-3'],
      initialBurnedReward: '50.0 USD',
      stateChanged: now - 2 * day,
    },
    {
      state: 'accepted',
      type: 'economic',
      title: 'Fixture: accepted result row',
      summary: 'Accepted result row with vote totals and reward details placeholder.',
      votes: { yes: 28, no: 9, by: {} },
      stateChanged: now - 3 * day,
    },
    {
      state: 'rejected',
      type: 'economic',
      title: 'Fixture: rejected result row',
      summary: 'Rejected result row used to check result styling and counts.',
      votes: { yes: 8, no: 31, by: {} },
      stateChanged: now - 4 * day,
    },
    {
      state: 'applied',
      type: 'protocol',
      title: 'Fixture: applied parameter update',
      summary: 'Applied row used to verify final result routing remains readable.',
      votes: { yes: 45, no: 6, by: {} },
      stateChanged: now - 5 * day,
    },
    {
      state: 'applied',
      type: 'protocol',
      title: 'Fixture: applied protocol change',
      summary: 'Applied row used to cover the final server DAO status in the active list.',
      votes: { yes: 19, no: 2, by: {} },
      stateChanged: now - 6 * day,
    },
  ];

  for (const fixture of fixtures) {
    addProposalRecord(_store, {
      ...fixture,
      created: fixture.stateChanged - day,
      nonce: `ui_stress_${fixture.state}_${fixture.type}_${fixture.stateChanged}`,
    });
  }

  _store = normalizeDaoStore(_store);
  _uiStressFixturesAdded = true;
  return fixtures.length;
}

async function fetchDaoStoreFromBackend() {
  if (_backendFetcher) return _backendFetcher();
  // No endpoints are assumed yet.
  // This stub keeps the app working while making the integration point explicit.
  return createEmptyDaoStore();
}

async function refreshInternal({ force } = {}) {
  if (_loadingPromise && !force) return _loadingPromise;
  if (_store && !force) return _store;

  // In mock mode, treat `force` as a no-op so proposals are stable across open/close.
  if (_store && force && _mode === 'mock') return _store;

  _loadingPromise = (async () => {
    const next = _mode === 'backend' ? await fetchDaoStoreFromBackend() : buildMockDaoStore();
    _store = normalizeDaoStore(next);
    return _store;
  })();

  try {
    return await _loadingPromise;
  } finally {
    _loadingPromise = null;
  }
}

export const daoRepo = {
  get mode() {
    return _mode;
  },

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

  async createProposal({ title, summary, type, fields, createdBy } = {}) {
    await refreshInternal({ force: false });
    const safeTitle = String(title || '').trim();
    const safeSummary = String(summary || '').trim();
    const safeType = String(type || '').trim();

    if (!safeTitle) throw new Error('Missing title');
    if (!safeSummary) throw new Error('Missing summary');
    if (!safeType) throw new Error('Missing type');

    const store = _store || createEmptyDaoStore();
    const id = addProposalRecord(store, {
      title: safeTitle,
      summary: safeSummary,
      state: 'review',
      type: safeType,
      createdBy: createdBy || 'unknown',
      fields: fields && typeof fields === 'object' ? fields : {},
    });

    _store = normalizeDaoStore(store);
    return id;
  },

  async castVote({ proposalId, voterId, choice } = {}) {
    await refreshInternal({ force: false });
    if (!_store) return { ok: false, error: 'Store not loaded' };

    const p = _store.proposals?.[proposalId];
    if (!p) return { ok: false, error: 'Proposal not found' };
    if (getEffectiveDaoState(p) !== 'voting') return { ok: false, error: 'Voting not available' };

    const voteChoice = choice === 'yes' ? 'yes' : 'no';
    const who = String(voterId || 'anon');

    p.votes = p.votes || { yes: 0, no: 0, by: {} };
    p.votes.by = p.votes.by || {};

    const prev = p.votes.by[who];

    if (prev === voteChoice) {
      delete p.votes.by[who];
      if (voteChoice === 'yes') p.votes.yes = Math.max(0, Number(p.votes.yes || 0) - 1);
      if (voteChoice === 'no') p.votes.no = Math.max(0, Number(p.votes.no || 0) - 1);
    } else {
      if (prev === 'yes') p.votes.yes = Math.max(0, Number(p.votes.yes || 0) - 1);
      if (prev === 'no') p.votes.no = Math.max(0, Number(p.votes.no || 0) - 1);
      p.votes.by[who] = voteChoice;
      if (voteChoice === 'yes') p.votes.yes = Number(p.votes.yes || 0) + 1;
      if (voteChoice === 'no') p.votes.no = Number(p.votes.no || 0) + 1;
    }

    _store = normalizeDaoStore(_store);
    return { ok: true };
  },
};
