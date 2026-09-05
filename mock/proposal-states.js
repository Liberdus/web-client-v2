// Fixed examples for the closeout-actions branch. These previews never submit transactions.
(() => {
  const labels = {
    review: 'Review', voting: 'Voting', accepted: 'Accepted', withheld: 'Withheld',
    rejected: 'Rejected', canceled: 'Canceled', applied: 'Applied',
    executing: 'Executing', terminated: 'Terminated', completed: 'Completed',
    pending: 'Pending',
  };
  const rows = (values) => values.map(([label, value, tone]) => `
    <div class="proposal-info-row${tone ? ` proposal-info-row--${tone}` : ''}"><span>${label}</span><span class="proposal-info-value">${String(value).replace(/(, 2026), /, '$1\n')}</span></div>
  `).join('');
  const section = (title, values, className = '') => `<section class="proposal-info-section${className ? ` ${className}` : ''}"><h3>${title}</h3><div class="proposal-info-grid">${rows(values)}</div></section>`;
  const action = (title, button, help, field = '') => `
    <details class="proposal-lifecycle-action${button === 'Claim milestone payment' ? ' proposal-lifecycle-action--claim' : ''}"${button === 'Claim milestone payment' || button.startsWith('Endorse ') ? ' open' : ''}>
      <summary><span>${title}</span></summary>
      <div class="proposal-lifecycle-action-content"><p>${help}</p>${field}<button class="btn btn--primary btn--pill btn--full" type="button">${button}</button></div>
    </details>`;
  const start = action('Start milestone 1', 'Propose start now', 'Propose the current time as milestone 1’s start time. 3 total endorsements are required.');
  const endorseStart = (count) => action('Start milestone 1', 'Endorse proposed start', `Endorse Sep 1, 2026, 9:00 AM as milestone 1’s start time. ${count} of 3 endorsements have been submitted.`);
  const complete = action('Complete milestone 1', 'Propose completion now', 'Propose the current time as milestone 1’s completion time. 3 total endorsements are required.');
  const endorseComplete = (count) => action('Complete milestone 1', 'Endorse proposed completion', `Endorse Sep 11, 2026, 9:00 AM as milestone 1’s completion time. ${count} of 3 endorsements have been submitted.`);
  const terminate = action('Terminate milestone 1', 'Submit termination vote', '1 of 3 committee termination votes has been submitted.', '<div class="form-group"><label for="mockTerminationReason">Termination reason</label><textarea id="mockTerminationReason" class="form-control" rows="3" maxlength="500" placeholder="Explain why this milestone should be terminated"></textarea></div>');
  const claim = (amount, timing) => action('Claim milestone 1', 'Claim milestone payment', `Claim ${amount} LIB for ${timing} delivery.`);
  const changeAddress = action('Change contractor address', 'Propose contractor address', 'Propose a new contractor address. 3 committee endorsements are required.', '<div class="form-group"><label for="mockContractorAddress">New contractor address</label><input id="mockContractorAddress" class="form-control" type="text" maxlength="66" placeholder="Enter a Liberdus address" /></div>');
  const endorseAddress = (count) => action('Endorse contractor address', 'Endorse proposed address', `${count} of 3 committee endorsements have been submitted.`);
  const replaceAddress = action('Replace proposed contractor', 'Propose replacement address', 'Propose a different contractor address and restart endorsements.', '<div class="form-group"><label for="mockContractorAddress">New contractor address</label><input id="mockContractorAddress" class="form-control" type="text" maxlength="66" placeholder="Enter a Liberdus address" /></div>');
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
    { id: 'voting', state: 'voting', note: 'Public voting on Reject or Fund project. The vote form starts with zero weights; milestones have not started.', milestone: 'pending' },
    { id: 'accepted', state: 'accepted', note: 'Committee view after the grace period. The approved project is ready to start.', milestone: 'pending', actions: action('Start project', 'Start project', 'Starting this project mints its approved budget into escrow at the current network rate.') },
    { id: 'withheld', state: 'withheld', note: 'The committee withheld the proposal. No project execution actions are available.', milestone: 'pending' },
    { id: 'rejected', state: 'rejected', note: 'Reject won public voting. The project is not funded.', milestone: 'pending' },
    { id: 'canceled', state: 'canceled', note: 'Canceled proposal retained for inspection. No project execution actions are available.', milestone: 'pending' },
    { id: 'applied', state: 'applied', note: 'Applied belongs to parameter proposals. The winning parameters are already active.' },
    { id: 'executing', state: 'executing', note: 'Contractor view: the active milestone opens by default; the next remains pending.', milestone: 'executing', nextMilestone: 'pending', milestoneActions: complete },
    { id: 'completed', state: 'completed', note: 'The project has ended with all work completed and paid.', milestone: 'paid', balance: '0 LIB' },
    { id: 'terminated', state: 'terminated', note: 'The project has ended with a terminated milestone. No payment is owed for terminated work.', milestone: 'terminated', balance: '0 LIB' },
  ];
  // These snapshots open and scroll to the endorsement details for easy comparison.
  const endorsementCases = [
    { id: 'start-one-endorsement', title: 'Start time · 1 of 3 endorsed', note: 'Committee view: one start-time endorsement is recorded. Two more are required to start the milestone.', milestone: 'pending', proposed: 'Sep 1, 2026, 9:00 AM', endorsements: 1, milestoneActions: endorseStart(1) + terminate, actions: changeAddress },
    { id: 'start-endorsement', title: 'Start time · 2 of 3 endorsed', note: 'Committee view: two start-time endorsements are recorded. Your endorsement will start the milestone.', milestone: 'pending', proposed: 'Sep 1, 2026, 9:00 AM', endorsements: 2, milestoneActions: endorseStart(2) + terminate, actions: changeAddress },
    { id: 'start-endorsed', title: 'Start time · already endorsed', note: 'You already endorsed this start time and voted to terminate. The count remains visible; duplicate actions are hidden.', milestone: 'pending', proposed: 'Sep 1, 2026, 9:00 AM', endorsements: 2, actions: changeAddress },
    { id: 'completion-one-endorsement', title: 'Completion time · 1 of 3 endorsed', note: 'Committee view: one completion-time endorsement is recorded. The milestone remains executing.', milestone: 'executing', proposed: 'Sep 11, 2026, 9:00 AM', endorsements: 1, milestoneActions: endorseComplete(1) + terminate, actions: changeAddress },
    { id: 'completion-endorsement', title: 'Completion time · 2 of 3 endorsed', note: 'Committee view: two completion-time endorsements are recorded. Your endorsement will complete the milestone.', milestone: 'executing', proposed: 'Sep 11, 2026, 9:00 AM', endorsements: 2, milestoneActions: endorseComplete(2) + terminate, actions: changeAddress },
    { id: 'completion-endorsed', title: 'Completion time · already endorsed', note: 'You already endorsed this completion time. The count remains visible, and you can still vote to terminate.', milestone: 'executing', proposed: 'Sep 11, 2026, 9:00 AM', endorsements: 2, milestoneActions: terminate, actions: changeAddress },
    { id: 'contractor-one-endorsement', title: 'Contractor change · 1 of 3 endorsed', note: 'Committee view: one address endorsement is recorded. The existing contractor remains until all three endorse.', milestone: 'executing', contractorChange: true, contractorEndorsements: 1, milestoneActions: complete + terminate, actions: endorseAddress(1) + replaceAddress },
    { id: 'contractor-endorse', title: 'Contractor change · 2 of 3 endorsed', note: 'Committee view: two address endorsements are recorded. Your endorsement will commit the replacement.', milestone: 'executing', contractorChange: true, contractorEndorsements: 2, milestoneActions: complete + terminate, actions: endorseAddress(2) + replaceAddress },
    { id: 'contractor-endorsed', title: 'Contractor change · already endorsed', note: 'You already endorsed this address. The pending recipient and count remain visible, with the option to propose a replacement.', milestone: 'executing', contractorChange: true, contractorEndorsements: 2, milestoneActions: complete + terminate, actions: replaceAddress },
  ].map((example) => ({ state: 'executing', votes: 1, endorsementPreview: example.contractorChange ? 'contractor' : 'time', ...example }));

  const milestoneCases = [
    { id: 'pending-start', title: 'Pending · propose start', note: 'Contractor view: the next pending milestone can receive a proposed start time.', milestone: 'pending', milestoneActions: start },
    { id: 'termination-vote', actions: changeAddress, title: 'Executing · termination vote', note: 'Committee view: a reason is required for a termination vote. The milestone remains executing until the threshold is met.', milestone: 'executing', votes: 1, milestoneActions: complete + terminate },
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
    { id: 'contractor-change', state: 'executing', title: 'Change contractor', note: 'Committee view: propose a new address while the project is executing.', milestone: 'executing', milestoneActions: complete + terminate, votes: 1, actions: changeAddress },
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
    const open = example.endorsementPreview === 'time' || ['review', 'voting'].includes(example.state) || (example.state === 'executing' && milestone.status === 'executing');
    return `<div class="dao-project-info-milestone-group">
      <details class="dao-project-review-milestone dao-project-info-milestone" data-milestone-state="${milestone.status}"${open ? ' open' : ''}>
        <summary><span class="dao-project-info-milestone-heading"><span>Milestone ${number}</span><strong>${number === 1 ? 'Write onboarding guides' : 'Publish API examples'}</strong></span><span class="dao-project-info-milestone-status">${labels[milestone.status]}</span></summary>
        <div class="dao-project-info-milestone-content">
          <div class="dao-project-review-copy"><div><span>Description</span><p>Document the account, messaging, and wallet flows.</p></div><div><span>Deliverable</span><p>Four reviewed guides published on the documentation site.</p></div></div>
          <div class="proposal-info-grid" aria-label="Milestone ${number} terms">${rows([['Duration', '10 days'], ['Cost', '2,400 USD'], ['Late penalty', '300 USD'], ['Early bonus', '200 USD']])}</div>
          ${runtime ? `<div class="proposal-info-grid dao-project-info-runtime" aria-label="Milestone ${number} runtime status">${rows([
            ['Milestone status', labels[milestone.status], milestone.status === 'completed' ? 'accept' : milestone.status === 'terminated' ? 'rejected' : ''], ['Started', milestone.start], ['Ended', milestone.end],
            ['Proposed time', number === 1 ? example.proposed || 'Unavailable' : 'Unavailable'],
            ['Time endorsements', number === 1 ? example.endorsements || 0 : 0], ['Termination votes', number === 1 ? example.votes || 0 : 0], ['Paid amount', milestone.paid],
            ...(milestone.payout ? [['Expected payout', milestone.payout], ['Delivery timing', milestone.timing]] : []),
          ])}</div>` : ''}
        </div>
      </details>
      ${actions ? `<section class="dao-project-milestone-actions" aria-label="Milestone ${number} actions"><h5>Milestone actions</h5>${actions}</section>` : ''}
    </div>`;
  }

  function renderOptions(isProject) {
    const options = isProject ? ['Reject', 'Fund project'] : ['no', 'Update parameters'];
    return `<section class="proposal-info-section"><h3>Proposal Options</h3>
      <div class="proposal-option-cards${isProject ? ' dao-project-ballot' : ''}">${options.map((option, index) => `
        <div class="proposal-option-section${!isProject && index === 0 ? ' proposal-option-section--no-change' : ''}">
          <span class="proposal-option-label">${option}</span>
          ${isProject ? `<div class="proposal-option-changes"><p class="proposal-info-muted">${index === 0 ? 'Project is not funded.' : 'Approve the recipient, milestones, and maximum budget below.'}</p></div>`
            : index === 0 ? '<p class="proposal-info-muted"><span class="proposal-change-arrow" aria-hidden="true">&rarr;</span> No parameter changes.</p>'
            : '<div class="proposal-option-changes"><div class="proposal-change-row"><span>proposalFeeUsdStr</span><div class="proposal-change-values"><small><span>Current:</span><strong>50</strong></small><span class="proposal-change-arrow" aria-hidden="true">&rarr;</span><small><span>New:</span><strong>40</strong></small></div></div></div>'}
        </div>`).join('')}</div></section>`;
  }

  function renderMeter(tallies, winner, ariaLabel) {
    const total = tallies.reduce((sum, tally) => sum + tally.value, 0);
    return `<div class="proposal-result-meter" aria-label="${ariaLabel}">
      <div class="proposal-result-meter-labels">${tallies.map((tally, index) => `
        <div class="proposal-result-meter-label proposal-result-meter-label--${index === 0 ? 'start' : 'end'} proposal-result-meter-label--${tally.tone}${index === winner ? ' proposal-result-meter-label--winner' : ''}">
          <span>${tally.label}</span><small>${Number((tally.value / total * 100).toFixed(1))}% (${tally.display})</small>
        </div>`).join('')}</div>
      <div class="proposal-result-meter-track" aria-hidden="true">${tallies.map((tally) => `
        <span class="proposal-result-meter-segment proposal-result-meter-segment--${tally.tone}" style="--result-segment-units: ${Math.round(tally.value / total * 1000)};"></span>`).join('')}</div>
    </div>`;
  }

  function renderCommitteeVotes(withheld) {
    return `<div class="proposal-committee-votes"><h4>Committee votes</h4><ul class="proposal-committee-vote-list">
      ${['Ari Rivera', 'Sam Chen', 'Mina Patel'].map((name, index) => {
        const vote = index === 2 || (withheld && index === 1) ? 'withhold' : 'accept';
        return `<li class="proposal-committee-vote-row"><span class="proposal-committee-vote-address"><strong>${name}</strong><small>0x${index + 1}2…a${index + 1}b</small></span><span class="proposal-committee-vote-choice proposal-committee-vote-choice--${vote}">${vote === 'accept' ? 'Accept' : 'Withhold - Deliverables need clarification'}</span></li>`;
      }).join('')}</ul></div>`;
  }

  function renderTallies(state, isProject) {
    const committee = state === 'review' || state === 'withheld';
    const withheld = state === 'withheld';
    const rejected = state === 'rejected';
    const tallies = committee ? [
      { label: 'Accept', value: withheld ? 1 : 2, display: withheld ? '1 vote' : '2 votes', tone: 'accept' },
      { label: 'Withhold', value: withheld ? 2 : 1, display: withheld ? '2 votes' : '1 vote', tone: 'withhold' },
    ] : [
      { label: isProject ? 'Reject' : 'no', value: rejected ? 23.4 : 8.3, display: rejected ? '23.4' : '8.3', tone: 'palette-0' },
      { label: isProject ? 'Fund project' : 'Update parameters', value: rejected ? 8.3 : 23.4, display: rejected ? '8.3' : '23.4', tone: 'palette-1' },
    ];
    const winner = state === 'review' ? -1 : rejected ? 0 : 1;
    const meter = renderMeter(tallies, winner, committee ? 'Committee review vote totals' : 'Vote result breakdown');
    if (state === 'review' || state === 'voting') {
      return `<section class="proposal-info-section proposal-vote-current-section"><div class="proposal-vote-current-heading"><h3>${committee ? 'Committee Review' : 'Current Vote'}</h3><span${committee ? '' : ' class="proposal-vote-current-deadline"'}>${committee ? 'Review ends: Aug 22, 9:00 AM' : 'Voting ends: Aug 29, 9:00 AM'}</span></div>${meter}${committee ? renderCommitteeVotes(false) : ''}</section>`;
    }
    return `<section class="proposal-info-section"><h3>Results</h3><div class="proposal-result-overview">
      <div class="proposal-result-card"><span>${committee ? 'Outcome' : 'Winner'}</span><span class="proposal-result-value">${committee ? 'Withheld' : tallies[winner].label}</span></div>
      <div class="proposal-result-card"><span>${committee ? 'Committee size' : 'Total voting power'}</span><span class="proposal-result-value">${committee ? '3' : '31.7 power'}</span></div>
    </div>${meter}${committee ? renderCommitteeVotes(true) : ''}</section>`;
  }

  function renderVoteForm() {
    return `<section class="proposal-vote-actions" id="proposalVoteActionSection" aria-label="Proposal voting actions">
      <div class="proposal-committee-actions-header"><h3>Vote preview</h3><p id="proposalVoteActionHelp">Allocate option weights and choose a minimum-spend multiple to preview voting power.</p></div>
      <div class="proposal-vote-options" id="proposalVoteOptions">
        <div class="proposal-vote-options-header"><span>Option</span><span>%</span><span class="proposal-vote-weight-label">Weight<button type="button" class="toll-info-icon proposal-vote-help" data-icon="info" aria-label="About weight"></button></span></div>
        ${['Reject', 'Fund project'].map((option, index) => `<label class="proposal-vote-option"><span>${option}</span><span class="proposal-vote-weight-percent" data-vote-weight-percent="${index}" aria-label="${option} percent">0%</span><input type="number" class="form-control" min="0" max="1000000" step="1" inputmode="numeric" placeholder="0" aria-label="${option} weight" data-vote-option-index="${index}" value="0" /></label>`).join('')}
        <div class="proposal-vote-requirements" aria-label="Vote requirements">
          ${[['Vote Threshold', '10 LIB'], ['Minimum Spend', '1 LIB']].map(([label, value]) => `<span class="proposal-vote-requirement-label">${label}<button type="button" class="toll-info-icon proposal-vote-help" data-icon="info" aria-label="About ${label}"></button></span><span class="proposal-vote-requirement-value">${value}</span>`).join('')}
        </div>
      </div>
      <div class="proposal-vote-spend-multiple-row"><label for="proposalVoteSpendMultiple">Spend multiple</label><input type="number" id="proposalVoteSpendMultiple" class="form-control" min="1" step="1" inputmode="numeric" value="1" /><span id="proposalVoteMinimumSpend">× 1 LIB minimum spend</span></div>
      <div class="proposal-vote-preview proposal-vote-preview--message" id="proposalVotePreview"><div class="proposal-vote-preview-message proposal-vote-preview-message--warning">Enter at least one positive option weight.</div></div>
      <button type="button" class="btn btn--primary btn--pill btn--full" id="proposalVoteSubmit" disabled>Submit vote</button>
    </section>`;
  }

  function renderScreen(example) {
    const isProject = example.state !== 'applied';
    const runtime = ['executing', 'completed', 'terminated'].includes(example.state);
    const multiple = Boolean(example.nextMilestone);
    const title = example.title || `${labels[example.state]} proposal`;
    const optionsMarkup = renderOptions(isProject);
    const resultsMarkup = ['review', 'voting', 'canceled'].includes(example.state) ? '' : renderTallies(example.state, isProject);
    return `<article class="screen" data-app-modal="proposalInfoModal" data-proposal-state="${example.state}" data-state-example="${example.id}"${example.endorsementPreview ? ` data-endorsement-preview="${example.endorsementPreview}"` : ''}>
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
          </div></section>` : optionsMarkup + resultsMarkup}
          ${example.state === 'review' ? renderTallies('review', isProject) : ''}
          ${example.state === 'voting' ? renderTallies('voting', isProject) : ''}
        </div>
        ${example.actions || example.contractorChange ? `<section class="proposal-lifecycle-actions">
          ${example.contractorChange ? section('Pending Contractor Change', [['Proposed recipient', '0x71ce19c13ae97c71d8202d59e31f7c82d7a183b2'], ['Endorsements', `${example.contractorEndorsements} of 3 required`]], 'dao-project-info-recipient-change') : ''}
          ${example.actions ? `<div class="proposal-lifecycle-action-group"><h3>Project actions</h3>${example.actions}</div>` : ''}
        </section>` : ''}
        ${example.state === 'voting' ? renderVoteForm() : ''}
        <div class="proposal-details"><details class="proposal-more"><summary><span class="proposal-more-title">Show proposal details</span><span class="proposal-more-note">${isProject ? 'Proposal options, results, overview, review timeline' : 'Overview, review timeline'}${example.state === 'review' ? ', committee review' : ''}</span></summary><div class="proposal-more-content">
          ${isProject ? optionsMarkup + resultsMarkup : ''}
          ${section('Overview', [['Number', '#1048'], ['Type', isProject ? 'Project' : 'Governance'], ['Status', labels[example.state]], ['Created', 'Aug 20, 2026, 9:00 AM'], ['Updated', example.state === 'review' ? 'Aug 21, 2026, 9:00 AM' : example.state === 'voting' ? 'Aug 25, 2026, 9:00 AM' : 'Sep 16, 2026, 9:00 AM']])}
          ${section('Review Timeline', [['Window state', example.state === 'review' ? 'Review open' : 'Review ended'], ['Review starts', 'Aug 20, 2026, 9:00 AM'], ['Review ends', 'Aug 22, 2026, 9:00 AM']])}
          ${example.state === 'review' ? section('Committee Review', [['Committee size', '3'], ['Next state', 'Voting if finalized']]) : ''}
        </div></details></div>
      </div></div></div>
    </article>`;
  }

  window.PROPOSAL_STATE_GROUPS = [
    { title: 'Committee endorsements', note: 'Start time, completion time, and contractor changes with one or two endorsements, plus your already-endorsed view. These snapshots open and scroll to the relevant details.', examples: endorsementCases },
    { title: 'Proposal states', note: 'Every proposal status, including parameter-only Applied.', examples: proposalCases },
    { title: 'Milestone states and payments', note: 'Pending, Executing, Completed, and Terminated, with payment variants. Expand milestones and action cards to inspect them.', examples: milestoneCases },
    { title: 'Project start, contractor changes, and closeout', note: 'Role and timing determine which actions appear. Each phone is an independent snapshot.', examples: closeoutCases },
  ];
  window.PROPOSAL_STATE_MARKUP = window.PROPOSAL_STATE_GROUPS.map((group) => `
    <div class="preview-subsection"><div class="section-heading"><h2 class="section-title">${group.title}</h2><div class="section-note">${group.note}</div></div>
      <div class="preview-grid">${group.examples.map(renderScreen).join('')}</div>
    </div>`).join('');
})();
