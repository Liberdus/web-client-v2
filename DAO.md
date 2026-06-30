# DAO (Proposals) UI

This document describes the DAO / proposals feature as currently implemented in the web client, and what needs to change as live backend endpoints are finalized.

## What’s implemented (current behavior)

### Entry point

- The DAO UI is opened from the main menu ("DAO").

### Modals

1. **DAO Modal**
   - Shows a list of proposals.
   - Includes an **Active / Archived** segmented toggle.
   - Includes a **Status filter** (funnel icon) that filters by proposal status and shows **counts**.
   - The proposal list is filtered by the selected status.
   - List ordering is **newest to enter the selected state first** (sort by `stateEnteredAt` descending, falling back to `createdAt`).
   - Clicking a proposal opens the Proposal Info modal.
   - A floating **“+”** button opens the Add Proposal modal.

2. **Add Proposal Modal**
   - Allows creating a new proposal with:
     - Title
     - Summary
     - Type
     - Type-specific fields (minimal dynamic fields)
   - Proposal creation is present in the UI shell but is not connected to a backend transaction yet.

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

### Archived is a group, not a status

- “Archived” is a **category/group** in the UI (Active vs Archived), not a status.
- Archived proposals keep their underlying status (e.g. `applied`) and can still be filtered by status.
- Auto-archiving rule:
  - Proposals in these statuses are eligible to be auto-archived after 30 days in that state:
    - `withheld`, `rejected`, `accepted`, `applied`

## Data model used by the UI

The UI consumes an in-memory “store” shape:

- `meta`: `{ count, active, archived }`
- `activeProposals`: list of lightweight proposal metadata
- `archivedProposals`: list of lightweight proposal metadata
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

## Where the code lives

- DAO UI implementation: [app.js](app.js)
- In-memory repository abstraction: [dao.repo.js](dao.repo.js)
- Shared constants/helpers (states, type labels, archiving constants): [dao.repo.js](dao.repo.js)

Important implementation detail:

- The DAO UI no longer persists proposals to localStorage.
- On DAO modal open, the UI calls `daoRepo.refresh()` and renders from the in-memory store.

## Backend Data Boundary

- `daoRepo` supports a backend integration hook but does not assume endpoints.
- You will provide:
  - `setDaoBackendFetcher(async () => { ... })`

## What must change for a live backend

This section is the integration checklist for moving from the backend fetcher boundary to real DAO proposal endpoints.

### 1) Implement backend fetch in `dao.repo.js`

Right now, `daoRepo` uses an injected fetcher and otherwise returns an empty store.

You should implement one of these approaches:

- **Approach A (recommended): keep the fetcher injection**
  - In the app bootstrap, call:
    - `setDaoBackendFetcher(async () => fetchAndMapStore())`

- **Approach B: hardcode network calls inside `dao.repo.js`**
  - Not recommended because this app typically keeps network logic centralized.

Either way, the backend response must be mapped into the store shape the UI expects.

### 2) Define backend endpoints / payloads

The repository currently does not guess endpoints. You’ll need to decide:

- List proposals endpoint (likely paginated)
- Single proposal endpoint (optional if the list includes full detail)
- Create proposal endpoint
- Cast vote endpoint

If the backend returns a different model than the UI store shape, add a mapping layer in the fetcher (or a mapper helper).

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

### 4) Decide how “Archived” is represented server-side

The UI rule is “Archived is a group, not a status.”

Options:

- Server only stores status + timestamps; client derives archived group via the 30-day rule.
- Server stores an explicit archived flag / archivedAt; client uses it.

If you choose server-side archiving, update `normalizeDaoStore()` accordingly.

### 5) Loading / errors / pagination

The UI already shows a basic loading empty-state while `daoRepo.refresh()` is running.

For production, consider adding:

- Pagination or infinite scroll for proposals
- Incremental refresh (don’t blow away list on refresh)
- Better error states (retry button)

### 6) Auth / permissions

The UI derives a `voterId` from the account in memory, but a real backend will likely require:

- Auth headers / signed requests
- Permission checks (who can propose, who can vote)

That should be handled in the backend fetcher or shared network layer.
