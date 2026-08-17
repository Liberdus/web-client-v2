# DAO (Proposals) UI

This document describes the DAO / proposals feature as currently implemented in the web client.

## What’s implemented (current behavior)

### Entry point

- The DAO UI is opened from the main menu ("DAO").

### Modals

1. **DAO Modal**
   - Shows a list of proposals.
   - Includes a **Status filter** for server-provided proposal statuses and their **counts**.
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
     - A required **No change** option plus one or more options with parameter changes
     - A separate type-specific change set for each option
   - The UI validates and renders the nested proposal shape in the review modal, then signs and submits the nested proposal transaction.

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

- The DAO UI requests the complete metadata index whenever the DAO is refreshed; proposal metadata is not persisted.
- Proposal details are not persisted. Status filters fetch fresh details for the visible 10 entries, “Load more” fetches the next 10, and opening a proposal refreshes that proposal again.
- The Claimable filter queries only proposals from the current account's confirmed vote history whose authoritative reward-claim window is currently open. It does not scan every finalized proposal, and it renders a candidate only when fresh details report that it is claimable.
- Account changes and sign-out clear the in-memory proposal details.
- Failed detail fetches are retried the next time their filter page or proposal is opened.

### Account claim candidates

- New accounts initialize an empty `daoUserVotes` map. For existing accounts without the map, the first confirmed vote creates it and adds its proposal number.
- Vote-history changes update `myData` in memory and rely on the normal account save lifecycle; DAO tracking does not trigger an extra save.
- On each DAO metadata refresh, tracked proposals that have entered a final state are refreshed once and updated with the authoritative claim window derived from `votingEndedAt`.
- Repeated confirmed votes on one proposal keep a single stored entry.
- Confirmed reward claims remove their proposal number. Submitted, failed, and timed-out claims leave it available for retry.
- Proposals are hidden until their authoritative claim window opens and after it ends. Expired entries are removed from the account record when claim candidates are evaluated.
- The authoritative saved claim window narrows the account's candidate list. Fresh proposal details must confirm current eligibility before rendering, and the server remains authoritative when a claim is submitted.
- Account backups include this vote history and restore it with the rest of the account data. It does not discover votes that are absent from the restored account record.
- Otherwise ineligible candidates can remain stored until a reward is successfully claimed or the account data is cleared, but fresh details exclude them from the rendered list.

## Backend Data Boundary

- `app.js` registers `setDaoBackendFetcher(createDaoBackendFetcher(queryNetwork))`.
- `dao.js` keeps endpoint querying and backend-to-UI mapping behind the repository boundary.
- Proposal list loading uses:
  - `GET /dao/proposals/meta` on every DAO refresh
  - `GET /dao/proposals/:number` for each entry on the visible filter page
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

`daoRepo.createProposal(...)` builds the nested proposal transaction, and the Proposal Review modal signs and injects it. The transaction contains exactly one type payload matching `proposalType`, with a nested change set for each action option.

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
