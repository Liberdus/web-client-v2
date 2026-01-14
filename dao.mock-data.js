// Mock DAO proposal data generator.
// This file intentionally contains no localStorage usage.

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

function randNonce() {
  return Math.random().toString(16).slice(2);
}

export function buildMockDaoStore() {
  const now = Date.now();
  const hours = (n) => n * 60 * 60 * 1000;
  const days = (n) => n * 24 * 60 * 60 * 1000;

  const store = createEmptyDaoStore();

  const addMock = ({ title, summary, state, enteredAt, createdAt, createdBy, type, fields, votes }) => {
    const number = ++store.meta.count;
    const nonce = randNonce();
    const id = daoProposalId(number, nonce);

    const created = Number(createdAt || enteredAt || now);
    const state_changed = Number(enteredAt || created);

    store.activeProposals.push({
      number,
      title,
      state,
      state_changed,
      type,
      nonce,
    });

    store.proposals[id] = {
      number,
      title,
      summary,
      type,
      state,
      state_changed,
      nonce,
      created,
      createdBy,
      fields: fields || {},
      votes: votes || { yes: 0, no: 0, by: {} },
    };
  };

  // Exact counts per plan:
  // Discussion 2, Withheld 7, Voting 1, Rejected 1, Accepted 2, Applied 3,
  // Executing 1, Terminated 0, Completed 5, Archived 14 (auto-archived by age rule).

  // Discussion (2)
  addMock({
    title: 'Add community grants working group',
    summary: 'Create a lightweight working group to evaluate community grants and publish monthly reports.',
    state: 'discussion',
    enteredAt: now - hours(3),
    createdBy: 'alice',
    type: 'params_governance',
    fields: { votingThreshold: '60%' },
  });
  addMock({
    title: 'Proposal format v2 (standard sections)',
    summary: 'Adopt a standard proposal template: Summary, Motivation, Specification, Risks, Alternatives, Timeline.',
    state: 'discussion',
    enteredAt: now - hours(18),
    createdBy: 'bob',
    type: 'params_governance',
    fields: { votingEligibility: 'validators + stakers' },
  });

  // Voting (1)
  addMock({
    title: 'Adjust minimum transaction fee',
    summary: 'Change the minimum transaction fee to better match network load (Yes/No).',
    state: 'voting',
    enteredAt: now - hours(9),
    createdAt: now - days(2),
    createdBy: 'carol',
    type: 'params_economic',
    fields: { minTxFee: '0.001', nodeRewards: 'unchanged' },
    votes: { yes: 12, no: 4, by: {} },
  });

  // Withheld (7)
  for (let i = 0; i < 7; i += 1) {
    addMock({
      title: `Withheld: parameter review backlog #${i + 1}`,
      summary: 'Withheld pending additional data and reviewer availability.',
      state: 'withheld',
      enteredAt: now - days(2 + i),
      createdAt: now - days(3 + i),
      createdBy: ['dave', 'eve', 'frank', 'gina'][i % 4],
      type: i % 2 === 0 ? 'params_protocol' : 'params_governance',
      fields: i % 2 === 0 ? { minActiveNodes: 100, maxActiveNodes: 250 } : { votingThreshold: '55%' },
    });
  }

  // Rejected (1)
  addMock({
    title: 'Remove toll feature',
    summary: 'Rejected due to spam-prevention needs and lack of alternatives.',
    state: 'rejected',
    enteredAt: now - days(6),
    createdAt: now - days(7),
    createdBy: 'henry',
    type: 'params_economic',
    fields: { rationale: 'anti-spam' },
  });

  // Accepted (2)
  addMock({
    title: 'Publish weekly transparency report',
    summary: 'Accepted: publish weekly uptime + incident report. Process-only.',
    state: 'accepted',
    enteredAt: now - days(2),
    createdAt: now - days(10),
    createdBy: 'ivy',
    type: 'params_governance',
    fields: { cadence: 'weekly' },
  });
  addMock({
    title: 'Treasury: fund documentation sprint',
    summary: 'Accepted: fund 2-week docs sprint from treasury.',
    state: 'accepted',
    enteredAt: now - days(4),
    createdAt: now - days(11),
    createdBy: 'jordan',
    type: 'treasury_project',
    fields: { amount: '2500', address: 'lib1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  });

  // Applied (3)
  for (let i = 0; i < 3; i += 1) {
    addMock({
      title: `Applied: economic parameter tweak #${i + 1}`,
      summary: 'Applied: parameter changes landed on-chain.',
      state: 'applied',
      enteredAt: now - days(3 + i),
      createdAt: now - days(15 + i),
      createdBy: ['kate', 'louis', 'mia'][i % 3],
      type: 'params_economic',
      fields: { stakeAmount: `${1000 + i * 250}`, validatorPenalty: `${50 + i * 10}` },
    });
  }

  // Executing (1)
  addMock({
    title: 'Implement DAO proposal indexer service',
    summary: 'Executing: build an indexer to expose proposal metadata + voting status to clients.',
    state: 'executing',
    enteredAt: now - days(1),
    createdAt: now - days(20),
    createdBy: 'nina',
    type: 'treasury_project',
    fields: { milestone: 'MVP API', budget: '5000' },
  });

  // Completed (5)
  for (let i = 0; i < 5; i += 1) {
    addMock({
      title: `Completed: project milestone #${i + 1}`,
      summary: 'Completed: deliverable shipped and verified.',
      state: 'completed',
      enteredAt: now - days(5 + i),
      createdAt: now - days(30 + i),
      createdBy: ['oscar', 'pat', 'quinn', 'riley'][i % 4],
      type: 'treasury_project',
      fields: { result: 'done' },
    });
  }

  // Archived (14) seed: older than 30 days in archivable states.
  const archivedSeedStates = ['withheld', 'rejected', 'applied', 'terminated', 'completed'];
  for (let i = 0; i < 14; i += 1) {
    const s = archivedSeedStates[i % archivedSeedStates.length];
    addMock({
      title: `Archived: historic ${s} proposal #${i + 1}`,
      summary: 'Archived after aging out (kept for reference).',
      state: s,
      enteredAt: now - days(45 + i),
      createdAt: now - days(60 + i),
      createdBy: ['sam', 'taylor', 'uma', 'vic'][i % 4],
      type: i % 2 === 0 ? 'params_protocol' : 'params_economic',
      fields: { note: 'archived by age rule' },
    });
  }

  // Do not normalize here; repository normalizes so mock generation stays simple.
  return store;
}
