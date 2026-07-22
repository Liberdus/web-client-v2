import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDaoBackendFetcher,
  daoRepo,
  getDaoProposalClaimWindow,
  getDaoRewardClaimStatus,
  isDaoProposalClaimable,
  setDaoBackendFetcher,
} from '../dao.repo.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 2_000_000_000_000;
const USER_ADDRESS = 'a'.repeat(40);
const USER_LONG_ADDRESS = `${USER_ADDRESS}${'0'.repeat(24)}`;
const OTHER_LONG_ADDRESS = `${'b'.repeat(40)}${'0'.repeat(24)}`;

function claimableProposal(overrides = {}) {
  return {
    status: 'accepted',
    startTime: NOW - 20 * DAY_MS,
    reviewDuration: 2 * DAY_MS,
    votingStartedAt: NOW - 10 * DAY_MS,
    votingDuration: 8 * DAY_MS,
    votingEndedAt: NOW - 2 * DAY_MS,
    claimDuration: 30 * DAY_MS,
    voterRewardPool: 100n,
    claimedReward: 25n,
    voterList: [{ address: USER_LONG_ADDRESS, timestamp: NOW - 9 * DAY_MS }],
    claimList: [],
    ...overrides,
  };
}

test('accepted, rejected, and applied proposals can be claimable', () => {
  for (const status of ['accepted', 'rejected', 'applied']) {
    const proposal = claimableProposal({ status });
    assert.equal(getDaoRewardClaimStatus(proposal, USER_ADDRESS, NOW), 'Claimable');
    assert.equal(isDaoProposalClaimable(proposal, USER_ADDRESS, NOW), true);
  }
});

test('claimList excludes a voter who already claimed', () => {
  const proposal = claimableProposal({ claimList: [USER_LONG_ADDRESS] });

  assert.equal(getDaoRewardClaimStatus(proposal, USER_ADDRESS, NOW), 'Already claimed');
  assert.equal(isDaoProposalClaimable(proposal, USER_ADDRESS, NOW), false);
});

test('non-voters are not eligible', () => {
  const proposal = claimableProposal({
    voterList: [{ address: OTHER_LONG_ADDRESS, timestamp: NOW - 9 * DAY_MS }],
  });

  assert.equal(getDaoRewardClaimStatus(proposal, USER_ADDRESS, NOW), 'Not eligible');
});

test('an unavailable account cannot have a claimable proposal', () => {
  const proposal = claimableProposal();

  assert.equal(getDaoRewardClaimStatus(proposal, '', NOW), 'Account unavailable');
  assert.equal(isDaoProposalClaimable(proposal, '', NOW), false);
});

test('expired claim windows are not claimable', () => {
  const proposal = claimableProposal({ votingEndedAt: NOW - 31 * DAY_MS });

  assert.equal(getDaoRewardClaimStatus(proposal, USER_ADDRESS, NOW), 'Claim window ended');
  assert.equal(isDaoProposalClaimable(proposal, USER_ADDRESS, NOW), false);
});

test('empty and fully claimed reward pools are not claimable', () => {
  assert.equal(
    getDaoRewardClaimStatus(claimableProposal({ voterRewardPool: 0n, claimedReward: 0n }), USER_ADDRESS, NOW),
    'Reward pool empty',
  );
  assert.equal(
    getDaoRewardClaimStatus(claimableProposal({ voterRewardPool: 100n, claimedReward: 100n }), USER_ADDRESS, NOW),
    'Reward pool fully claimed',
  );
});

test('unfinalized and withheld proposals are not claimable', () => {
  assert.equal(getDaoRewardClaimStatus(claimableProposal({ status: 'voting' }), USER_ADDRESS, NOW), 'Voting not finalized');
  assert.equal(getDaoRewardClaimStatus(claimableProposal({ status: 'withheld' }), USER_ADDRESS, NOW), 'Reward pool burned');
});

test('claim timing starts at actual late finalization time', () => {
  const proposal = claimableProposal({
    startTime: NOW - 100 * DAY_MS,
    reviewDuration: 2 * DAY_MS,
    votingStartedAt: NOW - 98 * DAY_MS,
    votingDuration: 8 * DAY_MS,
    votingEndedAt: NOW - DAY_MS,
  });

  const claimWindow = getDaoProposalClaimWindow(proposal);
  assert.equal(claimWindow.start, NOW - DAY_MS);
  assert.equal(claimWindow.end, NOW + 29 * DAY_MS);
  assert.equal(isDaoProposalClaimable(proposal, USER_ADDRESS, NOW), true);
});

test('claim window boundaries are inclusive', () => {
  const votingEndedAt = NOW - 30 * DAY_MS;
  const proposal = claimableProposal({ votingEndedAt });

  assert.equal(isDaoProposalClaimable(proposal, USER_ADDRESS, votingEndedAt), true);
  assert.equal(isDaoProposalClaimable(proposal, USER_ADDRESS, votingEndedAt + 30 * DAY_MS), true);
});

test('proposal list mapping preserves actual voting timestamps', async () => {
  const votingStartedAt = NOW - 10 * DAY_MS;
  const votingEndedAt = NOW - 2 * DAY_MS;
  const backendProposal = {
    ...claimableProposal({ votingStartedAt, votingEndedAt }),
    id: 'f'.repeat(64),
    number: 1,
    proposalType: 'governance',
    title: 'Claim timing',
    description: 'Uses actual finalization time',
    creationTime: NOW - 20 * DAY_MS,
    timestamp: NOW,
  };
  const fetcher = createDaoBackendFetcher(async (path) => {
    if (path === '/dao/proposals/meta') return { meta: { count: 1 } };
    if (path === '/dao/proposals/1') return { proposal: backendProposal };
    throw new Error(`Unexpected DAO path: ${path}`);
  });

  setDaoBackendFetcher(fetcher);
  await daoRepo.refresh({ force: true });

  const [proposal] = daoRepo.getProposalsForUi('active');
  assert.equal(proposal.votingStartedAt, votingStartedAt);
  assert.equal(proposal.votingEndedAt, votingEndedAt);
});
