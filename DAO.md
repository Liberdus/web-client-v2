# DAO (Proposals) UI

This document describes the DAO / proposals feature as currently implemented in the web client.

## What’s implemented (current behavior)

### Entry point

- The DAO UI is opened from the main menu ("DAO").

### Modals

1. **DAO Modal**
   - Shows a list of proposals.
   - Includes a **Status filter** for server-provided proposal statuses and their **counts**.
   - The **All** status filter displays every proposal returned by the server summary.
   - The proposal list is filtered by the selected option.
   - List ordering is **newest to enter the selected state first** (sort by `stateEnteredAt` descending, falling back to `createdAt`).
   - Clicking a proposal opens the Proposal Info modal.
   - A floating **“+”** button opens the Add Proposal modal.

2. **Add Proposal Modal**
   - Allows creating a new proposal with:
     - Title
     - Summary
     - Type
     - A required **No change** option plus one or more options with parameter changes
     - A separate type-specific change set for each option
   - The UI validates and previews the nested proposal shape. Submission remains unavailable until the nested transaction payload is wired.

3. **Proposal Info Modal**
   - Displays proposal:
     - Number (e.g. `Proposal #12`)
     - Title
     - Type label
     - State + timestamp + created-by
     - Summary
     - Type-specific fields
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
- In-memory repository abstraction: [dao.repo.js](dao.repo.js)
- Shared constants/helpers (states and type labels): [dao.repo.js](dao.repo.js)

Important implementation detail:

- The DAO UI no longer persists proposals to localStorage.
- On DAO modal open, the UI calls `daoRepo.refresh()` and renders from the in-memory store.

## Backend Data Boundary

- `app.js` registers `setDaoBackendFetcher(createDaoBackendFetcher(queryNetwork))`.
- `dao.repo.js` keeps endpoint querying and backend-to-UI mapping behind the repository boundary.
- Proposal list loading uses the current server DAO query shape:
  - `GET /dao/proposals/summary` for the recent-activity index and total count
  - `GET /dao/proposals/:number` for each indexed proposal's details
- The fetcher skips an unavailable detail response so it does not block the remaining indexed proposals from rendering.

## What must change for a live backend

This section is the remaining integration checklist after moving the DAO list to real proposal query endpoints.

### 1) Keep backend fetch in `dao.repo.js`

`daoRepo` uses an injected fetcher and otherwise returns an empty store.

The app passes `queryNetwork` into `createDaoBackendFetcher(...)`; the repository maps the summary index and `DaoProposalAccount` payloads into the store shape the UI expects.

### 2) Define backend endpoints / payloads

Known read endpoints:

- `GET /dao/proposals/summary`
- `GET /dao/proposals/:number`

Still needed for later phases:

- Create proposal endpoint/action
- Cast vote endpoint/action
- Proposal detail capability data for review, reward, and ready actions

### 3) Wire create + vote to backend

Currently these operations are placeholders until their backend transactions are wired:

- `daoRepo.createProposal(...)`
- `daoRepo.castVote(...)`

For production you likely want:

- `createProposal` to POST to backend and then either:
  - refresh the store, or
  - insert the created proposal returned by the backend.

- `castVote` to POST to backend and then either:
  - refresh the proposal, or
  - patch the vote totals from server response.

### 4) Loading / errors / pagination

The UI already shows a basic loading empty-state while `daoRepo.refresh()` is running.

For production, consider adding:

- Pagination or infinite scroll for proposals
- Incremental refresh (don’t blow away list on refresh)
- Better error states (retry button)

### 5) Auth / permissions

The UI derives a `voterId` from the account in memory, but a real backend will likely require:

- Auth headers / signed requests
- Permission checks (who can propose, who can vote)

That should be handled in the backend fetcher or shared network layer.
