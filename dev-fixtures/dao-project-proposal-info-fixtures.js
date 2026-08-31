const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const FALLBACK_VOTER_ADDRESS = '1111111111111111111111111111111111111111';
const COMMITTEE_ADDRESSES = Object.freeze([
  '2222222222222222222222222222222222222222',
  '3333333333333333333333333333333333333333',
  '4444444444444444444444444444444444444444',
]);

function getFixtureAddress(value) {
  const address = String(value || '').trim().replace(/^0x/i, '');
  return /^[0-9a-fA-F]{40}(?:0{24})?$/.test(address)
    ? address.slice(0, 40)
    : FALLBACK_VOTER_ADDRESS;
}

function createMilestone(index, overrides = {}) {
  return {
    title: `Milestone ${index}: deliver the working release`,
    description: `Implement, document, and demonstrate milestone ${index}.`,
    deliverable: `A reviewable milestone ${index} release with acceptance evidence.`,
    durationDays: 15 + index,
    costUsdStr: String(index * 1000),
    penaltyUsdStr: String(index * 100),
    bonusUsdStr: String(index * 50),
    status: 'pending',
    startedAt: null,
    paid: false,
    ...overrides,
  };
}

function createProject(overrides = {}) {
  return {
    address: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    status: 'pending',
    balance: '0',
    claimableBalance: '0',
    milestones: [createMilestone(1)],
    ...overrides,
  };
}

function createTimeline(status, anchorTimestamp) {
  const reviewDuration = HOUR_MS;
  const votingDuration = HOUR_MS;
  const claimDuration = 2 * HOUR_MS;
  const gracePeriod = 3 * HOUR_MS;

  if (status === 'review') {
    return {
      startTime: anchorTimestamp - (15 * MINUTE_MS),
      reviewDuration,
      votingDuration,
      claimDuration,
      gracePeriod,
    };
  }

  if (status === 'voting') {
    const votingStartedAt = anchorTimestamp - (30 * MINUTE_MS);
    return {
      startTime: votingStartedAt - reviewDuration,
      votingStartedAt,
      reviewDuration,
      votingDuration,
      claimDuration,
      gracePeriod,
    };
  }

  const votingEndedAt = anchorTimestamp - (30 * MINUTE_MS);
  const votingStartedAt = votingEndedAt - votingDuration;
  return {
    startTime: votingStartedAt - reviewDuration,
    votingStartedAt,
    votingEndedAt,
    reviewDuration,
    votingDuration,
    claimDuration,
    gracePeriod,
  };
}

function createRewardData(currentAddress, isClaimable) {
  const pool = '100000000000000000000';
  return {
    voterRewardPool: pool,
    claimedReward: '10000000000000000000',
    initialBurnedReward: '0',
    finalBurnedReward: '0',
    voterList: isClaimable ? [{ address: currentAddress, timestamp: 1 }] : [],
    claimList: [],
  };
}

function getProjectStatusForTitle(project) {
  const status = String(project?.status || '').trim();
  return status || 'unavailable';
}

function mergeFixtureMetadata(body, metadataEntries, fixtureProposalNumbers) {
  if (!body || typeof body !== 'object' || body.error) return body;

  const hasMetaWrapper = body.meta && typeof body.meta === 'object';
  const upstreamMeta = hasMetaWrapper ? body.meta : body;
  const upstreamEntries = Array.isArray(upstreamMeta.proposals)
    ? upstreamMeta.proposals.filter((entry) => !fixtureProposalNumbers.has(Number(entry?.proposal)))
    : [];
  const proposals = [...metadataEntries, ...upstreamEntries]
    .sort((a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0));
  const upstreamCount = Number(upstreamMeta.count);
  const normalizedUpstreamCount = Number.isSafeInteger(upstreamCount) && upstreamCount > 0
    ? upstreamCount
    : 0;
  const meta = {
    ...upstreamMeta,
    count: Math.max(normalizedUpstreamCount, proposals.length),
    proposals,
  };

  return hasMetaWrapper ? { ...body, meta } : meta;
}

function createFixtureScenarios(anchorTimestamp, currentAddress) {
  const completedAt = anchorTimestamp - (2 * HOUR_MS);
  const paidAt = anchorTimestamp - HOUR_MS;
  const longDescription = 'This intentionally long Project description checks wrapping across narrow Proposal Info layouts. '.repeat(7).trim();
  const maximumMilestones = Array.from({ length: 10 }, (_, index) => createMilestone(index + 1));
  const startedMilestones = [
    createMilestone(1, {
      status: 'completed',
      startedAt: anchorTimestamp - (20 * HOUR_MS),
      completedAt,
      paid: true,
      paidAt,
      payoutWei: '1000000000000000000',
    }),
    createMilestone(2, {
      status: 'started',
      startedAt: anchorTimestamp - (30 * MINUTE_MS),
    }),
    createMilestone(3),
  ];

  return [
    {
      state: 'review',
      label: 'Review · proposed Project',
      project: createProject(),
    },
    {
      state: 'voting',
      label: 'Voting · long multi-milestone Project',
      description: longDescription,
      project: createProject({
        address: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        milestones: [
          createMilestone(1, { description: longDescription }),
          createMilestone(2, { deliverable: longDescription }),
          createMilestone(3),
        ],
      }),
    },
    {
      state: 'accepted',
      label: 'Accepted · pending activation',
      project: createProject({ milestones: maximumMilestones }),
    },
    {
      state: 'withheld',
      label: 'Withheld · not activated',
      project: createProject(),
    },
    {
      state: 'rejected',
      label: 'Rejected · not funded',
      project: createProject(),
    },
    {
      state: 'applied',
      label: 'Executing · Project started',
      project: createProject({
        status: 'started',
        balance: '125000000000000000000',
        claimableBalance: '1000000000000000000',
        milestones: startedMilestones,
      }),
    },
    {
      state: 'applied',
      label: 'Completed · Project paid',
      project: createProject({
        status: 'completed',
        milestones: [
          createMilestone(1, {
            status: 'completed',
            startedAt: anchorTimestamp - (30 * HOUR_MS),
            completedAt,
            paid: true,
            paidAt,
            payoutWei: '1000000000000000000',
          }),
        ],
      }),
    },
    {
      state: 'applied',
      label: 'Terminated · Project stopped',
      project: createProject({
        status: 'terminated',
        balance: '250000000000000000',
        milestones: startedMilestones,
      }),
    },
    {
      state: 'canceled',
      label: 'Canceled · not activated',
      project: createProject(),
    },
    {
      state: 'accepted',
      label: 'Accepted · claimable reward',
      isClaimable: true,
      project: createProject(),
    },
    {
      state: 'applied',
      label: 'Applied · missing Project data',
      project: undefined,
    },
    {
      state: 'voting',
      label: 'Voting · partial malformed Project',
      project: {
        address: 'not-an-address',
        status: 'unexpected-status',
        balance: 'not-a-balance',
        claimableBalance: '0',
        milestones: [
          null,
          {
            title: '',
            description: 'Only this partial description is available.',
            deliverable: '',
            durationDays: 'unknown',
            costUsdStr: 'invalid',
            penaltyUsdStr: '0',
            bonusUsdStr: '0',
            status: 'unknown',
            paid: 'sometimes',
          },
        ],
      },
    },
  ].map((scenario, index) => {
    const number = 901 + index;
    const timeline = createTimeline(scenario.state, anchorTimestamp);
    const reward = createRewardData(currentAddress, scenario.isClaimable === true);
    return {
      number,
      state: scenario.state,
      isClaimable: scenario.isClaimable === true,
      timestamp: anchorTimestamp - ((index + 1) * MINUTE_MS),
      proposal: {
        id: `mock-dao-project-proposal-${number}`,
        number,
        proposalType: 'project',
        title: `[Fixture ${String(index + 1).padStart(2, '0')}] [Project status: ${getProjectStatusForTitle(scenario.project)}] ${scenario.label}`,
        description: scenario.description || 'Read-only Project Proposal Info fixture. No DAO transaction can be submitted in fixture mode.',
        creationTime: timeline.startTime - MINUTE_MS,
        emergency: false,
        options: ['no', 'Fund project'],
        totalVote: scenario.state === 'review' || scenario.state === 'withheld'
          ? ['0', '0']
          : scenario.state === 'rejected'
            ? ['12000000000000', '2000000000000']
            : ['2000000000000', '12000000000000'],
        winningOptionIndex: scenario.state === 'rejected' ? 0 : 1,
        committeeAddresses: COMMITTEE_ADDRESSES,
        committeeVotes: [],
        voteThresholdUsdStr: '0.40',
        minimumSpendUsdStr: '0.10',
        voteExponent: 1,
        ...timeline,
        ...reward,
        ...(scenario.project === undefined ? {} : { project: scenario.project }),
      },
    };
  });
}

export function createDaoProjectProposalInfoFixtures({
  now = Date.now(),
  getCurrentAddress = () => '',
  queryUpstream = null,
} = {}) {
  const requestedTimestamp = Number(now);
  const anchorTimestamp = Number.isFinite(requestedTimestamp) && requestedTimestamp > 0
    ? requestedTimestamp
    : Date.now();
  const currentAddress = getFixtureAddress(getCurrentAddress());
  const fixtures = createFixtureScenarios(anchorTimestamp, currentAddress);
  const fixturesByNumber = new Map(fixtures.map((fixture) => [fixture.number, fixture]));
  const fixtureProposalNumbers = new Set(fixturesByNumber.keys());
  const metadataEntries = fixtures
    .map((fixture) => ({
      proposal: fixture.number,
      status: fixture.state,
      emergencyFlag: false,
      timestamp: fixture.timestamp,
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  async function queryDaoApi(path) {
    if (path === '/dao/proposals/meta') {
      if (typeof queryUpstream !== 'function') {
        return { meta: { count: fixtures.length, proposals: metadataEntries } };
      }
      const body = await queryUpstream(path);
      return mergeFixtureMetadata(body, metadataEntries, fixtureProposalNumbers);
    }

    const match = /^\/dao\/proposals\/(\d+)$/.exec(String(path || ''));
    const fixture = match ? fixturesByNumber.get(Number(match[1])) : null;
    if (fixture) return { proposal: fixture.proposal };
    if (typeof queryUpstream === 'function') return queryUpstream(path);
    return { error: `Project fixture not found: ${path}` };
  }

  function getClaimableProposalNumbers(timestamp = Date.now()) {
    const currentTimestamp = Number(timestamp);
    if (!Number.isFinite(currentTimestamp) || currentTimestamp <= 0) return [];
    return fixtures
      .filter((fixture) => {
        if (!fixture.isClaimable) return false;
        const start = fixture.proposal.votingEndedAt;
        const end = start + fixture.proposal.claimDuration;
        return currentTimestamp >= start && currentTimestamp <= end;
      })
      .map((fixture) => fixture.number);
  }

  return Object.freeze({
    getClaimableProposalNumbers,
    queryDaoApi,
  });
}
