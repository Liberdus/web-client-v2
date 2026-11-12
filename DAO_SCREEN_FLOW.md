# DAO Screen Flow

This reference follows the UI and DAO project lifecycle on `main` at `b99afc85` (November 11, 2026). The interactive reference is [`mock/index.html`](mock/index.html).

Its device frames use the iPhone 17 Pro logical viewport (`402 × 874`) and load the production stylesheet. Proposal previews use the production responsive layout without milestone style overrides.

## Entry and list

The Devnet-only **DAO** Menu item opens `daoModal`. The modal loads proposal metadata and details from the DAO backend, initially selects **Vote**, and remembers the selected filter. A DAO notification can choose **Vote** or **Claim** as the initial filter.

The modal title stays **DAO**. Navigation scrolls with the list and contains:

- **All** and **Claim**, available in both contexts.
- A **Proposals / Projects** context switch.
- Proposal filters grouped as **Review / Withheld** and **Vote / Rejected / Accepted / Applied**.
- Project filters **Executing / Terminated / Completed**.

Only the selected context's filters are active. The mock includes proposal and
project list examples with the same production navigation and responsive styles.

All except **Claim** and **All** are server proposal-status filters. **All** contains every metadata entry. **Claim** is account-specific: it starts with locally tracked claim candidates, loads fresh proposal details, and only displays rows that are currently claimable.

Proposal rows show the title, proposal type, and contextual preview badges. Preview badges expose important timing and actions without adding separate screens, including:

- review or voting deadlines;
- ready-to-finalize status;
- accepted, rejected, or emergency results;
- ready-to-claim, ready-to-burn, and ready-to-apply actions.

The floating **+** button opens `addProposalModal`.

## Proposal creation

```text
DAO list
  -> Add Proposal
  -> Review Proposal
  -> Sign Proposal
  -> previous DAO filter + pending confirmation toast
  -> Review filter after settlement
```

**Add Proposal** includes:

- emergency and proposal-fee fields;
- title, description, and proposal type;
- the fixed first **no change** option;
- one to nine additional options with typed parameter changes;
- review-delay and grace-period pickers;
- Cancel and Review Draft actions.

For **Committee Addresses**, a governance draft starts with the current list and
accepts 4–10 unique addresses. The editor marks duplicate entries inline.
The review screen shows the current and proposed lists as copyable addresses.
Economic parameter fields include **Transaction Fee** in USD, **Archiver Versions**
with three text fields, and units or conversion hints beside the relevant inputs.

**Review Proposal** reuses the same heading, option cards, overview cards, and review-timeline cards as the shared Proposal modal. Signing closes the creation modals and returns to the previously selected DAO filter. It does not automatically open the new proposal or select Review.

## Shared Proposal modal

Every proposal row opens `proposalInfoModal`. The modal title reflects the effective proposal state, and the body starts with the proposal heading. Project proposals show funding and milestones first, with option cards in the expandable details. State-, role-, account-, and time-dependent sections are added below them.

| Effective state | Always visible | Contextual actions |
| --- | --- | --- |
| Review | Proposal options and committee totals | Committee members can submit Accept or Withhold while review is open. After `reviewEnd`, a funded user can finalize the review result. |
| Voting | Proposal options and current weighted totals | Eligible users can allocate integer weights, select a whole-number minimum-spend multiple, preview power, and submit a vote. After `votingEnd`, a funded user can finalize the vote result. |
| Accepted | Winning option, result meter, and expandable details | Claim reward during the account's eligible claim window; apply parameters after the grace period; burn unclaimed rewards after the claim window. |
| Rejected | Winning option, result meter, and expandable details | Claim or burn rewards when the corresponding lifecycle conditions are met. |
| Withheld | Committee result, committee votes, and expandable details | Reward lifecycle actions when available. |
| Applied | Result and expandable reward accounting | Remaining reward lifecycle actions when available. |

The expandable **Show proposal details** section contains overview data, the review timeline, committee review information during Review, and reward accounting when available.

**Your vote** opens expanded for the signed-in voter. Submitted casts show the
LIB allocation. Confirmed casts can show the option shares and voting power.
Failed casts show the attempted spend and are excluded from the **Spent** total,
which stays visible when the section is collapsed. A vote recorded by the network
with no saved local cast displays **Vote recorded**.

## State transitions

```text
Review
  -> committee votes during the review window
  -> Finalize review result
     -> Voting for an accepted standard proposal
     -> Accepted for an accepted emergency proposal
     -> Withheld when withhold wins

Voting
  -> weighted user votes during the voting window
  -> Finalize vote result
     -> Accepted when a change option wins
     -> Rejected when no-change wins

Accepted
  -> Claim reward during claim window, when eligible
  -> Apply parameters after grace period
  -> Burn unclaimed reward after claim window
  -> Applied after parameters are applied
```

## Concepts removed from the old mock

The current client does not use these older prototype concepts:

- in-memory DAO mock data;
- Active/Archived tabs;
- a funnel-based status overlay;
- a DAO category dashboard;
- a separate committee queue;
- standalone Vote, Results, Rewards, Parameters, Ready Actions, or Apply Parameters modals.

Their functions now live in the filter bar, proposal-row preview badges, and the shared Proposal modal.

## Interactive mock controls

- Scroll vertically or horizontally to pan the canvas, including while hovering over an unfocused device. Dragging the board background also pans. Visible horizontal and vertical scrollbars provide direct navigation; Shift + scroll pans horizontally. Scrolling stops at the board edges so the header and tabs remain reachable.
- Click a device once to focus it; its outline turns purple and subsequent clicks and scrolling interact with its content.
- Click outside the device, press **Escape**, switch tabs, or zoom the canvas to leave device focus. Expanding or collapsing a milestone keeps focus.
- Use **+**, **−**, the percentage button, or **Ctrl/Cmd + scroll** outside a device to control zoom.
- Drag the zoom toolbar’s grip to move it within the window. With the grip focused, arrow keys move it (Shift for larger steps), and Home restores its default position. Resizing keeps a moved toolbar visible.
- Click a flow arrow, arrow label, or connected source control to pin its animated highlight.
- Run `node mock/validate-current-flow.mjs` after changing production DAO modal labels or actions.


## Proposal and milestone gallery

Open `mock/index.html?tab=proposals` (the existing `?tab=projects` link also works).
The **Proposals** tab includes proposal and milestone state examples, followed by
parameter and project authoring previews. All phones load the production stylesheet. Controls
illustrate available actions without submitting transactions. A second filter row beneath
the main tabs selects All, Project, Governance, Economic, or Protocol previews.
A phase row below it narrows those results to Authoring, Review, Voting, Accepted,
Executing, Completed, Terminated, Withheld, Rejected, Canceled, or Applied.
Phases refer to the proposal status, independent of individual milestone statuses;
Authoring includes the editor and signing preview. Empty combinations show a
message, and both selections are retained when switching tabs.

- Committee endorsements: start time, completion time, and contractor changes,
  each with one endorsement, two endorsements, and an already-endorsed account.
  Expand the milestone or action cards to inspect recorded counts; their initial disclosure state matches the app.
- Proposal statuses: Review, Voting, Accepted, Withheld, Rejected, Canceled,
  Applied, Executing, Completed, and Terminated. Applied is for parameter proposals.
- Your vote: the Voting, Accepted, and Rejected examples show a submitted cast,
  confirmed and failed casts, and a vote recorded on another device.
- Parameter proposals: select Governance or Economic and Authoring to see the
  committee editor and review, duplicate-address validation, or the economic form.
- Milestone statuses: Pending, Executing, Completed, and Terminated. Proposed
  times, endorsements, termination votes, and payment status are shown as variants.
- Payments: early bonus, on-time payout, late penalty, already paid, insufficient
  escrow, and completed work that remains claimable after project end or termination.
- Project actions: grace-period waiting, project start, contractor address proposals
  and endorsements, project end, the 90-day claim window, balance reclaim, and empty escrow.

The notes above each phone identify the viewing role and timing. Unavailable project
actions are hidden, matching the app. Milestone terms and runtime fields expand
independently from action cards; payment claims open by default.

State and parameter fixtures live in `mock/proposal-states.js` and
`mock/dao-parameter-previews.js`. Run
`node mock/generate-modal-catalog.mjs` after changing production modal markup, then
`node mock/validate-current-flow.mjs` to check the catalog and state coverage.

## Project proposal visual parity

The stage gallery uses the production stylesheet without milestone layout overrides.
Mobile milestone metrics stack at the production breakpoint; desktop retains the
production columns. Only review/voting milestones and the first executing milestone
start expanded, and only payment-claim actions open automatically.

Visual references are the mobile/desktop Playwright captures from proposals #70
(completed flow) and #72 (terminated flow), recorded on 2026-09-24. The original
images remain local under `tests/browser/dao/artifacts/transactions-QVATz0/` and
`transactions-asIoW4/` in the test worktree. Compare layout, section order, and
action placement; the gallery intentionally uses illustrative titles, amounts,
and accounts. Expanded test screenshots open every disclosure for inspection,
so they do not represent the application's default open/closed state.


## Chat message gallery

Open `mock/index.html?tab=chat`. The message-type filter includes text, replies,
drafts, media, files, payments, calls, voice, location, reactions, edits, deleted and
failed messages, and toll changes. Related viewers and overlays follow the same
filter, and the selection is retained when switching tabs. The Drafts preview
restores a draft over the 10,000-byte limit and updates the warning as you edit.

Choose **Pay** in the Chat actions preview or click **Send money** in Contact Info
to open the shared payment chooser. **LIB** opens Send directly. **EVM Assets**
and **NEAR Assets** open their asset lists and carry the recipient through asset
details to Send. The media previews show the in-app photo and video viewer with
rotation, the attaching indicator, and the offline **Delete for all** explanation.
Payment receipts include verification states and recovery actions for EVM and NEAR
payments. The fixtures use synthetic data and run offline.


## Wallet gallery

Open `mock/index.html?tab=wallet`. Filters select All, LIB Wallet, EVM Assets,
or NEAR Assets and retain their selection when changing tabs.
LIB and EVM use separate production Send, Confirm Transaction, and Receive modals.

The wallet overview shows the time since the last refresh attempt, the LIB asset card,
and the NEAR Assets and EVM Assets tiles. Its shell and all 73 modal shells are
generated from `index.html`. `wallet-previews.js` fills them with examples of
balances, asset details, activity, payment forms, and confirmations. The LIB and
EVM previews cover contact suggestions and receive requests with optional memos.
The NEAR Assets previews cover **Other assets**, asset details, **Receive** within
NEAR Intents, external **Deposit** and **Withdraw**, and the send form and its chat
message toll. A mismatched QR request leaves the send form intact, and a higher
toll requires a second approval. QR previews encode illustrative labels. Token
marks come from the production icon renderer at catalog-generation time.

Run `node mock/generate-modal-catalog.mjs` followed by
`node mock/validate-current-flow.mjs` when production markup changes. Runtime
rendering changes in `app.js`, `evm-assets.js`, or `near-assets.js` can also require
updating the corresponding fixture; sharing CSS alone does not keep markup current.
