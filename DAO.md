# DAO (Proposals) UI

This document describes the DAO / proposals feature as currently implemented in the web client.

## What’s implemented (current behavior)

### Entry point

- The DAO UI is opened from the main menu ("DAO").
- A glowing DAO header icon appears when proposal metadata reveals a new proposal in Voting, a tracked proposal reaches its scheduled voting end while still in Voting, or a tracked vote enters a final reward state before its local reminder expires.
- The notification icon opens Claimable first when voting and claim reminders coexist; otherwise it opens the filter matching the reminder.

### Modals

1. **DAO Modal**
   - Shows a list of proposals.
   - Includes proposal lifecycle filters and a separate **Projects:** row for **Executing**, **Terminated**, and **Completed**, with counts for every filter.
   - Project execution uses the top-level proposal states `executing`, `terminated`, and `completed`; **Applied** is reserved for parameter-change proposals.
   - There is no Archived filter.
   - The **All** status filter paginates every proposal in the complete metadata index.
   - The proposal list is filtered by the selected option.
   - Filters preserve the server metadata index order: status-transition timestamp descending, then proposal number descending.
   - Clicking a proposal opens the Proposal Info modal.
   - A floating **“+”** button opens the Add Proposal modal.

2. **Add Proposal Modal**
   - Allows creating a new proposal with:
     - Title
     - Summary
     - Type
     - Parameter proposals: a required **No change** option plus one or more options with type-specific parameter changes
     - Project proposals: a contractor address and up to 20 milestones with duration, cost, late penalty, and early bonus terms
   - The UI validates and renders the nested proposal shape in the review modal, then signs and submits the proposal transaction.

   Governance proposals include **Committee Addresses**. Selecting it prefills an
   editable row for each address in `current.dao.committeeAddresses`. Each action
   option starts with its own copy of that list. **Add address** appends a blank
   row and is disabled at ten rows; **Remove** remains available even below four.
   Inline validation requires 4–10 valid, unique addresses before review.

   Inputs accept 40-character wallet addresses or full 64-character network
   addresses, with or without `0x`. Validation trims surrounding whitespace,
   removes the prefix, lowercases the address, and pads a 40-character address
   with 24 zeros. Duplicate detection uses this normalized form. The form keeps
   the entered text when returning from review; confirmation and submitted
   proposal details show the normalized addresses as a list without `0x` or the
   24-zero wallet-address padding. Prefilled inputs also omit that padding.
   A full 64-character address without the padding suffix is displayed intact.
   Committee address lists and inputs use the app's monospace font at a compact
   size so equal-length addresses align and wallet addresses fit on mobile.
   Displayed address lists are centered; inputs stay left-aligned.
   Pressing a displayed address in Current, confirmation,
   or proposal details copies its visible text and shows the app's usual clipboard
   toast; input fields stay editable.
   Trash buttons remove addresses, parameter changes, options, or project milestones;
   each button retains a descriptive accessible label and tooltip.

   The editor stores arrays of strings. For the `committeeAddresses` change,
   `current` and `value` are JSON array strings containing full 64-character network
   addresses, preserving row order. The original current list is independent of
   every editable option and remains unchanged by edits.

3. **Proposal Info Modal**
   - Displays proposal:
     - Number (e.g. `Proposal #12`)
     - Title
     - Type label
     - State + timestamp + created-by
     - Summary
     - A card for every option, with each action option displaying only its matching nested parameter change set and its current/proposed values
   - Shows voting controls only when the proposal is in **Voting** state.
   - Voting is **Yes/No**, tracked per “voter id” derived from the current account:
     - `myAccount.address` / `myData.account.address` → fallback to username → fallback to `anon`.

### Proposal lifecycle (statuses)

The UI uses these statuses:

- `review`
- `withheld`
- `voting`
- `rejected`
- `accepted`
- `applied`
- `executing`
- `completed`
- `terminated`
- `canceled`

Accepted project proposals can be started after their grace period by a snapshotted proposal committee member. A confirmed start moves the proposal to `executing` and funds the project escrow at the server's current network rate.

For an executing project, the contractor or a proposal committee member can propose the current milestone start/completion time. Committee members endorse the pending time, and the server commits it once the required threshold is reached. Committee members can also submit a reasoned vote to terminate a pending or executing milestone.

The current contractor can claim each completed, unpaid milestone while the project is `executing`, `completed`, or `terminated`. The UI previews the fixed-rate payout and its early, on-time, or late adjustment before submission.

While a project is executing, or after it ends with funds still in escrow, committee members can propose a replacement contractor address and endorse the pending address. A new proposal resets the address endorsements, matching the server transaction contract.

Once every milestone is completed or terminated, a committee member can end the project. The project retains only funds owed to completed, unpaid milestones so the contractor can still claim them. If funds remain 90 days after the project ends, a committee member can reclaim the balance and remove it from circulation.

## Check committee proposals locally

Run `python3 -m http.server 8000` from the client checkout, open
`http://localhost:8000`, and sign into the configured Devnet. Open
**Menu → DAO → + → Governance → Committee Addresses**. No feature flag is needed.
Use a funded Devnet account for an actual submission; opening review does not
submit a transaction.

- Compare the prefilled rows with the current committee list; wallet addresses
  must display as 40 characters, with the 24-zero network padding omitted. Add
  and remove rows, including deleting every row. With fewer than four, review must stay
  blocked with a count error beside the list; adding rows allows recovery.
- At ten rows, Add address is disabled. A blank, non-hex address, or duplicate
  (including a short address and its padded full-address equivalent) blocks
  review with an inline error. Correcting it clears the error.
- Paste an uppercase address with `0x` and surrounding spaces. Review displays
  its lowercase form without the prefix or network padding. Go Back: the entered
  text and row order remain intact.
- Add another proposal option. Its initial committee is the current network
  list; editing either option does not change the other. Include a numeric
  parameter too and confirm its existing validation and review still work.
- Submit only on the intended test network. Verify both change fields are JSON
  strings containing full 64-character addresses, including the 24-zero padding
  for 40-character wallet inputs, then reopen the confirmed proposal to check the
  readable current/new lists. A rejected submission must leave the draft
  available for retry or editing.

Repeat the editor and review checks at a narrow/mobile viewport, including
keyboard focus after adding or removing rows. If configuration cannot load,
the existing unavailable state must prevent review instead of supplying an
empty committee as a default.

## Data model used by the UI

The UI consumes an in-memory “store” shape:

- `meta`: `{ count }`
- `proposals`: map of `proposalId -> full proposal`

Identifiers:

- `proposalId` is `${number}_${nonce}`.

Full proposal fields (current shape in memory):

- `number`, `nonce`
- `title`, `summary`
- `type`
- `state`
- `state_changed` (UI uses this as `stateEnteredAt`)
- `created` (UI uses this as `createdAt`)
- `createdBy`
- `fields` (type-specific)
- `votes`: `{ yes, no, by: Record<voterId, 'yes'|'no'> }`

For current multi-option proposals:

- `options[0]` is the negative/no-change choice.
- Each later option is mapped positionally to the selected type payload's nested change sets: `options[1]` → `changes[0]`, `options[2]` → `changes[1]`, and so on.
- The creation UI produces this nested `changes: ParamChange[][]` shape rather than the deprecated flat change list.

## Where the code lives

- DAO UI implementation: [app.js](app.js)
- In-memory repository abstraction: [dao.js](dao.js)
- Shared constants/helpers (states and type labels): [dao.js](dao.js)

Important implementation detail:

- Sign-in notification detection requests only the complete metadata index and combines it with the current account's locally tracked vote schedules. It does not request proposal details.
- The DAO UI requests the complete metadata index whenever the DAO is refreshed; proposal metadata is not persisted.
- Proposal details are not persisted. Status filters fetch fresh details for the visible 10 entries, “Load more” fetches the next 10, and opening a proposal refreshes that proposal again.
- The Claimable filter queries only proposals from the current account's confirmed vote history whose authoritative reward-claim window is currently open. It does not scan every finalized proposal, and it renders a candidate only when fresh details report that it is claimable.
- Account changes and sign-out clear the in-memory proposal details.
- Failed detail fetches are retried the next time their filter page or proposal is opened.

### Account claim candidates

- New accounts initialize an empty `daoUserVotes` map. For existing accounts without the map, the first confirmed vote creates it and adds its proposal number with the proposal's local reminder schedule.
- The schedule is calculated from the proposal already loaded when the vote is submitted: `votingEndsAt` is the estimated voting end, `estimatedClaimEndsAt` is `votingEndsAt + claimDuration`, and `reminderExpiresAt` adds one more day.
- The schedule is saved with the pending transaction so it survives a reload, then copied into `daoUserVotes` only after the vote confirms. Failed and timed-out votes are not tracked.
- Vote-history changes update `myData` in memory and otherwise rely on the normal account save lifecycle.
- When the DAO modal refreshes metadata, tracked proposals that have entered a final state are refreshed once and updated with the authoritative claim window derived from `votingEndedAt`.
- Repeated confirmed votes on one proposal keep a single stored entry.
- Confirmed reward claims remove their proposal number. Submitted, failed, and timed-out claims leave it available for retry.
- Proposals are hidden until their authoritative claim window opens and after it ends. Expired entries are removed from the account record when claim candidates are evaluated.
- The authoritative saved claim window narrows the account's candidate list. Fresh proposal details must confirm current eligibility before rendering, and the server remains authoritative when a claim is submitted.
- Account backups include this vote history and restore it with the rest of the account data. It does not discover votes that are absent from the restored account record.
- Otherwise ineligible candidates can remain stored until a reward is successfully claimed or the account data is cleared, but fresh details exclude them from the rendered list.

### Local notification acknowledgement

- New accounts initialize `daoNotifications.lastDaoOpenedAt` to `0`.
- The first successful sign-in metadata refresh initializes a missing or zero timestamp to a cutoff captured before the request, without showing a DAO reminder. Failed requests leave initialization pending; later sign-ins preserve the timestamp and detect new activity normally.
- Opening the DAO from either the header or menu clears the current header reminder only after metadata loads successfully.
- A cutoff timestamp captured before the metadata request is saved with the account record only after that request succeeds. Closing the DAO does not update it.
- Claim reminders take routing priority over voting reminders. When both exist, the DAO opens Claimable and both categories remain marked until all notified proposals in each category have been opened successfully.
- Proposals from the opening notification batch receive an in-memory dot. Successfully opening an individual proposal clears its dot and removes it from the corresponding filter notification; selecting the filter alone does not clear either dot.
- Unopened proposal and filter dots survive closing and reopening the DAO during the current signed-in session. Account changes, sign-out, and reload clear them without persisting per-proposal read state.
- The one-day reminder buffer is local notification timing only. Proposal details and the server remain authoritative for actual claim eligibility.

## Backend Data Boundary

- `app.js` registers `setDaoBackendFetcher(createDaoBackendFetcher(queryNetwork))`.
- `dao.js` keeps endpoint querying and backend-to-UI mapping behind the repository boundary.
- Proposal list loading uses:
  - `GET /dao/proposals/meta` on every DAO refresh
  - `GET /dao/proposals/:number` for each entry on the visible filter page
- Project-filter membership and counts use the top-level `executing`, `terminated`, and `completed` statuses in the metadata index.
- The Claimable filter requests details only for locally tracked proposal numbers with an open saved claim window that are found in the metadata index, then renders only details whose reward status is `Claimable`.
- Status, emergency flag, and status-transition ordering always come from the metadata index overlay, not the detail payload.
- The fetcher skips an unavailable detail response so it does not block the remaining indexed proposals from rendering.
- The old exhaustive `1..N` list fallback is not used when the metadata index is empty.
- Below-threshold unapply votes do not change metadata and are not reflected until the applied proposal is queried again; live unapply tracking is outside this flow.

## What must change for a live backend

This section is the remaining integration checklist after moving the DAO list to real proposal query endpoints.

### 1) Keep backend fetch in `dao.js`

`daoRepo` uses an injected fetcher and otherwise returns an empty store.

The app passes `queryNetwork` into `createDaoBackendFetcher(...)`; the repository maps the metadata index and `DaoProposalAccount` payloads into the store shape the UI expects.

### 2) Define backend endpoints / payloads

Known read endpoints:

- `GET /dao/proposals/meta`
- `GET /dao/proposals/:number`

Still needed for later phases:

- Cast vote endpoint/action
- Proposal detail capability data for review, reward, and ready actions

### 3) Wire create + vote to backend

`daoRepo.createProposal(...)` builds the nested proposal transaction, and the Proposal Review modal signs and injects it. Parameter transactions contain exactly one type payload matching `proposalType`, with a nested change set for each action option. Project transactions contain only the contractor address and proposer-supplied milestone terms; runtime fields are populated by later project lifecycle transactions.

For production, cast-vote submission should refresh the proposal or patch vote totals from the server response.

### 4) Loading / errors / pagination

The UI already shows a basic loading empty-state while `daoRepo.refresh()` is running.

For production, consider adding:

- Incremental refresh (don’t blow away list on refresh)
- Better error states (retry button)

### 5) Auth / permissions

The UI derives a `voterId` from the account in memory, but a real backend will likely require:

- Auth headers / signed requests
- Permission checks (who can propose, who can vote)

That should be handled in the backend fetcher or shared network layer.
