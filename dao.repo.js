import { buildMockDaoStore } from './dao.mock-data.js';

// Shared DAO constants and light helper functions.
// Kept here so UI + repo can share one import surface.

export const DAO_ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const DAO_ARCHIVABLE_STATE_KEYS = ['withheld', 'rejected', 'applied', 'terminated', 'completed'];

export const DAO_TYPE_OPTIONS = [
  { key: 'treasury_project', label: 'Project', group: 'Treasury' },
  { key: 'treasury_mint', label: 'Mint coins (fund projects)', group: 'Treasury' },
  { key: 'params_governance', label: 'Governance', group: 'Parameters' },
  { key: 'params_economic', label: 'Economic', group: 'Parameters' },
  { key: 'params_protocol', label: 'Protocol', group: 'Parameters' },
];

export const DAO_STATES = [
  { key: 'discussion', label: 'Discussion' },
  { key: 'withheld', label: 'Withheld' },
  { key: 'voting', label: 'Voting' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'applied', label: 'Applied' },
  { key: 'executing', label: 'Executing' },
  { key: 'terminated', label: 'Terminated' },
  { key: 'completed', label: 'Completed' },
];

export function getDaoTypeLabel(typeKey) {
  return DAO_TYPE_OPTIONS.find((t) => t.key === typeKey)?.label || typeKey || '';
}

export function getDaoStateLabel(key) {
  return DAO_STATES.find((s) => s.key === key)?.label || key;
}

export function getEffectiveDaoState(proposal) {
  return proposal?.state || 'discussion';
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
    // We cannot reliably recover the original state; map to 'completed' to keep it visible.
    if ((full.state || meta.state) === 'archived') {
      full.state = full.archivedFromState || 'completed';
      meta.state = meta.archivedFromState || full.state;
    }

    const state = full.state || meta.state || 'discussion';
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
    if ((full.state || meta.state) === 'archived') {
      full.state = full.archivedFromState || 'completed';
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
      return {
        id,
        number: p.number,
        nonce: p.nonce,
        title: p.title,
        summary: p.summary,
        type: p.type,
        createdAt: p.created,
        state: p.state,
        stateEnteredAt: p.state_changed,
        createdBy: p.createdBy,
        fields: p.fields || {},
        votes: p.votes || { yes: 0, no: 0, by: {} },
        archivedAt: p.archivedAt || 0,
      };
    })
    .filter(Boolean);
}

let _mode = 'mock'; // 'mock' | 'backend'
let _store = null;
let _loadingPromise = null;

// Optional hooks for future backend integration.
let _backendFetcher = null;

export function setDaoRepoMode(mode) {
  _mode = mode === 'backend' ? 'backend' : 'mock';
}

export function setDaoBackendFetcher(fetcher) {
  _backendFetcher = typeof fetcher === 'function' ? fetcher : null;
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

    const now = Date.now();
    const store = _store || createEmptyDaoStore();

    const number = Number(store.meta?.count || 0) + 1;
    const nonce = Math.random().toString(16).slice(2);
    const id = daoProposalId(number, nonce);

    store.meta.count = number;
    store.activeProposals.push({
      number,
      title: safeTitle,
      state: 'discussion',
      state_changed: now,
      type: safeType,
      nonce,
    });

    store.proposals[id] = {
      number,
      title: safeTitle,
      summary: safeSummary,
      type: safeType,
      state: 'discussion',
      state_changed: now,
      nonce,
      created: now,
      createdBy: createdBy || 'unknown',
      fields: fields && typeof fields === 'object' ? fields : {},
      votes: { yes: 0, no: 0, by: {} },
    };

    _store = normalizeDaoStore(store);
    return id;
  },

  async castVote({ proposalId, voterId, choice } = {}) {
    await refreshInternal({ force: false });
    if (!_store) return { ok: false, error: 'Store not loaded' };

    const p = _store.proposals?.[proposalId];
    if (!p) return { ok: false, error: 'Proposal not found' };
    if (p.state !== 'voting') return { ok: false, error: 'Voting not available' };

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
