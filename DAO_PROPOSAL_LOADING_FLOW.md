# DAO Proposal Loading Flow

This branch uses the complete proposal metadata index to filter and paginate DAO proposals. It loads full proposal accounts only for the visible page.

## Endpoints

| Endpoint | Use |
| --- | --- |
| `GET /dao/proposals/meta` | Complete proposal index and total count. |
| `GET /dao/proposals/:number` | Full account for one proposal. |

A metadata entry contains the proposal number, status, emergency flag, and status-change timestamp. That is enough to determine counts, filter membership, and ordering. Titles, options, votes, rewards, and claim data require the full proposal account.

## Main flow

The client follows the same flow whenever the DAO is opened or refreshed:

1. Request `/dao/proposals/meta`.
2. Filter the metadata locally. Voting is the default filter.
3. Request full accounts for the first 10 matching proposals.
4. Render those proposals in metadata order.

```text
GET /meta -> filter metadata -> GET first 10 /:number accounts -> render
```

Always requesting `/meta` means new proposals and status transitions appear on the next refresh without a summary comparison or cache-invalidation flow. Metadata and proposal details stay in memory and are not persisted.

## Filters and pagination

All regular filters use the same behavior:

- selecting a filter requests its first 10 proposal accounts;
- Load more requests and appends the next 10;
- returning to a filter requests fresh details again.

Selecting a row also requests that proposal again before opening it, so the Proposal Info modal receives current review, voting, and reward data.

## Claimable

Claimable is intentionally deferred in this branch. Selecting it makes no proposal-detail requests and displays no proposals.

Metadata cannot establish claimability because it lacks the voter list, claim list, reward pool, and claim window. [Issue #1571](https://github.com/Liberdus/web-client-v2/issues/1571) will track proposals voted on by the current account and query only those candidates.

## Transaction settlement

After a DAO transaction settles, the client refreshes `/meta`, reloads the open filter's first page, and refreshes the affected proposal when needed by the Proposal Info modal.

## Code map

### `dao.js`

| Function | Change |
| --- | --- |
| `normalizeDaoProposalMetadataEntry` | Renamed and updated the former summary-entry normalizer for the `/meta` shape. |
| `normalizeDaoProposalIndexEntries` | Normalizes and removes invalid entries at the network boundary. |
| `fetchDaoProposalMeta` | Queries `/meta` and returns the normalized count and complete index. |
| `mapBackendProposalToStoreProposal` | Overlays authoritative metadata status, emergency flag, and transition timestamp onto a full proposal account. |
| `mapBackendProposals` | Converts fetched proposal accounts into the repository's ID-keyed proposal map. |
| `fetchBackendProposal` | Queries one `/dao/proposals/:number` account and skips unavailable responses. |
| `createDaoBackendFetcher` | Now exposes separate `fetchMeta` and `fetchProposals` operations instead of loading the entire list at once. |
| `setDaoBackendFetcher` | Accepts and validates that two-operation fetcher. |
| `refreshInternal` | Refreshes metadata and clears previously loaded proposal details. |
| `daoRepo.reset` | Clears DAO memory and prevents an older metadata request from restoring stale state. |
| `daoRepo.loadProposalEntries` | Replaces or appends one page of freshly queried proposal details. |
| `daoRepo.refreshProposal` | Requeries one proposal before it is opened or after a transaction settles. |
| `daoRepo.getProposalMetaForUi` | Exposes normalized metadata for counts, filters, ordering, and pagination. |

The unused `isDaoProposalClaimable` and `daoRepo.isReady` helpers were removed. Claim status for an opened proposal still uses `getDaoRewardClaimStatus`.

### `app.js`

| Function | Change |
| --- | --- |
| `clearMyData` | Also resets in-memory DAO state when the account is cleared. |
| `DaoModal.getSelectedMetadataEntries` | Filters metadata by status and returns no entries for deferred Claimable behavior. |
| `DaoModal.loadSelectedFilter` | Loads the first or next 10 details while guarding against superseded requests. |
| `DaoModal.loadMore` | Advances pagination and appends the next page. |
| `DaoModal.refreshAfterDaoSettlement` | Refreshes metadata, the visible page, and the affected proposal as needed. |
| `DaoModal.setFilter` | Resets pagination and fetches fresh details for the selected filter. |
| `DaoModal.render` | Uses metadata for counts, membership, ordering, and Load more visibility. |
| `DaoModal.openProposal` | Fetches fresh proposal details before opening the Proposal Info modal. |

`index.html` adds the Load more button. `styles.css` keeps that button in the scrollable DAO list while preserving space for the floating Add button.

## Limitations

- Claimable proposals are not listed yet.
- Changes that do not update metadata, such as below-threshold unapply activity, appear only when that proposal is queried directly.
- Proposal details are retained for the currently loaded page but are queried again when returning to a filter; there is no persistent or cross-filter detail cache.
