// Fixed examples for the closeout-actions branch. These previews never submit transactions.
(() => {
  const labels = {
    review: 'Review', voting: 'Voting', accepted: 'Accepted', withheld: 'Withheld',
    rejected: 'Rejected', canceled: 'Canceled', applied: 'Applied',
    executing: 'Executing', terminated: 'Terminated', completed: 'Completed',
    pending: 'Pending',
  };
  const rows = (values) => values.map(([label, value]) => `
    <div class="proposal-info-row"><span>${label}</span><span class="proposal-info-value">${value}</span></div>
  `).join('');
  const section = (title, values) => `<section class="proposal-info-section"><h3>${title}</h3><div class="proposal-info-grid">${rows(values)}</div></section>`;
  const action = (title, button, help, field = '') => `
    <details class="proposal-lifecycle-action${button === 'Claim milestone payment' ? ' proposal-lifecycle-action--claim' : ''}"${button === 'Claim milestone payment' ? ' open' : ''}>
      <summary><span>${title}</span></summary>
      <div class="proposal-lifecycle-action-content"><p>${help}</p>${field}<button class="btn btn--primary btn--pill btn--full" type="button">${button}</button></div>
    </details>`;
  const start = action('Start milestone 1', 'Propose start now', 'Propose the current time as milestone 1’s start time. 3 total endorsements are required.');
  const endorseStart = action('Start milestone 1', 'Endorse proposed start', 'Endorse Sep 1, 2026, 9:00 AM as the start time. 2 of 3 endorsements have been submitted.');
  const complete = action('Complete milestone 1', 'Propose completion now', 'Propose the current time as milestone 1’s completion time. 3 total endorsements are required.');
  const endorseComplete = action('Complete milestone 1', 'Endorse proposed completion', 'Endorse Sep 11, 2026, 9:00 AM as the completion time. 2 of 3 endorsements have been submitted.');
  const terminate = action('Terminate milestone 1', 'Submit termination vote', '1 of 3 committee termination votes has been submitted.', '<div class="form-group"><label>Termination reason<textarea class="form-control" rows="3" maxlength="500" placeholder="Explain why this milestone should be terminated"></textarea></label></div>');
  const claim = (amount, timing) => action('Claim milestone 1', 'Claim milestone payment', `Claim ${amount} LIB for ${timing} delivery.`);
  const changeAddress = action('Change contractor address', 'Propose contractor address', 'Propose a new contractor address. 3 committee endorsements are required.', '<div class="form-group"><label>New contractor address<input class="form-control" type="text" maxlength="66" placeholder="Enter a Liberdus address" /></label></div>');
  const endProject = action('End project', 'End project', 'All milestones are finished. End the project and retain only completed, unpaid milestone payouts in escrow.');
  const reclaim = action('Reclaim project balance', 'Reclaim remaining balance', 'Reclaim the remaining 1,200 LIB from project escrow.');

  // Milestone status is independent of proposal status. Payment and endorsements
  // are contextual variants, rather than additional persisted milestone statuses.
  const milestones = {
    pending: { status: 'pending', start: 'Unavailable', end: 'Unavailable', paid: '0 LIB' },
    executing: { status: 'executing', start: 'Sep 1, 2026, 9:00 AM', end: 'Unavailable', paid: '0 LIB' },
    early: { status: 'completed', start: 'Sep 1, 2026, 9:00 AM', end: 'Sep 8, 2026, 9:00 AM', paid: '0 LIB', payout: '1,300 LIB', timing: 'Early' },
    ontime: { status: 'completed', start: 'Sep 1, 2026, 9:00 AM', end: 'Sep 11, 2026, 9:00 AM', paid: '0 LIB', payout: '1,200 LIB', timing: 'On time' },
    late: { status: 'completed', start: 'Sep 1, 2026, 9:00 AM', end: 'Sep 15, 2026, 9:00 AM', paid: '0 LIB', payout: '1,050 LIB', timing: 'Late' },
    paid: { status: 'completed', start: 'Sep 1, 2026, 9:00 AM', end: 'Sep 11, 2026, 9:00 AM', paid: '1,200 LIB' },
    terminated: { status: 'terminated', start: 'Sep 1, 2026, 9:00 AM', end: 'Sep 5, 2026, 9:00 AM', paid: '0 LIB' },
  };

  const proposalCases = [
    { id: 'review', state: 'review', note: 'Observer view during committee review, before public voting. Milestone terms open by default.', milestone: 'pending' },
    { id: 'voting', state: 'voting', note: 'Observer view during public voting on Reject or Fund project. Milestones have not started.', milestone: 'pending' },
    { id: 'accepted', state: 'accepted', note: 'Committee view after the grace period. The approved project is ready to start.', milestone: 'pending', actions: action('Start project', 'Start project', 'Starting this project mints its approved budget into escrow at the current network rate.') },
    { id: 'withheld', state: 'withheld', note: 'The committee withheld the proposal. No project execution actions are available.', milestone: 'pending' },
    { id: 'rejected', state: 'rejected', note: 'Reject won public voting. The project is not funded.', milestone: 'pending' },
    { id: 'canceled', state: 'canceled', note: 'Canceled proposal retained for inspection. No project execution actions are available.', milestone: 'pending' },
    { id: 'applied', state: 'applied', note: 'Applied belongs to parameter proposals. The winning parameters are already active.' },
    { id: 'executing', state: 'executing', note: 'Contractor view: the active milestone opens by default; the next remains pending.', milestone: 'executing', nextMilestone: 'pending', milestoneActions: complete },
    { id: 'completed', state: 'completed', note: 'The project has ended with all work completed and paid.', milestone: 'paid', balance: '0 LIB' },
    { id: 'terminated', state: 'terminated', note: 'The project has ended with a terminated milestone. No payment is owed for terminated work.', milestone: 'terminated', balance: '0 LIB' },
  ];
  const milestoneCases = [
    { id: 'pending-start', title: 'Pending · propose start', note: 'Contractor view: the next pending milestone can receive a proposed start time.', milestone: 'pending', milestoneActions: start },
    { id: 'start-endorsement', title: 'Pending · start proposed', note: 'Committee view: two endorsements are recorded; the next endorsement commits the start.', milestone: 'pending', proposed: 'Sep 1, 2026, 9:00 AM', endorsements: 2, milestoneActions: endorseStart + terminate },
    { id: 'start-endorsed', votes: 1, title: 'Pending · already endorsed', note: 'A committee member who already endorsed and voted to terminate sees no duplicate actions.', milestone: 'pending', proposed: 'Sep 1, 2026, 9:00 AM', endorsements: 2 },
    { id: 'completion-endorsement', title: 'Executing · completion proposed', note: 'Committee view: the milestone stays executing until the proposed completion time has enough endorsements.', milestone: 'executing', proposed: 'Sep 11, 2026, 9:00 AM', endorsements: 2, milestoneActions: endorseComplete + terminate },
    { id: 'termination-vote', title: 'Executing · termination vote', note: 'Committee view: a reason is required for a termination vote. The milestone remains executing until the threshold is met.', milestone: 'executing', votes: 1, milestoneActions: complete + terminate },
    { id: 'terminated-next', title: 'Terminated · next milestone pending', note: 'Terminated work is unpaid. A later pending milestone can start after the earlier one finishes.', milestone: 'terminated', nextMilestone: 'pending', nextActions: action('Start milestone 2', 'Propose start now', 'Propose the current time as milestone 2’s start time. 3 total endorsements are required.') },
    { id: 'claim-early', title: 'Completed · early payment', note: 'Contractor view: 7 days against a 10-day duration earns the 200 USD bonus at 2 USD/LIB.', milestone: 'early', milestoneActions: claim('1,300', 'early') },
    { id: 'claim-ontime', title: 'Completed · on-time payment', note: 'Contractor view: 10 days earns the base 2,400 USD payment at the fixed rate.', milestone: 'ontime', milestoneActions: claim('1,200', 'on-time') },
    { id: 'claim-late', title: 'Completed · late payment', note: 'Contractor view: 14 days incurs the 300 USD late penalty. Timing tolerances are 10%.', milestone: 'late', milestoneActions: claim('1,050', 'late') },
    { id: 'claim-paid', title: 'Completed · already paid', note: 'The paid amount remains visible. A paid milestone has no further payment claim action.', milestone: 'paid' },
    { id: 'claim-insufficient', title: 'Completed · insufficient escrow', note: 'The expected 1,200 LIB payout exceeds the 500 LIB balance. The app hides the claim action until refreshed data permits payment.', milestone: 'ontime', balance: '500 LIB' },
    { id: 'observer', title: 'Executing · observer view', note: 'An account outside the committee and contractor roles can inspect the milestone but has no execution actions.', milestone: 'executing' },
  ].map((example) => ({ state: 'executing', ...example }));
  const closeoutCases = [
    { id: 'grace-period', state: 'accepted', title: 'Accepted · grace period', note: 'Project start is hidden until the grace period ends, including for committee members.', milestone: 'pending' },
    { id: 'contractor-change', state: 'executing', title: 'Change contractor', note: 'Committee view: propose a new address while the project is executing.', milestone: 'executing', actions: changeAddress },
    { id: 'contractor-endorse', state: 'executing', title: 'Endorse contractor change', note: 'Committee view: the existing contractor remains in place until the replacement is endorsed.', milestone: 'executing', contractorChange: true, actions: action('Endorse contractor address', 'Endorse proposed address', '2 of 3 committee endorsements have been submitted.') + action('Replace proposed contractor', 'Propose replacement address', 'Propose a different contractor address and restart endorsements.', '<div class="form-group"><label>New contractor address<input class="form-control" type="text" maxlength="66" placeholder="Enter a Liberdus address" /></label></div>') },
    { id: 'end-project', state: 'executing', title: 'All milestones finished · end project', note: 'Committee view: all work is finished. End the project while retaining funds for the unpaid milestone.', milestone: 'ontime', actions: endProject + changeAddress },
    { id: 'ended-unpaid', state: 'completed', title: 'Completed project · payment owed', note: 'Contractor view: ending the project preserves the earned payment claim.', milestone: 'ontime', balance: '1,200 LIB', milestoneActions: claim('1,200', 'on-time') },
    { id: 'terminated-unpaid', state: 'terminated', title: 'Terminated project · payment owed', note: 'Contractor view: completed work remains claimable even when another milestone was terminated.', milestone: 'ontime', nextMilestone: 'terminated', balance: '1,200 LIB', milestoneActions: claim('1,200', 'on-time') },
    { id: 'reclaim-wait', state: 'completed', title: 'Closeout · 90-day claim window', note: 'Committee view, 30 days after project end: reclaim is hidden while the contractor can claim earned payments.', milestone: 'ontime', balance: '1,200 LIB', actions: changeAddress },
    { id: 'reclaim-ready', state: 'completed', title: 'Closeout · reclaim balance', note: 'Committee view, 90 days after project end: remaining escrow can be reclaimed and removed from circulation.', milestone: 'ontime', balance: '1,200 LIB', actions: reclaim + changeAddress },
    { id: 'reclaimed', state: 'completed', title: 'Closeout · escrow empty', note: 'After escrow is reclaimed, no reclaim, contractor-change, or unfunded payment action remains.', milestone: 'ontime', balance: '0 LIB' },
  ];

  function renderMilestone(example, key, number, actions) {
    const milestone = milestones[key];
    const runtime = ['executing', 'completed', 'terminated'].includes(example.state);
    const open = ['review', 'voting'].includes(example.state) || (example.state === 'executing' && milestone.status === 'executing');
    return `<div class="dao-project-info-milestone-group">
      <details class="dao-project-review-milestone dao-project-info-milestone" data-milestone-state="${milestone.status}"${open ? ' open' : ''}>
        <summary><span class="dao-project-info-milestone-heading"><span>Milestone ${number}</span><strong>${number === 1 ? 'Write onboarding guides' : 'Publish API examples'}</strong></span><span class="dao-project-info-milestone-status">${labels[milestone.status]}</span></summary>
        <div class="dao-project-info-milestone-content">
          <div class="dao-project-review-copy"><div><span>Description</span><p>Document the account, messaging, and wallet flows.</p></div><div><span>Deliverable</span><p>Four reviewed guides published on the documentation site.</p></div></div>
          <div class="proposal-info-grid" aria-label="Milestone ${number} terms">${rows([['Duration', '10 days'], ['Cost', '2,400 USD'], ['Late penalty', '300 USD'], ['Early bonus', '200 USD']])}</div>
          ${runtime ? `<div class="proposal-info-grid dao-project-info-runtime">${rows([
            ['Milestone status', labels[milestone.status]], ['Started', milestone.start], ['Ended', milestone.end],
            ['Proposed time', number === 1 ? example.proposed || 'Unavailable' : 'Unavailable'],
            ['Time endorsements', number === 1 ? example.endorsements || 0 : 0], ['Termination votes', number === 1 ? example.votes || 0 : 0], ['Paid amount', milestone.paid],
            ...(milestone.payout ? [['Expected payout', milestone.payout], ['Delivery timing', milestone.timing]] : []),
          ])}</div>` : ''}
        </div>
      </details>
      ${actions ? `<section class="dao-project-milestone-actions" aria-label="Milestone ${number} actions"><h5>Milestone actions</h5>${actions}</section>` : ''}
    </div>`;
  }

  function renderScreen(example) {
    const isProject = example.state !== 'applied';
    const runtime = ['executing', 'completed', 'terminated'].includes(example.state);
    const multiple = Boolean(example.nextMilestone);
    const title = example.title || `${labels[example.state]} proposal`;
    const options = isProject ? ['Reject', 'Fund project'] : ['No change', 'Update parameters'];
    const result = example.state === 'withheld' ? 'Committee withheld' : example.state === 'rejected' ? 'Reject' : example.state === 'canceled' ? 'Canceled' : options[1];
    return `<article class="screen" data-app-modal="proposalInfoModal" data-proposal-state="${example.state}" data-state-example="${example.id}">
      <div class="screen-label-row"><div class="screen-label">${title}</div><div class="screen-badges"><span class="screen-badge">${labels[example.state]}</span></div></div>
      <div class="screen-note">${example.note}</div>
      <div class="modal fixed-header active"><div class="modal-header"><button class="back-button" type="button" aria-label="Back"></button><div class="modal-title">${labels[example.state]}</div></div>
        <div class="modal-content"><div class="form-container"><div class="proposal-info">
          <div class="proposal-info-heading"><h2 class="proposal-info-title">${isProject ? 'Community documentation sprint' : 'Update proposal fee'}</h2><p class="proposal-type-indicator">Standard ${isProject ? 'Project' : 'Governance'} proposal</p></div>
          ${isProject ? `<section class="proposal-info-section dao-project-info-funding"><h3>Project Funding</h3><div class="proposal-info-grid">${rows([
            ['Recipient', '0x8f2a19c13ae97c71d8202d59e31f7c82d7a10000'],
            ['Base cost', multiple ? '4,800 USD' : '2,400 USD'], ['Maximum bonuses', multiple ? '400 USD' : '200 USD'], ['Maximum authorized', multiple ? '5,200 USD' : '2,600 USD'],
            ...(runtime ? [['Treasury balance', example.balance || (multiple ? '2,600 LIB' : example.milestone === 'paid' ? '100 LIB' : '1,300 LIB')], ['Fixed USD/LIB rate', '2 USD/LIB'], ['Started', 'Sep 1, 2026, 9:00 AM'], ['Ended', example.state === 'executing' ? 'Unavailable' : 'Sep 16, 2026, 9:00 AM']] : []),
          ])}</div></section>
          <section class="proposal-info-section dao-project-info-milestones"><h3>Milestones</h3><div class="dao-project-review-milestone-list">
            ${renderMilestone(example, example.milestone, 1, example.milestoneActions)}
            ${multiple ? renderMilestone(example, example.nextMilestone, 2, example.nextActions) : ''}
          </div></section>` : section('Results', [['Winner', 'Update parameters'], ['Proposal fee', '50 USD → 40 USD']])}
          ${example.state === 'review' ? section('Committee Review', [['Accept', '2 votes'], ['Withhold', '1 vote']]) : ''}
          ${example.state === 'voting' ? section('Current Vote', [['Reject', '8.3 power'], ['Fund project', '23.4 power']]) : ''}
          ${example.contractorChange ? section('Pending Contractor Change', [['Proposed recipient', '0x71ce19c13ae97c71d8202d59e31f7c82d7a183b2'], ['Endorsements', '2 of 3 required']]) : ''}
          ${example.actions ? `<section class="proposal-lifecycle-actions">${example.actions}</section>` : ''}
        </div>
        <div class="proposal-details"><details class="proposal-more"><summary><span class="proposal-more-title">Show proposal details</span><span class="proposal-more-note">Proposal options, results, overview, review timeline</span></summary><div class="proposal-more-content">
          <section class="proposal-info-section"><h3>Proposal Options</h3><div class="proposal-option-cards">${options.map((option) => `<div class="proposal-option-section"><span class="proposal-option-label">${option}</span></div>`).join('')}</div></section>
          ${['review', 'voting'].includes(example.state) ? '' : section('Results', [['Result', result]])}
          ${section('Overview', [['Type', isProject ? 'Project' : 'Governance'], ['Status', labels[example.state]]])}
          ${section('Review Timeline', [['Review starts', 'Aug 20, 2026, 9:00 AM'], ['Review ends', 'Aug 22, 2026, 9:00 AM']])}
        </div></details></div>
      </div></div></div>
    </article>`;
  }

  window.PROPOSAL_STATE_GROUPS = [
    { title: 'Proposal states', note: 'Every proposal status, including parameter-only Applied.', examples: proposalCases },
    { title: 'Milestone states and payments', note: 'Pending, Executing, Completed, and Terminated, with endorsement and payment variants. Expand milestones and action cards to inspect them.', examples: milestoneCases },
    { title: 'Project start, contractor changes, and closeout', note: 'Role and timing determine which actions appear. Each phone is an independent snapshot.', examples: closeoutCases },
  ];
  window.PROPOSAL_STATE_MARKUP = window.PROPOSAL_STATE_GROUPS.map((group) => `
    <div class="preview-subsection"><div class="section-heading"><h2 class="section-title">${group.title}</h2><div class="section-note">${group.note}</div></div>
      <div class="preview-grid">${group.examples.map(renderScreen).join('')}</div>
    </div>`).join('');
})();
