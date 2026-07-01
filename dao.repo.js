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

const DAO_PROPOSAL_QUERY_BATCH_SIZE = 10;

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

function normalizeDaoVoteNumber(value) {
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getDaoProposalDescription(proposal) {
  return String(proposal?.description || proposal?.summary || '').trim();
}

function getDaoProposalFields(proposal) {
  const fields = proposal?.fields && typeof proposal.fields === 'object' ? { ...proposal.fields } : {};
  if (proposal?.governance) fields.governance = proposal.governance;
  if (proposal?.economic) fields.economic = proposal.economic;
  if (proposal?.protocol) fields.protocol = proposal.protocol;
  return fields;
}

function getDaoProposalVotes(proposal) {
  if (proposal?.votes && typeof proposal.votes === 'object') return proposal.votes;

  const totals = Array.isArray(proposal?.totalVote) ? proposal.totalVote : [];
  return {
    yes: normalizeDaoVoteNumber(totals[0]),
    no: normalizeDaoVoteNumber(totals[1]),
    by: {},
  };
}

function mapBackendProposalToStoreProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') return null;

  const number = normalizeDaoPositiveInteger(proposal.number);
  if (!number) return null;

  const nonce = String(proposal.id || proposal.nonce || number);
  const type = proposal.proposalType || proposal.type || '';
  const state = getEffectiveDaoState(proposal);
  const created = normalizeDaoTimestamp(proposal.creationTime || proposal.created || proposal.timestamp);
  const stateChanged = normalizeDaoTimestamp(proposal.timestamp || proposal.state_changed || created);
  const description = getDaoProposalDescription(proposal);

  return {
    ...proposal,
    accountId: proposal.id,
    number,
    nonce,
    title: String(proposal.title || '').trim(),
    summary: description,
    description,
    type,
    proposalType: type,
    state,
    status: state,
    state_changed: stateChanged,
    created,
    createdBy: proposal.createdBy || proposal.creator || proposal.from || '',
    fields: getDaoProposalFields(proposal),
    votes: getDaoProposalVotes(proposal),
  };
}

function getDaoStoreMeta(proposal) {
  return {
    number: proposal.number,
    title: proposal.title,
    state: proposal.state,
    status: proposal.status,
    state_changed: proposal.state_changed,
    type: proposal.type,
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
    throw new Error(`Failed to load DAO proposal #${proposalNumber}`);
  }
  if (body.error || !body.proposal) return null;
  return body.proposal;
}

export function createDaoBackendFetcher(queryDaoApi, { batchSize = DAO_PROPOSAL_QUERY_BATCH_SIZE } = {}) {
  if (typeof queryDaoApi !== 'function') {
    return async () => createEmptyDaoStore();
  }

  const safeBatchSize = normalizeDaoPositiveInteger(batchSize) || DAO_PROPOSAL_QUERY_BATCH_SIZE;

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
    for (let start = 1; start <= count; start += safeBatchSize) {
      const end = Math.min(start + safeBatchSize - 1, count);
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

  async createProposal() {
    throw new Error('Proposal creation is not connected yet');
  },

  async castVote() {
    return { ok: false, error: 'Voting is not connected yet' };
  },
};
