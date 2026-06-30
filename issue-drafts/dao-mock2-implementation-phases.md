# Implement DAO UI From Mock2 In Phases

## Context

We have a working `mock2` flow that better represents the intended DAO UX, but the design is still not final. This issue should track implementation in phases so we can ship useful DAO improvements without needing every DAO route and transaction flow finished at once.

Reference mock in this repo, branch `dao-mock-flow-zoom-pan`:

- `mock2/index.html`

Current implementation references in this repo:

- `DAO.md`
- `DAO_SCREEN_FLOW.md`
- `dao.repo.js`
- `dao.mock-data.js`

Backend transaction reference in `Liberdus/server`, branch `dev`:

- `src/transactions/dao`

## Goal

Move the DAO UI from the current in-memory mock experience toward the `mock2` proposal-list-first flow, using real DAO data/actions as they become available.

The first milestone should focus on the DAO modal itself:

- Remove mock-only DAO data from the production DAO modal.
- Update the DAO proposal list layout.
- Update the filter dropdown.
- Keep the design flexible because the final visual treatment is still being worked out.

## Issue Strategy

Use this as the parent/base issue for the DAO UI implementation plan. After this base issue is created, create detailed child issues for the phases below. In most cases, each phase should be split into a UI/class-structure issue and a backend/query-integration issue. Each child issue should include its own implementation notes, file targets, backend assumptions, acceptance criteria, and validation steps.

Each phase should usually become two child issues:

1. **Phase N.A: class/UI structure**
   - Rework the modal/list/form structure and user flow.
   - Keep data local, adapted, or stubbed only as needed to prove switching and layout.

2. **Phase N.B: backend/query integration**
   - Replace the temporary data path with real DAO queries/actions.
   - Add loading, error, refresh, and post-action behavior.

Suggested child issue order:

- [ ] Phase 1.A: DAO Modal, List Shape, And Filter Dropdown UI
- [ ] Phase 1.B: DAO Modal, List Shape, And Filter Dropdown Backend Integration
- [ ] Phase 2.A: Add Proposal Form UI
- [ ] Phase 2.B: Add Proposal Form Data Integration
- [ ] Phase 3.A: Confirm Proposal / Sign Review UI
- [ ] Phase 3.B: Confirm Proposal / Sign Review Transaction Integration
- [ ] Phase 4.A: Proposal Status And Committee Review UI
- [ ] Phase 4.B: Proposal Status And Committee Review Backend Integration
- [ ] Phase 5.A: Voting Flow UI
- [ ] Phase 5.B: Voting Flow Transaction Integration
- [ ] Phase 6.A: Results And Rewards UI
- [ ] Phase 6.B: Results And Rewards Backend Integration
- [ ] Phase 7.A: Ready Actions / Apply Parameters UI
- [ ] Phase 7.B: Ready Actions / Apply Parameters Backend Integration

Each phase should be implemented in two steps:

1. **Client structure and UX first**
   - Add or update the classes/components/helpers needed for that screen or modal.
   - Build the UI/UX, routing, modal switching, local state, empty states, and validation behavior.
   - Use stable local/adapted data while the interactions are being shaped.
   - Confirm the screen can be reached from the expected DAO route and can navigate to the next step.

2. **Backend/query integration second**
   - Replace local/adapted data with the real repository/query/action path.
   - Map backend data into the UI shape.
   - Wire submit/sign/finalize actions where that phase requires them.
   - Add loading, error, refresh, and post-action state handling.

This keeps each phase shippable and reviewable: first prove the class/UI flow and transitions, then connect it to real DAO data and transactions.

## Reuse Existing App Structure

`mock2/index.html` is a behavior/layout reference, not production code to copy directly. Each detailed phase issue should explicitly mention what existing HTML, CSS, and `app.js` structure it is reusing.

HTML reminders:

- Keep the existing modal shell pattern in `index.html`: `.modal.fixed-header`, `.modal-header`, `.modal-title`, `.modal-content`, existing close/filter/add button placement, and existing modal IDs where possible.
- Current DAO entry points are `#daoModal`, `#addProposalModal`, `#proposalInfoModal`, `#daoFilterButton`, `#daoStatusContextMenu`, `#daoProposalList`, and `#daoAddProposalButton`.
- Prefer updating those existing DOM sections over creating parallel DAO mock markup.
- Preserve common app controls where they already exist: `.icon-button`, `.filter-icon`, `.floating-button`, `.message-context-menu`, `.context-menu-option`, `.chat-list`, `.chat-item`, `.empty-state`, `.form-group`, and `.form-control`.

CSS reminders:

- Reuse existing CSS variables and shared classes before adding DAO-only styles.
- Put DAO-specific styling under scoped selectors such as `#daoModal ...`, `#addProposalModal ...`, or `#proposalInfoModal ...` so other app modals are not affected.
- Extend the current DAO CSS area in `styles.css` instead of creating a second visual system from the mock.
- Keep the app's existing modal/footer/list/button behavior intact: modal shell stays fixed, content scrolls, footers/actions stay anchored when needed, and floating buttons should not warp list layout.
- If a phase needs a new class, name it semantically for production behavior, not for the mock artifact. Example: prefer `dao-row-preview`, `dao-filter-count`, or `dao-proposal-option-input` over names tied to a screenshot.

`app.js` structure reminders:

- Keep DAO behavior in the existing modal classes unless a phase clearly needs a new class:
  - `DaoModal` for the entry proposal list, active/archive toggle, status filter, list rows, empty/loading/error state, and row routing.
  - `AddProposalModal` for proposal draft form state and validation.
  - `ProposalInfoModal` or a replacement/detail class for proposal status, voting, review, result, and reward detail flows.
- Follow the current class lifecycle shape: `load()` queries DOM and wires events, `open()`/`close()` manage modal state, `render()` updates DOM from state, and action handlers call repo/action helpers.
- Do not hardcode backend fetch/transaction logic directly into modal rendering. Keep DAO data mapping and backend fetch boundaries in `dao.repo.js` or a similarly named DAO helper.
- Keep route/status decisions centralized enough that row clicks are easy to audit. The DAO list should route by proposal state/capability instead of each row having unrelated inline logic.
- When a phase introduces a new screen state, add a small state model first, then render from that state. Avoid one-off DOM mutation paths that bypass the modal class state.

Child issue checklist:

- List existing classes/selectors being reused.
- List any new classes/selectors and why they are needed.
- State whether the issue is UI/class structure or backend/query integration.
- State which temporary mock/stub data, if any, is allowed and when it should be removed.

## Non-goals

- Do not implement every DAO transaction flow in the first phase.
- Do not finalize visual design in this issue.
- Do not block DAO modal/list cleanup on later create/vote/reward screens.
- Do not keep `mock2` UI as production code; use it as a behavior/layout reference.

## Phase 1.A: DAO Modal, List Shape, And Filter Dropdown UI

Primary intent: make the DAO entry modal useful and proposal-list-first before connecting real data.

- [ ] Keep DAO entry as proposal-list-first: Menu -> DAO -> proposal list.
- [ ] Rework `DaoModal` around the existing modal shell and list structure.
- [ ] Keep `Active` / `Archived` as a visible segmented control if this grouping is still supported.
- [ ] Update the filter button dropdown so status counts are shown as separate count tokens, not inline text.
- [ ] Keep filter options easy to scan.
- [ ] Make the proposal list scroll independently inside the DAO modal.
- [ ] Keep the floating `+` button anchored above the bottom-right of the modal, not pushed by list content.
- [ ] Update proposal rows to use consistent row sizing.
- [ ] Add compact row previews where useful:
  - Voting preview
  - Result preview
  - Reward preview
  - Review preview
- [ ] Preserve route behavior by proposal status:
  - Voting row opens the vote flow.
  - Review row opens review/status flow.
  - Accepted/rejected/result row opens result flow.
  - Claimable reward row opens reward flow.
- [ ] Use local/adapted proposal data only as needed to prove list rendering, filters, and route switching.

Acceptance criteria:

- Filter dropdown has separate status labels and count tokens.
- Proposal rows are visually consistent and readable.
- The proposal list scrolls without moving/warping the floating `+` button.
- Row click behavior is testable with local/adapted data.

## Phase 1.B: DAO Modal, List Shape, And Filter Dropdown Backend Integration

Primary intent: replace temporary DAO list data with the real repository/query path.

- [ ] Remove dependency on `dao.mock-data.js` for the production DAO modal.
- [ ] Make `dao.repo.js` load DAO proposals from the real backend/fetcher path instead of the in-memory mock store.
- [ ] Map backend proposal data into the UI row shape used by `DaoModal`.
- [ ] Populate `Active` / `Archived` counts from backend data or documented client derivation.
- [ ] Populate status filter counts from backend data or documented client derivation.
- [ ] Keep a clear empty/loading/error state when backend data is unavailable.
- [ ] Refresh the DAO list after proposal create, vote, review, result, reward, and ready-action changes when those integrations exist.

Acceptance criteria:

- DAO modal no longer displays generated mock proposals in production mode.
- Filter counts match the loaded proposal data.
- Empty/loading/error states are understandable.
- Backend/query logic stays behind `dao.repo.js` or a DAO data helper, not inline in row rendering.

## Phase 2.A: Add Proposal Form UI

Primary intent: replace the old mock create form with a form that maps to `dao_proposal_create`.

- [ ] Update Add Proposal modal to use real form controls:
  - `proposalType` dropdown: governance, economic, protocol
  - options as separate inputs, not comma-separated text
  - `+ Add option` control
  - parameter selector dropdown
  - current value shown read-only
  - proposed value input
  - emergency dropdown
  - timing controls
  - description textarea
- [ ] Enforce or clearly show server-side option rules:
  - 2 to 10 options
  - `options[0]` must be affirmative: `yes`, `accept`, or `approve`
- [ ] Show read-only placeholders for derived fields such as proposal fee and current parameter value.
- [ ] Do not ask users to manually enter generated fields such as `proposalId`, `metaId`, timestamp, or signature.
- [ ] Keep form state in `AddProposalModal` or a small helper that follows the existing class pattern.

Acceptance criteria:

- User can understand which fields they enter and which fields are derived.
- No comma-separated option entry is required.
- Form validation and navigation can be tested with local/adapted data.

## Phase 2.B: Add Proposal Form Data Integration

Primary intent: connect the Add Proposal form to real DAO params and build the transaction draft consumed by confirmation.

- [ ] Load proposal type choices from the supported DAO transaction/schema constants where possible.
- [ ] Load parameter choices and current values from DAO params or a documented repo helper.
- [ ] Load proposal fee as read-only/server-derived data.
- [ ] Build a `dao_proposal_create` draft payload from form state.
- [ ] Validate option count and affirmative first-option rules before moving to confirmation.
- [ ] Keep generated-at-submit fields out of the form: `proposalId`, `metaId`, timestamp, and signature.
- [ ] Pass the draft payload to the confirm/sign flow without submitting yet.

Acceptance criteria:

- Form data maps directly to the server transaction fields.
- Derived fields are populated from DAO data, not manually entered.
- The confirm screen receives a complete draft payload.

## Phase 3.A: Confirm Proposal / Sign Review UI

Primary intent: make the confirmation screen explain what will be submitted.

- [ ] Add a Confirm Proposal modal before signing.
- [ ] Show a structured submitted-payload summary:
  - Cost and initial state
  - Transaction fields
  - Proposal body
  - Parameter change
  - Generated-at-submit fields
- [ ] Make clear that the proposal fee is derived from DAO params and seeds the voter reward pool for regular proposals.
- [ ] Put secondary action on the left and primary signing action on the right.
- [ ] Show non-committee author next state: proposal lands in review/status after signing.
- [ ] Show committee-only behavior separately if emergency proposals or committee-only creation changes the route.

Acceptance criteria:

- User can review all meaningful fields before signing.
- User can tell which fields are submitted, derived, or generated at signing time.
- Button placement and next-step copy are clear before backend submission is wired.

## Phase 3.B: Confirm Proposal / Sign Review Transaction Integration

Primary intent: submit the confirmed proposal through the real `dao_proposal_create` action.

- [ ] Generate submit-time fields such as timestamp, proposal id, meta id, and signature.
- [ ] Submit/sign `dao_proposal_create`.
- [ ] Handle signing/submission loading state.
- [ ] Handle signing/submission errors without losing the draft.
- [ ] After successful submit, route to proposal review/status.
- [ ] Refresh DAO list/status data after submit.

Acceptance criteria:

- Successful signing creates a proposal in review state.
- Submit-time generated fields match the backend transaction requirements.
- Failed signing/submission leaves the user able to retry or cancel.

## Phase 4.A: Proposal Status And Committee Review UI

Primary intent: show what happens after create while proposal is in review.

- [ ] Add proposal review/status screen.
- [ ] Show review timer/window.
- [ ] Show public status for non-committee users.
- [ ] Show committee actions only for committee members:
  - accept
  - withhold
  - withhold reason
- [ ] Base committee action visibility on the proposal snapshot, not only the live DAO committee list:
  - `proposal.committeeAddresses.includes(currentAddress)`
- [ ] Make clear whether the next state is voting or withheld.
- [ ] Use local/adapted capability flags to prove committee vs non-committee display.
- [ ] Keep `dao_committee_result` visually separate from committee voting because finalizing the review result is a ready action after `reviewEnd`, not the same footer action as Accept/Withhold.

Acceptance criteria:

- Non-committee users can understand proposal status without seeing committee-only actions.
- Committee members can see and perform review actions.
- Accept and Withhold buttons render in the footer only for proposal committee members.
- Withhold reason appears only when the committee member chooses Withhold.
- The UI communicates the expected next state before backend actions are wired.

## Phase 4.B: Proposal Status And Committee Review Backend Integration

Primary intent: wire committee review screens to real proposal role/capability data and actions.

- [ ] Load proposal review detail and review window from backend/repo data.
- [ ] Load proposal `committeeAddresses` snapshot from backend/repo data.
- [ ] Load user committee capability from backend/repo data, or derive `canCommitteeVote` from `proposal.committeeAddresses.includes(currentAddress)` if the backend does not return capability flags.
- [ ] Prefer a proposal-detail capability shape when available:
  - `isCommitteeMemberForProposal`
  - `canCommitteeVote`
  - `canFinalizeReviewResult`
- [ ] Support `dao_committee_vote`.
- [ ] Support `dao_committee_result` when review window ends as a separate ready/finalize action.
- [ ] Refresh proposal detail and DAO list after committee actions.
- [ ] Keep committee-only actions hidden or disabled for non-committee users based on real capability data.
- [ ] Do not require committee membership for `dao_committee_result` unless backend rules change; current server validation only requires a valid funded sender, review status, and reviewEnd to have passed.

Acceptance criteria:

- Committee actions submit correctly.
- Review result routes proposals correctly.
- Non-committee users cannot perform committee-only actions through the UI.
- Committee membership checks match the server rule for `dao_committee_vote`.

## Phase 5.A: Voting Flow UI

Primary intent: replace current yes/no mock voting with the weighted DAO vote flow.

- [ ] Add voting proposal detail/form.
- [ ] Show eligibility and vote deadline.
- [ ] Support multiple proposal options.
- [ ] Let voter enter weights per option.
- [ ] Let voter enter spend amount.
- [ ] Show estimated applied weight before submit.
- [ ] Add a clear applied-weight visualization so the number is easier to understand.
- [ ] Show audit trail / recent vote rows using local/adapted data where useful.
- [ ] Add preview/submit button states without submitting yet.

Acceptance criteria:

- Voting UI explains how the entered weights and spend affect applied weight.
- User can preview before signing/submitting.
- Multiple options are supported in the UI, not only yes/no.

## Phase 5.B: Voting Flow Transaction Integration

Primary intent: submit weighted votes through the real DAO vote transaction path.

- [ ] Load voter eligibility, voting deadline, options, and existing vote state from backend/repo data.
- [ ] Calculate or request the same applied-weight estimate the backend expects.
- [ ] Submit `dao_vote`.
- [ ] Add loading, error, and retry behavior for vote submission.
- [ ] Show audit trail / recent vote rows from backend/repo data where available.
- [ ] Refresh proposal detail and DAO list after voting.

Acceptance criteria:

- Submitted votes update proposal state after refresh.
- Applied weight shown before submit matches the submitted vote behavior.
- Ineligible users cannot submit votes through the UI.

## Phase 6.A: Results And Rewards UI

Primary intent: support finalized results and voter rewards.

- [ ] Add Results screen.
- [ ] Show current/final weighted totals and winning option.
- [ ] Add Rewards screen.
- [ ] Show claim window, initial burn, reward estimate, claimed amount, and unclaimed pool.
- [ ] Make reward rows discoverable from DAO modal.
- [ ] Show compact result and reward previews in DAO rows.
- [ ] Use local/adapted data to prove result and reward navigation.

Acceptance criteria:

- Result rows clearly preview the outcome before opening details.
- Claimable reward rows clearly preview claim amount/window.
- Reward screen explains what can be claimed and what has already been claimed/burned.

## Phase 6.B: Results And Rewards Backend Integration

Primary intent: wire finalized proposal results and rewards to real DAO actions.

- [ ] Load current/final weighted totals and winning option from backend/repo data.
- [ ] Support `dao_vote_result` after voting ends.
- [ ] Load reward pool, claim window, claimed amount, and user claim eligibility from backend/repo data.
- [ ] Support `dao_claim_reward`.
- [ ] Support `dao_burn_reward` after claim end where applicable.
- [ ] Refresh result/reward screens and DAO row previews after actions.

Acceptance criteria:

- Result rows and result detail match backend proposal totals.
- Reward claim and burn actions submit correctly.
- Reward screen state updates after claim/burn refresh.

## Phase 7.A: Ready Actions / Apply Parameters UI

Primary intent: expose lifecycle actions that are permissionless or role-dependent.

- [ ] Add ready-action queue if needed.
- [ ] Include review-result finalization when a review proposal has passed `reviewEnd`.
- [ ] Make clear that regular accepted proposals can be applied by any funded user after `applyEligibleAt`.
- [ ] Make clear that emergency proposal apply behavior may be committee-only.
- [ ] Show apply/burn/finalize actions as distinct rows or buttons with clear role/timing copy.
- [ ] Use local/adapted readiness data to prove discoverability and routing.

Acceptance criteria:

- Users can discover valid lifecycle actions without needing to know transaction names.
- The UI explains who can perform the action and why it is currently available.

## Phase 7.B: Ready Actions / Apply Parameters Backend Integration

Primary intent: wire ready actions to real DAO lifecycle transactions.

- [ ] Load ready-action eligibility from backend/repo data.
- [ ] Surface `dao_committee_result` as a ready action after `reviewEnd`.
- [ ] Support `dao_apply_parameters`.
- [ ] Support any final burn/apply actions surfaced by backend state.
- [ ] Add loading, error, refresh, and post-action handling.
- [ ] Refresh DAO params/proposal detail/DAO list after successful actions.

Acceptance criteria:

- Ready actions only appear when backend state says they are available.
- Successful actions update affected proposal and DAO parameter state after refresh.
- Failed actions show an understandable error and leave the user able to retry.

## Data / Backend Notes

The UI should expect backend-backed DAO data instead of generated mock data. Exact endpoint shape still needs to be confirmed, but the UI will need enough data to render:

- proposal id / number
- title or description summary
- proposal status
- proposal type
- proposal committee address snapshot
- options
- timing windows
- current totals
- reward pool / claim state
- user eligibility or role-specific capability flags where available

Relevant transaction types:

- `dao_proposal_create`
- `dao_committee_vote`
- `dao_committee_result`
- `dao_vote`
- `dao_vote_result`
- `dao_claim_reward`
- `dao_burn_reward`
- `dao_apply_parameters`

## Open Questions

- What exact backend endpoints should the web client call for proposal list/detail/counts?
- Should `Active` / `Archived` be server-derived or client-derived?
- Should the DAO modal show all proposal categories in one list, or keep separate category/list routes?
- How should claimable reward rows be sourced: proposal list endpoint, user-specific rewards endpoint, or both?
- What user role/capability fields will backend expose for committee-only and emergency actions?
- Will proposal detail return explicit capabilities such as `canCommitteeVote`, or should the client derive committee review permissions from `proposal.committeeAddresses`?
- Should `startTime` be exposed in the Add Proposal form, or hidden unless scheduled review is enabled?
- Should parameter keys be grouped by proposal type in the API so the UI can populate dropdowns safely?

## Suggested First PR

Start with `Phase 1.A` only:

- [ ] Update DAO modal class/UI structure, proposal list layout, list scroll behavior, and floating `+` placement.
- [ ] Update filter dropdown counts into tokens.
- [ ] Keep create/vote/result/reward routes stubbed or existing until later phases.
- [ ] Use a stable adapter/local fixture only long enough to prove route switching and UI behavior.
- [ ] Leave backend/query replacement for `Phase 1.B`.

Then open `Phase 1.B` as the next PR:

- [ ] Replace mock DAO list data with the backend-backed repository/query path.
- [ ] Map backend proposal data into the row/filter/count shape from `Phase 1.A`.
- [ ] Add loading, error, refresh, and post-action list behavior.

This keeps the first PR focused on the DAO entry point UI and avoids mixing form submission, voting, rewards, committee review, and backend integration into one large change.
